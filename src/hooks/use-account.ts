"use client";

import * as React from "react";

import {
  AuthError,
  clearAccount,
  clearFailedAttempts,
  cooldownRemaining,
  getAccountSnapshot,
  getServerAccountSnapshot,
  recordFailedAttempt,
  resendOtp,
  signIn,
  signUp,
  storeAccount,
  subscribeToAccount,
  verifyOtp,
  type AccountUser,
  type AuthErrorCode,
  type Credentials,
  type Registration,
} from "@/lib/auth";

/** Confirming an address, and signing into it once confirmed. */
export interface Verification extends Credentials {
  otp: string;
}

/**
 * How an attempt ended.
 *
 * The whole failure travels with the result rather than being left in state for
 * a later render to pick up. Both halves are needed at the call site and needed
 * *there*: the caller branches on `code` — an unconfirmed address sends the
 * user to the code screen rather than reporting anything — and announces
 * `message` in a toast, and both decisions belong to the handler that awaited
 * the call. Nothing renders a failure, so nothing has to remember one.
 *
 * `message` is absent when there is nothing to say: a second submit arriving
 * while the first is still in flight is discarded, not reported.
 */
export type AttemptResult =
  | { ok: true }
  | { ok: false; code: AuthErrorCode | null; message: string | null };

const SUCCEEDED: AttemptResult = { ok: true };
const DISCARDED: AttemptResult = { ok: false, code: null, message: null };

export interface AccountSession {
  /** The signed-in user, or `null`. */
  user: AccountUser | null;
  isSignedIn: boolean;
  /** True while a request is in flight. */
  pending: boolean;

  /** Signs in, unless the address has never been confirmed. */
  logIn: (credentials: Credentials) => Promise<AttemptResult>;
  /** Creates the account and has a code sent to the address. */
  register: (details: Registration) => Promise<AttemptResult>;
  /** Confirms the address with the code, then signs in. */
  verify: (details: Verification) => Promise<AttemptResult>;
  /** Has another code sent to an address awaiting confirmation. */
  resend: (email: string) => Promise<AttemptResult>;
  logOut: () => void;
}

/**
 * The signed-in account, and the ways to get one.
 *
 * The user is subscribed to rather than copied into state, so every surface
 * using this hook — the header, the dialog, anything later — sees the same
 * session, and another tab signing out moves all of them at once. What *is*
 * local is `pending` and `error`, which belong to one form's attempt and would
 * be wrong to share. Which step of a sign-up someone is on is local in the same
 * way, and stays in the dialog: nothing else on the page should re-render
 * because a code is being typed into it.
 */
export function useAccount(): AccountSession {
  const user = React.useSyncExternalStore(
    subscribeToAccount,
    getAccountSnapshot,
    getServerAccountSnapshot,
  );

  const [pending, setPending] = React.useState(false);

  // Mirrors `pending` so the guard below can read it without depending on the
  // render that set it — a double submit arrives before React has re-rendered.
  const inFlight = React.useRef(false);

  /**
   * Whether there is still a component here to tell about the result.
   *
   * Set on mount as well as cleared on teardown, and the mount half is the half
   * that matters: Strict Mode mounts every effect, tears it down and mounts it
   * again, so a ref that is only ever cleared reads `false` from the second
   * mount onwards. Everything guarded by it — `setPending(false)` most of all —
   * would then never run again, leaving the form disabled and its button
   * spinning against a request that finished.
   */
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * One attempt at the service, whether or not it ends in a session.
   *
   * Work that establishes one resolves with a user and it is stored; work that
   * only moves the sign-up along — creating the account, sending another code —
   * resolves with `null` and leaves whoever is signed in exactly as they were.
   * Both share the guard, the brake and the error handling, which is the part
   * that must not be written twice.
   */
  const attempt = React.useCallback(
    async (work: () => Promise<AccountUser | null>): Promise<AttemptResult> => {
      if (inFlight.current) return DISCARDED;

      // Nothing is sent while the local brake is on — see `recordFailedAttempt`
      // for what this does and, more importantly, what it does not.
      const waiting = cooldownRemaining();
      if (waiting > 0) {
        return {
          ok: false,
          code: "TOO_MANY_ATTEMPTS",
          message: `Too many attempts. Try again in ${Math.ceil(waiting / 1000)} seconds.`,
        };
      }

      inFlight.current = true;
      setPending(true);

      try {
        const user = await work();
        if (user) {
          // Stored before anything renders the result, so the subscription is
          // what tells the UI it worked — there is no second copy to keep in
          // step.
          storeAccount(user);
          clearFailedAttempts();
        }
        return SUCCEEDED;
      } catch (cause) {
        // A rejected credential or code counts; being offline or timing out
        // does not — the guess was never assessed, and locking someone out of a
        // form because their connection dropped would be punishing the wrong
        // thing. Nor does an unverified address: the password was right, and
        // the answer to it is the code screen, not a lockout.
        if (
          cause instanceof AuthError &&
          (cause.code === "INVALID_CREDENTIALS" || cause.code === "INVALID_OTP")
        ) {
          recordFailedAttempt();
        }
        return cause instanceof AuthError
          ? { ok: false, code: cause.code, message: cause.message }
          : {
              ok: false,
              code: null,
              message: "Something went wrong. Please try again.",
            };
      } finally {
        inFlight.current = false;
        if (mounted.current) setPending(false);
      }
    },
    [],
  );

  return {
    user,
    isSignedIn: user !== null,
    pending,

    logIn: React.useCallback(
      (credentials: Credentials) => attempt(() => signIn(credentials)),
      [attempt],
    ),
    register: React.useCallback(
      (details: Registration) => attempt(async () => {
        await signUp(details);
        // No session yet, and deliberately so — the account is inert until the
        // code is confirmed.
        return null;
      }),
      [attempt],
    ),

    /**
     * The code, and then the session.
     *
     * The password is passed through from the form that was already holding it
     * so confirming an address ends signed in rather than back at a login the
     * user has just proved they can pass. It is only sent if the service
     * doesn't hand back a user itself.
     */
    verify: React.useCallback(
      ({ email, otp, password }: Verification) =>
        attempt(async () => {
          const verified = await verifyOtp({ email, otp });
          return verified ?? (await signIn({ email, password }));
        }),
      [attempt],
    ),
    resend: React.useCallback(
      (email: string) =>
        attempt(async () => {
          await resendOtp(email);
          return null;
        }),
      [attempt],
    ),

    logOut: React.useCallback(() => clearAccount(), []),
  };
}
