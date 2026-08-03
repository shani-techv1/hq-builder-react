/**
 * The editor's side of the Canva integration.
 *
 * The browser holds the Canva access token and presents it on every request;
 * the service forwards it and keeps nothing. That is what makes the connection
 * belong to one person — a token held on the server would be a single token
 * for everybody, and two people using the editor at once would end up sharing
 * whichever account signed in last.
 *
 * The client *secret* is still server-side. Only the short-lived, read-only
 * access token ever reaches the browser.
 *
 * The one thing worth knowing about the shapes below: a project's `thumbnail`
 * is Canva's small preview and exists only to fill the picker grid. What gets
 * placed on the sheet is the full-resolution export from {@link importProject},
 * which is a different image entirely.
 */

/**
 * Where the Canva service is listening. Overridable per environment.
 *
 * The loopback IP rather than `localhost`, and not interchangeably: Canva
 * refuses `localhost` in redirect URLs, so the popup ends up on `127.0.0.1`
 * whatever it was opened with. Since the origin check below compares against
 * this value, opening the popup anywhere else would mean rejecting the very
 * message the flow exists to deliver.
 */
export const CANVA_API_URL =
  process.env.NEXT_PUBLIC_CANVA_API_URL ?? "http://127.0.0.1:5055";

/** Origin the OAuth popup posts its result from, for verifying the message. */
export const CANVA_API_ORIGIN = (() => {
  try {
    return new URL(CANVA_API_URL).origin;
  } catch {
    return CANVA_API_URL;
  }
})();

export interface CanvaProject {
  id: string;
  title: string;
  /** Small preview for the grid. Never placed on the sheet. */
  thumbnail: string | null;
  updatedAt: string | null;
}

export interface CanvaProjectPage {
  projects: CanvaProject[];
  nextCursor: string | null;
}

/* -------------------------------- The token ------------------------------- */

/**
 * `sessionStorage`, not `localStorage`.
 *
 * The token expires in a few hours anyway, so surviving a browser restart buys
 * very little — and this keeps it out of storage the moment the tab closes,
 * which is the smallest exposure window available without a server session.
 */
const STORAGE_KEY = "design-builder:canva";

export interface CanvaSession {
  accessToken: string;
  /** ISO timestamp, or `null` when Canva did not say. */
  expiresAt: string | null;
  scopes: string[];
}

/** Treat a token as expired slightly early, so it can't die mid-export. */
const EXPIRY_MARGIN_MS = 30_000;

/* The session is an external store, so React can subscribe to it directly. */
const listeners = new Set<() => void>();

/** Cached so the snapshot is referentially stable between changes. */
let snapshot: CanvaSession | null | undefined;

function announce(): void {
  snapshot = undefined;
  for (const listener of listeners) listener();
}

export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);

  // Another tab signing out should not leave this one thinking it is still
  // connected — though with `sessionStorage` that only fires for duplicates
  // of this tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) announce();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSessionSnapshot(): CanvaSession | null {
  if (snapshot === undefined) snapshot = readSession();
  return snapshot;
}

/** Nothing is stored during a server render, so there is no connection. */
export const getServerSessionSnapshot = (): CanvaSession | null => null;

/** The stored session, or `null` if there isn't a usable one. */
function readSession(): CanvaSession | null {
  if (typeof window === "undefined") return null;

  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked outright; that just means "not connected".
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { accessToken, expiresAt, scopes } = parsed as Partial<CanvaSession>;
    if (typeof accessToken !== "string" || !accessToken) return null;

    // Dropped rather than returned and refused upstream, so an expired token
    // and no token look the same to everything above.
    if (typeof expiresAt === "string") {
      const deadline = new Date(expiresAt).getTime();
      if (Number.isFinite(deadline) && Date.now() > deadline - EXPIRY_MARGIN_MS) {
        // Removed directly rather than through `clearSession`, which would
        // notify subscribers from inside the snapshot they are reading.
        try {
          window.sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          // Nothing more to do; the value is unusable either way.
        }
        return null;
      }
    }

    return {
      accessToken,
      expiresAt: typeof expiresAt === "string" ? expiresAt : null,
      scopes: Array.isArray(scopes) ? scopes.filter((s) => typeof s === "string") : [],
    };
  } catch {
    return null;
  }
}

export function writeSession(session: CanvaSession): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Nothing to do — the connection simply won't survive a refresh.
  }
  announce();
}

