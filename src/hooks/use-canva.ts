"use client";

import * as React from "react";

import {
  CANVA_API_ORIGIN,
  CanvaError,
  clearSession,
  importProject,
  isConnectMessage,
  listProjects,
  openConnectPopup,
  getServerSessionSnapshot,
  getSessionSnapshot,
  subscribeToSession,
  writeSession,
  type CanvaProject,
} from "@/lib/canva";

/**
 * Whether an account is attached.
 *
 * There is no "checking" state: the token is in this tab's storage, so the
 * answer is available synchronously rather than after a round trip.
 */
export type CanvaStatus = "disconnected" | "connected";

export interface CanvaLibrary {
  status: CanvaStatus;
  projects: CanvaProject[];
  /** True during the first load; the grid shows skeletons rather than empty. */
  isLoading: boolean;
  /** True while another page is being appended. */
  isLoadingMore: boolean;
  hasMore: boolean;
  /** The project currently being exported, or `null`. */
  importingId: string | null;
  error: string | null;

  connect: () => void;
  disconnect: () => void;
  loadMore: () => void;
  retry: () => void;
  /** Export a design and hand back the file, for the caller to place. */
  importDesign: (projectId: string) => Promise<File | null>;
}

/**
 * Connection state and the user's Canva designs.
 *
 * Owns three things that would otherwise be scattered across the panel: is
 * there an account attached, which page of designs have we got, and is an
 * export in flight. Everything the panel renders is derived from those.
 */
export function useCanva(): CanvaLibrary {
  /*
   * Connection state is the stored token, subscribed to rather than copied.
   * Anything that writes or clears it — the popup, a refused request, the
   * disconnect button — moves this on its own, so there is no second copy to
   * keep in step.
   */
  const session = React.useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const status: CanvaStatus = session ? "connected" : "disconnected";

  const [projects, setProjects] = React.useState<CanvaProject[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [importingId, setImportingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /** Bumped to re-run the connection check — what "retry" does. */
  const [attempt, setAttempt] = React.useState(0);

  /**
   * The attempt whose design list has finished loading.
   *
   * Loading is derived from this rather than held as its own flag, because
   * raising a flag as the fetch starts means setting state in an effect body
   * and paying a second render before anything has been requested.
   */
  const [loadedAttempt, setLoadedAttempt] = React.useState<number | null>(null);
  const isLoading = status === "connected" && loadedAttempt !== attempt;

  /**
   * Drop the account and everything that came from it.
   *
   * Every route to a disconnected state goes through here — the status check,
   * a token that died mid-request, the popup reporting a refusal, and the
   * disconnect button. Clearing the designs alongside the status keeps the two
   * from disagreeing, which is what showing a stale grid behind a "connect"
   * prompt would look like.
   */
  const markDisconnected = React.useCallback(() => {
    // A token refused anywhere is worthless everywhere, so it goes. Clearing
    // it is what flips `status`, since that is read from the store.
    clearSession();
    setProjects([]);
    setCursor(null);
  }, []);

  /* ---------------------------- Their designs --------------------------- */
  React.useEffect(() => {
    // Designs are cleared by `markDisconnected`, not here — clearing state in
    // an effect body costs an extra render pass for something already handled
    // at the point the account went away.
    if (status !== "connected") return;

    const controller = new AbortController();

    listProjects(undefined, controller.signal)
      .then((page) => {
        setProjects(page.projects);
        setCursor(page.nextCursor);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        // A token that died between the status check and this call sends the
        // panel back to its disconnected state rather than showing an error.
        if (cause instanceof CanvaError && cause.needsConnection) {
          markDisconnected();
          return;
        }
        setError(
          cause instanceof Error ? cause.message : "Unable to load your designs.",
        );
      })
      .finally(() => {
        // Not on an aborted run: that attempt never finished, and marking it
        // done would hide the loading state for the one replacing it.
        if (!controller.signal.aborted) setLoadedAttempt(attempt);
      });

    return () => controller.abort();
  }, [status, attempt, markDisconnected]);

  const loadMore = React.useCallback(() => {
    if (!cursor || isLoadingMore) return;

    setIsLoadingMore(true);
    listProjects(cursor)
      .then((page) => {
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
  }, [cursor, isLoadingMore]);

  /* ------------------------------ Connecting ---------------------------- */
  const connect = React.useCallback(() => {
    setError(null);
    const popup = openConnectPopup();
    if (!popup) {
      setError("Allow pop-ups for this site to connect your Canva account.");
    }
  }, []);

  /* The popup reports back here rather than redirecting the whole editor. */
  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Anyone can post to this window, so the sender is checked before the
      // payload is trusted.
      if (event.origin !== CANVA_API_ORIGIN) return;
      if (!isConnectMessage(event.data)) return;

      if (event.data.connected && event.data.accessToken) {
        // The token arrives exactly once, here, and lives in this tab after.
        writeSession({
          accessToken: event.data.accessToken,
          expiresAt: event.data.expiresAt ?? null,
          scopes: event.data.scopes ?? [],
        });
        setError(null);
        // Re-runs the design fetch against the newly connected account.
        setAttempt((current) => current + 1);
      } else {
        markDisconnected();
        setError(event.data.message || "Canva was not connected.");
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [markDisconnected]);

  const disconnect = React.useCallback(() => {
    // Nothing to tell the server: it never had the token.
    markDisconnected();
    setError(null);
  }, [markDisconnected]);

  /* ------------------------------- Importing ---------------------------- */
  const importDesign = React.useCallback(
    async (projectId: string): Promise<File | null> => {
      setImportingId(projectId);
      setError(null);
      try {
        return await importProject(projectId);
      } catch (cause) {
        if (cause instanceof CanvaError && cause.needsConnection) {
          markDisconnected();
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
    [markDisconnected],
  );

  return {
    status,
    projects,
    isLoading,
    isLoadingMore,
    hasMore: cursor !== null,
    importingId,
    error,
    connect,
    disconnect,
    loadMore,
    retry: React.useCallback(() => {
      setError(null);
      setAttempt((current) => current + 1);
    }, []),
    importDesign,
  };
}
