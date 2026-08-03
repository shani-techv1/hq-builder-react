"use client";

import { cn } from "@/lib/utils";

export interface MetadataEntry {
  label: string;
  value: string;
  /** Renders the value in the muted colour, for absent or inherited data. */
  muted?: boolean;
}

export interface MetadataTableProps {
  entries: MetadataEntry[];
  className?: string;
}

/**
 * Read-only facts about the selected object.
 *
 * A definition list rather than disabled inputs: nothing here is editable, and
 * greyed-out fields would suggest otherwise.
 */
export function MetadataTable({ entries, className }: MetadataTableProps) {
  return (
    <dl className={cn("overflow-hidden rounded-xl border border-border", className)}>
      {entries.map((entry, index) => (
        <div
          key={entry.label}
          className={cn(
            "flex items-center justify-between gap-3 px-2.5 py-1.5",
            index < entries.length - 1 && "border-b border-border",
          )}
        >
          <dt className="shrink-0 text-[11px] text-muted-foreground">
            {entry.label}
          </dt>
          <dd
            className={cn(
              "min-w-0 truncate text-[11px] font-semibold",
              entry.muted ? "text-muted-foreground" : "text-foreground",
            )}
            title={entry.value}
          >
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
