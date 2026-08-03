"use client";

import * as React from "react";
import { Copy, Lock, Trash2, Unlock } from "lucide-react";

import { SelectionToolbarShell } from "@/components/canvas/selection/selection-toolbar-shell";
import { ToolbarAction } from "@/components/canvas/selection/toolbar-action";
import { ToolbarDivider } from "@/components/toolbar/toolbar-divider";

export interface MultiSelectionToolbarProps {
  badge: React.ReactNode;
  boundary?: React.RefObject<HTMLElement | null>;
  reflowKey?: string | number;
  locked: boolean;
  onDuplicate: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
}

/**
 * Actions for two or more selected objects — the operations that mean the same
 * thing applied to every member of a selection.
 */
export function MultiSelectionToolbar({
  badge,
  boundary,
  reflowKey,
  locked,
  onDuplicate,
  onToggleLock,
  onDelete,
}: MultiSelectionToolbarProps) {
  return (
    <SelectionToolbarShell
      badge={badge}
      boundary={boundary}
      reflowKey={reflowKey}
    >
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

      <ToolbarDivider />

      <ToolbarAction
        icon={Trash2}
        label="Delete"
        hint="⌫"
        tone="danger"
        onClick={onDelete}
      />
    </SelectionToolbarShell>
  );
}
