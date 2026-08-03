"use client";

import * as React from "react";

import {
  MOCK_ARTWORK,
  applyPatch,
  boundingBox,
  createPlacedAsset,
  createTextObject,
  renameFirstLine,
  type CanvasObject,
  type CanvasObjectPatch,
  type PlacementPoint,
  type SelectionBox,
} from "@/lib/canvas-objects";
import type { Asset } from "@/lib/assets";
import type { DesignDocument } from "@/lib/design-document";
import {
  canRedo,
  canUndo,
  clearHistory,
  initHistory,
  record,
  redo,
  undo,
  type HistoryPolicy,
  type HistoryState,
} from "@/lib/history";
import { DEFAULT_SHEET_SIZE, sheetInches } from "@/lib/workspace";

/** Offset applied to a duplicate so it doesn't land exactly on its source. */
const DUPLICATE_OFFSET = 3;

/**
 * The undoable document.
 *
 * Sheet size lives here rather than with the workspace settings because it
 * describes the artwork, not the view — resizing the sheet is an edit, while
 * zoom, grid and snap are not.
 */
interface CanvasState {
  objects: CanvasObject[];
  selectedIds: string[];
  sheetSize: string;
  /** Monotonic counter behind duplicate ids — keeps the reducer deterministic. */
  copyCount: number;
  /** The same, for placements: the id of the nth asset dropped on this sheet. */
  placeCount: number;
}

type CanvasAction =
  | { type: "select"; id: string; additive: boolean }
  | { type: "setSelection"; ids: string[] }
  | { type: "patchObjects"; updates: ObjectPatch[] }
  | { type: "clear" }
  | { type: "placeAsset"; asset: Asset; at?: PlacementPoint }
  | { type: "addText"; id: string }
  | { type: "renameObject"; id: string; name: string }
  | { type: "syncMetrics"; updates: ObjectPatch[] }
  | { type: "addMockArtwork" }
  | { type: "duplicate" }
  | { type: "delete" }
  | { type: "rotate"; degrees: number }
  | { type: "toggleLock" }
  | { type: "setOpacity"; opacity: number }
  | { type: "patch"; patch: CanvasObjectPatch }
  | { type: "patchObject"; id: string; patch: CanvasObjectPatch }
  | { type: "setHidden"; id: string; hidden: boolean }
  | { type: "deleteObject"; id: string }
  | { type: "setOrder"; ids: string[] }
  | { type: "moveToEnd"; id: string; edge: "front" | "back" }
  | { type: "setSheetSize"; sheetSize: string };

/**
 * Actions the history wrapper handles itself.
 *
 * `replaceDocument` belongs here rather than with the document actions because
 * it does not edit the design, it swaps it — undoing back into the design that
 * was on screen before a draft was restored would be a trap.
 */
type HistoryAction =
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clearHistory" }
  | { type: "replaceDocument"; document: DesignDocument };

type EditorAction = CanvasAction | HistoryAction;

/** One object's worth of change, used when a whole selection is transformed. */
export interface ObjectPatch {
  id: string;
  patch: CanvasObjectPatch;
}

const INITIAL_STATE: CanvasState = {
  objects: [],
  selectedIds: [],
  sheetSize: DEFAULT_SHEET_SIZE,
  copyCount: 0,
  placeCount: 0,
};

/** Apply a change to the selected objects, leaving the rest untouched. */
function patchSelected(
  state: CanvasState,
  patch: (object: CanvasObject) => CanvasObject,
): CanvasState {
  return {
    ...state,
    objects: state.objects.map((object) =>
      state.selectedIds.includes(object.id) ? patch(object) : object,
    ),
  };
}

/**
 * Pure and deterministic, so React can safely re-run it — which is also what
 * makes this straightforward to swap for canvas-owned state later.
 */
function documentReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case "select": {
      if (!action.additive) return { ...state, selectedIds: [action.id] };
      const selectedIds = state.selectedIds.includes(action.id)
        ? state.selectedIds.filter((id) => id !== action.id)
        : [...state.selectedIds, action.id];
      return { ...state, selectedIds };
    }

    case "setSelection": {
      // Bail when nothing changed, so echoes from the canvas don't re-render.
      const same =
        state.selectedIds.length === action.ids.length &&
        state.selectedIds.every((id) => action.ids.includes(id));
      return same ? state : { ...state, selectedIds: action.ids };
    }

    case "patchObjects": {
      if (action.updates.length === 0) return state;
      const byId = new Map(action.updates.map((u) => [u.id, u.patch]));
      return {
        ...state,
        objects: state.objects.map((object) => {
          const patch = byId.get(object.id);
          return patch ? applyPatch(object, patch) : object;
        }),
      };
    }

    case "clear":
      return state.selectedIds.length === 0 ? state : { ...state, selectedIds: [] };

    case "placeAsset": {
      const placeCount = state.placeCount + 1;
      // Sized against this sheet, so the same file lands print-ready whether
      // it is dropped on a 22×12 or a 22×60.
      const placed = createPlacedAsset(
        action.asset,
        sheetInches(state.sheetSize),
        placeCount,
        action.at,
      );
      return {
        ...state,
        objects: [...state.objects, placed],
        // Placing something is the start of working on it, so it arrives
        // selected and the inspector is already describing it.
        selectedIds: [placed.id],
        placeCount,
      };
    }

    case "addText": {
      const text = createTextObject(sheetInches(state.sheetSize), action.id);
      return {
        ...state,
        objects: [...state.objects, text],
        selectedIds: [text.id],
      };
    }

    /**
     * Rename from the layer list.
     *
     * A text layer is named by its own first line, so renaming one edits the
     * text rather than a label beside it — otherwise the list and the sheet
     * would each hold a name and the two would drift.
     */
    case "renameObject":
      return {
        ...state,
        objects: state.objects.map((object) => {
          if (object.id !== action.id) return object;
          return object.kind === "text"
            ? { ...object, text: renameFirstLine(object.text ?? "", action.name) }
            : { ...object, name: action.name };
        }),
      };

    /**
     * Geometry the renderer measured, for objects that size themselves.
     *
     * Never an edit: this is the editor catching up with what text already
     * occupies, so it must not land on the undo stack — see `historyPolicy`.
     */
    case "syncMetrics": {
      if (action.updates.length === 0) return state;
      const byId = new Map(action.updates.map((update) => [update.id, update.patch]));
      return {
        ...state,
        objects: state.objects.map((object) => {
          const patch = byId.get(object.id);
          return patch ? applyPatch(object, patch) : object;
        }),
      };
    }

    case "addMockArtwork":
      return {
        ...state,
        // Stamp the placement size so the inspector's scale control has a
        // fixed 100% to measure against.
        objects: MOCK_ARTWORK.map((object) => ({
          ...object,
          baseWidth: object.width,
          baseHeight: object.height,
        })),
        selectedIds: [],
      };

    case "duplicate": {
      if (state.selectedIds.length === 0) return state;
      const copyCount = state.copyCount + 1;
      const copies = state.objects
        .filter((object) => state.selectedIds.includes(object.id))
        .map((object) => ({
          ...object,
          id: `${object.id}-copy-${copyCount}`,
          name: `${object.name} copy`,
          // Keep the copy on the sheet even when the source sits at an edge.
          x: Math.min(object.x + DUPLICATE_OFFSET, 100 - object.width),
          y: Math.min(object.y + DUPLICATE_OFFSET, 100 - object.height),
          locked: false,
        }));

      return {
        ...state,
        objects: [...state.objects, ...copies],
        selectedIds: copies.map((copy) => copy.id),
        copyCount,
      };
    }

    case "delete": {
      if (state.selectedIds.length === 0) return state;
      return {
        ...state,
        objects: state.objects.filter(
          (object) => !state.selectedIds.includes(object.id),
        ),
        selectedIds: [],
      };
    }

    case "rotate":
      return patchSelected(state, (object) => ({
        ...object,
        rotation: (object.rotation + action.degrees) % 360,
      }));

    case "toggleLock":
      return patchSelected(state, (object) => ({
        ...object,
        locked: !object.locked,
      }));

    case "setOpacity":
      return patchSelected(state, (object) => ({
        ...object,
        opacity: action.opacity,
      }));

    case "patch":
      return patchSelected(state, (object) => applyPatch(object, action.patch));

    case "patchObject":
      return {
        ...state,
        objects: state.objects.map((object) =>
          object.id === action.id ? applyPatch(object, action.patch) : object,
        ),
      };

    case "setHidden":
      return {
        ...state,
        objects: state.objects.map((object) =>
          object.id === action.id
            ? { ...object, hidden: action.hidden }
            : object,
        ),
        // A hidden object can't be shown as selected — there'd be a selection
        // outline with nothing inside it.
        selectedIds: action.hidden
          ? state.selectedIds.filter((id) => id !== action.id)
          : state.selectedIds,
      };

    case "deleteObject":
      return {
        ...state,
        objects: state.objects.filter((object) => object.id !== action.id),
        selectedIds: state.selectedIds.filter((id) => id !== action.id),
      };

    case "setOrder": {
      // Rebuild from the incoming id order, ignoring anything unknown and
      // keeping objects the caller didn't mention.
      const byId = new Map(state.objects.map((object) => [object.id, object]));
      const reordered = action.ids
        .map((id) => byId.get(id))
        .filter((object): object is CanvasObject => Boolean(object));
      const missing = state.objects.filter(
        (object) => !action.ids.includes(object.id),
      );
      return { ...state, objects: [...missing, ...reordered] };
    }

    case "moveToEnd": {
      const target = state.objects.find((object) => object.id === action.id);
      if (!target) return state;
      const rest = state.objects.filter((object) => object.id !== action.id);
      // Later in the array paints on top, so "front" is the end of it.
      return {
        ...state,
        objects:
          action.edge === "front" ? [...rest, target] : [target, ...rest],
      };
    }

    case "setSheetSize":
      return state.sheetSize === action.sheetSize
        ? state
        : { ...state, sheetSize: action.sheetSize };

    default:
      return state;
  }
}

