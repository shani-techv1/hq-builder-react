"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { CanvasEmptyState } from "@/components/canvas/canvas-empty-state";
import { SelectionOverlay } from "@/components/canvas/selection/selection-overlay";
import { SheetSpecCard } from "@/components/canvas/sheet-spec-card";
import type { CanvasInteraction } from "@/hooks/use-canvas-interaction";
import { useFabricCanvas } from "@/hooks/use-fabric-canvas";
import { ASSET_DRAG_TYPE } from "@/lib/assets";
import type { PlacementPoint } from "@/lib/canvas-objects";
import { rulerScale } from "@/lib/workspace";
import { cn } from "@/lib/utils";

/**
 * Below this the sheet is smaller than the empty state, so the invitation is
 * dropped rather than clipped — at that zoom the sheet is a thumbnail and an
 * empty one already reads as empty.
 */
const MIN_EMPTY_STATE_WIDTH = 380;
const MIN_EMPTY_STATE_HEIGHT = 300;


export interface DesignSheetProps {
  /** Sheet dimensions in base pixels, i.e. at 100% zoom. */
  baseWidth: number;
  baseHeight: number;
  /** Zoom as a percentage. */
  zoom: number;
  /** Human-readable size, shown on the spec card. */
  sizeLabel: string;
  showBackground: boolean;
  /** Colour behind the artwork while the background is shown. */
  backgroundColor: string;
  showGrid: boolean;
  /** Objects and selection state — the canvas renders these, it doesn't own them. */
  interaction: CanvasInteraction;
  /** Scrolling pane the floating toolbar must stay inside. */
  boundary?: React.RefObject<HTMLElement | null>;
  /** False while the workspace is being panned, so drags don't hit objects. */
  interactive?: boolean;
  /** Place a library asset at a point on the sheet, in sheet percentages. */
  onPlaceAsset: (assetId: string, at: PlacementPoint) => void;
  /** Files dropped straight onto the sheet, to upload and then place. */
  onDropFiles: (files: File[], at: PlacementPoint) => void;
  /** Opens the Autofill panel for the selection. */
  onOpenAutofill: () => void;
  /** Opens the Position panel for the selection. */
  onOpenPosition: () => void;
  /** Opens the Filters panel for the selected artwork. */
  onOpenFilters: () => void;
  /** Opens the Settings panel on the opacity row. */
  onOpenOpacity: () => void;
  /** Opens the file dialog from the empty state's invitation. */
  onBrowse: () => void;
  className?: string;
}

/**
 * The print sheet, and the Fabric canvas that draws on it.
 *
 * A white board floating on the workspace: hairline border, soft elevation,
 * and an 8px radius — enough to feel like a surface, not so much that it stops
 * reading as a cut sheet. The spec card is anchored to its top edge rather
 * than placed in the workspace, so the two move as one object.
 *
 * The Fabric canvas sits inside it at exactly the sheet's pixel size. It owns
 * hit-testing, transform handles and pointer gestures; the sheet's chrome —
 * grid, checkerboard, spec card, empty state — stays as DOM around it.
 */
