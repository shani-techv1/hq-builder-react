"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface PanelHeaderProps {
  title: string;
  description?: string;
  onClose: () => void;
  /** Optional control rendered to the left of the close button. */
  actions?: React.ReactNode;
  className?: string;
}

/** Title block and close affordance, pinned to the top of every panel. */
export function PanelHeader({
  title,
  description,
  onClose,
  actions,
  className,
}: PanelHeaderProps) {
  return (
    <header
      className={cn(
        "flex shrink-0 items-start gap-3 border-b border-border px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {actions}
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title} panel`}
          className={cn(
            "grid size-8 place-items-center rounded-lg text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          )}
        >
          <X className="size-[18px]" strokeWidth={2.1} />
        </button>
      </div>
    </header>
  );
}
