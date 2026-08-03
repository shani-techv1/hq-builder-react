"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const MotionButton = motion.button;

export interface PrimaryButtonProps
  extends Omit<
    React.ComponentProps<"button">,
    "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag" | "ref"
  > {
  /** Optional leading icon, rendered at 18px to match the label. */
  icon?: LucideIcon;
  /** Softer, tinted treatment for secondary calls to action. */
  variant?: "solid" | "soft" | "outline";
  size?: "md" | "lg";
  /** Stretch to the container — the default inside panels. */
  block?: boolean;
}

const VARIANTS: Record<NonNullable<PrimaryButtonProps["variant"]>, string> = {
  solid:
    "bg-primary text-primary-foreground shadow-primary hover:bg-primary/92 disabled:shadow-none",
  soft: "bg-primary-soft text-primary hover:bg-primary-soft/70",
  outline:
    "border border-border bg-card text-foreground shadow-soft hover:border-primary/40 hover:bg-primary-softer hover:text-primary",
};

const SIZES: Record<NonNullable<PrimaryButtonProps["size"]>, string> = {
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

/**
 * The editor's emphasised action button.
 *
 * Wraps a plain `<button>` in Framer Motion rather than the shadcn `Button`
 * so press feedback is a spring rather than a CSS translate — the panels lean
 * on that tactility, and layering motion over the primitive's own `active:`
 * transform would fight it.
 */
export function PrimaryButton({
  icon: Icon,
  variant = "solid",
  size = "lg",
  block = true,
  className,
  children,
  disabled,
  ...props
}: PrimaryButtonProps) {
  return (
    <MotionButton
      type="button"
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold",
        "outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-[18px] shrink-0" strokeWidth={2.1} /> : null}
      {children}
    </MotionButton>
  );
}
