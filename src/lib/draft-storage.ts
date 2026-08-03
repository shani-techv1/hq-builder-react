/**
 * Where the current design is kept between visits.
 *
 * IndexedDB rather than `localStorage` because a draft carries the uploaded
 * artwork with it. `localStorage` holds strings, so images would have to be
 * base64 — a third larger, synchronous to read and write, and against a quota
 * of a few megabytes that one photo can exhaust. IndexedDB stores a `Blob`
 * natively, asynchronously, with room for real files.
 *
 * Every operation is best-effort. Private browsing, a full disk and a blocked
 * origin all surface here, and none of them are worth failing an edit over —
 * a draft that cannot be written is a lost convenience, not a lost design.
 */

import type { SerializedDesign } from "@/lib/design-document";

const DATABASE = "design-builder";
const DATABASE_VERSION = 1;
const STORE = "drafts";

/**
 * One draft at a time, under a fixed key.
 *
 * The editor edits one design, so a keyed collection would be a list that
 * never has a second entry — and "the draft" is easier to reason about than
 * "the most recent of the drafts".
 */
const DRAFT_KEY = "current";

/** Resolves to `null` wherever IndexedDB is unavailable or refuses to open. */
function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DATABASE, DATABASE_VERSION);
    } catch {
      // Firefox throws rather than failing the request in private windows.
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    // Another tab is holding an older version open. Rather than hang, give up
    // — that tab is still autosaving, so nothing is lost.
    request.onblocked = () => resolve(null);
  });
}

/** Run one transaction and close the connection, whatever the outcome. */
function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDatabase().then(
    (database) =>
      new Promise<T | null>((resolve) => {
        if (!database) {
          resolve(null);
          return;
        }

        const settle = (value: T | null) => {
          database.close();
          resolve(value);
        };

        try {
          const transaction = database.transaction(STORE, mode);
          const request = work(transaction.objectStore(STORE));

          request.onsuccess = () => settle(request.result ?? null);
          request.onerror = () => settle(null);
          // Quota errors arrive on the transaction, not the request.
          transaction.onabort = () => settle(null);
        } catch {
          settle(null);
        }
      }),
  );
}

/**
 * Write the draft, replacing whatever was there.
 *
 * Resolves `true` when it landed. Callers use that only to decide what to tell
 * the user; none of them treat a `false` as fatal.
 */
export async function saveDraft(design: SerializedDesign): Promise<boolean> {
  const result = await withStore<IDBValidKey>("readwrite", (store) =>
    store.put(design, DRAFT_KEY),
  );
  return result !== null;
}

/** The stored draft, unvalidated — pass it through `deserializeDocument`. */
export function loadDraft(): Promise<unknown> {
  return withStore<unknown>("readonly", (store) => store.get(DRAFT_KEY));
}

/** Throw the draft away. Called when the user starts fresh, or empties the sheet. */
export async function clearDraft(): Promise<void> {
  await withStore("readwrite", (store) => store.delete(DRAFT_KEY));
}
