"use client";

import { Group, Star, Type } from "lucide-react";

import { useEditorState } from "@/components/editor/editor-state";
import type { CanvasObject } from "@/lib/canvas-objects";
import { cn } from "@/lib/utils";

export interface LayerThumbnailProps {
  object: CanvasObject;
  className?: string;
}

/**
 * A small preview of what a layer is.
 *
 * Layers with real artwork show it; everything else shows the glyph for its
 * kind, because a gradient square would say less about a text layer than the
 * letter does.
 *
 * The asset is read from the editor rather than passed down, so the list and
 * the row in between stay unaware that layers have files behind them at all.
 */
export function LayerThumbnail({ object, className }: LayerThumbnailProps) {
  const { findAsset } = useEditorState();
  const thumbnail = findAsset(object.assetId)?.thumbnail;

  const base = cn(
    "grid size-8 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted",
    className,
  );

  if (thumbnail) {
    return (
      <span className={cn(base, "bg-checkerboard")}>
        {/* eslint-disable-next-line @next/next/no-img-element --
            a locally generated data URL. */}
        <img src={thumbnail} alt="" className="size-full object-contain" />
      </span>
    );
  }

  if (object.kind === "image") {
    const fill = object.fill;
    return (
      <span className={base}>
        <span
          aria-hidden
          className="size-full"
          style={
            fill
              ? {
                  backgroundImage: `linear-gradient(135deg, ${fill.from}, ${fill.to})`,
                }
              : undefined
          }
        />
      </span>
    );
  }

  if (object.kind === "text") {
    return (
      <span className={cn(base, "bg-card")}>
        <Type
          className="size-4"
          strokeWidth={2.2}
          style={{ color: object.accent }}
          aria-hidden
        />
      </span>
    );
  }

  if (object.kind === "group") {
    return (
      <span className={cn(base, "bg-card")}>
        <Group
          className="size-4 text-muted-foreground"
          strokeWidth={2}
          aria-hidden
        />
      </span>
    );
  }

  return (
    <span className={cn(base, "bg-card")}>
      <Star
        className="size-4"
        strokeWidth={2}
        style={{ color: object.accent }}
        fill="currentColor"
        aria-hidden
      />
    </span>
  );
}
