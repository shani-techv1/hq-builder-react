"use client";

import * as React from "react";

import {
  CANVA_API_ORIGIN,
  CanvaError,
  clearStore,
  disconnectAccount,
  fetchAccounts,
  getServerStoreSnapshot,
  getStoreSnapshot,
  importProject,
  isConnectMessage,
  listProjects,
  openConnectPopup,
  setSelectedAccountId,
  setSessionId,
  startConnect,
  subscribeToStore,
  type CanvaAccount,
  type CanvaProject,
} from "@/lib/canva";

/**
 * Whether any account is attached. Not whether a *particular* one works —
 * that is `status` on the account itself, and one lapsing says nothing about
 * the others.
 */
export type CanvaStatus = "disconnected" | "connected";

export interface CanvaLibrary {
  status: CanvaStatus;

  /** Every connected account, in the order they were added. */
  accounts: CanvaAccount[];
  /** The account the grid belongs to, or `null` when none is connected. */
  selectedAccount: CanvaAccount | null;
  /** True while the account list itself is being fetched. */
  accountsLoading: boolean;
  /** True from clicking connect until the popup resolves or closes. */
  connecting: boolean;
  /** The account currently being disconnected, or `null`. */
  disconnectingId: string | null;

  /** Designs belonging to `selectedAccount`, and nothing else. */
  projects: CanvaProject[];
  /** True during the first load; the grid shows skeletons rather than empty. */
  isLoading: boolean;
  /** True while another page is being appended. */
  isLoadingMore: boolean;
  hasMore: boolean;
  /** The project currently being exported, or `null`. */
  importingId: string | null;
  error: string | null;

  /** Start an OAuth flow. Adds an account; never replaces one. */
  connect: () => void;
  selectAccount: (accountId: string) => void;
  /** Remove one account. The rest keep working. */
  disconnect: (accountId: string) => void;
  loadMore: () => void;
  retry: () => void;
  /** Export a design from the selected account and hand back the file. */
  importDesign: (projectId: string) => Promise<File | null>;
}

/** How often the popup is checked for having been closed. */
const POPUP_POLL_MS = 600;

/** Referentially stable, so "no session" doesn't re-render on every pass. */
const NO_ACCOUNTS: CanvaAccount[] = [];

/**
 * Connected Canva accounts, and the designs of whichever one is selected.
 *
 * Three things that used to be one: which accounts exist, which is selected,
 * and what that account contains. Keeping them separate is what allows an
 * account to lapse, be reconnected or be removed without touching the others.
 */
