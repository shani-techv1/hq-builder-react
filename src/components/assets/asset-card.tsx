"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Copy, Expand, MoreHorizontal, Star } from "lucide-react";

import { AssetContextMenu } from "@/components/assets/asset-context-menu";
import { InlineRenameInput } from "@/components/common/inline-rename-input";
import {
  formatDimensions,
  formatFileSize,
  formatResolution,
  formatUploadDate,
  type Asset,
} from "@/lib/assets";
import { cn } from "@/lib/utils";

export interface AssetCardProps {
  asset: Asset;
  onOpen: () => void;
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
 * The card is built to be dragged onto the canvas later, so it already reads
 * as grabbable: a grab cursor, and a ghost that peels off while it's held.
 * None of that moves anything yet.
 */
export function AssetCard({
  asset,
  onOpen,
  onRename,
  onDuplicate,
  onToggleFavorite,
  onDelete,
  className,
}: AssetCardProps) {
  const [isHeld, setIsHeld] = React.useState(false);
  const [isRenaming, setIsRenaming] = React.useState(false);

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
        <div className="relative aspect-[4/3] overflow-hidden">
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 bg-linear-to-br transition-transform duration-300",
              "group-hover/card:scale-[1.04]",
              asset.swatch,
            )}
          />
          {/* Transparent artwork reads as such through a checker margin. */}
          {asset.transparent ? (
            <span
              aria-hidden
              className="bg-checkerboard absolute inset-x-0 bottom-0 h-2 opacity-70"
            />
          ) : null}

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
            onClick={onOpen}
            aria-label={`Preview ${asset.name}`}
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
