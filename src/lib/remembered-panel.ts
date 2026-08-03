import type { PanelId } from "@/lib/navigation";

const STORAGE_KEY = "design-builder:last-panel";

/**
 * The last menu the user opened, persisted so the rail still shows where they
 * left off after a reload.
 *
 * Modelled as an external store rather than component state seeded in an
 * effect: `localStorage` isn't readable while rendering on the server, and
 * `useSyncExternalStore` is what lets a client-only value hydrate without a
 * mismatch and without a cascading render.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** `undefined` means "not read yet" — `null` is a legitimate stored value. */
let snapshot: PanelId | null | undefined;

function read(): PanelId | null {
  try {
    return (window.localStorage.getItem(STORAGE_KEY) as PanelId | null) ?? null;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). Remembering
    // the menu is a convenience, so failing quietly is the right trade.
    return null;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeToRememberedPanel(listener: Listener) {
  listeners.add(listener);

  // Another tab changing the value invalidates our cached snapshot.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = undefined;
    emit();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Must return a stable value between changes — hence the cached snapshot. */
export function getRememberedPanel(): PanelId | null {
  if (snapshot === undefined) snapshot = read();
  return snapshot;
}

/** Nothing is remembered during SSR, so the rail renders unselected. */
export function getServerRememberedPanel(): PanelId | null {
  return null;
}

export function rememberPanel(id: PanelId) {
  snapshot = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // See `read` — persistence is best-effort.
  }
  emit();
}
