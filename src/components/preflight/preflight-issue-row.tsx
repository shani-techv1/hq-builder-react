"use client";

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
        "flex w-full items-start gap-2.5 rounded-xl border px-2 py-2 text-left",
        "transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        isSelected
          ? "border-primary bg-primary-softer"
          : "border-transparent hover:border-border hover:bg-muted/60",
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
        <span className="block truncate text-[12px] font-semibold text-foreground">
          {issue.title}
        </span>
        <span className="mt-0.5 block text-[10.5px] leading-relaxed text-muted-foreground">
          {issue.detail}
        </span>
      </span>
    </button>
  );
}
