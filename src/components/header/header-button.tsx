"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface HeaderButtonProps
  extends Omit<React.ComponentProps<"button">, "children"> {
  icon: LucideIcon;
  /** Always the accessible name; shown as text when there's room. */
  label: string;
  variant?: "ghost" | "outline";
  /** Breakpoint at which the text label appears. */
  labelClassName?: string;
}

const VARIANTS = {
  ghost:
    "text-muted-foreground hover:bg-muted hover:text-foreground",
  outline:
    "border border-border bg-card text-foreground shadow-soft hover:border-primary/35 hover:bg-primary-softer hover:text-primary",
} as const;

/**
 * A secondary header action. Collapses to an icon on narrow screens — the
 * header has to survive a Shopify admin frame, which is a good deal narrower
 * than a full browser window.
 */
export function HeaderButton({
  icon: Icon,
  label,
  variant = "ghost",
  labelClassName = "hidden lg:inline",
  className,
  ...props
}: HeaderButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold",
        "transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      <Icon className="size-[17px] shrink-0" strokeWidth={2} aria-hidden />
      <span className={labelClassName}>{label}</span>
    </button>
  );
}