export function useCanva(): CanvaLibrary {
  /*
   * The session handle and the current selection, subscribed to rather than
   * copied. Anything that writes them — the popup, a dead session, another tab
   * — moves this on its own, so there is no second copy to keep in step.
   */
  const store = React.useSyncExternalStore(
    subscribeToStore,
    getStoreSnapshot,
    getServerStoreSnapshot,
  );

  const [loadedAccounts, setLoadedAccounts] = React.useState<CanvaAccount[]>([]);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnectingId, setDisconnectingId] = React.useState<string | null>(null);

  const [projects, setProjects] = React.useState<CanvaProject[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [importingId, setImportingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /** Bumped to re-run a fetch — what "retry" does. */
  const [accountsAttempt, setAccountsAttempt] = React.useState(0);
  const [projectsAttempt, setProjectsAttempt] = React.useState(0);

  /**
   * The attempt whose account list has finished loading.
   *
   * Loading is derived from this rather than held as its own flag, because
   * raising a flag as the fetch starts means setting state in an effect body
   * and paying a second render before anything has been requested.
   */
  const [loadedAccountsAttempt, setLoadedAccountsAttempt] = React.useState<
    number | null
  >(null);

  const { sessionId } = store;

  /**
   * Derived rather than cleared when the session goes.
   *
   * Emptying the list from inside the effect below would cost a second render
   * pass for something already decided the moment the session id vanished —
   * and there is nothing to fetch without one, so the answer is always `[]`.
   */
  const accounts = sessionId ? loadedAccounts : NO_ACCOUNTS;
  const accountsLoading =
    sessionId !== null && loadedAccountsAttempt !== accountsAttempt;

  /**
   * The selected account, resolved against what is actually connected.
   *
   * A stored id can outlive the account it names — disconnected in another tab,
   * or dropped when the service restarted — so the list is the authority and
   * the stored id only a preference. An *expired* account is still honoured as
   * a selection: the panel has to be able to show which one needs reconnecting.
   */
  const selectedAccount = React.useMemo(() => {
    if (accounts.length === 0) return null;
    return (
      accounts.find((account) => account.id === store.selectedAccountId) ??
      accounts.find((account) => account.status === "connected") ??
      accounts[0]
    );
  }, [accounts, store.selectedAccountId]);

  /**
   * Which fetch the loaded designs belong to.
   *
   * Compared against the key the current selection implies, so switching
   * accounts hides the previous account's designs *immediately* rather than
   * when the next response lands. Aborting the request is not enough on its own
   * — the stale grid would still be on screen in the meantime.
   */
  const projectsKey =
    selectedAccount && selectedAccount.status === "connected"
      ? `${selectedAccount.id}#${projectsAttempt}`
      : null;
  const [loadedKey, setLoadedKey] = React.useState<string | null>(null);

  const isLoading = projectsKey !== null && loadedKey !== projectsKey;
  const visibleProjects = loadedKey === projectsKey ? projects : [];

  /* ----------------------------- The accounts ---------------------------- */

  const refreshAccounts = React.useCallback(() => {
    setAccountsAttempt((current) => current + 1);
  }, []);

  React.useEffect(() => {
    if (!sessionId) return;

    const controller = new AbortController();

    fetchAccounts(controller.signal)
      .then((next) => {
        setLoadedAccounts(next);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        // The session itself is gone, which is the one case where everything
        // has to be reconnected. Clearing it flips the panel back to its
        // opening state rather than showing an error with no way forward.
        if (cause instanceof CanvaError && cause.needsSession) {
          clearStore();
          setLoadedAccounts([]);
          return;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load your Canva accounts.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedAccountsAttempt(accountsAttempt);
      });

    return () => controller.abort();
  }, [sessionId, accountsAttempt]);

  /** Read by callbacks that must not close over a stale selection. */
  const selectedAccountRef = React.useRef(selectedAccount);
  React.useEffect(() => {
    selectedAccountRef.current = selectedAccount;
  }, [selectedAccount]);

  /* ----------------------------- Their designs --------------------------- */

  React.useEffect(() => {
    if (!projectsKey || !selectedAccount) return;

    const accountId = selectedAccount.id;
    const controller = new AbortController();

    listProjects(accountId, undefined, controller.signal)
      .then((page) => {
        setProjects(page.projects);
        setCursor(page.nextCursor);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;

        if (cause instanceof CanvaError && cause.needsSession) {
          clearStore();
          return;
        }
        // One account lapsed. The list is refetched so that account picks up
        // its expired badge, and every other account carries on untouched.
        if (cause instanceof CanvaError && cause.needsAccount) {
          setProjects([]);
          setCursor(null);
          refreshAccounts();
          return;
        }
        setError(
          cause instanceof Error ? cause.message : "Unable to load your designs.",
        );
      })
      .finally(() => {
        // Not on an aborted run: that attempt never finished, and marking it
        // done would hide the loading state for the one replacing it.
        if (!controller.signal.aborted) setLoadedKey(projectsKey);
      });

    return () => controller.abort();
  }, [projectsKey, selectedAccount, refreshAccounts]);

  const loadMore = React.useCallback(() => {
    if (!cursor || isLoadingMore || !selectedAccount) return;

    const accountId = selectedAccount.id;
    setIsLoadingMore(true);

    listProjects(accountId, cursor)
      .then((page) => {
        // Dropped if the selection moved on while this was in flight —
        // appending Account A's next page to Account B's grid would be worse
        // than losing a page nobody is looking at any more.
        if (accountId !== selectedAccountRef.current?.id) return;

        // Appended by id rather than by index: a design edited between pages
        // can shift position and arrive twice.
        setProjects((current) => {
          const seen = new Set(current.map((project) => project.id));
          return [
            ...current,
            ...page.projects.filter((project) => !seen.has(project.id)),
          ];
        });
        setCursor(page.nextCursor);
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : "Unable to load more designs.",
        );
      })
      .finally(() => setIsLoadingMore(false));
  }, [cursor, isLoadingMore, selectedAccount]);

  /* ------------------------------ Connecting ----------------------------- */

  /*
   * A ref, not the state flag: two clicks in the same tick would both see
   * `connecting === false` and start competing flows, each with its own PKCE
   * verifier and state.
   */
  const isStartingRef = React.useRef(false);
  const popupRef = React.useRef<Window | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const finishConnecting = React.useCallback(() => {
    isStartingRef.current = false;
    setConnecting(false);
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  React.useEffect(() => finishConnecting, [finishConnecting]);

  const connect = React.useCallback(() => {
    if (isStartingRef.current) {
      // Already mid-flow. Bring the window they lost behind the editor forward
      // rather than opening a second one.
      popupRef.current?.focus();
      return;
    }

    isStartingRef.current = true;
    setConnecting(true);
    setError(null);

    void (async () => {
      try {
        const { sessionId: granted, authorizeUrl } = await startConnect();
        // Stored before the popup can possibly come back, so the callback's
        // message is never received against a session this tab doesn't know.
        setSessionId(granted);

        const popup = openConnectPopup(authorizeUrl);
        if (!popup) {
          setError("Allow pop-ups for this site to connect your Canva account.");
          finishConnecting();
          return;
        }
        popupRef.current = popup;

        /*
         * Watch for the window closing.
         *
         * Covers two cases that otherwise leave the button spinning forever:
         * the user closing the popup without finishing, and a flow that
         * succeeded but whose `postMessage` never arrived. Refetching the
         * accounts settles both — if the connection was made, it is on the
         * server whether or not the message reached this tab.
         */
        pollRef.current = setInterval(() => {
          if (!popup.closed) return;
          finishConnecting();
          refreshAccounts();
        }, POPUP_POLL_MS);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not start the Canva sign-in.",
        );
        finishConnecting();
      }
    })();
  }, [finishConnecting, refreshAccounts]);

  /* The popup reports back here rather than redirecting the whole editor. */
  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Anyone can post to this window, so the sender is checked before the
      // payload is trusted.
      if (event.origin !== CANVA_API_ORIGIN) return;
      if (!isConnectMessage(event.data)) return;

      finishConnecting();

      const { connected, sessionId: granted, account } = event.data;
      if (!connected || !granted || !account) {
        setError(event.data.message || "Canva was not connected.");
        return;
      }

      setSessionId(granted);
      setSelectedAccountId(account.id);

      // Merged in directly so the new account appears at once, and the server
      // is asked afterwards to confirm. Replaced in place when it is already
      // known — reconnecting an expired account should revive the row it is
      // sitting in, not add a second one below it.
      setLoadedAccounts((current) =>
        current.some((existing) => existing.id === account.id)
          ? current.map((existing) =>
              existing.id === account.id ? account : existing,
            )
          : [...current, account],
      );
      setError(null);
      refreshAccounts();
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [finishConnecting, refreshAccounts]);

  /* ----------------------------- Housekeeping ---------------------------- */

  const selectAccount = React.useCallback((accountId: string) => {
    setError(null);
    setSelectedAccountId(accountId);
  }, []);

  const disconnect = React.useCallback(
    (accountId: string) => {
      setDisconnectingId(accountId);
      setError(null);

      void disconnectAccount(accountId)
        .then((remaining) => {
          setLoadedAccounts(remaining);

          // Only the selection needs adjusting, and only if it was this one.
          // Everything else about the remaining accounts is unaffected.
          if (getStoreSnapshot().selectedAccountId === accountId) {
            setSelectedAccountId(
              remaining.find((account) => account.status === "connected")?.id ??
                remaining[0]?.id ??
                null,
            );
          }
        })
        .catch((cause: unknown) => {
          if (cause instanceof CanvaError && cause.needsSession) {
            clearStore();
            return;
          }
          // Already gone server-side — reconciling is the right answer, not an
          // error the user has to do something about.
          if (cause instanceof CanvaError && cause.code === "ACCOUNT_NOT_FOUND") {
            refreshAccounts();
            return;
          }
          setError(
            cause instanceof Error
              ? cause.message
              : "That account could not be disconnected.",
          );
        })
        .finally(() => setDisconnectingId(null));
    },
    [refreshAccounts],
  );

  /* ------------------------------- Importing ----------------------------- */

  const importDesign = React.useCallback(
    async (projectId: string): Promise<File | null> => {
      // Captured now, not read later: an export takes seconds, and the user may
      // well switch accounts during one. It must finish against the account it
      // was started for.
      const account = selectedAccountRef.current;
      if (!account) return null;

      setImportingId(projectId);
      setError(null);
      try {
        return await importProject(account.id, projectId);
      } catch (cause) {
        if (cause instanceof CanvaError && cause.needsSession) {
          clearStore();
          return null;
        }
        if (cause instanceof CanvaError && cause.needsAccount) {
          refreshAccounts();
          return null;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "That design could not be imported.",
        );
        return null;
      } finally {
        setImportingId(null);
      }
    },
    [refreshAccounts],
  );

  return {
    status: accounts.length > 0 ? "connected" : "disconnected",
    accounts,
    selectedAccount,
    accountsLoading,
    connecting,
    disconnectingId,

    projects: visibleProjects,
    isLoading,
    isLoadingMore,
    hasMore: cursor !== null,
    importingId,
    error,

    connect,
    selectAccount,
    disconnect,
    loadMore,
    retry: React.useCallback(() => {
      setError(null);
      setAccountsAttempt((current) => current + 1);
      setProjectsAttempt((current) => current + 1);
    }, []),
    importDesign,
  };
}
