/**
 * Accounts: signing in with an emailed code, and remembering who is signed in.
 *
 * There are no passwords. `/api/auth/request-otp` emails a code to the address,
 * and `/api/auth/verify-otp` exchanges it for a session. Creating an account is
 * the same two steps with a name added to the first: an address the service
 * doesn't know is refused with a 404 until a name comes with it, which is the
 * signal that turns "Sign in" into "Create your account".
 *
 * Signing in gives back a user record and a signed token, and there is no
 * endpoint that answers "who am I". The user personalises the editor; the token
 * is what the service asks for before it hands over the account's saved
 * designs and graphics, and it authorises nothing else. It is kept in the store
 * below and leaves only through {@link authorizedRequest}. A session remembered
 * from before the service issued tokens has none, and the account's saved work
 * asks for a fresh sign-in rather than failing.
 *
 * A code is never stored. It goes into the one request that needs it and is
 * not written to storage, kept in the session, or logged.
 *
 * On what the checks here are and aren't. Everything below is defence in depth
 * for *this browser*: it keeps the editor from sending a credential over a
 * cleartext connection, from rendering a hostile string, from hammering the
 * service, and from trusting its own storage. None of it is a security control
 * for the service, because anything running in a browser can be bypassed by not
 * using the browser. The service's own limits — a handful of guesses per code,
 * and a wait between codes — are what actually protect the accounts.
 */

/**
 * Where the account service is listening. Overridable per environment.
 *
 * Two ways in, because this module is built twice — the same split `lib/canva`
 * documents. The standalone Next app inlines `NEXT_PUBLIC_AUTH_API_URL` at
 * build time; the storefront bundle is built by Vite, which does no such thing,
 * so there the page injects `__AUTH_API_URL__` instead and one bundle serves
 * every deployment.
 *
 * An origin *and* a base path, unlike the Canva URL: the deployed service lives
 * under `/backend`, and `/api/...` is appended to whatever this resolves to.
 */
function resolveApiUrl(): string {
  const injected =
    typeof window === "undefined"
      ? undefined
      : (window as unknown as Record<string, unknown>).__AUTH_API_URL__;
  if (typeof injected === "string" && injected) return injected;

  const fromEnv = process.env.NEXT_PUBLIC_AUTH_API_URL;
  if (typeof fromEnv === "string" && fromEnv) return fromEnv;

  return "https://highquality.allgovjobs.com/backend";
}

/** Trailing slashes are stripped, so a configured value can carry one safely. */
export const AUTH_API_URL = resolveApiUrl().replace(/\/+$/, "");

/** A signed-in person, as the service describes them. */
export interface AccountUser {
  id: string;
  name: string;
  email: string;
}

/** What a successful sign-in establishes. */
export interface SignedIn {
  user: AccountUser;
  /** `null` when the service issued none — it only does once it is configured to. */
  token: string | null;
}

/**
 * Who a code is for. `name` is only needed to create an account, and is
 * ignored for an address that already has one.
 */
export interface CodeRequest {
  email: string;
  name?: string;
}

/** The code from the email, against the address it was sent to. */
export interface OtpSubmission {
  email: string;
  otp: string;
}

/* ------------------------------ Text hygiene ------------------------------ */

/**
 * Characters that have no business in a name or an address.
 *
 * C0/C1 controls, the bidirectional overrides and the zero-width characters.
 * Not an XSS defence — React escapes what it renders — but a spoofing one: a
 * right-to-left override inside a display name can make one string read on
 * screen as an entirely different one, and a zero-width space can make two
 * accounts indistinguishable.
 */
const UNSAFE_CHARACTERS =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** The same class without `g`, because a global regex is stateful in `test`. */
const HAS_UNSAFE_CHARACTER = new RegExp(UNSAFE_CHARACTERS.source);

const hasUnsafeCharacters = (value: string) => HAS_UNSAFE_CHARACTER.test(value);

/** Strip what can't be displayed safely, and cap what's left. */
const clean = (value: string, limit: number) =>
  value.replace(UNSAFE_CHARACTERS, "").trim().slice(0, limit);

/* -------------------------------- Requests -------------------------------- */

/**
 * Why a request failed.
 *
 * Mostly derived from the status, because the service sends a human-readable
 * `error` string and no machine-readable code. The message is what the form
 * shows; the code is for callers that need to tell "wrong code" from "the
 * service is down" without matching on prose.
 */
