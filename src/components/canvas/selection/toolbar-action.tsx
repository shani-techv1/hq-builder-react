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
  /** Accessible name, tooltip text, and the visible label when there is one. */
  label: string;
  /** Second tooltip line — the shortcut, when there is one. */
  hint?: string;
  /**
   * Show the label beside the icon.
   *
   * For the actions a person has to recognise rather than recall: "Remove
   * background" is not a glyph anyone would guess at, and a toolbar of eight
   * unlabelled icons is a memory test.
   */
  showLabel?: boolean;
  active?: boolean;
  /** Destructive actions pick up the danger colour on hover. */
  tone?: "default" | "danger";
  /** Applied to the glyph — how the busy state spins its spinner. */
  iconClassName?: string;
}

/**
 * Shared shape for everything sitting in the floating toolbar.
 *
 * Exported because two of the toolbar's controls open something instead of
 * doing something, so their trigger is a Base UI element rather than this
 * button — and a popover trigger that looked different to the buttons beside it
 * would read as a different kind of thing.
 */
export function toolbarActionClass({
  tone = "default",
  active = false,
  hasLabel = false,
}: {
  tone?: "default" | "danger";
  active?: boolean;
  hasLabel?: boolean;
} = {}): string {
  return cn(
    "flex shrink-0 items-center justify-center gap-1.5 rounded-lg transition-colors outline-none",
    "focus-visible:ring-3 focus-visible:ring-ring/40",
    "disabled:pointer-events-none disabled:opacity-35",
    hasLabel
      ? "h-8 px-2 text-[12.5px] font-semibold"
      : "size-8 [&_svg]:shrink-0",
    tone === "danger"
      ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      : active
        ? "bg-primary-soft text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

/**
 * One action in the floating toolbar.
 *
 * The hover lift is what makes the toolbar feel physical — a spring on `y`
 * rather than a colour change alone, matched across every action so the row
 * responds as one surface.
 *
 * A labelled action needs no tooltip: it already says what it is, and a tooltip
 * repeating the label is a box that appears over the artwork to tell you
 * nothing. The hint keeps one, since a shortcut has nowhere else to live.
 */
export function ToolbarAction({
  icon: Icon,
  label,
  hint,
  showLabel = false,
  active = false,
  tone = "default",
  iconClassName,
  className,
  disabled,
  ...props
}: ToolbarActionProps) {
  const button = (
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -1.5 }}
      whileTap={disabled ? undefined : { scale: 0.94, y: 0 }}
      transition={{ type: "spring", stiffness: 460, damping: 26 }}
      className={cn(
        toolbarActionClass({ tone, active, hasLabel: showLabel }),
        className,
      )}
      {...props}
    >
      <Icon
        className={cn("size-[17px] shrink-0", iconClassName)}
        strokeWidth={2}
        aria-hidden
      />
      {showLabel ? <span className="whitespace-nowrap">{label}</span> : null}
    </motion.button>
  );

  if (showLabel && !hint) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {button}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {hint ? <span className="text-background/60">{hint}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
