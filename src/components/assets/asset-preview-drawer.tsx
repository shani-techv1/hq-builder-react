"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Minus,
  Pencil,
  PlusSquare,
  Star,
  Trash2,
} from "lucide-react";

import { InlineRenameInput } from "@/components/common/inline-rename-input";
import { PrimaryButton } from "@/components/common/primary-button";
import { SectionTitle } from "@/components/common/section-title";
import {
  formatDimensions,
  formatFileSize,
  formatResolution,
  formatUploadDate,
  relatedAssets,
  type Asset,
} from "@/lib/assets";
import { cn } from "@/lib/utils";

export interface AssetPreviewDrawerProps {
  asset: Asset;
  /** The whole library, used to find related artwork. */
  assets: Asset[];
  onClose: () => void;
  onOpenAsset: (id: string) => void;
  /** Put the asset on the sheet, centred. */
  onPlace: () => void;
  onRename: (name: string) => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

/**
 * Full detail view for one asset, sliding over the library.
 *
 * It covers the panel body rather than opening beside it — at 420px there is
 * no room for a master/detail split, and a drawer keeps the back-to-library
 * gesture obvious.
 */
export function AssetPreviewDrawer({
  asset,
  assets,
  onClose,
  onOpenAsset,
  onPlace,
  onRename,
  onToggleFavorite,
  onDelete,
}: AssetPreviewDrawerProps) {
  const [isRenaming, setIsRenaming] = React.useState(false);
  const related = relatedAssets(assets, asset);

  return (
    <motion.div
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 28 }}
      transition={{ type: "spring", stiffness: 420, damping: 40 }}
      className="absolute inset-0 z-40 flex flex-col bg-card"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to library"
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          )}
        >
          <ArrowLeft className="size-4" strokeWidth={2.2} />
        </button>

        {isRenaming ? (
          <InlineRenameInput
            label="Asset name"
            value={asset.name}
            onCommit={(name) => {
              onRename(name);
              setIsRenaming(false);
            }}
            onCancel={() => setIsRenaming(false)}
            className="flex-1"
          />
        ) : (
          <p
            className="min-w-0 flex-1 truncate text-[13px] font-bold tracking-tight text-foreground"
            title={asset.name}
          >
            {asset.name}
          </p>
        )}

        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={asset.favorite ? "Remove favourite" : "Add to favourites"}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
            asset.favorite
              ? "text-amber-500 hover:bg-amber-500/10"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Star
            className="size-4"
            strokeWidth={2.2}
            fill={asset.favorite ? "currentColor" : "none"}
          />
        </button>
      </header>

      <div className="scrollbar-slim min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div
          className={cn(
            "bg-checkerboard relative aspect-4/3 overflow-hidden rounded-card border border-border shadow-card",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element --
              a locally generated data URL: nothing for the optimiser to do. */}
          <img
            src={asset.thumbnail}
            alt={asset.name}
            className="absolute inset-3 size-[calc(100%-1.5rem)] object-contain"
          />
          <span className="absolute left-2 top-2 rounded-md bg-card/90 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-foreground shadow-soft backdrop-blur-sm">
            {asset.format}
          </span>
        </div>

        <section className="space-y-2">
          <SectionTitle title="Details" />
          <dl className="overflow-hidden rounded-xl border border-border">
            <MetaRow label="Dimensions" value={formatDimensions(asset)} />
            <MetaRow label="Resolution" value={formatResolution(asset)} />
            <MetaRow label="File type" value={`${asset.format} · ${formatFileSize(asset.sizeBytes)}`} />
            <MetaRow
              label="Transparency"
              value={asset.transparent ? "Transparent" : "Flattened"}
              icon={asset.transparent ? Check : Minus}
            />
            <MetaRow label="Uploaded" value={formatUploadDate(asset.uploadedAt)} />
            <MetaRow
              label="Used in"
              value={
                asset.usageCount === 1
                  ? "1 sheet"
                  : `${asset.usageCount} sheets`
              }
              last
            />
          </dl>
        </section>

        {related.length > 0 ? (
          <section className="space-y-2">
            <SectionTitle title="Related assets" />
            <div className="grid grid-cols-3 gap-2">
              {related.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenAsset(item.id)}
                  title={item.name}
                  className={cn(
                    "group/related overflow-hidden rounded-lg border border-border bg-card text-left shadow-soft",
                    "transition-all duration-200 outline-none hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card",
                    "focus-visible:ring-3 focus-visible:ring-ring/40",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element --
                      a locally generated data URL. */}
                  <img
                    src={item.thumbnail}
                    alt=""
                    className={cn(
                      "bg-checkerboard block aspect-square w-full object-contain p-1",
                      "transition-transform duration-300 group-hover/related:scale-105",
                    )}
                  />
                  <span className="block truncate px-1.5 py-1 text-[9.5px] font-semibold text-muted-foreground">
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <footer className="shrink-0 space-y-2 border-t border-border px-4 py-3">
        {/* The reason the drawer is open at all, so it leads. */}
        <PrimaryButton icon={PlusSquare} size="md" onClick={onPlace}>
          Place on sheet
        </PrimaryButton>

        <div className="flex items-center gap-2">
          <PrimaryButton
            icon={Pencil}
            variant="outline"
            size="md"
            onClick={() => setIsRenaming(true)}
          >
            Rename
          </PrimaryButton>
          <PrimaryButton
            icon={Trash2}
            variant="outline"
            size="md"
            onClick={onDelete}
            className="text-destructive hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
          >
            Delete
          </PrimaryButton>
        </div>
      </footer>
    </motion.div>
  );
}

function MetaRow({
  label,
  value,
  icon: Icon,
  last = false,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2",
        !last && "border-b border-border",
      )}
    >
      <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1 text-[11.5px] font-semibold text-foreground">
        {Icon ? <Icon className="size-3.5" strokeWidth={2.4} /> : null}
        {value}
      </dd>
    </div>
  );
}
