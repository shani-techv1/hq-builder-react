"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { CanvasEmptyState } from "@/components/canvas/canvas-empty-state";
import { SelectionOverlay } from "@/components/canvas/selection/selection-overlay";
import { SheetSpecCard } from "@/components/canvas/sheet-spec-card";
import type { CanvasInteraction } from "@/hooks/use-canvas-interaction";
import { useFabricCanvas } from "@/hooks/use-fabric-canvas";
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
  showGrid: boolean;
  /** Objects and selection state — the canvas renders these, it doesn't own them. */
  interaction: CanvasInteraction;
  /** Scrolling pane the floating toolbar must stay inside. */
  boundary?: React.RefObject<HTMLElement | null>;
  /** False while the workspace is being panned, so drags don't hit objects. */
  interactive?: boolean;
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
  showGrid,
  interaction,
  boundary,
  interactive = true,
  className,
}: DesignSheetProps) {
  const { objects, selectedObjects, selectionBox } = interaction;

  // Stable identity, so the canvas only re-applies state when the sheet's
  // dimensions actually change.
  const sheet = React.useMemo(
    () => ({ width: baseWidth, height: baseHeight }),
    [baseWidth, baseHeight],
  );

  const canvasRef = useFabricCanvas({
    objects,
    selectedIds: interaction.selectedIds,
    sheet,
    zoom,
    onSelectionChange: interaction.setSelection,
    onTransform: interaction.patchObjects,
  });

  const width = (baseWidth * zoom) / 100;
  const height = (baseHeight * zoom) / 100;
  const showEmptyState =
    objects.length === 0 &&
    width >= MIN_EMPTY_STATE_WIDTH &&
    height >= MIN_EMPTY_STATE_HEIGHT;

  return (
    <div
      data-design-sheet
      style={{ width, height }}
      className={cn(
        "relative rounded-sm border border-border/70 shadow-sheet",
        showBackground ? "bg-card" : "bg-checkerboard bg-card",
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
          className="bg-grid-dots pointer-events-none absolute inset-0 rounded-sm opacity-70"
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
        onRotate={() => interaction.rotateSelection(90)}
        onDuplicate={interaction.duplicateSelection}
        onDelete={interaction.deleteSelection}
        onToggleLock={interaction.toggleLockSelection}
        onOpacityChange={interaction.setSelectionOpacity}
      />

      <AnimatePresence>
        {showEmptyState ? (
          <motion.div
            key="empty"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inset-0 grid place-items-center overflow-hidden p-4"
          >
            <CanvasEmptyState onUpload={interaction.addMockArtwork} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
