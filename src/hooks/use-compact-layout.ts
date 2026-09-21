"use client";

import * as React from "react";

/**
 * Narrower than Tailwind's `md` breakpoint, 48rem.
 *
 * Written as the exact complement of the query Tailwind compiles `md:` into, so
 * a component switching on this hook and a class switching on `md:` always
 * change over at the same width. Were the two ever a pixel apart, there would
 * be a window size showing the rail and the bottom bar at once, or neither.
 */
const COMPACT_QUERY = "(width < 48rem)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(COMPACT_QUERY).matches;

/**
 * The server has no screen to measure, so it renders the desktop editor.
 *
 * Everything that is visible before anything is opened — the rail against the
 * bottom bar, the toolbar's groups — switches in CSS instead, so a phone's
 * first paint is already the phone layout. This hook only decides what CSS
 * cannot: which way the panel opens, and how far the sheet is zoomed.
 */
const getServerSnapshot = () => false;

/**
 * Whether the editor is laid out for a phone.
 *
 * Width, not the kind of pointer: a phone-sized window on a laptop is as short
 * of room as a phone, and a tablet held landscape has the room for the desktop
 * layout whatever it is touched with.
 */
export function useCompactLayout(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
