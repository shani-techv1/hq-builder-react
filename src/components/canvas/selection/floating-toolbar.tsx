"use client";

import * as React from "react";
import { Copy, Grip, Trash2 } from "lucide-react";

import { DimensionsControl } from "@/components/canvas/selection/dimensions-control";
import { RemoveBackgroundAction } from "@/components/canvas/selection/remove-background-action";
import { SelectionOverflowMenu } from "@/components/canvas/selection/selection-overflow-menu";
import { SelectionToolbarShell } from "@/components/canvas/selection/selection-toolbar-shell";
import { ToolbarAction } from "@/components/canvas/selection/toolbar-action";
import { ToolbarDivider } from "@/components/toolbar/toolbar-divider";
import type { CanvasObject } from "@/lib/canvas-objects";

export interface FloatingToolbarProps {
  /** The selected object — what every action here acts on. */
  object: CanvasObject;
  badge: React.ReactNode;
  boundary?: React.RefObject<HTMLElement | null>;
  reflowKey?: string | number;
  locked: boolean;
  onRotate: () => void;
  onDuplicate: () => void;
  onToggleLock: () => void;
  /** Opens the Autofill panel, with this object already the selection. */
  onOpenAutofill: () => void;
  /** Opens the Settings panel on the opacity row. */
  onOpenOpacity: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDelete: () => void;
}

/**
 * Actions for a single selected object.
 *
 * Labelled, and ordered by what someone does with a piece of artwork just
 * placed on a sheet: get the background off it, repeat it across the sheet,
 * copy it, check the size it prints at. Delete sits past a divider so it is
 * never adjacent to something harmless, and everything rarer is behind the
 * overflow menu rather than widening a bar that floats over the work.
 *
 * A locked object keeps its toolbar but loses everything that would change it,
 * so unlocking is always one click away.
 */
export function FloatingToolbar({
  object,
  badge,
  boundary,
  reflowKey,
  locked,
  onRotate,
  onDuplicate,
  onToggleLock,
  onOpenAutofill,
  onOpenOpacity,
  onBringToFront,
  onSendToBack,
  onDelete,
}: FloatingToolbarProps) {
  return (
    <SelectionToolbarShell
      badge={badge}
      boundary={boundary}
      reflowKey={reflowKey}
    >
      <RemoveBackgroundAction object={object} />

      <ToolbarAction
        icon={Grip}
        label="Autofill"
        showLabel
        onClick={onOpenAutofill}
      />
      <ToolbarAction
        icon={Copy}
        label="Duplicate"
        showLabel
        hint="⌘D"
        onClick={onDuplicate}
      />

      <DimensionsControl object={object} />

      <ToolbarAction
        icon={Trash2}
        label="Delete"
        hint="⌫"
        tone="danger"
        onClick={onDelete}
        disabled={locked}
      />

      <ToolbarDivider />

      <SelectionOverflowMenu
        locked={locked}
        onRotate={onRotate}
        onToggleLock={onToggleLock}
        onOpenOpacity={onOpenOpacity}
        onBringToFront={onBringToFront}
        onSendToBack={onSendToBack}
      />
    </SelectionToolbarShell>
  );
}
