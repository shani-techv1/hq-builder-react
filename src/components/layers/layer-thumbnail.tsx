"use client";

import { Group, Star, Type } from "lucide-react";

import type { CanvasObject } from "@/lib/canvas-objects";
import { cn } from "@/lib/utils";

export interface LayerThumbnailProps {
  object: CanvasObject;
  className?: string;
}

/**
 * A small preview of what a layer is.
 *
 * Raster layers show their artwork; everything else shows the glyph for its
 * kind, because a gradient square would say less about a text layer than the
 * letter does.
 */
export function LayerThumbnail({ object, className }: LayerThumbnailProps) {
  const base = cn(
    "grid size-8 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted",
    className,
  );

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