/**
 * Stable tag for a patch, so edits to the same property collapse together.
 *
 * Typography is expanded rather than counted as one key: a font change
 * followed by a size change are two decisions and have to be two undo steps,
 * while dragging a single slider stays one.
 */
const patchTag = (patch: CanvasObjectPatch) =>
  Object.entries(patch)
    .map(([key, value]) =>
      key === "typography" && value
        ? `typography.${Object.keys(value).sort().join(".")}`
        : key,
    )
    .sort()
    .join(",");

/**
 * Whether an action belongs in history, and whether it continues a run.
 *
 * One table, so adding an editor action is a two-line change: a case in
 * {@link documentReducer} and a case here. Anything not listed is recorded as
 * its own step, which is the safe default — a new edit that nobody classified
 * is still undoable.
 */
function historyPolicy(action: CanvasAction): HistoryPolicy {
  switch (action.type) {
    // Selection is restored *by* undo but never creates a step of its own.
    case "select":
    case "setSelection":
    case "clear":
      return { record: false };

    /* Text measured by the renderer. Not an edit — the user changed the font
       or the content, and this is only the box catching up with it. Recording
       it would put a second, meaningless step behind every real one. */
    case "syncMetrics":
      return { record: false };

    // A rename is one continuous edit however many keystrokes it took.
    case "renameObject":
      return { record: true, coalesceTag: `rename:${action.id}` };

    /* Continuous edits — a slider drag or a held arrow key dispatches many
       times, and all of it should collapse into one step. */
    case "setOpacity":
      return { record: true, coalesceTag: "opacity" };
    case "patch":
      return { record: true, coalesceTag: `patch:${patchTag(action.patch)}` };
    case "patchObject":
      return {
        record: true,
        coalesceTag: `patchObject:${action.id}:${patchTag(action.patch)}`,
      };
    // Reordering reports continuously while the layer is being dragged.
    case "setOrder":
      return { record: true, coalesceTag: "order" };

    /* Discrete edits — move/resize/rotate arrive as a single dispatch when the
       canvas gesture ends, so they need no coalescing. */
    default:
      return { record: true };
  }
}

/**
 * The document reducer with an undo stack wrapped around it.
 *
 * Recording here rather than in components is what makes history total: every
 * edit already goes through this reducer, so none can be forgotten, and the
 * policy above is the single place that decides what counts.
 */
function editorReducer(
  state: HistoryState<CanvasState>,
  action: EditorAction,
): HistoryState<CanvasState> {
  switch (action.type) {
    case "undo":
      return undo(state);
    case "redo":
      return redo(state);
    case "clearHistory":
      return clearHistory(state);
    case "replaceDocument":
      // A fresh stack, not an entry on the old one: the restored design has no
      // shared past with whatever was open, so there is nothing to step back
      // through.
      return initHistory({ ...action.document, selectedIds: [] });
    default:
      return record(state, documentReducer(state.present, action), historyPolicy(action));
  }
}

export interface CanvasInteraction {
  objects: CanvasObject[];
  selectedIds: string[];
  selectedObjects: CanvasObject[];
  /** Axis-aligned box around the whole selection, in sheet percentages. */
  selectionBox: SelectionBox | null;
  hasSelection: boolean;

