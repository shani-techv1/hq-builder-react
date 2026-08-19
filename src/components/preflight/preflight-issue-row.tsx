"use client";

import { TriangleAlert } from "lucide-react";

import { LayerThumbnail } from "@/components/layers/layer-thumbnail";
import type { CanvasObject } from "@/lib/canvas-objects";
import type { PreflightIssue } from "@/lib/preflight";
import { cn } from "@/lib/utils";

export interface PreflightIssueRowProps {
  issue: PreflightIssue;
  /** The objects the issue names, in the order it names them. */
  objects: CanvasObject[];
  /** True when the sheet's selection is exactly this issue's objects. */
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * One warning.
 *
 * The whole row is the button, and pressing it selects the artwork the warning
 * is about — a list of problems you then have to go and find on the sheet
 * yourself would be most of the work and none of the help.
 *
 * An overlap names two layers, so it shows two thumbnails, tucked into each
 * other the way the artwork is.
 */
export function PreflightIssueRow({
  issue,
  objects,
  isSelected,
  onSelect,
}: PreflightIssueRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Select ${issue.title}`}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-xl border border-l-[3px] px-2.5 py-2 text-left",
        // The warning is the row, not a mark on it: an amber card reads as
        // something to deal with while scrolling past, which a line of grey
        // text beside a thumbnail does not.
        "border-amber-200 border-l-amber-400 bg-amber-50/70 hover:bg-amber-50",
        "transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        // Selection is a different fact to "this is a warning", so it is a
        // ring around the card rather than a second surface colour competing
        // with it. A hairline at full strength, not a thick one softened by an
        // alpha: `/50` on a theme colour compiles to the solid colour here, so
        // the weight has to come from the width.
        isSelected && "ring-1 ring-primary",
      )}
    >
      <span className="flex shrink-0 items-center">
        {objects.map((object, index) => (
          <LayerThumbnail
            key={object.id}
            object={object}
            className={index > 0 ? "-ml-3 ring-2 ring-card" : undefined}
          />
        ))}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {/* Colour never carries it alone — the glyph survives a monochrome
              screen and a colour-blind reader, which for a print warning is
              the whole point. */}
          <TriangleAlert
            className="size-3 shrink-0 text-amber-600"
            strokeWidth={2.4}
            aria-hidden
          />
          <span className="truncate text-[12px] font-bold text-amber-900">
            {issue.title}
          </span>
        </span>
        <span className="mt-0.5 block text-[10.5px] leading-relaxed text-amber-800/85">
          {issue.detail}
        </span>
      </span>
    </button>
  );
}
