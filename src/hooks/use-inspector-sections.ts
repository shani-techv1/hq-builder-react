"use client";

import * as React from "react";

import { createPersistedValue } from "@/lib/persisted-value";

/**
 * Which inspector sections are open.
 *
 * Serialised as `id=1,id=0` pairs rather than a list of open ids, because each
 * section has its own default — advanced groups start collapsed — and a bare
 * list can't distinguish "closed by the user" from "never touched".
 */
const store = createPersistedValue<string>(
  "design-builder:inspector-sections",
  "",
);

function parse(raw: string): Record<string, boolean> {
  const entries: Record<string, boolean> = {};
  for (const pair of raw.split(",")) {
    if (!pair) continue;
    const [id, value] = pair.split("=");
    if (id) entries[id] = value === "1";
  }
  return entries;
}

function serialise(state: Record<string, boolean>): string {
  return Object.entries(state)
    .map(([id, open]) => `${id}=${open ? 1 : 0}`)
    .join(",");
}

export interface InspectorSections {
  /** Open state for a section, falling back to its own default. */
  isOpen: (id: string, defaultOpen: boolean) => boolean;
  toggle: (id: string, defaultOpen: boolean) => void;
}

export function useInspectorSections(): InspectorSections {
  const raw = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const state = React.useMemo(() => parse(raw), [raw]);

  const isOpen = React.useCallback(
    (id: string, defaultOpen: boolean) => state[id] ?? defaultOpen,
    [state],
  );

  const toggle = React.useCallback(
    (id: string, defaultOpen: boolean) => {
      const current = state[id] ?? defaultOpen;
      store.set(serialise({ ...state, [id]: !current }));
    },
    [state],
  );

  return { isOpen, toggle };
}
