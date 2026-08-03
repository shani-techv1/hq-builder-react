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
}

/**
 * Drives the header's save indicator.
 *
 * There is no persistence layer yet, so the transition to "saved" is on a
 * timer. It lives in a hook rather than inline in the header so swapping the
 * timeout for a real request later touches this file alone.
 */
export function useSaveStatus(
  initial: SaveState = "saved",
): SaveStatusController {
  const [status, setStatus] = React.useState<SaveState>(initial);
  // Mirrors `status` so the callbacks can read it without a state updater
  // doing the scheduling — updaters have to stay side-effect free.
  const statusRef = React.useRef<SaveState>(initial);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = React.useCallback((next: SaveState) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  React.useEffect(
    () => () => {
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
    apply("saving");
    timer.current = setTimeout(() => apply("saved"), SAVE_DURATION_MS);
  }, [apply]);

  return { status, markDirty, save };
}
