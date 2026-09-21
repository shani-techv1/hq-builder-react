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
 * Whose draft, and for which product.
 *
 * One editor serves every product a shop sells sheets for, and anyone who uses
 * this browser. A draft is filed against both, so a sheet started for one
 * product is never offered on another's page, and one account's work is never
 * offered to the next person to sign in — or to nobody in particular.
 */
export interface DraftScope {
  /** The signed-in account, or `null` for someone who hasn't signed in. */
  accountId: string | null;
  /** The product being built for, or `null` in the standalone editor. */
  productId: string | null;
}

/**
 * The key a scope's draft is stored under.
 *
 * Still one draft per scope, as there was once one draft in all: the editor
 * edits one design at a time, and "the draft" stays easier to reason about than
 * "the most recent of the drafts". Each part is encoded, so no id can contain
 * the separator and pass for a different account's key.
 */
export function draftKey({ accountId, productId }: DraftScope): string {
  const account = accountId
    ? `account:${encodeURIComponent(accountId)}`
    : "guest";
  const product = productId
    ? `product:${encodeURIComponent(productId)}`
    : "standalone";
  return `draft:${account}:${product}`;
}

/**
 * Where the single draft lived before drafts had owners.
 *
 * Read once more, by the first scope to find nothing of its own, and moved
 * there — a sheet someone was halfway through when this shipped should come
 * back to them rather than be stranded under a key nothing reads.
 */
const LEGACY_DRAFT_KEY = "current";

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
 * Write a draft under `key`, replacing whatever was there.
 *
 * Resolves `true` when it landed. Callers use that only to decide what to tell
 * the user; none of them treat a `false` as fatal.
 */
export async function saveDraft(
  key: string,
  design: SerializedDesign,
): Promise<boolean> {
  const result = await withStore<IDBValidKey>("readwrite", (store) =>
    store.put(design, key),
  );
  return result !== null;
}

/**
 * The draft under `key`, unvalidated — pass it through `deserializeDocument`.
 *
 * Falls back to the pre-scoping draft when the key has none, and moves it under
 * the key in the same transaction: either both the move and the delete land or
 * neither does, so the old draft cannot end up in two places or in none.
 */
export async function loadDraft(key: string): Promise<unknown> {
  const database = await openDatabase();
  if (!database) return null;

  return new Promise((resolve) => {
    let found: unknown = null;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      database.close();
      resolve(found);
    };

    try {
      const transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);

      const own = store.get(key);
      own.onsuccess = () => {
        if (own.result !== undefined) {
          found = own.result;
          return;
        }
        const legacy = store.get(LEGACY_DRAFT_KEY);
        legacy.onsuccess = () => {
          if (legacy.result === undefined) return;
          found = legacy.result;
          store.put(legacy.result, key);
          store.delete(LEGACY_DRAFT_KEY);
        };
      };

      transaction.oncomplete = settle;
      // A failed request aborts the transaction, so the abort is the one place
      // a failure is handled. The move is rolled back whole: the legacy draft
      // is still there for the next load, and nothing is offered this time.
      transaction.onabort = () => {
        found = null;
        settle();
      };
    } catch {
      settle();
    }
  });
}

/**
 * Throw the draft under `key` away. Called when the user starts fresh, empties
 * the sheet, or carries the design into another scope.
 */
export async function clearDraft(key: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(key));
}
