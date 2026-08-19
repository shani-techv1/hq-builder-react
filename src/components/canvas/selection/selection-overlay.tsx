"use client";

import { AnimatePresence, motion } from "framer-motion";

import { FloatingToolbar } from "@/components/canvas/selection/floating-toolbar";
import { MultiSelectionToolbar } from "@/components/canvas/selection/multi-selection-toolbar";
import { SelectionBadge } from "@/components/canvas/selection/selection-badge";
import {
  selectionLabel,
  type CanvasObject,
  type SelectionBox,
} from "@/lib/canvas-objects";

export interface SelectionOverlayProps {
  selectedObjects: CanvasObject[];
  /** Axis-aligned box around the selection, in sheet percentages. */
  selectionBox: SelectionBox | null;
  /** The scrolling canvas pane — keeps the toolbar inside the viewport. */
  boundary?: React.RefObject<HTMLElement | null>;
  /** Clockwise degrees — negative turns the other way. */
  onRotate: (degrees: number) => void;
  onFlip: (axis: "horizontal" | "vertical") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  /** Opens the Autofill panel for what is selected. */
  onOpenAutofill: () => void;
  /** Opens the Position panel for what is selected. */
  onOpenPosition: () => void;
  /** Opens the Filters panel for the selected artwork. */
  onOpenFilters: () => void;
  /** Opens the Settings panel on the opacity row. */
  onOpenOpacity: () => void;
}

/**
 * The badge and floating toolbar that follow the current selection.
 *
 * Outlines and transform handles are Fabric's — this draws only the chrome
 * Fabric has no concept of. It tracks the selection through the editor's
 * state rather than by reading the canvas, so it stays correct whether the
 * selection came from a click, the layer list or a keyboard shortcut.
 *
 * The whole layer is inert except the toolbar itself, so pointer gestures
 * still reach the canvas underneath.
 */
export function SelectionOverlay({
  selectedObjects,
  selectionBox,
  boundary,
  onRotate,
  onFlip,
  onDuplicate,
  onDelete,
  onToggleLock,
  onOpenAutofill,
  onOpenPosition,
  onOpenFilters,
  onOpenOpacity,
}: SelectionOverlayProps) {
  const isMulti = selectedObjects.length > 1;
  const primary = selectedObjects[0];
  const allLocked =
    selectedObjects.length > 0 && selectedObjects.every((o) => o.locked);

  // Re-runs the toolbar's placement check whenever the selection moves.
  const reflowKey = selectionBox
    ? `${selectedObjects.length}:${Math.round(selectionBox.x)}:${Math.round(selectionBox.y)}:${Math.round(selectionBox.width)}`
    : "none";

  return (
    <AnimatePresence>
      {selectionBox ? (
        <motion.div
          key="selection"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 z-20"
        >
          {/* Anchored to the selection's unrotated box, so the chrome stays
              upright even when the artwork under it is at an angle. */}
          <div
            style={{
              left: `${selectionBox.x}%`,
              top: `${selectionBox.y}%`,
              width: `${selectionBox.width}%`,
              height: `${selectionBox.height}%`,
            }}
            className="absolute"
          >
            <div className="pointer-events-auto">
              {isMulti ? (
                <MultiSelectionToolbar
                  badge={
                    <SelectionBadge label={selectionLabel(selectedObjects)} />
                  }
                  boundary={boundary}
                  reflowKey={reflowKey}
                  locked={allLocked}
                  onDuplicate={onDuplicate}
                  onToggleLock={onToggleLock}
                  onDelete={onDelete}
                />
              ) : (
                <FloatingToolbar
                  object={primary}
                  badge={
                    <SelectionBadge
                      label={selectionLabel(selectedObjects)}
                      kind={primary.kind}
                      locked={primary.locked}
                    />
                  }
                  boundary={boundary}
                  reflowKey={reflowKey}
                  locked={primary.locked}
                  onRotate={onRotate}
                  onFlip={onFlip}
                  onDuplicate={onDuplicate}
                  onToggleLock={onToggleLock}
                  onOpenAutofill={onOpenAutofill}
                  onOpenPosition={onOpenPosition}
                  onOpenFilters={onOpenFilters}
                  onOpenOpacity={onOpenOpacity}
                  onDelete={onDelete}
                />
              )}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
