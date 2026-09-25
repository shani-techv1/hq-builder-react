"use client";

import * as React from "react";

import { toast } from "@/components/ui/toast";
import { useAccount } from "@/hooks/use-account";
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
  getSheetProduct,
  type MeasurementUnit,
} from "@/lib/workspace";
import type { PlacementPoint } from "@/lib/canvas-objects";
import type { Asset } from "@/lib/assets";
import {
  emptyDesign,
  serializeDocument,
  type DesignDocument,
  type RestoredDesign,
  type SerializedDesign,
} from "@/lib/design-document";
import { getAssetFile, releaseImageCache } from "@/lib/image-cache";
import { setDesignSource } from "@/lib/commerce";
import { runPreflight, type PreflightReport } from "@/lib/preflight";
import { renderSheetPreview } from "@/lib/sheet-preview";

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

/**
 * The design on screen at one moment, by identity.
 *
 * Every edit replaces at least one of the three — the fact autosave keys off —
 * so two versions holding the same three are the same design, and selecting,
 * zooming or panning never makes a new one.
 */
export interface DesignVersion {
  document: DesignDocument;
  assets: Asset[];
  name: string;
}

const sameVersion = (a: DesignVersion, b: DesignVersion) =>
  a.document === b.document && a.assets === b.assets && a.name === b.name;

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
   * Print warnings for the sheet as it currently stands.
   *
   * Computed here because it needs both halves of the design — the objects and
   * the files behind them — and because the rail badge, the Checks panel, the
   * layer list and the save warning are then four views of one result rather
   * than four runs of the same checks.
   */
  preflight: PreflightReport;
  /**
   * Place an asset on the sheet, centred on `at` or on the sheet.
   *
   * Lives on the editor rather than on either half, because it is the one
   * operation that spans both: the canvas gains an object, and the library
   * counts a use.
   */
  placeAsset: (asset: Asset, at?: PlacementPoint) => void;
  /**
   * The same, for a caller holding only an id — a drag out of the library grid.
   *
   * Not interchangeable with {@link placeAsset}: anything placing what it has
   * just uploaded must pass the asset itself, because `uploadFiles` resolves in
   * the same tick as the state update that adds its assets, so the library this
   * looks in is still the one from before the upload.
   */
  placeAssetById: (assetId: string, at?: PlacementPoint) => void;
  /**
   * Local persistence: the saved-design prompt, and the autosave behind it,
   * kept per signed-in account and per product.
   *
   * Owned here because a design is its document *and* its artwork, and this is
   * the only place that holds both.
   */
  recovery: DraftRecovery;
  /** Apply a design from a draft or an imported file, replacing what's open. */
  restoreDesign: (design: RestoredDesign) => void;
  /**
   * Which of the account's saved designs is on screen, if any.
   *
   * Every way a design arrives goes through {@link restoreDesign}, which sets
   * this from the design itself — so opening one from My designs links it,
   * and an import, a fresh sheet or a sign-out unlinks it. Saving to My
   * designs overwrites the linked entry rather than adding another.
   */
  savedDesignId: string | null;
  /**
   * Whether the linked saved design holds exactly what is on screen — what
   * the header's "Saved" means. False whenever none is linked: My designs is
   * the one place a design is kept, and a draft in this browser is not it.
   */
  matchesSavedDesign: boolean;
  /** The design on screen now, to record what a save to My designs held. */
  version: DesignVersion;
  /** Link the design on screen to the saved entry `id`, which holds `version` of it. */
  linkSavedDesign: (id: string, version: DesignVersion) => void;
  /** Unlink the design on screen from `id`, if that is the entry it is linked to. */
  unlinkSavedDesign: (id: string) => void;
  /** The current design in portable form, for export. */
  snapshotDesign: () => SerializedDesign;
}

const EditorStateContext = React.createContext<EditorState | null>(null);

export interface EditorStateProviderProps {
  /** The design's name, carried into drafts and exports. */
  designName: string;
  /** Set when a restored design brings its own name. */
  onDesignNameChange: (name: string) => void;
  /**
   * Called once artwork has been put on the sheet.
   *
   * How a phone gets its canvas back: there, the open menu takes most of the
   * lower half of the screen, and the middle of the sheet — where artwork
   * lands — is behind it.
   */
  onAssetPlaced?: () => void;
  children: React.ReactNode;
}

