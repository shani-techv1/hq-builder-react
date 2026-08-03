"use client";

import { Layers } from "lucide-react";

import { SHEET_SPEC } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export interface SheetSpecCardProps {
  /** Current sheet dimensions, e.g. `22″ × 24″`. */
  size: string;
  className?: string;
}

/**
 * The floating specification card above the sheet.
 *
 * Reads as a label attached to the sheet rather than a caption in the
 * workspace: its own surface, its own shadow, and no gap-filling width — it
 * hugs its contents so it stays subordinate to the sheet below it.
 */
export function SheetSpecCard({ size, className }: SheetSpecCardProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 rounded-xl border border-border/80 bg-card py-1.5 pl-2 pr-3 shadow-card",
        className,
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        <Layers className="size-[15px]" strokeWidth={2.1} aria-hidden />
      </span>

      <span className="min-w-0">
        <span className="block text-[12px] font-bold leading-tight tracking-tight text-foreground">
          {SHEET_SPEC.product}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] leading-tight text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground/70">
            {size}
          </span>
          <SpecDot />
          <span>{SHEET_SPEC.resolution}</span>
          <SpecDot />
          <span className="hidden sm:inline">{SHEET_SPEC.background}</span>
          <span className="sm:hidden">Transparent</span>
        </span>
      </span>
    </div>
  );
}

function SpecDot() {
  return (
    <span
      aria-hidden
      className="size-[3px] shrink-0 rounded-full bg-muted-foreground/45"
    />
  );
}
