/**
 * The editor's side of the Canva integration.
 *
 * Several Canva accounts can be connected at once, and the tokens for all of
 * them stay on the server. What the browser holds is an **app session id** —
 * an opaque handle to the set of accounts it has connected — plus which of
 * those accounts is currently selected. Neither is a Canva credential.
 *
 * That split is what makes multiple accounts possible. A Canva token is a
 * single value with a single place to live, so a second one overwrote the
 * first; a session id addresses a list the server can extend indefinitely.
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
 *
 * Two ways in, because this module is built twice. The standalone Next app
 * inlines `NEXT_PUBLIC_CANVA_API_URL` at build time; the storefront bundle is
 * built by Vite, which does no such thing, and is served to whichever shop
 * loads it — so there the value is injected by the page instead, and the same
 * bundle works for every deployment.
 *
 * Read at module scope deliberately: the page sets the global in a classic
 * `<script>`, and a module script is deferred behind those, so it is always
 * there by the time this runs.
 */
function resolveApiUrl(): string {
  const injected =
    typeof window === "undefined"
      ? undefined
      : (window as unknown as Record<string, unknown>).__CANVA_API_URL__;
  if (typeof injected === "string" && injected) return injected;

  const fromEnv = process.env.NEXT_PUBLIC_CANVA_API_URL;
  if (typeof fromEnv === "string" && fromEnv) return fromEnv;

  return "http://127.0.0.1:5055";
}

export const CANVA_API_URL = resolveApiUrl();

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

/** Whether an account can be used, or needs the user to reconnect it. */
export type CanvaAccountStatus = "connected" | "expired";

/**
 * One connected Canva account, as the server describes it.
 *
 * Everything here is safe to render. There is no token field, because there is
 * no token on this side any more.
 */
export interface CanvaAccount {
  /** The server's id for the connection. What everything selects by. */
  id: string;
  /** Canva's own id. Stable, and what the server dedupes reconnects against. */
  canvaUserId: string;
  teamId: string;
  /** `null` unless the app was granted `profile:read`. Never guessed. */
  displayName: string | null;
  connectedAt: string;
  status: CanvaAccountStatus;
  scopes: string[];
}

/**
 * What to call an account on screen.
 *
 * Canva only returns a display name when the integration holds `profile:read`,
 * which this one does not request by default — so the fallback has to be
 * genuinely usable rather than a placeholder. A short slice of Canva's own
 * account id is enough to tell two connected accounts apart, which is all the
 * label has to do.
 */
export function accountLabel(account: CanvaAccount): string {
  if (account.displayName) return account.displayName;
  return `Canva account ${account.canvaUserId.slice(-6)}`;
}

/* ------------------------------- The session ------------------------------ */

/**
 * `localStorage`, where the token used to be in `sessionStorage`.
 *
 * The trade has changed. This key no longer holds a Canva credential — only a
 * handle to server-side connections — while the thing it buys is much larger:
 * connecting three accounts is setup, and setup that evaporates when the tab
 * closes is setup nobody does twice.
 *
 * A new key rather than the old one, so the upgrade cannot read a stored Canva
 * token as a session id. The old key is deleted on sight, which takes a real
 * access token out of browser storage.
 */
const STORAGE_KEY = "design-builder:canva:v2";
const LEGACY_STORAGE_KEY = "design-builder:canva";

export interface CanvaStore {
  /** Opaque handle to the connected accounts. `null` before the first connect. */
  sessionId: string | null;
  /** Which account the panel is showing. `null` falls back to the first. */
  selectedAccountId: string | null;
}

const EMPTY_STORE: CanvaStore = { sessionId: null, selectedAccountId: null };

/* The store is external to React, so components subscribe to it directly. */
const listeners = new Set<() => void>();

/** Cached so the snapshot is referentially stable between changes. */
let snapshot: CanvaStore | undefined;

function announce(): void {
  snapshot = undefined;
  for (const listener of listeners) listener();
}

export function subscribeToStore(listener: () => void): () => void {
  listeners.add(listener);

  // Another tab disconnecting should not leave this one pointing at accounts
  // that are gone. With `localStorage` this fires across every tab, which it
  // did not when the value was per-tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) announce();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getStoreSnapshot(): CanvaStore {
  if (snapshot === undefined) snapshot = readStore();
  return snapshot;
}

/** Nothing is stored during a server render, so nothing is connected. */
export const getServerStoreSnapshot = (): CanvaStore => EMPTY_STORE;

function readStore(): CanvaStore {
  if (typeof window === "undefined") return EMPTY_STORE;

  try {
    // Left over from the single-account version, where it held a live Canva
    // access token. Nothing reads it any more, so it is cleared rather than
    // left sitting in storage.
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage can be blocked outright; there is nothing to clean up if so.
  }

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY_STORE;
  }
  if (!raw) return EMPTY_STORE;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY_STORE;

    const { sessionId, selectedAccountId } = parsed as Partial<CanvaStore>;
    return {
      sessionId: typeof sessionId === "string" && sessionId ? sessionId : null,
      selectedAccountId:
        typeof selectedAccountId === "string" && selectedAccountId
          ? selectedAccountId
          : null,
    };
  } catch {
    return EMPTY_STORE;
  }
}

function writeStore(next: CanvaStore): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Nothing to do — the connection simply won't survive a refresh.
  }
  announce();
}

