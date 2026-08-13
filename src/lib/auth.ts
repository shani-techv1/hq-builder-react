/**
 * Accounts: creating one, proving the address is real, signing in, and
 * remembering who is signed in.
 *
 * Creating an account is two steps, not one. `/api/auth/signup` sends a code to
 * the address and returns no user; nothing can be signed in until
 * `/api/auth/verify-otp` accepts that code. Until then the address is a claim,
 * and `/api/auth/login` refuses it with `needsVerification` — which is the
 * signal that puts an existing user back on the code screen rather than
 * telling them their password is wrong.
 *
 * What the service gives back is a user record and nothing else — no token, no
 * cookie, and there is no endpoint that answers "who am I". So being signed in
 * is a fact this browser remembers rather than a credential it holds: it
 * personalises the editor, and it cannot authorise anything on its own. When
 * the service does start issuing a token, it goes into the store below and
 * travels out of {@link request} — the only two places that would change.
 *
 * A password is never stored. It goes into the one request that needs it and
 * is not written to storage, kept in the session, or logged.
 *
 * On what the checks here are and aren't. Everything below is defence in depth
 * for *this browser*: it keeps the editor from sending a credential over a
 * cleartext connection, from rendering a hostile string, from hammering the
 * service, and from trusting its own storage. None of it is a security control
 * for the service, because anything running in a browser can be bypassed by not
 * using the browser. The service's own limits are what actually protect the
 * accounts — see the note on rate limiting above {@link recordFailedAttempt}.
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

/** A signed-in person, as the service describes them. Never holds a password. */
export interface AccountUser {
  id: string;
  name: string;
  email: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  name: string;
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
 * shows; the code is for callers that need to tell "wrong password" from "the
 * service is down" without matching on prose.
 */
export type AuthErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CREDENTIALS"
  /** The password was right, but the address has never been confirmed. */
  | "EMAIL_NOT_VERIFIED"
  /** The code was wrong, already used, or has expired. */
  | "INVALID_OTP"
  /** No account under that address — nothing to verify or send a code to. */
  | "ACCOUNT_NOT_FOUND"
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

/** Where an unencrypted connection is a development detail, not a leak. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Refuse to put a password on the wire in cleartext.
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
  // 403 is the service's "email not verified", which {@link request} has
  // already turned into its own code by the time this is reached.
  if (status === 401 || status === 403) return "INVALID_CREDENTIALS";
  if (status === 404) return "ACCOUNT_NOT_FOUND";
  if (status === 429) return "TOO_MANY_ATTEMPTS";
  // Everything the service rejects — a malformed email, a short password, an
  // address already registered — comes back as a 400 with the reason in `error`.
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
 * The envelope is returned rather than a user, because only two of the four
 * endpoints describe one — signing up and resending a code answer with a
 * message and nothing else, and a caller that needs a user says so by reading
 * one out with {@link userFrom}.
 *
 * Only `Content-Type` is sent. The service's CORS policy allows that header
 * alone, so anything else would fail the preflight rather than the request.
 * The rest of the options are about what must *not* travel: no ambient
 * cookies, no `Referer` disclosing which design the user was editing, and no
 * cached copy of an authentication response left in the browser's store.
 */
async function request(
  path: string,
  body: unknown,
  statusCode: (status: number) => AuthErrorCode = codeFor,
): Promise<Record<string, unknown>> {
  assertSecureEndpoint();

  let response: Response;
  try {
    response = await fetch(`${AUTH_API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
    // An unconfirmed address is a step to take, not a failure to report: it is
    // the one rejection the dialog answers by moving forward rather than by
    // showing the message. The flag is the service's, and the status backs it
    // up in case a future response drops it.
    const unverified =
      response.status === 403 ||
      (isRecord(payload) && payload.needsVerification === true);

    throw new AuthError(
      unverified ? "EMAIL_NOT_VERIFIED" : statusCode(response.status),
      messageFrom(payload) ?? "Something went wrong. Please try again.",
    );
  }

  return payload;
}

/**
 * The user in a response, wherever the endpoint chose to put it.
 *
 * Login nests it under `data`; the verify endpoint is documented only by the
 * four calls it was handed over in, and answers a correct code with a message.
 * Reading all three shapes costs a line each and means a service that starts
 * returning a user on verification is used immediately rather than being
 * followed by a redundant login — see {@link verifyOtp} for the fallback when
 * it doesn't.
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
 * Register, and get a code sent to the address.
 *
 * No user comes back and none is expected: the account exists but is inert
 * until {@link verifyOtp} accepts the code. An address that is already
 * registered but unverified is answered the same way, with a fresh code, so
 * someone who lost the first email can simply sign up again.
 *
 * Fields are trimmed and bounded on the way out. The service applies no length
 * limit of its own — it will hash an eight-kilobyte password — so the cap is
 * what keeps this client from being the thing that sends one.
 */
export async function signUp(details: Registration): Promise<void> {
  await request("/api/auth/signup", {
    name: details.name.trim().slice(0, MAX_NAME_LENGTH),
    email: details.email.trim().slice(0, MAX_EMAIL_LENGTH),
    password: details.password.slice(0, MAX_PASSWORD_LENGTH),
  });
}

export async function signIn(credentials: Credentials): Promise<AccountUser> {
  const payload = await request("/api/auth/login", {
    email: credentials.email.trim().slice(0, MAX_EMAIL_LENGTH),
    password: credentials.password.slice(0, MAX_PASSWORD_LENGTH),
  });

  const user = userFrom(payload);
  if (!user) {
    throw new AuthError(
      "REQUEST_FAILED",
      "The account service returned something unexpected.",
    );
  }
  return user;
}

/**
 * Confirm the address with the code from the email.
 *
 * Resolves with the user when the service describes one, and with `null` when
 * it only confirms — in which case the account is now verified and a normal
 * sign-in is what establishes the session. Both are successes; only a throw
 * means the code was refused.
 */
export const verifyOtp = (submission: OtpSubmission): Promise<AccountUser | null> =>
  request(
    "/api/auth/verify-otp",
    {
      email: submission.email.trim().slice(0, MAX_EMAIL_LENGTH),
      otp: submission.otp.trim().slice(0, OTP_LENGTH),
    },
    codeForVerify,
  ).then(userFrom);

/** Send another code to an address that hasn't been confirmed yet. */
export async function resendOtp(email: string): Promise<void> {
  await request("/api/auth/resend-otp", {
    email: email.trim().slice(0, MAX_EMAIL_LENGTH),
  });
}

/* ------------------------------- Validation ------------------------------- */

export const MAX_NAME_LENGTH = 80;

/** The longest address SMTP will carry (RFC 5321). */
export const MAX_EMAIL_LENGTH = 254;

/** Digits in the emailed code, as the service issues it. */
export const OTP_LENGTH = 6;

/**
 * Stricter than the service's own six-character floor, and deliberately so.
 *
 * The service accepts unlimited guesses at a password — there is no lockout and
 * no rate limit — which makes the length of the password the only thing
 * standing between an account and an offline-speed attack on it. Eight is the
 * floor this app is willing to create; the service still lets older, shorter
 * passwords sign in, which is why {@link passwordError} does not apply it.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Bounded so a pathological input can't be turned into work for the service.
 * Well above any real password, well below the point where hashing it costs
 * anything.
 */
export const MAX_PASSWORD_LENGTH = 128;

/** Shown under the field, so the rule is known before the button is pressed. */
export const PASSWORD_RULE = `At least ${MIN_PASSWORD_LENGTH} characters, and not something guessable.`;

/**
 * Deliberately loose: an address is either deliverable or it isn't, and no
 * pattern short of sending mail can tell. This rejects what is obviously not an
 * address and leaves the rest to the service, which applies its own rule.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The passwords guessed first.
 *
 * A deny-list is not a strength meter and this one is short on purpose — it
 * exists to catch the handful that appear at the top of every breach corpus,
 * including the one in this service's own API examples. Anything longer belongs
 * behind a breach-corpus check on the server, where it can be kept current.
 */
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "qwertyuiop",
  "letmein123",
  "iloveyou",
  "admin123",
  "welcome123",
  "abc12345",
  "football",
  "monkey123",
  "designbuilder",
]);

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

/**
 * Required, and nothing more.
 *
 * For signing *in*: an account made under an older rule still has to be able to
 * get in, and telling someone their existing password is too short would be
 * both wrong and unfixable from this form.
 */
export function passwordError(password: string): string | null {
  if (!password) return "Enter your password.";
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Passwords are at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/**
 * For the password being created, where the rules do apply.
 *
 * The identity checks matter more than they look: a password derived from the
 * address it protects is the first thing tried after the deny-list, and it is
 * the one an attacker can construct without knowing anything else.
 */
export function newPasswordError(
  password: string,
  context: { email?: string; name?: string } = {},
): string | null {
  if (!password) return "Choose a password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Keep it under ${MAX_PASSWORD_LENGTH} characters.`;
  }

  const lowered = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) {
    return "That password is too common. Choose another.";
  }
  // A single repeated character passes every length check ever written.
  if (new Set(lowered).size < 4) {
    return "That password is too simple. Mix in a few more characters.";
  }

  const local = (context.email ?? "").trim().toLowerCase().split("@")[0];
  if (local.length >= 3 && lowered.includes(local)) {
    return "Don’t use your email address in your password.";
  }

  const name = (context.name ?? "").trim().toLowerCase();
  if (name.length >= 3 && lowered.includes(name)) {
    return "Don’t use your name in your password.";
  }

  return null;
}

/* ------------------------------- Throttling ------------------------------- */

/**
 * A local brake on repeated failures.
 *
 * To be clear about what this is: the service has no rate limiting — six wrong
 * passwords in a row get six identical rejections, as fast as they can be sent
 * — and nothing in a browser can change that, because an attacker guessing
 * passwords is not using this form. What this does do is stop the editor from
 * being the thing that hammers the service, and tell an honest user who has
 * mistyped five times that waiting is better than a sixth attempt.
 *
 * The real fix is a limit per address and per IP on the server. Until that
 * exists, the account's protection is the length of its password, which is why
 * {@link MIN_PASSWORD_LENGTH} is stricter here than the service requires.
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
 * Safe to keep there because it is a profile, not a credential: the worst it
 * can do in the wrong hands is show the wrong name in the header, and it is
 * re-validated on the way out. If this ever holds a token, that calculation
 * changes completely and this is the comment that has to change with it.
 */
const STORAGE_KEY = "design-builder:account:v1";

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
let snapshot: AccountUser | null | undefined;

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

function read(): AccountUser | null {
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

    // Through the same validator as a response: storage is writable by
    // anything else running on this origin.
    return readUser(parsed.user);
  } catch {
    return null;
  }
}

export function getAccountSnapshot(): AccountUser | null {
  if (snapshot === undefined) snapshot = read();
  return snapshot;
}

/** Nothing is stored during a server render, so nobody is signed in there. */
export const getServerAccountSnapshot = (): AccountUser | null => null;

export function storeAccount(user: AccountUser): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user, signedInAt: Date.now() }),
    );
  } catch {
    // Nothing to do — the session simply won't survive a refresh.
  }
  announce();
}

export function clearAccount(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Already gone, as far as anything here can tell.
  }
  announce();
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