export type AuthErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CREDENTIALS"
  /** The code was wrong, already used, or has expired. */
  | "INVALID_OTP"
  /** No account under that address — one needs a name to be created. */
  | "ACCOUNT_NOT_FOUND"
  /** The saved design isn't there: deleted, or never this account's. */
  | "NOT_FOUND"
  /** No token, or one the service refused — signing in again fixes it. */
  | "SESSION_EXPIRED"
  | "INSECURE_ENDPOINT"
  | "TOO_MANY_ATTEMPTS"
  | "TIMEOUT"
  | "OFFLINE"
  | "REQUEST_FAILED";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Long enough for a slow service, short enough that a hung one gives up. */
const REQUEST_TIMEOUT_MS = 15_000;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Sent as a bearer token. Only {@link authorizedRequest} passes one. */
  token?: string;
  timeoutMs?: number;
}

/** Where an unencrypted connection is a development detail, not a leak. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Refuse to put a sign-in code or a session token on the wire in cleartext.
 *
 * A misconfigured `NEXT_PUBLIC_AUTH_API_URL` — or an injected
 * `__AUTH_API_URL__` on a page that has already been tampered with — is the
 * realistic way this app would end up posting credentials over plain HTTP.
 * Failing loudly at that point is the only moment it can still be prevented;
 * once the request is sent, it has been read. Loopback is exempt because
 * nothing leaves the machine.
 */
function assertSecureEndpoint(): void {
  let url: URL;
  try {
    url = new URL(AUTH_API_URL);
  } catch {
    throw new AuthError(
      "REQUEST_FAILED",
      "The account service address isn’t a valid URL.",
    );
  }

  if (url.protocol === "https:") return;
  if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) return;

  throw new AuthError(
    "INSECURE_ENDPOINT",
    "Signing in is disabled because the account service isn’t using a secure (HTTPS) connection.",
  );
}

function codeFor(status: number): AuthErrorCode {
  if (status === 401 || status === 403) return "INVALID_CREDENTIALS";
  if (status === 404) return "ACCOUNT_NOT_FOUND";
  // Too many wrong codes, or a new code asked for too soon.
  if (status === 429) return "TOO_MANY_ATTEMPTS";
  // Everything else the service rejects — a malformed email, a list that is
  // full — comes back as a 400 or 409 with the reason in `error`.
  if (status === 400 || status === 409 || status === 422) return "INVALID_INPUT";
  return "REQUEST_FAILED";
}

/**
 * A rejected code, told apart from a malformed request.
 *
 * The service answers both with a 400 and prose. The difference matters —
 * a wrong code is a guess and counts towards the local brake, a missing field
 * is a bug here — and the fields are validated before the request is sent, so
 * a 400 from the verify endpoint is a rejected code by elimination.
 */
const codeForVerify = (status: number): AuthErrorCode =>
  status === 400 ? "INVALID_OTP" : codeFor(status);

/**
 * The service's own wording for a failure, when it sent one.
 *
 * Cleaned and capped like any other field: it is rendered, and it comes from
 * somewhere this app does not control.
 */
function messageFrom(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const { error, message } = payload;
  const text = typeof error === "string" && error ? error : message;
  if (typeof text !== "string" || !text) return null;
  return clean(text, 200) || null;
}

/**
 * Rebuild the user field by field rather than casting.
 *
 * This is a response from a service the editor does not control, and it ends up
 * rendered and written to storage — so anything it cannot vouch for is refused,
 * and what it keeps is cleaned and bounded. The same reader validates what
 * comes back out of `localStorage`, which any script on this origin can write.
 */
function readUser(value: unknown): AccountUser | null {
  if (!isRecord(value)) return null;

  const { id, name, email } = value;
  if (typeof id !== "string" || typeof email !== "string") return null;

  const safeId = clean(id, 128);
  const safeEmail = clean(email, MAX_EMAIL_LENGTH);
  if (!safeId || !safeEmail) return null;

  return {
    id: safeId,
    email: safeEmail,
    name: typeof name === "string" ? clean(name, MAX_NAME_LENGTH) : "",
  };
}

/**
 * Every endpoint in one shape: post JSON, get an envelope or a reason back.
 *
 * The envelope is returned rather than a user, because only verifying a code
 * describes one — asking for a code answers with a message and nothing else,
 * and a caller that needs a user says so by reading one out with
 * {@link userFrom}.
 *
 * Only `Content-Type` is sent, plus `Authorization` on an
 * {@link authorizedRequest}. The service's CORS policy allows those two
 * headers alone, so anything else would fail the preflight rather than the
 * request. The rest of the options are about what must *not* travel: no
 * ambient cookies, no `Referer` disclosing which design the user was editing,
 * and no cached copy of an authentication response left in the browser's store.
 */
