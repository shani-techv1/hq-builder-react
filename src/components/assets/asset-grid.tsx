"use client";

import { AnimatePresence, motion } from "framer-motion";

import { AssetCard } from "@/components/assets/asset-card";
import type { Asset } from "@/lib/assets";
import { cn } from "@/lib/utils";

export interface AssetGridProps {
  assets: Asset[];
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  className?: string;
}

/**
 * Two-column grid of asset cards.
 *
 * Two columns rather than a denser grid or a list: at 420px it is the widest
 * layout that still shows a readable thumbnail, and thumbnails are what stop
 * this reading as a file explorer.
 */
export function AssetGrid({
  assets,
  onOpen,
  onRename,
  onDuplicate,
  onToggleFavorite,
  onDelete,
  className,
}: AssetGridProps) {
  return (
    <motion.div layout className={cn("grid grid-cols-2 gap-2.5", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onOpen={() => onOpen(asset.id)}
            onRename={(name) => onRename(asset.id, name)}
            onDuplicate={() => onDuplicate(asset.id)}
            onToggleFavorite={() => onToggleFavorite(asset.id)}
            onDelete={() => onDelete(asset.id)}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
