"use client";

import * as React from "react";

import { rulerScale } from "@/lib/workspace";
import { cn } from "@/lib/utils";

/** Ruler thickness, and the size of the corner square between the two. */
const RULER_SIZE = 22;

/** How far past the viewport labels are generated before they get clipped. */
const LABEL_EXTENT_PX = 6000;
const MAX_LABELS = 240;

/** Ticks are the text colour at low alpha, so they sit under the labels. */
const MINOR_TICK = "color-mix(in oklch, var(--foreground) 15%, transparent)";
const MAJOR_TICK = "color-mix(in oklch, var(--foreground) 32%, transparent)";

export interface RulerProps {
  orientation: "horizontal" | "vertical";
  zoom: number;
  /** Gutter between the pane edge and the sheet's origin, in pixels. */
  origin: number;
  /**
   * Set by the canvas pane's scroll handler as `--ruler-offset`, so the ticks
   * travel with the sheet instead of staying pinned to the viewport.
   */
  ref?: React.Ref<HTMLDivElement>;
  className?: string;
}

/**
 * A Figma-style ruler.
 *
 * Ticks are drawn as two tiled gradients rather than hundreds of elements —
 * a short minor tick every fifth of an interval and a taller major tick on the
 * interval itself, both anchored to the edge nearest the canvas. Only the
 * labels are real DOM, and they share one transform with the tick layer so
 * they can never drift out of register while scrolling.
 */
export function Ruler({
  orientation,
  zoom,
  origin,
  ref,
  className,
}: RulerProps) {
  const { majorPx, minorPx, majorInches } = rulerScale(zoom);
  const isHorizontal = orientation === "horizontal";

  const labelCount = Math.min(
    MAX_LABELS,
    Math.ceil(LABEL_EXTENT_PX / Math.max(majorPx, 1)),
  );

  const direction = isHorizontal ? "to right" : "to bottom";
  const tickStyle: React.CSSProperties = {
    backgroundImage: [
      `linear-gradient(${direction}, ${MAJOR_TICK} 0 1px, transparent 1px)`,
      `linear-gradient(${direction}, ${MINOR_TICK} 0 1px, transparent 1px)`,
    ].join(", "),
    backgroundSize: isHorizontal
      ? `${majorPx}px 9px, ${minorPx}px 5px`
      : `9px ${majorPx}px, 5px ${minorPx}px`,
    backgroundRepeat: isHorizontal ? "repeat-x" : "repeat-y",
    backgroundPosition: isHorizontal
      ? "left bottom, left bottom"
      : "right top, right top",
    // Both tick layers and the labels ride this one offset.
    transform: isHorizontal
      ? `translateX(calc(var(--ruler-offset, 0px) + ${origin}px))`
      : `translateY(calc(var(--ruler-offset, 0px) + ${origin}px))`,
  };

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "relative overflow-hidden bg-card select-none",
        isHorizontal ? "border-b border-border" : "border-r border-border",
        className,
      )}
      style={
        isHorizontal
          ? { height: RULER_SIZE }
          : { width: RULER_SIZE }
      }
    >
      <div className="absolute inset-0" style={tickStyle}>
        {Array.from({ length: labelCount }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "absolute text-[9px] font-medium tabular-nums leading-none tracking-tight",
              "text-muted-foreground/80",
              // Upright on both axes: a 22px ruler is too narrow to rotate a
              // three-digit label into without it clipping.
              isHorizontal ? "top-1.5" : "left-1.5",
            )}
            style={
              isHorizontal
                ? { left: index * majorPx + 3 }
                : { top: index * majorPx + 3 }
            }
          >
            {index * majorInches}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The square where the two rulers meet. Carries the unit they're drawn in. */
export function RulerCorner({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      style={{ width: RULER_SIZE, height: RULER_SIZE }}
      className={cn(
        "grid shrink-0 place-items-center border-b border-r border-border bg-card",
        "text-[8.5px] font-semibold uppercase tracking-wide text-muted-foreground/70",
        className,
      )}
    >
      in
    </div>
  );
}