async function request(
  path: string,
  body: unknown,
  statusCode: (status: number) => AuthErrorCode = codeFor,
  { method = "POST", token, timeoutMs = REQUEST_TIMEOUT_MS }: RequestOptions = {},
): Promise<Record<string, unknown>> {
  assertSecureEndpoint();

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${AUTH_API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    // A timeout is a different thing to tell someone than "you're offline" —
    // one is worth retrying immediately, the other isn't.
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      throw new AuthError(
        "TIMEOUT",
        "The account service took too long to respond. Try again in a moment.",
      );
    }
    throw new AuthError(
      "OFFLINE",
      "We couldn’t reach the account service. Check your connection and try again.",
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Not JSON. `payload` stays null and the checks below report it as failed.
  }

  // `success` is checked as well as the status, so a 200 carrying a failure
  // envelope cannot be read as a signed-in user.
  if (!response.ok || !isRecord(payload) || payload.success !== true) {
    throw new AuthError(
      statusCode(response.status),
      messageFrom(payload) ?? "Something went wrong. Please try again.",
    );
  }

  return payload;
}

/**
 * The user in a response, wherever the endpoint chose to put it.
 *
 * The verify endpoint nests it under `data`, beside the token. The other two
 * shapes cost a line each and keep a service that moves it from being read as
 * a failed sign-in.
 */
function userFrom(payload: Record<string, unknown>): AccountUser | null {
  const { data } = payload;
  if (isRecord(data)) {
    const nested = readUser(data.user);
    if (nested) return nested;
  }
  return readUser(data) ?? readUser(payload.user);
}

/**
 * The service's signed token: two base64url segments joined by a dot.
 *
 * Checked for shape only. What it says is the service's business, and whether
 * it is still good is found out by using it. The shape check is what keeps
 * anything else — from the response, or from storage — out of a header.
 */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_TOKEN_LENGTH = 1024;

function readToken(value: unknown): string | null {
  return typeof value === "string" &&
    value.length <= MAX_TOKEN_LENGTH &&
    TOKEN_PATTERN.test(value)
    ? value
    : null;
}

/** The user and token in a response, or `null` when it describes no user. */
function signedInFrom(payload: Record<string, unknown>): SignedIn | null {
  const user = userFrom(payload);
  if (!user) return null;
  const { data } = payload;
  return { user, token: readToken(isRecord(data) ? data.token : undefined) };
}

/**
 * Have a sign-in code emailed to the address.
 *
 * Also how an account is made: with a name, an address the service doesn't
 * know becomes an account awaiting its first code. Without one, that address
 * is refused with `ACCOUNT_NOT_FOUND`. Asking again sends a fresh code and
 * voids the last, so this doubles as "send a new code".
 *
 * Fields are trimmed and bounded on the way out, so this client is never the
 * thing that sends the service something unbounded.
 */
export async function requestOtp({ email, name }: CodeRequest): Promise<void> {
  const trimmedName = name?.trim().slice(0, MAX_NAME_LENGTH);
  await request("/api/auth/request-otp", {
    email: email.trim().slice(0, MAX_EMAIL_LENGTH),
    ...(trimmedName ? { name: trimmedName } : {}),
  });
}

/**
 * Exchange the code from the email for a session.
 *
 * The first code an account uses also confirms its address. Only a throw means
 * the code was refused.
 */
export async function verifyOtp(submission: OtpSubmission): Promise<SignedIn> {
  const payload = await request(
    "/api/auth/verify-otp",
    {
      email: submission.email.trim().slice(0, MAX_EMAIL_LENGTH),
      otp: submission.otp.trim().slice(0, OTP_LENGTH),
    },
    codeForVerify,
  );

  const signedIn = signedInFrom(payload);
  if (!signedIn) {
    throw new AuthError(
      "REQUEST_FAILED",
      "The account service returned something unexpected.",
    );
  }
  return signedIn;
}

/* ------------------------------- Validation ------------------------------- */

export const MAX_NAME_LENGTH = 80;

/** The longest address SMTP will carry (RFC 5321). */
export const MAX_EMAIL_LENGTH = 254;