export function setSessionId(sessionId: string): void {
  const current = getStoreSnapshot();
  if (current.sessionId === sessionId) return;

  // A different session knows nothing about the previous selection.
  writeStore({ sessionId, selectedAccountId: null });
}

export function setSelectedAccountId(selectedAccountId: string | null): void {
  writeStore({ ...getStoreSnapshot(), selectedAccountId });
}

/** Forget the session entirely — every account with it. */
export function clearStore(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Already gone, as far as anything here can tell.
  }
  announce();
}

/* -------------------------------- Requests -------------------------------- */

/**
 * A failure the UI can act on.
 *
 * `code` is what matters, and now carries a distinction that did not exist
 * before: whether the problem is the whole session or one account of several.
 */
export class CanvaError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CanvaError";
    this.code = code;
  }

  /** The session is gone. Everything must be connected again. */
  get needsSession(): boolean {
    return this.code === "NOT_CONNECTED" || this.code === "SESSION_EXPIRED";
  }

  /** One account lapsed. The others are fine and must be left alone. */
  get needsAccount(): boolean {
    return this.code === "ACCOUNT_EXPIRED" || this.code === "ACCOUNT_NOT_FOUND";
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
 * The session id travels in a header, never in the URL.
 *
 * Query strings end up in server access logs, in `Referer` headers and in
 * browser history. Headers also survive being embedded in an iframe, where
 * cookies do not — which is why this is a bearer rather than a cookie now that
 * there is server-side state to address.
 */
function authHeaders(): HeadersInit {
  const { sessionId } = getStoreSnapshot();
  if (!sessionId) {
    throw new CanvaError("NOT_CONNECTED", "Connect your Canva account to continue.");
  }
  return { Authorization: `Bearer ${sessionId}` };
}

const offline = () =>
  new CanvaError(
    "OFFLINE",
    "The Canva service isn’t running. Start it and try again.",
  );

/** Every call goes through here, so failures look the same wherever they start. */
async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${CANVA_API_URL}${path}`, init);
  } catch (error) {
    if (error instanceof CanvaError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw offline();
  }

  if (!response.ok) throw await toError(response);
  return response;
}

/* -------------------------------- Accounts -------------------------------- */

/** Every account connected to this session. */
export async function fetchAccounts(
  signal?: AbortSignal,
): Promise<CanvaAccount[]> {
  const response = await request("/api/canva/accounts", {
    headers: authHeaders(),
    signal,
  });
  const body = (await response.json()) as { data: { accounts: CanvaAccount[] } };
  return body.data.accounts;
}

/**
 * Disconnect one account, and get back the ones that remain.
 *
 * The remaining list comes from the server rather than being filtered locally,
 * so the panel cannot drift from what is actually connected.
 */
export async function disconnectAccount(
  accountId: string,
): Promise<CanvaAccount[]> {
  const response = await request(
    `/api/canva/accounts/${encodeURIComponent(accountId)}`,
    { method: "DELETE", headers: authHeaders() },
  );
  const body = (await response.json()) as { data: { accounts: CanvaAccount[] } };
  return body.data.accounts;
}

/* -------------------------------- Projects -------------------------------- */

export async function listProjects(
  accountId: string,
  cursor?: string,
  signal?: AbortSignal,
): Promise<CanvaProjectPage> {
  const query = new URLSearchParams({ accountId });
  if (cursor) query.set("cursor", cursor);

  const response = await request(`/api/canva/projects?${query.toString()}`, {
    headers: authHeaders(),
    signal,
  });

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
export async function importProject(
  accountId: string,
  projectId: string,
): Promise<File> {
  const response = await request("/api/canva/import", {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, projectId }),
  });

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
  sessionId?: string;
  account?: CanvaAccount;
}

export function isConnectMessage(value: unknown): value is CanvaConnectMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { source?: unknown }).source === "canva-connect"
  );
}

/**
 * Ask the service to begin a connection.
 *
 * Two steps rather than one because this is the only point where the browser
 * can say which session the new account belongs to — `window.open` cannot set a
 * header, and Canva's redirect back is a plain navigation. Without it the
 * server would have to guess, and guessing is what made this single-account.
 *
 * Sends the current session when there is one, so the account joins the others;
 * the server issues a new session when there is not.
 */
export async function startConnect(): Promise<{
  sessionId: string;
  authorizeUrl: string;
}> {
  const { sessionId } = getStoreSnapshot();

  const response = await request("/api/canva/accounts/connect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionId ? { Authorization: `Bearer ${sessionId}` } : {}),
    },
    body: JSON.stringify({ origin: window.location.origin }),
  });

  const body = (await response.json()) as {
    data: { sessionId: string; authorizeUrl: string };
  };
  return body.data;
}

/**
 * Open Canva's consent screen in a popup.
 *
 * A popup rather than a redirect because a redirect unmounts the editor. The
 * design would survive — drafts are recovered — but the user would come back
 * to a recovery prompt in the middle of signing in.
 *
 * The window name is fixed, which is deliberate: a second click while a flow is
 * already open reuses that window instead of starting a competing one.
 */
export function openConnectPopup(authorizeUrl: string): Window | null {
  const width = 600;
  const height = 760;
  // Centred on the window the user is actually looking at, which is not
  // necessarily the primary display.
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  return window.open(
    authorizeUrl,
    "canva-connect",
    `width=${width},height=${height},left=${Math.max(0, left)},top=${Math.max(0, top)}`,
  );
}