  /** Select an object. `additive` (shift-click) extends the selection. */
  selectObject: (id: string, additive?: boolean) => void;
  /** Replace the whole selection — how the canvas reports what it selected. */
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  /** Apply per-object changes in one go, e.g. after dragging a selection. */
  patchObjects: (updates: ObjectPatch[]) => void;

  /**
   * Put a library asset on the sheet, centred on `at` or on the sheet itself.
   *
   * One undo step: the placement arrives selected, and undoing it takes the
   * artwork off the sheet without touching the library it came from.
   */
  placeAsset: (asset: Asset, at?: PlacementPoint) => void;
  /**
   * Add a text layer at the centre of the sheet, selected and ready to type
   * into. One undo step; the typing that follows is another.
   */
  addText: () => void;
  /**
   * The text layer waiting to be edited, or `null`.
   *
   * Deliberately outside the document: it is a one-shot instruction to the
   * canvas, not a fact about the design, and undoing back past a creation must
   * not drop the user into an editor again.
   */
  pendingEditId: string | null;
  /** Called by the canvas once it has put the caret in that layer. */
  clearPendingEdit: () => void;
  /**
   * Geometry the renderer measured for objects that size themselves.
   * Never recorded — see the history policy.
   */
  syncMetrics: (updates: ObjectPatch[]) => void;
  /** Drop the mock artwork onto the sheet. */
  addMockArtwork: () => void;
  duplicateSelection: () => void;
  deleteSelection: () => void;
  rotateSelection: (degrees: number) => void;
  toggleLockSelection: () => void;
  setSelectionOpacity: (opacity: number) => void;
  /**
   * Apply an arbitrary change to every selected object. This is what the
   * inspector edits through — one entry point rather than an action per
   * property, and the same shape a canvas-backed implementation would expose.
   */
  patchSelection: (patch: CanvasObjectPatch) => void;

  /* --------------------------- Per-object edits -------------------------- */
  /** Change one object regardless of what is selected — the layer list's path. */
  patchObject: (id: string, patch: CanvasObjectPatch) => void;
  /**
   * Rename one object. Distinct from `patchObject` because a text layer has no
   * name of its own — renaming one rewrites its first line.
   */
  renameObject: (id: string, name: string) => void;
  setObjectHidden: (id: string, hidden: boolean) => void;
  deleteObject: (id: string) => void;
  /**
   * Replace the stacking order with `ids`, bottom-most first. The objects
   * array *is* the z-order — later entries paint on top.
   */
  setObjectOrder: (ids: string[]) => void;
  moveObjectToEdge: (id: string, edge: "front" | "back") => void;

  /* ------------------------------- Sheet -------------------------------- */
  /** Sheet size preset. Part of the document, so it undoes with everything else. */
  sheetSize: string;
  setSheetSize: (sheetSize: string) => void;

  /* ---------------------------- Persistence ----------------------------- */
  /**
   * The design, without the parts that describe looking at it.
   *
   * Selection is left out deliberately: it is the one piece of `CanvasState`
   * that changes without the design changing, so keeping it out means anything
   * watching this object for changes is watching real edits only.
   */
  document: DesignDocument;
  /** Swap in a restored design, discarding whatever was open and its history. */
  replaceDocument: (document: DesignDocument) => void;

