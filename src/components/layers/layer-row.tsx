"use client";

import * as React from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Eye, EyeOff, GripVertical, Lock, Unlock } from "lucide-react";

import { LayerContextMenu } from "@/components/layers/layer-context-menu";
import { InlineRenameInput } from "@/components/common/inline-rename-input";
import { LayerThumbnail } from "@/components/layers/layer-thumbnail";
import { KIND_LABELS, type CanvasObject } from "@/lib/canvas-objects";
import { cn } from "@/lib/utils";

export interface LayerRowProps {
  object: CanvasObject;
  isSelected: boolean;
  /** Shift- or meta-click arrives as `additive`. */
  onSelect: (id: string, additive: boolean) => void;
  onRename: (id: string, name: string) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
}

/**
 * One layer.
 *
 * Dragging is handle-only: the row itself has to stay clickable for selection
 * and double-clickable for rename, so `dragListener` is off and the grip
 * starts the drag through `dragControls`.
 *
 * Visibility and lock are per-object rather than per-selection, because the
 * list is exactly where you reach for a layer you haven't selected.
 */
export function LayerRow({
  object,
  isSelected,
  onSelect,
  onRename,
  onToggleHidden,
  onToggleLocked,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack,
}: LayerRowProps) {
  const [isRenaming, setIsRenaming] = React.useState(false);
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={object}
      dragListener={false}
      dragControls={dragControls}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 460, damping: 36 }}
      className="list-none"
    >
      <LayerContextMenu
        onRename={() => setIsRenaming(true)}
        onDuplicate={() => onDuplicate(object.id)}
        onBringToFront={() => onBringToFront(object.id)}
        onSendToBack={() => onSendToBack(object.id)}
        onDelete={() => onDelete(object.id)}
      >
        <div
          onPointerDown={(event) => {
            if (isRenaming) return;
            onSelect(object.id, event.shiftKey || event.metaKey);
          }}
          onDoubleClick={() => setIsRenaming(true)}
          className={cn(
            "group/layer flex items-center gap-2 rounded-xl border px-2 py-1.5",
            "cursor-pointer transition-colors",
            isSelected
              ? "border-primary bg-primary-softer"
              : "border-transparent hover:border-border hover:bg-muted/60",
            object.hidden && "opacity-50",
          )}
        >
          <button
            type="button"
            aria-label={`Reorder ${object.name}`}
            onPointerDown={(event) => {
              event.stopPropagation();
              dragControls.start(event);
            }}
            className={cn(
              "grid size-5 shrink-0 cursor-grab touch-none place-items-center rounded",
              "text-muted-foreground/50 transition-colors active:cursor-grabbing",
              "hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
            )}
          >
            <GripVertical className="size-3.5" strokeWidth={2.2} aria-hidden />
          </button>

          <LayerThumbnail object={object} />

          <div className="min-w-0 flex-1">
            {isRenaming ? (
              <InlineRenameInput
                label="Layer name"
                value={object.name}
                onCommit={(name) => {
                  onRename(object.id, name);
                  setIsRenaming(false);
                }}
                onCancel={() => setIsRenaming(false)}
              />
            ) : (
              <>
                <p className="truncate text-[12px] font-semibold text-foreground">
                  {object.name}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {KIND_LABELS[object.kind]}
                </p>
              </>
            )}
          </div>

          <RowToggle
            label={object.locked ? `Unlock ${object.name}` : `Lock ${object.name}`}
            active={object.locked}
            onClick={() => onToggleLocked(object.id)}
          >
            {object.locked ? (
              <Lock className="size-3.5" strokeWidth={2.2} />
            ) : (
              <Unlock className="size-3.5" strokeWidth={2.2} />
            )}
          </RowToggle>

          <RowToggle
            label={object.hidden ? `Show ${object.name}` : `Hide ${object.name}`}
            active={object.hidden ?? false}
            onClick={() => onToggleHidden(object.id)}
          >
            {object.hidden ? (
              <EyeOff className="size-3.5" strokeWidth={2.2} />
            ) : (
              <Eye className="size-3.5" strokeWidth={2.2} />
            )}
          </RowToggle>
        </div>
      </LayerContextMenu>
    </Reorder.Item>
  );
}

/**
 * Lock and visibility controls. They fade in on hover unless they're already
 * on, so a quiet row shows only the layers that are actually locked or hidden.
 */
function RowToggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-md transition-all",
        "outline-none focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/40",
        "hover:bg-muted hover:text-foreground",
        active
          ? "text-foreground opacity-100"
          : "text-muted-foreground opacity-0 group-hover/layer:opacity-100",
      )}
    >
      {children}
    </button>
  );
}
