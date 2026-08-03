"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Copy, Expand, MoreHorizontal, Star } from "lucide-react";

import { AssetContextMenu } from "@/components/assets/asset-context-menu";
import { InlineRenameInput } from "@/components/common/inline-rename-input";
import {
  ASSET_DRAG_TYPE,
  formatDimensions,
  formatFileSize,
  formatResolution,
  formatUploadDate,
  type Asset,
} from "@/lib/assets";
import { cn } from "@/lib/utils";

/**
 * How long a single click waits to see whether a second one follows. Just
 * under the platform double-click threshold, so the preview still feels
 * immediate.
 */
const DOUBLE_CLICK_GRACE_MS = 250;

export interface AssetCardProps {
  asset: Asset;
  onOpen: () => void;
  /** Put this asset on the sheet — a double-click, or a drop on the canvas. */
  onPlace: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  className?: string;
}

/**
 * One asset in the library grid.
 *
 * Two layers: the thumbnail carries the actions, the footer carries the
 * metadata a print operator needs before placing a file — dimensions,
 * resolution, weight and when it arrived.
 *
 * Two ways onto the sheet, because the card is both a preview and a source:
 * double-click places it centred, and dragging it places it where it lands.
 * Only the asset's id travels in the drag — the canvas resolves the artwork
 * itself, so nothing about the file is copied to move it.
 */