/** Owns the canvas selection and the sheet settings for the whole editor. */
export function EditorStateProvider({
  designName,
  onDesignNameChange,
  onAssetPlaced,
  children,
}: EditorStateProviderProps) {
  const canvas = useCanvasInteraction();
  const library = useAssetLibrary();

  const [zoom, setZoom] = React.useState(DEFAULT_ZOOM);
  /*
   * The sheet opens as the clear film it prints on, not as a white garment.
   * A white sheet is a guess at where the transfer ends up, and it hides the
   * one thing that is always true of the artwork — that it is cut out.
   */
  const [showBackground, setShowBackground] = React.useState(false);
  const [backgroundColor, setBackgroundColor] = React.useState(
    DEFAULT_SHEET_BACKGROUND,
  );
  const [showGrid, setShowGrid] = React.useState(false);
  const [snapEnabled, setSnapEnabled] = React.useState(true);
  const [unit, setUnit] = React.useState<MeasurementUnit>("in");

  /* Every object URL the session handed out goes back when the editor does. */
  React.useEffect(() => releaseImageCache, []);

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

  /*
   * Re-run only when the design or its files change — never on a selection, a
   * zoom or a panel opening. The pairwise overlap pass is the expensive half,
   * and it has no business running because someone clicked a layer.
   */
  const preflight = React.useMemo(
    () => runPreflight(canvas.objects, canvas.sheetSize, library.assets),
    [canvas.objects, canvas.sheetSize, library.assets],
  );

  const placeAsset = (asset: Asset, at?: PlacementPoint) => {
    canvas.placeAsset(asset, at);
    library.countPlacement(asset.id);
    onAssetPlaced?.();
  };

  const placeAssetById = (assetId: string, at?: PlacementPoint) => {
    const asset = findAsset(assetId);
    if (!asset) return;
    placeAsset(asset, at);
  };

  const [savedDesignId, setSavedDesignId] = React.useState<string | null>(
    null,
  );

  /**
   * What the linked saved design holds: the version on screen when it was
   * last saved, or opened. `"restoring"` while a design that matches its
   * saved entry is being applied, whose pieces only take their new identities
   * in the render it lands in.
   */
  const [savedVersion, setSavedVersion] = React.useState<
    DesignVersion | "restoring" | null
  >(null);

  const version = React.useMemo<DesignVersion>(
    () => ({ document: canvas.document, assets: library.assets, name: designName }),
    [canvas.document, library.assets, designName],
  );

  // Adopted during the render the restored design lands in, rather than in an
  // effect after it, so the header never reads it as unsaved for a frame.
  if (savedVersion === "restoring") setSavedVersion(version);

  const matchesSavedDesign =
    savedDesignId !== null &&
    savedVersion !== null &&
    savedVersion !== "restoring" &&
    sameVersion(savedVersion, version);

  /**
   * Apply a whole design at once.
   *
   * Artwork first: the canvas resolves objects to bitmaps by asset id, so a
   * document arriving before its library would render a sheet of placeholders
   * until the next pass.
   */
  const { restoreAssets } = library;
  const { replaceDocument } = canvas;
  const restoreDesign = React.useCallback(
    (design: RestoredDesign) => {
      restoreAssets(design.assets);
      replaceDocument(design.document);
      onDesignNameChange(design.name);
      setSavedDesignId(design.savedDesignId);
      setSavedVersion(
        design.savedDesignId && design.matchesSavedDesign ? "restoring" : null,
      );
    },
    [restoreAssets, replaceDocument, onDesignNameChange],
  );

  const linkSavedDesign = React.useCallback(
    (id: string, held: DesignVersion) => {
      setSavedDesignId(id);
      setSavedVersion(held);
    },
    [],
  );

  const unlinkSavedDesign = React.useCallback(
    (id: string) =>
      setSavedDesignId((current) => (current === id ? null : current)),
    [],
  );

  const snapshotDesign = (): SerializedDesign => {
    const files = new Map<string, Blob>();
    for (const asset of library.assets) {
      const file = getAssetFile(asset.id);
      if (file) files.set(asset.id, file);
    }
    return serializeDocument({
      name: designName,
      document: canvas.document,
      assets: library.assets,
      files,
      savedAt: new Date().toISOString(),
    });
  };

  /**
   * Clear the editor as its account leaves.
   *
   * By the time this runs the design has been saved under that account, so it
   * is gone from the screen but not from the browser — and the toast says so,
   * or a sheet emptying itself on sign-out would read as work lost.
   */
  const resetDesign = () => {
    const hadWork = canvas.objects.length > 0 || library.assets.length > 0;
    restoreDesign(emptyDesign());
    if (hadWork) {
      toast.success(
        "Signed out",
        "Your design is saved to your account on this device. Sign back in to pick it up.",
      );
    }
  };

  /*
   * A draft belongs to whoever is signed in and to the product this editor was
   * opened for — one browser can serve several people and several products,
   * and each should only ever be offered their own.
   */
  const { user } = useAccount();
  const recovery = useDraftRecovery({
    scope: { accountId: user?.id ?? null, productId: getSheetProduct().id },
    document: canvas.document,
    assets: library.assets,
    name: designName,
    savedDesignId,
    matchesSavedDesign,
    onRestore: restoreDesign,
    onReset: resetDesign,
  });

  /**
   * Publish the design for the storefront build.
   *
   * The commerce adapter is not a component at all, so it cannot call
   * `snapshotDesign` through context. Re-published
   * on every render because the closure it captures goes stale otherwise, and
   * withdrawn on unmount so nothing holds a dead editor.
   */
  const latestSnapshot = React.useRef(snapshotDesign);
  latestSnapshot.current = snapshotDesign;

  React.useEffect(() => {
    setDesignSource(() => {
      const design = latestSnapshot.current();
      return {
        design,
        preview: renderSheetPreview(
          design.document.objects,
          design.document.sheetSize,
        ),
      };
    });
    return () => setDesignSource(null);
  }, []);

  return (
    <EditorStateContext.Provider
      value={{
        canvas,
        settings,
        library,
        findAsset,
        preflight,
        placeAsset,
        placeAssetById,
        recovery,
        restoreDesign,
        savedDesignId,
        matchesSavedDesign,
        version,
        linkSavedDesign,
        unlinkSavedDesign,
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
