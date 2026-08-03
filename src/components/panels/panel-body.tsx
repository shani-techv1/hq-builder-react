"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The scrollable region of a panel. Owns the panel's horizontal padding and the
 * rhythm between sections, so individual panels only decide their content.
 */
export function PanelBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "scrollbar-slim min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-5 py-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
