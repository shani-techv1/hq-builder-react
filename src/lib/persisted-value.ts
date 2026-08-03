/**
 * A tiny external store backed by `localStorage`.
 *
 * `useSyncExternalStore` is what lets a client-only value hydrate without a
 * mismatch, so anything the UI should remember across reloads goes through one
 * of these rather than being seeded from an effect.
 */

type Listener = () => void;

export interface PersistedValue<T extends string> {
  subscribe: (listener: Listener) => () => void;
  /** Cached, so the snapshot is referentially stable between changes. */
  getSnapshot: () => T;
  /** Nothing is stored during SSR, so the default renders on the server. */
  getServerSnapshot: () => T;
  set: (value: T) => void;
}

export function createPersistedValue<T extends string>(
  key: string,
  fallback: T,
  isValid: (value: string) => boolean = () => true,
): PersistedValue<T> {
  const listeners = new Set<Listener>();
  let snapshot: T | undefined;

  const read = (): T => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored && isValid(stored) ? (stored as T) : fallback;
    } catch {
      // Storage can be blocked entirely. Remembering is a convenience.
      return fallback;
    }
  };

  const emit = () => {
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);

      const onStorage = (event: StorageEvent) => {
        if (event.key !== key) return;
        snapshot = undefined;
        emit();
      };
      window.addEventListener("storage", onStorage);

      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },

    getSnapshot() {
      if (snapshot === undefined) snapshot = read();
      return snapshot;
    },

    getServerSnapshot: () => fallback,

    set(value) {
      snapshot = value;
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // See `read` — persistence is best-effort.
      }
      emit();
    },
  };
}
