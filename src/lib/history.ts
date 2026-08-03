/**
 * Undo/redo, as a pure service.
 *
 * Nothing here knows about React, the canvas or any particular editor action —
 * it stores snapshots of whatever state it is handed and moves between them.
 * The editor's reducer decides *what* is worth recording; this file decides
 * *how* the stack behaves.
 *
 * Snapshots are stored by reference, never cloned. The editor's document state
 * is already immutable — every reducer case returns fresh containers over the
 * same object references — so a snapshot costs one array of pointers, not a
 * copy of the artwork.
 */

/** Maximum number of undo steps retained. The oldest are discarded first. */
export const HISTORY_LIMIT = 100;

export interface HistoryState<S> {
  /** Snapshots before `present`, oldest first. */
  past: S[];
  present: S;
  /** Snapshots undone from `present`, nearest first. */
  future: S[];
  /**
   * Coalescing tag of the edit that produced `present`. A record carrying the
   * same tag folds into that entry rather than pushing a new one — which is
   * what turns a slider drag into a single undo step.
   */
  lastTag: string | null;
}

/** What the reducer says should happen to history for a given action. */
export interface HistoryPolicy {
  /** False for anything that isn't an edit: selection, viewport, hover. */
  record: boolean;
  /** Consecutive records sharing a tag merge into one entry. */
  coalesceTag?: string;
}

export function initHistory<S>(present: S): HistoryState<S> {
  return { past: [], present, future: [], lastTag: null };
}

/**
 * Advance to `next`, deciding whether that becomes an undo step.
 *
 * A non-recorded change still moves `present` — selection has to update on
 * screen — but it also ends any run of coalescing, so selecting a different
 * object between two opacity drags keeps them as separate undo steps.
 */
export function record<S>(
  history: HistoryState<S>,
  next: S,
  policy: HistoryPolicy,
  limit: number = HISTORY_LIMIT,
): HistoryState<S> {
  if (next === history.present) return history;

  if (!policy.record) {
    return { ...history, present: next, lastTag: null };
  }

  const tag = policy.coalesceTag ?? null;
  const continuesRun =
    tag !== null && tag === history.lastTag && history.past.length > 0;

  if (continuesRun) {
    // `past` already holds the state from before the run started, which is
    // exactly where undo should land — so only `present` moves.
    return { ...history, present: next, future: [] };
  }

  const past = [...history.past, history.present];
  return {
    past: past.length > limit ? past.slice(past.length - limit) : past,
    present: next,
    future: [],
    lastTag: tag,
  };
}

export const canUndo = <S,>(history: HistoryState<S>): boolean =>
  history.past.length > 0;

export const canRedo = <S,>(history: HistoryState<S>): boolean =>
  history.future.length > 0;

export function undo<S>(history: HistoryState<S>): HistoryState<S> {
  if (!canUndo(history)) return history;

  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    // Landing on a restored state ends any coalescing run: the next edit is a
    // new step even if it touches the same property.
    lastTag: null,
  };
}

export function redo<S>(history: HistoryState<S>): HistoryState<S> {
  if (!canRedo(history)) return history;

  const [present, ...future] = history.future;
  return {
    past: [...history.past, history.present],
    present,
    future,
    lastTag: null,
  };
}

/** Drop every step, keeping what's on screen. */
export function clearHistory<S>(history: HistoryState<S>): HistoryState<S> {
  return { past: [], present: history.present, future: [], lastTag: null };
}
