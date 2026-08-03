"use client";

import {
  Group,
  ImageIcon,
  PenTool,
  Type,
  type LucideIcon,
} from "lucide-react";

import { summariseSelection, type CanvasObject, type CanvasObjectKind } from "@/lib/canvas-objects";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<CanvasObjectKind, LucideIcon> = {
  image: ImageIcon,
  text: Type,
  vector: PenTool,
  group: Group,
};

/** Plural label for a kind, e.g. 3 → "3 Images". */
const KIND_PLURALS: Record<CanvasObjectKind, [string, string]> = {
  image: ["Image", "Images"],
  text: ["Text", "Text"],
  vector: ["Vector", "Vectors"],
  group: ["Group", "Groups"],
};

export interface SelectionSummaryProps {
  objects: CanvasObject[];
  className?: string;
}

/**
 * What the multi-selection actually contains, broken down by kind.
 *
 * "5 objects" tells you nothing about which controls will apply; "3 Images ·
 * 1 Text · 1 Vector" tells you why the panel below is showing only the
 * properties they have in common.
 */
export function SelectionSummary({ objects, className }: SelectionSummaryProps) {
  const groups = summariseSelection(objects);

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[13px] font-bold tracking-tight text-foreground">
        {objects.length} objects selected
      </p>

      <ul className="flex flex-wrap gap-1.5">
        {groups.map(({ kind, count }) => {
          const Icon = KIND_ICONS[kind];
          const [one, many] = KIND_PLURALS[kind];
          return (
            <li
              key={kind}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1 text-[11px] font-semibold text-muted-foreground"
            >
              <Icon className="size-3 text-primary" strokeWidth={2.2} aria-hidden />
              {count} {count === 1 ? one : many}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
