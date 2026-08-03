"use client";

import * as React from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export interface LayerContextMenuProps {
  /** The row this menu belongs to. */
  children: React.ReactNode;
  onRename: () => void;
  onDuplicate: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDelete: () => void;
}

/**
 * Right-click menu for a layer row.
 *
 * Every entry maps onto something the editor already does — rename, duplicate,
 * restack and delete. Nothing here is a placeholder.
 */
export function LayerContextMenu({
  children,
  onRename,
  onDuplicate,
  onBringToFront,
  onSendToBack,
  onDelete,
}: LayerContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div />}>{children}</ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={onRename}>
          <Pencil aria-hidden />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={onDuplicate}>
          <Copy aria-hidden />
          Duplicate
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onBringToFront}>
          <ArrowUpToLine aria-hidden />
          Bring to front
        </ContextMenuItem>
        <ContextMenuItem onClick={onSendToBack}>
          <ArrowDownToLine aria-hidden />
          Send to back
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 aria-hidden />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
