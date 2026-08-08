"use client";

import * as React from "react";

import type { SaveState } from "@/lib/workspace";

/** How long the simulated save spends in its "saving" state. */
const SAVE_DURATION_MS = 900;

export interface SaveStatusController {
  status: SaveState;
  /** Mark the design as having unsaved changes. */
  markDirty: () => void;
  /** Run a save — no-op while one is already in flight. */
  save: () => void;
  /** The last save's failure, cleared when the next one starts. */
  error: string | null;
}

/**
 * Drives the header's save indicator.
 *
 * Standalone there is nowhere to persist to, so the transition to "saved" is
 * still on a timer — the local draft is written continuously by the recovery
 * hook regardless, so the button is confirming rather than causing it.
 *
 * Embedded in a storefront, `persist` is supplied and the indicator follows the
 * real request instead: a failed save has to stop reading as a successful one.
 */
export function useSaveStatus(
  initial: SaveState = "saved",
  persist?: () => Promise<{ ok: true } | { ok: false; error: string }>,
): SaveStatusController {
  const [status, setStatus] = React.useState<SaveState>(initial);
  const [error, setError] = React.useState<string | null>(null);
  // Mirrors `status` so the callbacks can read it without a state updater
  // doing the scheduling — updaters have to stay side-effect free.
  const statusRef = React.useRef<SaveState>(initial);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Kept in a ref so `save` stays stable while the caller re-renders.
  const persistRef = React.useRef(persist);
  persistRef.current = persist;
  /** False once unmounted, so a slow save can't set state on a dead hook. */
  const alive = React.useRef(true);

  const apply = React.useCallback((next: SaveState) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  React.useEffect(
    () => () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const markDirty = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    apply("unsaved");
  }, [apply]);

  const save = React.useCallback(() => {
    if (statusRef.current === "saving") return;
    if (timer.current) clearTimeout(timer.current);
    setError(null);
    apply("saving");

    const run = persistRef.current;
    if (!run) {
      timer.current = setTimeout(() => apply("saved"), SAVE_DURATION_MS);
      return;
    }

    void run().then(
      (result) => {
        if (!alive.current) return;
        // A failed save leaves the design unsaved, not saved — the indicator is
        // the only thing telling the shopper their work is safe.
        apply(result.ok ? "saved" : "unsaved");
        if (!result.ok) setError(result.error);
      },
      (cause: unknown) => {
        if (!alive.current) return;
        apply("unsaved");
        setError(cause instanceof Error ? cause.message : "Could not save.");
      },
    );
  }, [apply]);

  return { status, markDirty, save, error };
}