/** Digits in the emailed code, as the service issues it. */
export const OTP_LENGTH = 6;

/**
 * Deliberately loose: an address is either deliverable or it isn't, and no
 * pattern short of sending mail can tell. This rejects what is obviously not an
 * address and leaves the rest to the service, which applies its own rule.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function nameError(name: string): string | null {
  const value = name.trim();
  if (!value) return "Enter your name.";
  if (value.length > MAX_NAME_LENGTH) {
    return `Keep this under ${MAX_NAME_LENGTH} characters.`;
  }
  if (hasUnsafeCharacters(value)) {
    return "That name contains characters we can’t accept.";
  }
  return null;
}

export function emailError(email: string): string | null {
  const value = email.trim();
  if (!value) return "Enter your email address.";
  if (value.length > MAX_EMAIL_LENGTH) return "That email address is too long.";
  if (hasUnsafeCharacters(value)) return "Enter a valid email address.";
  return EMAIL_PATTERN.test(value) ? null : "Enter a valid email address.";
}

/**
 * Only what the code obviously is, so a typo costs a keystroke.
 *
 * The service can't tell a malformed code from a wrong one — both are a 400
 * with prose — so checking the shape here is also what lets a rejection from
 * it be read as a wrong guess and counted as one.
 */
const OTP_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);

export function otpError(otp: string): string | null {
  const value = otp.trim();
  if (!value) return "Enter the code we emailed you.";
  return OTP_PATTERN.test(value)
    ? null
    : `Enter the ${OTP_LENGTH}-digit code from the email.`;
}

/* ------------------------------- Throttling ------------------------------- */

/**
 * A local brake on repeated failures.
 *
 * To be clear about what this is: nothing in a browser can stop someone
 * guessing codes, because an attacker is not using this form. The service does
 * that — a code stops working after a handful of wrong guesses, and a new one
 * can't be asked for straight away. What this does do is stop the editor from
 * being the thing that hammers the service, and tell an honest user who has
 * mistyped five times that waiting is better than a sixth attempt.
 *
 * Module scope, so closing and reopening the dialog doesn't reset the count.
 */
const MAX_ATTEMPTS_BEFORE_COOLDOWN = 5;
const COOLDOWN_MS = 30_000;

let failedAttempts = 0;
let cooldownUntil = 0;

/** Milliseconds left before another attempt is allowed. `0` when it is. */
export function cooldownRemaining(): number {
  return Math.max(0, cooldownUntil - Date.now());
}

export function recordFailedAttempt(): void {
  failedAttempts += 1;
  if (failedAttempts >= MAX_ATTEMPTS_BEFORE_COOLDOWN) {
    cooldownUntil = Date.now() + COOLDOWN_MS;
    failedAttempts = 0;
  }
}

/** Signing in successfully says the person is who they said they were. */
export function clearFailedAttempts(): void {
  failedAttempts = 0;
  cooldownUntil = 0;
}

/* -------------------------------- The store ------------------------------- */

/**
 * `localStorage`, so a reload doesn't sign the user out.
 *
 * The profile is harmless there: the worst it can do in the wrong hands is
 * show the wrong name in the header, and it is re-validated on the way out.
 *
 * The token is a credential, and keeping it here is a trade-off made on
 * purpose. Any script on this origin can read `localStorage` — on a storefront
 * that includes the shop's theme and apps. The alternative, an HttpOnly cookie
 * on the service's own domain, would be a third-party cookie from the
 * storefront, and Safari and increasingly Chrome don't send those. What limits
 * the exposure is what the token can do: it opens the account's saved designs
 * and graphics and nothing else, cannot sign in anywhere, and lapses with the
 * session below.
 */
const STORAGE_KEY = "design-builder:account:v1";

/** A remembered sign-in, as read back out of storage and validated. */
interface StoredSession extends SignedIn {
  signedInAt: number;
}

/**
 * How long a remembered session lasts.
 *
 * There is no server-side session to expire it, so if this browser doesn't
 * forget, nothing does — and "signed in forever on a shared machine" is a
 * decision nobody made. Thirty days is long enough not to be a nuisance on a
 * personal machine.
 */
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/* External to React, so every component that cares subscribes to one copy. */
const listeners = new Set<() => void>();

/** Cached, so the snapshot stays referentially stable between changes. */
let snapshot: StoredSession | null | undefined;

function announce(): void {
  snapshot = undefined;
  for (const listener of listeners) listener();
}

