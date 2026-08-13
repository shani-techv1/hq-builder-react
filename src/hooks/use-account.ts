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
  signIn,
  signUp,
  storeAccount,
  subscribeToAccount,
  type AccountUser,
  type Credentials,
  type Registration,
} from "@/lib/auth";

export interface AccountSession {
  /** The signed-in user, or `null`. */
  user: AccountUser | null;
  isSignedIn: boolean;
  /** True while a sign-in or sign-up request is in flight. */
  pending: boolean;
  /** Why the last attempt failed, in the service's own words. */
  error: string | null;

  /** Resolves `true` when the session was established. */
  logIn: (credentials: Credentials) => Promise<boolean>;
  register: (details: Registration) => Promise<boolean>;
  logOut: () => void;
  clearError: () => void;
}

/**
 * The signed-in account, and the two ways to get one.
 *
 * The user is subscribed to rather than copied into state, so every surface
 * using this hook — the header, the dialog, anything later — sees the same
 * session, and another tab signing out moves all of them at once. What *is*
 * local is `pending` and `error`, which belong to one form's attempt and would
 * be wrong to share.
 */
export function useAccount(): AccountSession {
  const user = React.useSyncExternalStore(
    subscribeToAccount,
    getAccountSnapshot,
    getServerAccountSnapshot,
  );

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Mirrors `pending` so the guard below can read it without depending on the
  // render that set it — a double submit arrives before React has re-rendered.
  const inFlight = React.useRef(false);
  const mounted = React.useRef(true);
  React.useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const attempt = React.useCallback(
    async (work: () => Promise<AccountUser>): Promise<boolean> => {
      if (inFlight.current) return false;

      // Nothing is sent while the local brake is on — see `recordFailedAttempt`
      // for what this does and, more importantly, what it does not.
      const waiting = cooldownRemaining();
      if (waiting > 0) {
        setError(
          `Too many attempts. Try again in ${Math.ceil(waiting / 1000)} seconds.`,
        );
        return false;
      }

      inFlight.current = true;
      setPending(true);
      setError(null);

      try {
        // Stored before anything renders the result, so the subscription is
        // what tells the UI it worked — there is no second copy to keep in step.
        storeAccount(await work());
        clearFailedAttempts();
        return true;
      } catch (cause) {
        // A rejected credential counts; being offline or timing out does not —
        // the guess was never assessed, and locking someone out of a form
        // because their connection dropped would be punishing the wrong thing.
        if (cause instanceof AuthError && cause.code === "INVALID_CREDENTIALS") {
          recordFailedAttempt();
        }
        if (mounted.current) {
          setError(
            cause instanceof AuthError
              ? cause.message
              : "Something went wrong. Please try again.",
          );
        }
        return false;
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
    error,

    logIn: React.useCallback(
      (credentials: Credentials) => attempt(() => signIn(credentials)),
      [attempt],
    ),
    register: React.useCallback(
      (details: Registration) => attempt(() => signUp(details)),
      [attempt],
    ),
    logOut: React.useCallback(() => {
      clearAccount();
      setError(null);
    }, []),
    clearError: React.useCallback(() => setError(null), []),
  };
}
