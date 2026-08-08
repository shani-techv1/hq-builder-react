"use client";

import * as React from "react";
import { Copy, Lock, RotateCw, Trash2, Unlock } from "lucide-react";

import { OpacityControl } from "@/components/canvas/selection/opacity-control";
import { SelectionToolbarShell } from "@/components/canvas/selection/selection-toolbar-shell";
import { ToolbarAction } from "@/components/canvas/selection/toolbar-action";
import { ToolbarDivider } from "@/components/toolbar/toolbar-divider";

export interface FloatingToolbarProps {
  badge: React.ReactNode;
  boundary?: React.RefObject<HTMLElement | null>;
  reflowKey?: string | number;
  locked: boolean;
  onRotate: () => void;
  onDuplicate: () => void;
  onToggleLock: () => void;
  /** Opens the Settings panel on the opacity row. */
  onOpenOpacity: () => void;
  onDelete: () => void;
}

/**
 * Actions for a single selected object.
 *
 * Every control here performs a real edit — transforms first, then delete on
 * its own past a divider so it is never adjacent to something harmless.
 *
 * A locked object keeps its toolbar but loses everything that would change it,
 * so unlocking is always one click away.
 */
export function FloatingToolbar({
  badge,
  boundary,
  reflowKey,
  locked,
  onRotate,
  onDuplicate,
  onToggleLock,
  onOpenOpacity,
  onDelete,
}: FloatingToolbarProps) {
  return (
    <SelectionToolbarShell
      badge={badge}
      boundary={boundary}
      reflowKey={reflowKey}
    >
      <ToolbarAction
        icon={RotateCw}
        label="Rotate 90°"
        onClick={onRotate}
        disabled={locked}
      />
      <ToolbarAction
        icon={Copy}
        label="Duplicate"
        hint="⌘D"
        onClick={onDuplicate}
      />
      <ToolbarAction
        icon={locked ? Unlock : Lock}
        label={locked ? "Unlock" : "Lock"}
        active={locked}
        onClick={onToggleLock}
      />
      <OpacityControl onOpen={onOpenOpacity} />

      <ToolbarDivider />

      <ToolbarAction
        icon={Trash2}
        label="Delete"
        hint="⌫"
        tone="danger"
        onClick={onDelete}
        disabled={locked}
      />
    </SelectionToolbarShell>
  );
}
