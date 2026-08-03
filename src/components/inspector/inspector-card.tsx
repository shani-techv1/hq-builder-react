"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface InspectorCardProps {
  /** Omit for a plain container, e.g. the quick-actions block. */
  title?: string;
  /** Rendered at the right of the title row — a badge or a reset. */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * The inspector's surface unit.
 *
 * Every group of properties sits on one of these. A card that is always open
 * — use `InspectorSection` when the group should be collapsible.
 */
export function InspectorCard({
  title,
  action,
  className,
  children,
}: InspectorCardProps) {
  return (
    <section
      className={cn(
        "rounded-card border border-border bg-card p-3 shadow-soft",
        className,
      )}
    >
      {title ? (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