  /* ------------------------------ History ------------------------------- */
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

/**
 * The editor's document: objects, selection, sheet size and the undo stack.
 *
 * This is the source of truth Fabric renders from and reports back to. Every
 * mutation is a dispatch, which is what lets history be complete without any
 * component knowing history exists.
 */
export function useCanvasInteraction(): CanvasInteraction {
  const [history, dispatch] = React.useReducer(
    editorReducer,
    INITIAL_STATE,
    initHistory,
  );
  const state = history.present;

  /**
   * The text layer the canvas should drop a caret into next.
   *
   * Outside the reducer because it is an instruction with a lifetime of one
   * render, not part of the design — putting it in the document would make it
   * undoable, and undoing into an open text editor is nobody's intent.
   */
  const [pendingEditId, setPendingEditId] = React.useState<string | null>(null);

  /** Text ids are per-session and never reused, so a counter is enough. */
  const textCount = React.useRef(0);

  const selectedObjects = React.useMemo(
    () => state.objects.filter((object) => state.selectedIds.includes(object.id)),
    [state.objects, state.selectedIds],
  );

  const selectionBox = React.useMemo(
    () => boundingBox(selectedObjects),
    [selectedObjects],
  );

  /**
   * Identity changes only when the design does.
   *
   * `state.objects` is a fresh array after every edit and the same array after
   * a selection change, which is what lets autosave key off this and stay out
   * of the way of clicking around.
   */
  const document = React.useMemo<DesignDocument>(
    () => ({
      objects: state.objects,
      sheetSize: state.sheetSize,
      copyCount: state.copyCount,
      placeCount: state.placeCount,
    }),
    [state.objects, state.sheetSize, state.copyCount, state.placeCount],
  );

  const selectObject = React.useCallback(
    (id: string, additive = false) => dispatch({ type: "select", id, additive }),
    [],
  );

  return {
    objects: state.objects,
    selectedIds: state.selectedIds,
    selectedObjects,
    selectionBox,
    hasSelection: selectedObjects.length > 0,

    selectObject,
    setSelection: React.useCallback(
      (ids: string[]) => dispatch({ type: "setSelection", ids }),
      [],
    ),
    clearSelection: React.useCallback(() => dispatch({ type: "clear" }), []),
    patchObjects: React.useCallback(
      (updates: ObjectPatch[]) => dispatch({ type: "patchObjects", updates }),
      [],
    ),
    placeAsset: React.useCallback(
      (asset: Asset, at?: PlacementPoint) =>
        dispatch({ type: "placeAsset", asset, at }),
      [],
    ),
    addText: React.useCallback(() => {
      textCount.current += 1;
      const id = `text-${textCount.current}`;
      dispatch({ type: "addText", id });
      setPendingEditId(id);
    }, []),
    pendingEditId,
    clearPendingEdit: React.useCallback(() => setPendingEditId(null), []),
    syncMetrics: React.useCallback(
      (updates: ObjectPatch[]) => dispatch({ type: "syncMetrics", updates }),
      [],
    ),
    addMockArtwork: React.useCallback(
      () => dispatch({ type: "addMockArtwork" }),
      [],
    ),
    duplicateSelection: React.useCallback(
      () => dispatch({ type: "duplicate" }),
      [],
    ),
    deleteSelection: React.useCallback(() => dispatch({ type: "delete" }), []),
    rotateSelection: React.useCallback(
      (degrees: number) => dispatch({ type: "rotate", degrees }),
      [],
    ),
    toggleLockSelection: React.useCallback(
      () => dispatch({ type: "toggleLock" }),
      [],
    ),
    setSelectionOpacity: React.useCallback(
      (opacity: number) => dispatch({ type: "setOpacity", opacity }),
      [],
    ),
    patchSelection: React.useCallback(
      (patch: CanvasObjectPatch) => dispatch({ type: "patch", patch }),
      [],
    ),

    patchObject: React.useCallback(
      (id: string, patch: CanvasObjectPatch) =>
        dispatch({ type: "patchObject", id, patch }),
      [],
    ),
    renameObject: React.useCallback(
      (id: string, name: string) => dispatch({ type: "renameObject", id, name }),
      [],
    ),
    setObjectHidden: React.useCallback(
      (id: string, hidden: boolean) => dispatch({ type: "setHidden", id, hidden }),
      [],
    ),
    deleteObject: React.useCallback(
      (id: string) => dispatch({ type: "deleteObject", id }),
      [],
    ),
    setObjectOrder: React.useCallback(
      (ids: string[]) => dispatch({ type: "setOrder", ids }),
      [],
    ),
    moveObjectToEdge: React.useCallback(
      (id: string, edge: "front" | "back") =>
        dispatch({ type: "moveToEnd", id, edge }),
      [],
    ),

    sheetSize: state.sheetSize,
    setSheetSize: React.useCallback(
      (sheetSize: string) => dispatch({ type: "setSheetSize", sheetSize }),
      [],
    ),

    document,
    replaceDocument: React.useCallback((next: DesignDocument) => {
      // Text ids come from a counter, not from the document, so a restored
      // design has to push it past whatever it already contains — otherwise
      // the next "Add text" would reuse an id that is already on the sheet.
      textCount.current = next.objects.reduce((highest, object) => {
        const match = /^text-(\d+)$/.exec(object.id);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, textCount.current);

      dispatch({ type: "replaceDocument", document: next });
    }, []),

    undo: React.useCallback(() => dispatch({ type: "undo" }), []),
    redo: React.useCallback(() => dispatch({ type: "redo" }), []),
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    clearHistory: React.useCallback(() => dispatch({ type: "clearHistory" }), []),
  };
}
