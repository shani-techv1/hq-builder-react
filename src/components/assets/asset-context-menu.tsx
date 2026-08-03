"use client";

import * as React from "react";
import {
  Copy,
  Expand,
  Pencil,
  PlusSquare,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Asset } from "@/lib/assets";

export interface AssetContextMenuProps {
  asset: Asset;
  /** The trigger — usually the card's "More" button. */
  children: React.ReactElement;
  onPreview: () => void;
  /** Put the asset on the sheet — the discoverable form of double-clicking. */
  onPlace: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

/** Per-asset overflow menu. Every entry performs a real action. */
export function AssetContextMenu({
  asset,
  children,
  onPreview,
  onPlace,
  onRename,
  onDuplicate,
  onToggleFavorite,
  onDelete,
}: AssetContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={children} />

      <DropdownMenuContent align="end" sideOffset={6} className="w-48">
        <DropdownMenuItem className="px-2 py-1.5" onClick={onPlace}>
          <PlusSquare aria-hidden />
          Place on sheet
        </DropdownMenuItem>
        <DropdownMenuItem className="px-2 py-1.5" onClick={onPreview}>
          <Expand aria-hidden />
          Preview
        </DropdownMenuItem>
        <DropdownMenuItem className="px-2 py-1.5" onClick={onRename}>
          <Pencil aria-hidden />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem className="px-2 py-1.5" onClick={onDuplicate}>
          <Copy aria-hidden />
          Duplicate
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="px-2 py-1.5" onClick={onToggleFavorite}>
          {asset.favorite ? <StarOff aria-hidden /> : <Star aria-hidden />}
          {asset.favorite ? "Remove favourite" : "Add to favourites"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="px-2 py-1.5"
          variant="destructive"
          onClick={onDelete}
        >
          <Trash2 aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