export function clearSession(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Already gone, as far as anything here can tell.
  }
  announce();
}

/* -------------------------------- Requests -------------------------------- */

/**
 * A failure the UI can act on.
 *
 * `code` is what matters: a disconnected account needs a "Connect" button, not
 * an error message, and the two are told apart by this rather than by reading
 * the prose.
 */
export class CanvaError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CanvaError";
    this.code = code;
  }

  /** True when the remedy is signing in again rather than retrying. */
  get needsConnection(): boolean {
    return this.code === "NOT_CONNECTED" || this.code === "SESSION_EXPIRED";
  }
}

/** Pull `{ success, message, code }` out of a failed response. */
async function toError(response: Response): Promise<CanvaError> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "message" in body) {
      const { message, code } = body as { message?: unknown; code?: unknown };
      return new CanvaError(
        typeof code === "string" ? code : "REQUEST_FAILED",
        typeof message === "string" ? message : "Something went wrong.",
      );
    }
  } catch {
    // Not JSON — fall through to the generic message below.
  }
  return new CanvaError("REQUEST_FAILED", "Canva could not be reached.");
}

/**
 * The token travels in a header, never in the URL.
 *
 * Query strings end up in server access logs, in `Referer` headers and in
 * browser history. Headers also survive being embedded in an iframe, where
 * cookies do not.
 */
function authHeaders(): HeadersInit {
  const session = getSessionSnapshot();
  if (!session) {
    throw new CanvaError("NOT_CONNECTED", "Connect your Canva account to continue.");
  }
  return { Authorization: `Bearer ${session.accessToken}` };
}

const offline = () =>
  new CanvaError(
    "OFFLINE",
    "The Canva service isn’t running. Start it and try again.",
  );

export async function listProjects(
  cursor?: string,
  signal?: AbortSignal,
): Promise<CanvaProjectPage> {
  const path = `/api/canva/projects${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;

  let response: Response;
  try {
    response = await fetch(`${CANVA_API_URL}${path}`, {
      headers: authHeaders(),
      signal,
    });
  } catch (error) {
    if (error instanceof CanvaError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw offline();
  }

  if (!response.ok) throw await toError(response);

  const body = (await response.json()) as { data: CanvaProjectPage };
  return body.data;
}

/**
 * Export a design and return it as a file the upload pipeline accepts.
 *
 * This is the whole integration: once the PNG is a `File`, it goes through the
 * same path as a dragged-in image, so an imported design gets its thumbnail,
 * dimensions, transparency and place in the draft with no special handling.
 *
 * Expect seconds rather than milliseconds — Canva renders exports as a job.
 */
export async function importProject(projectId: string): Promise<File> {
  let response: Response;
  try {
    response = await fetch(`${CANVA_API_URL}/api/canva/import`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
  } catch (error) {
    if (error instanceof CanvaError) throw error;
    throw offline();
  }

  if (!response.ok) throw await toError(response);

  const blob = await response.blob();
  const title = decodeURIComponent(
    response.headers.get("X-Design-Title") ?? "Canva design",
  );

  // Named for the design so the asset reads as its project in the library,
  // and typed explicitly because the upload validator checks the MIME type.
  return new File([blob], `${title}.png`, { type: "image/png" });
}

/* --------------------------------- OAuth --------------------------------- */

/** What the popup posts back when the flow finishes. */
export interface CanvaConnectMessage {
  source: "canva-connect";
  connected: boolean;
  message: string;
  accessToken?: string;
  expiresAt?: string | null;
  scopes?: string[];
}

export function isConnectMessage(value: unknown): value is CanvaConnectMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { source?: unknown }).source === "canva-connect"
  );
}

/**
 * Open Canva's consent screen in a popup.
 *
 * A popup rather than a redirect because a redirect unmounts the editor. The
 * design would survive — drafts are recovered — but the user would come back
 * to a recovery prompt in the middle of signing in.
 *
 * The window's own origin is passed along so the service knows where to send
 * the token, and checks it against its allow-list before doing so.
 */
export function openConnectPopup(): Window | null {
  const width = 600;
  const height = 760;
  // Centred on the window the user is actually looking at, which is not
  // necessarily the primary display.
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const url = `${CANVA_API_URL}/api/canva/login?origin=${encodeURIComponent(
    window.location.origin,
  )}`;

  return window.open(
    url,
    "canva-connect",
    `width=${width},height=${height},left=${Math.max(0, left)},top=${Math.max(0, top)}`,
  );
}
