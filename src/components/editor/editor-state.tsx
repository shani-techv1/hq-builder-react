"use client";

import * as React from "react";

import {
  useCanvasInteraction,
  type CanvasInteraction,
} from "@/hooks/use-canvas-interaction";
import { useAssetLibrary, type AssetLibrary } from "@/hooks/use-asset-library";
import {
  useDraftRecovery,
  type DraftRecovery,
} from "@/hooks/use-draft-recovery";
import {
  DEFAULT_SHEET_BACKGROUND,
  DEFAULT_ZOOM,
  type MeasurementUnit,
} from "@/lib/workspace";
import type { CanvasObjectPatch, PlacementPoint } from "@/lib/canvas-objects";
import type { Asset } from "@/lib/assets";
import {
  serializeDocument,
  type RestoredDesign,
  type SerializedDesign,
} from "@/lib/design-document";
import { getAssetFile, releaseImageCache } from "@/lib/image-cache";

/**
 * Everything about the sheet that isn't an object on it.
 *
 * Shared rather than local to the workspace because two surfaces now drive the
 * same switches — the toolbar above the canvas and the inspector's canvas
 * settings — and a toggle that disagreed with itself would be worse than
 * either one alone.
 */
export interface WorkspaceSettings {
  sheetSize: string;
  setSheetSize: (value: string) => void;
  zoom: number;
  setZoom: (value: number) => void;
  showBackground: boolean;
  setShowBackground: (value: boolean) => void;
  /**
   * Colour the sheet is previewed against when the background is shown.
   *
   * A view setting, like zoom: the sheet prints on transparent film, so this
   * stands in for the garment and never becomes part of the design.
   */
  backgroundColor: string;
  setBackgroundColor: (value: string) => void;
  showGrid: boolean;
  setShowGrid: (value: boolean) => void;
  snapEnabled: boolean;
  setSnapEnabled: (value: boolean) => void;
  unit: MeasurementUnit;
  setUnit: (value: MeasurementUnit) => void;
}

export interface EditorState {
  canvas: CanvasInteraction;
  settings: WorkspaceSettings;
  /**
   * The uploaded artwork available to this editor.
   *
   * Owned here rather than by the Graphics panel because the library outlives
   * it: the panel unmounts every time it is closed, and the canvas has to keep
   * resolving the assets it has placed.
   */
  library: AssetLibrary;
  /** Look up an asset by id — how a placement reaches its file's metadata. */
  findAsset: (id: string | undefined) => Asset | undefined;
  /**
   * Place a library asset on the sheet, centred on `at` or on the sheet.
   *
   * Lives on the editor rather than on either half, because it is the one
   * operation that spans both: the canvas gains an object, and the library
   * counts a use.
   */
  placeAsset: (assetId: string, at?: PlacementPoint) => void;
  /**
   * Local persistence: the startup prompt, and the autosave behind it.
   *
   * Owned here because a design is its document *and* its artwork, and this is
   * the only place that holds both.
   */
  recovery: DraftRecovery;
  /** Apply a design from a draft or an imported file, replacing what's open. */
  restoreDesign: (design: RestoredDesign) => void;
  /** The current design in portable form, for export. */
  snapshotDesign: () => SerializedDesign;
}

const EditorStateContext = React.createContext<EditorState | null>(null);

export interface EditorStateProviderProps {
  /** Called whenever something happens that should count against the save. */
  onDesignChange?: () => void;
  /** The design's name, carried into drafts and exports. */
  designName: string;
  /** Set when a restored design brings its own name. */
  onDesignNameChange: (name: string) => void;
  children: React.ReactNode;
}

/**
 * Owns the canvas selection and the sheet settings for the whole editor.
 *
 * Mutations are wrapped once here so every surface that changes the design
 * marks it unsaved, rather than each call site remembering to.
 */
