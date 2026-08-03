"use client";

import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SectionTitleProps {
  title: string;
  /** Optional count chip, e.g. the number of recent uploads. */
  count?: number;
  /** Trailing text action, e.g. "View all". */
  action?: string;
  onAction?: () => void;
  className?: string;
}

/** Small caps-ish heading that separates the groups inside a panel body. */
export function SectionTitle({
  title,
  count,
  action,
  onAction,
  className,
}: SectionTitleProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {typeof count === "number" ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {count}
          </span>
        ) : null}
      </div>

      {action ? (
        <button
          type="button"
          onClick={onAction}
          className={cn(
            "group inline-flex items-center gap-0.5 rounded-md text-xs font-semibold text-primary",
            "transition-colors hover:text-primary/80",
            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          )}
        >
          {action}
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      ) : null}
    </div>
  );
}
