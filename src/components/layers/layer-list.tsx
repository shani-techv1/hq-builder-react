"use client";

import * as React from "react";
import { AnimatePresence, Reorder } from "framer-motion";

import { LayerRow } from "@/components/layers/layer-row";
import type { CanvasObject } from "@/lib/canvas-objects";
import { cn } from "@/lib/utils";

export interface LayerListProps {
  /** Objects in canvas order — bottom-most first. */
  objects: CanvasObject[];
  selectedIds: string[];
  /** Receives the new canvas order, bottom-most first. */
  onReorder: (ids: string[]) => void;
  onSelect: (id: string, additive: boolean) => void;
  onRename: (id: string, name: string) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  className?: string;
}

/**
 * The reorderable list of layers.
 *
 * Displayed top-most first, which is the inverse of the canvas array — later
 * objects paint on top, and every layers panel puts the front-most layer at
 * the top. The reversal happens here and nowhere else, so the canvas order
 * stays the single source of truth.
 */
export function LayerList({
  objects,
  selectedIds,
  onReorder,
  className,
  ...handlers
}: LayerListProps) {
  const topFirst = React.useMemo(() => [...objects].reverse(), [objects]);

  return (
    <Reorder.Group
      axis="y"
      values={topFirst}
      onReorder={(next: CanvasObject[]) =>
        onReorder([...next].reverse().map((object) => object.id))
      }
      className={cn("space-y-0.5", className)}
    >
      <AnimatePresence initial={false}>
        {topFirst.map((object) => (
          <LayerRow
            key={object.id}
            object={object}
            isSelected={selectedIds.includes(object.id)}
            {...handlers}
          />
        ))}
      </AnimatePresence>
    </Reorder.Group>
  );
}