export function AssetCard({
  asset,
  onOpen,
  onPlace,
  onRename,
  onDuplicate,
  onToggleFavorite,
  onDelete,
  className,
}: AssetCardProps) {
  const [isHeld, setIsHeld] = React.useState(false);
  const [isRenaming, setIsRenaming] = React.useState(false);

  const handleDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id);
    event.dataTransfer.effectAllowed = "copy";
  };

  /**
   * The two gestures share a target, so the preview has to wait to find out
   * which one it was — a double-click fires `click` first, and opening the
   * drawer before placing would bury the artwork the user just placed.
   */
  const pendingOpen = React.useRef<number | null>(null);

  const cancelPendingOpen = () => {
    if (pendingOpen.current === null) return;
    window.clearTimeout(pendingOpen.current);
    pendingOpen.current = null;
  };

  React.useEffect(() => cancelPendingOpen, []);

  const handleClick = () => {
    if (pendingOpen.current !== null) return;
    pendingOpen.current = window.setTimeout(() => {
      pendingOpen.current = null;
      onOpen();
    }, DOUBLE_CLICK_GRACE_MS);
  };

  const handleDoubleClick = () => {
    cancelPendingOpen();
    onPlace();
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={cn("group/card relative", className)}
    >
      {/* Ghost that peels off while the card is held — the drag preview. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl border-2 border-dashed border-primary/50 bg-primary-softer",
          "transition-opacity duration-150",
          isHeld ? "opacity-100" : "opacity-0",
        )}
      />

      <motion.div
        animate={isHeld ? { scale: 0.97, x: 6, y: -6 } : { scale: 1, x: 0, y: 0 }}
        transition={{ type: "spring", stiffness: 460, damping: 30 }}
        onPointerDown={() => setIsHeld(true)}
        onPointerUp={() => setIsHeld(false)}
        onPointerLeave={() => setIsHeld(false)}
        className={cn(
          "relative overflow-hidden rounded-xl border border-border bg-card shadow-soft",
          "transition-[border-color,box-shadow] duration-200",
          "hover:border-primary/35 group-hover/card:shadow-card",
        )}
      >
        {/* The drag source is the thumbnail rather than the whole card: it is
            the part that already reads as grabbable, and it leaves the footer
            free for the rename field. */}
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={() => setIsHeld(false)}
          className="bg-checkerboard relative aspect-4/3 overflow-hidden"
        >
          {/* A locally generated data URL, so there is nothing for the image
              optimiser to fetch, size or cache.

              No `draggable={false}` either: browsers differ on whether an
              opted-out child still lets its draggable ancestor be the drag
              source, and `dragstart` bubbles to the handler regardless. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.thumbnail}
            alt=""
            className={cn(
              "absolute inset-0 size-full object-contain p-1.5",
              "transition-transform duration-300 group-hover/card:scale-[1.04]",
            )}
          />

          <span
            aria-hidden
            className={cn(
              "absolute inset-0 bg-linear-to-t from-foreground/55 via-foreground/5 to-transparent",
              "opacity-0 transition-opacity duration-200 group-hover/card:opacity-100",
            )}
          />

          {/* Full-bleed click target, under the chrome that sits on top of it. */}
          <button
            type="button"
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            aria-label={`Preview ${asset.name}. Double-click to place it on the sheet.`}
            className={cn(
              "absolute inset-0 cursor-grab active:cursor-grabbing",
              "outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50",
            )}
          />

          <span className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1">
            <span className="rounded-md bg-card/90 px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-foreground shadow-soft backdrop-blur-sm">
              {asset.format}
            </span>
            {asset.favorite ? (
              <span
                aria-hidden
                className="grid size-[18px] place-items-center rounded-full bg-card/90 text-amber-500 shadow-soft backdrop-blur-sm"
              >
                <Star className="size-2.5" strokeWidth={2.4} fill="currentColor" />
              </span>
            ) : null}
          </span>

          <div
            className={cn(
              "pointer-events-none absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-0.5",
              "rounded-lg border border-border/70 bg-card/90 p-0.5 backdrop-blur-md",
              "shadow-[0_4px_12px_-4px_rgb(16_24_40/0.24)]",
              "translate-y-1 opacity-0 transition-all duration-200",
              "group-hover/card:pointer-events-auto group-hover/card:translate-y-0 group-hover/card:opacity-100",
            )}
          >
            <CardAction icon={Expand} label="Preview" onClick={onOpen} />
            <CardAction icon={Copy} label="Duplicate" onClick={onDuplicate} />
            <CardAction
              icon={Star}
              label={asset.favorite ? "Remove favourite" : "Favourite"}
              active={asset.favorite}
              onClick={onToggleFavorite}
            />
            <AssetContextMenu
              asset={asset}
              onPreview={onOpen}
              onPlace={onPlace}
              onRename={() => setIsRenaming(true)}
              onDuplicate={onDuplicate}
              onToggleFavorite={onToggleFavorite}
              onDelete={onDelete}
            >
              <button
                type="button"
                aria-label="More actions"
                className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <MoreHorizontal className="size-3.5" strokeWidth={2.2} />
              </button>
            </AssetContextMenu>
          </div>
        </div>

        <div className="space-y-1 px-2 py-2">
          {isRenaming ? (
            <InlineRenameInput
              label="Asset name"
              value={asset.name}
              onCommit={(name) => {
                onRename(name);
                setIsRenaming(false);
              }}
              onCancel={() => setIsRenaming(false)}
            />
          ) : (
            <p
              className="truncate text-[11.5px] font-semibold text-foreground"
              title={asset.name}
            >
              {asset.name}
            </p>
          )}
          <p className="flex items-center gap-1 text-[10px] leading-tight text-muted-foreground">
            <span className="tabular-nums">{formatDimensions(asset)}</span>
            <Dot />
            <span>{formatResolution(asset)}</span>
          </p>
          <p className="flex items-center gap-1 text-[10px] leading-tight text-muted-foreground">
            <span className="tabular-nums">{formatFileSize(asset.sizeBytes)}</span>
            <Dot />
            <span className="truncate">{formatUploadDate(asset.uploadedAt)}</span>
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Dot() {
  return (
    <span
      aria-hidden
      className="size-[2.5px] shrink-0 rounded-full bg-muted-foreground/45"
    />
  );
}

function CardAction({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      whileHover={{ y: -1.5 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 460, damping: 26 }}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-md outline-none transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/40",
        active
          ? "text-amber-500 hover:bg-amber-500/10"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.2} />
    </motion.button>
  );
}
