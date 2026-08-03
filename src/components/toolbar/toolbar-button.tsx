"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ToolbarButtonProps
  extends Omit<React.ComponentProps<"button">, "children"> {
  icon: LucideIcon;
  /** Accessible name, and the tooltip text unless `hint` overrides it. */
  label: string;
  /** Extra tooltip line — usually the keyboard shortcut. */
  hint?: string;
  /** Toggles render pressed rather than merely hovered. */
  active?: boolean;
}

/**
 * One square control in the toolbar.
 *
 * Every toolbar action is the same 36px box so the groups line up on a common
 * grid — the dividers are what separate them, not varying sizes. The tooltip
 * hangs off a wrapping span so a disabled button still explains itself.
 */
export function ToolbarButton({
  icon: Icon,
  label,
  hint,
  active = false,
  className,
  ...props
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg transition-colors outline-none",
            "focus-visible:ring-3 focus-visible:ring-ring/40",
            "disabled:pointer-events-none disabled:opacity-35",
            active
              ? "bg-primary-soft text-primary hover:bg-primary-soft/70"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            className,
          )}
          {...props}
        >
          <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {hint ? (
          <span className="text-background/60">{hint}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