export function subscribeToAccount(listener: () => void): () => void {
  listeners.add(listener);

  // Signing out in one tab signs out the others. Without this they would each
  // keep showing a session that no longer exists anywhere else.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) announce();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function read(): StoredSession | null {
  if (typeof window === "undefined") return null;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked outright; nobody is signed in if it is.
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    // A record with no timestamp, or one dated in the future, is not one this
    // app wrote — treat it the same as an expired one rather than trusting it.
    const signedInAt = parsed.signedInAt;
    if (typeof signedInAt !== "number" || !Number.isFinite(signedInAt)) {
      return null;
    }
    const age = Date.now() - signedInAt;
    if (age < 0 || age > SESSION_MAX_AGE_MS) return null;

    // Through the same validators as a response: storage is writable by
    // anything else running on this origin.
    const user = readUser(parsed.user);
    if (!user) return null;
    return { user, token: readToken(parsed.token), signedInAt };
  } catch {
    return null;
  }
}

function currentSession(): StoredSession | null {
  if (snapshot === undefined) snapshot = read();
  return snapshot;
}

export function getAccountSnapshot(): AccountUser | null {
  return currentSession()?.user ?? null;
}

/** Nothing is stored during a server render, so nobody is signed in there. */
export const getServerAccountSnapshot = (): AccountUser | null => null;

/** The signed-in account's token, or `null` — signed out, or signed in without one. */
export function getAccountToken(): string | null {
  return currentSession()?.token ?? null;
}

function write(session: StoredSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Nothing to do — the session simply won't survive a refresh.
  }
  announce();
}

export function storeAccount({ user, token }: SignedIn): void {
  write({ user, token, signedInAt: Date.now() });
}

/**
 * Drop a token the service refused, and stay signed in.
 *
 * The profile is still right, and the editor keeps working without a token;
 * only the saved designs need one. Losing the dead token is what turns the
 * next attempt into "sign in again" rather than the same failure twice.
 * `signedInAt` is kept, so this can't extend the session.
 */
function forgetToken(): void {
  const current = currentSession();
  if (current?.token) write({ ...current, token: null });
}

export function clearAccount(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Already gone, as far as anything here can tell.
  }
  announce();
}

/* --------------------------- Authorised requests -------------------------- */

const SIGN_IN_AGAIN = "Your sign-in has expired. Sign in again to continue.";

/** 401 is a refused token here, not a wrong code. */
const codeForAuthorized = (status: number): AuthErrorCode => {
  if (status === 401) return "SESSION_EXPIRED";
  if (status === 404) return "NOT_FOUND";
  return codeFor(status);
};

export interface AuthorizedRequestOptions {
  method?: RequestOptions["method"];
  /** Sent as JSON. Omitted for a GET or DELETE. */
  body?: unknown;
  timeoutMs?: number;
}

/**
 * A request made as the signed-in account — the one way the token leaves.
 *
 * Throws `SESSION_EXPIRED` without sending anything when there is no token, and
 * drops the token when the service refuses it, so the account stays signed in
 * and the caller can ask for a fresh sign-in instead.
 */
export async function authorizedRequest(
  path: string,
  { method = "GET", body, timeoutMs }: AuthorizedRequestOptions = {},
): Promise<Record<string, unknown>> {
  const token = getAccountToken();
  if (!token) throw new AuthError("SESSION_EXPIRED", SIGN_IN_AGAIN);

  try {
    return await request(path, body, codeForAuthorized, {
      method,
      token,
      timeoutMs,
    });
  } catch (cause) {
    // Only the token that was refused: another tab may have signed in afresh
    // while this request was out.
    if (
      cause instanceof AuthError &&
      cause.code === "SESSION_EXPIRED" &&
      getAccountToken() === token
    ) {
      forgetToken();
    }
    throw cause;
  }
}

/* ------------------------------- Formatting ------------------------------- */

/**
 * What to call someone on screen.
 *
 * The service does not require a name to be anything in particular, so the
 * address is the fallback — a blank label in the header would leave the user
 * unable to tell which account they are in.
 */
export function displayName(user: AccountUser): string {
  const name = user.name.trim();
  return name || user.email.split("@")[0] || user.email;
}

/** Up to two letters for the avatar, from the name or the address. */
export function initials(user: AccountUser): string {
  const parts = displayName(user).split(/[\s._-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]);
  return letters.join("").toUpperCase() || "?";
}