export function DesignSheet({
  baseWidth,
  baseHeight,
  zoom,
  sizeLabel,
  showBackground,
  backgroundColor,
  showGrid,
  interaction,
  boundary,
  interactive = true,
  onPlaceAsset,
  onDropFiles,
  onOpenAutofill,
  onOpenPosition,
  onOpenFilters,
  onOpenOpacity,
  onBrowse,
  className,
}: DesignSheetProps) {
  const { objects, selectedObjects, selectionBox } = interaction;
  const [isDropTarget, setIsDropTarget] = React.useState(false);
  const surfaceRef = React.useRef<HTMLDivElement>(null);

  // Stable identity, so the canvas only re-applies state when the sheet's
  // dimensions actually change.
  const sheet = React.useMemo(
    () => ({ width: baseWidth, height: baseHeight }),
    [baseWidth, baseHeight],
  );

  // Every keystroke lands as the same patch shape, so the history policy folds
  // a whole typing session into one undo step.
  const { patchObject } = interaction;
  const handleTextChange = React.useCallback(
    (id: string, text: string) => patchObject(id, { text }),
    [patchObject],
  );

  const canvasRef = useFabricCanvas({
    objects,
    selectedIds: interaction.selectedIds,
    sheet,
    zoom,
    onSelectionChange: interaction.setSelection,
    onTransform: interaction.patchObjects,
    pendingEditId: interaction.pendingEditId,
    onEditStarted: interaction.clearPendingEdit,
    onTextChange: handleTextChange,
    onTextEmptied: interaction.deleteObject,
    onMetrics: interaction.syncMetrics,
  });

  const width = (baseWidth * zoom) / 100;
  const height = (baseHeight * zoom) / 100;

  /**
   * The grid is the rulers' own scale, drawn across the sheet.
   *
   * Sharing `rulerScale` is what makes it a measure rather than a texture: a
   * line falls exactly where a tick does, and the interval steps up as you zoom
   * out — so the grid never collapses into a grey wash at 25% or thins out to
   * nothing at 400%.
   */
  const { majorPx, minorPx } = rulerScale(zoom);
  const showEmptyState =
    objects.length === 0 &&
    width >= MIN_EMPTY_STATE_WIDTH &&
    height >= MIN_EMPTY_STATE_HEIGHT;

  /**
   * Where a drop landed, as a percentage of the sheet.
   *
   * Measured from the sheet's own box rather than from the event's offset,
   * which would be relative to whichever child element happened to be under
   * the cursor.
   */
  const dropPoint = (event: React.DragEvent): PlacementPoint => {
    const box = surfaceRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return { x: 50, y: 50 };
    return {
      x: ((event.clientX - box.left) / box.width) * 100,
      y: ((event.clientY - box.top) / box.height) * 100,
    };
  };

  /** True for the two things the sheet accepts: a library asset, or files. */
  const carriesArtwork = (event: React.DragEvent) =>
    event.dataTransfer.types.includes(ASSET_DRAG_TYPE) ||
    event.dataTransfer.types.includes("Files");

  const handleDragOver = (event: React.DragEvent) => {
    if (!carriesArtwork(event)) return;
    // Claiming the event is what stops the browser navigating to the file.
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDropTarget(true);
  };

  const handleDrop = (event: React.DragEvent) => {
    if (!carriesArtwork(event)) return;
    event.preventDefault();
    setIsDropTarget(false);

    const at = dropPoint(event);
    const assetId = event.dataTransfer.getData(ASSET_DRAG_TYPE);
    if (assetId) {
      onPlaceAsset(assetId, at);
      return;
    }

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onDropFiles(files, at);
  };

  return (
    <div
      data-design-sheet
      ref={surfaceRef}
      style={{
        width,
        height,
        // The colour is a preview of what the transfer is applied to. With the
        // background off, the checkerboard shows the film as it really is.
        backgroundColor: showBackground ? backgroundColor : undefined,
      }}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={handleDrop}
      className={cn(
        "relative rounded-sm border shadow-sheet transition-colors duration-150",
        isDropTarget ? "border-primary" : "border-border/70",
        showBackground ? undefined : "bg-checkerboard bg-card",
        className,
      )}
    >
      <SheetSpecCard
        size={sizeLabel}
        className="absolute bottom-full left-0 mb-3.5"
      />

      {showGrid ? (
        <span
          aria-hidden
          style={
            {
              "--grid-cell": `${majorPx}px`,
              "--grid-subcell": `${minorPx}px`,
            } as React.CSSProperties
          }
          className="bg-grid-lines pointer-events-none absolute inset-0 rounded-sm"
        />
      ) : null}

      <div
        className={cn(
          "absolute inset-0",
          interactive ? undefined : "pointer-events-none",
        )}
      >
        <canvas ref={canvasRef} />
      </div>

      <SelectionOverlay
        selectedObjects={selectedObjects}
        selectionBox={selectionBox}
        boundary={boundary}
        onRotate={(degrees) => interaction.rotateSelection(degrees)}
        onFlip={(axis) =>
          interaction.patchSelection(
            axis === "horizontal"
              ? { flipHorizontal: !(selectedObjects[0]?.flipHorizontal ?? false) }
              : { flipVertical: !(selectedObjects[0]?.flipVertical ?? false) },
          )
        }
        onDuplicate={interaction.duplicateSelection}
        onDelete={interaction.deleteSelection}
        onToggleLock={interaction.toggleLockSelection}
        onOpenAutofill={onOpenAutofill}
        onOpenPosition={onOpenPosition}
        onOpenFilters={onOpenFilters}
        onOpenOpacity={onOpenOpacity}
      />

      <AnimatePresence>
        {showEmptyState ? (
          <motion.div
            key="empty"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inset-0 grid place-items-center overflow-hidden p-4"
          >
            <CanvasEmptyState onUpload={onBrowse} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