export function EditorStateProvider({
  onDesignChange,
  designName,
  onDesignNameChange,
  children,
}: EditorStateProviderProps) {
  const base = useCanvasInteraction();
  const library = useAssetLibrary();

  const [zoom, setZoom] = React.useState(DEFAULT_ZOOM);
  const [showBackground, setShowBackground] = React.useState(true);
  const [backgroundColor, setBackgroundColor] = React.useState(
    DEFAULT_SHEET_BACKGROUND,
  );
  const [showGrid, setShowGrid] = React.useState(false);
  const [snapEnabled, setSnapEnabled] = React.useState(true);
  const [unit, setUnit] = React.useState<MeasurementUnit>("in");

  const notify = onDesignChange;

  /* Every object URL the session handed out goes back when the editor does. */
  React.useEffect(() => releaseImageCache, []);

  const canvas: CanvasInteraction = {
    ...base,
    placeAsset: (asset, at) => {
      base.placeAsset(asset, at);
      notify?.();
    },
    addText: () => {
      base.addText();
      notify?.();
    },
    renameObject: (id: string, name: string) => {
      base.renameObject(id, name);
      notify?.();
    },
    addMockArtwork: () => {
      base.addMockArtwork();
      notify?.();
    },
    duplicateSelection: () => {
      base.duplicateSelection();
      notify?.();
    },
    deleteSelection: () => {
      base.deleteSelection();
      notify?.();
    },
    rotateSelection: (degrees: number) => {
      base.rotateSelection(degrees);
      notify?.();
    },
    toggleLockSelection: () => {
      base.toggleLockSelection();
      notify?.();
    },
    setSelectionOpacity: (opacity: number) => {
      base.setSelectionOpacity(opacity);
      notify?.();
    },
    patchSelection: (patch: CanvasObjectPatch) => {
      base.patchSelection(patch);
      notify?.();
    },
    patchObject: (id: string, patch: CanvasObjectPatch) => {
      base.patchObject(id, patch);
      notify?.();
    },
    patchObjects: (updates) => {
      base.patchObjects(updates);
      notify?.();
    },
    setObjectHidden: (id: string, hidden: boolean) => {
      base.setObjectHidden(id, hidden);
      notify?.();
    },
    deleteObject: (id: string) => {
      base.deleteObject(id);
      notify?.();
    },
    setObjectOrder: (ids: string[]) => {
      base.setObjectOrder(ids);
      notify?.();
    },
    moveObjectToEdge: (id: string, edge: "front" | "back") => {
      base.moveObjectToEdge(id, edge);
      notify?.();
    },
    setSheetSize: (value: string) => {
      base.setSheetSize(value);
      notify?.();
    },
    // Stepping through history changes the design as much as any edit does.
    undo: () => {
      base.undo();
      notify?.();
    },
    redo: () => {
      base.redo();
      notify?.();
    },
  };

  const settings: WorkspaceSettings = {
    // Backed by the document reducer rather than local state, so resizing the
    // sheet lands on the undo stack with everything else. The shape the
    // toolbar and inspector consume is unchanged.
    sheetSize: canvas.sheetSize,
    setSheetSize: canvas.setSheetSize,
    zoom,
    setZoom,
    showBackground,
    setShowBackground,
    backgroundColor,
    setBackgroundColor,
    showGrid,
    setShowGrid,
    snapEnabled,
    setSnapEnabled,
    unit,
    setUnit,
  };

  const findAsset = (id: string | undefined) =>
    id ? library.assets.find((asset) => asset.id === id) : undefined;

  const placeAsset = (assetId: string, at?: PlacementPoint) => {
    const asset = findAsset(assetId);
    if (!asset) return;
    canvas.placeAsset(asset, at);
    library.countPlacement(asset.id);
  };

  /**
   * Apply a whole design at once.
   *
   * Artwork first: the canvas resolves objects to bitmaps by asset id, so a
   * document arriving before its library would render a sheet of placeholders
   * until the next pass.
   */
  const { restoreAssets } = library;
  const { replaceDocument } = base;
  const restoreDesign = React.useCallback(
    (design: RestoredDesign) => {
      restoreAssets(design.assets);
      replaceDocument(design.document);
      onDesignNameChange(design.name);
    },
    [restoreAssets, replaceDocument, onDesignNameChange],
  );

  const snapshotDesign = (): SerializedDesign => {
    const files = new Map<string, Blob>();
    for (const asset of library.assets) {
      const file = getAssetFile(asset.id);
      if (file) files.set(asset.id, file);
    }
    return serializeDocument({
      name: designName,
      document: base.document,
      assets: library.assets,
      files,
      savedAt: new Date().toISOString(),
    });
  };

  const recovery = useDraftRecovery({
    document: base.document,
    assets: library.assets,
    name: designName,
    onRestore: restoreDesign,
  });

  return (
    <EditorStateContext.Provider
      value={{
        canvas,
        settings,
        library,
        findAsset,
        placeAsset,
        recovery,
        restoreDesign,
        snapshotDesign,
      }}
    >
      {children}
    </EditorStateContext.Provider>
  );
}

export function useEditorState(): EditorState {
  const context = React.useContext(EditorStateContext);
  if (!context) {
    throw new Error("useEditorState must be used inside an EditorStateProvider");
  }
  return context;
}
