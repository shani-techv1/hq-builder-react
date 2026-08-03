"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ToolbarActionProps
  extends Omit<
    React.ComponentProps<"button">,
    "children" | "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag" | "ref"
  > {
  icon: LucideIcon;
  /** Accessible name and tooltip text. */
  label: string;
  /** Second tooltip line — the shortcut, when there is one. */
  hint?: string;
  active?: boolean;
  /** Destructive actions pick up the danger colour on hover. */
  tone?: "default" | "danger";
}

/**
 * One action in the floating toolbar.
 *
 * The hover lift is what makes the toolbar feel physical — a spring on `y`
 * rather than a colour change alone, matched across every action so the row
 * responds as one surface.
 */
export function ToolbarAction({
  icon: Icon,
  label,
  hint,
  active = false,
  tone = "default",
  className,
  disabled,
  ...props
}: ToolbarActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <motion.button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          whileHover={disabled ? undefined : { y: -1.5 }}
          whileTap={disabled ? undefined : { scale: 0.94, y: 0 }}
          transition={{ type: "spring", stiffness: 460, damping: 26 }}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg transition-colors outline-none",
            "focus-visible:ring-3 focus-visible:ring-ring/40",
            "disabled:pointer-events-none disabled:opacity-35",
            tone === "danger"
              ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              : active
                ? "bg-primary-soft text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            className,
          )}
          {...props}
        >
          <Icon className="size-[17px]" strokeWidth={2} aria-hidden />
        </motion.button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {hint ? <span className="text-background/60">{hint}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
