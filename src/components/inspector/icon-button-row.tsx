"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface IconChoice {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}

export interface IconButtonRowProps {
  choices: IconChoice[];
  /** Fill the row evenly — used for alignment and text-align groups. */
  fill?: boolean;
  className?: string;
}

/**
 * A row of icon-only controls sharing one segmented surface.
 *
 * Used for alignment, distribution, flips and text alignment — sets where the
 * icons are self-explanatory and a labelled row would triple the height.
 */
export function IconButtonRow({
  choices,
  fill = true,
  className,
}: IconButtonRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5",
        className,
      )}
    >
      {choices.map((choice) => (
        <motion.button
          key={choice.id}
          type="button"
          aria-label={choice.label}
          title={choice.label}
          aria-pressed={choice.active}
          onClick={choice.onClick}
          disabled={choice.disabled}
          whileHover={choice.disabled ? undefined : { y: -1 }}
          whileTap={choice.disabled ? undefined : { scale: 0.94 }}
          transition={{ type: "spring", stiffness: 460, damping: 26 }}
          className={cn(
            "grid h-7 place-items-center rounded-md transition-colors outline-none",
            "focus-visible:ring-3 focus-visible:ring-ring/40",
            "disabled:pointer-events-none disabled:opacity-35",
            fill ? "flex-1" : "w-7",
            choice.active
              ? "bg-card text-primary shadow-soft"
              : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
          )}
        >
          <choice.icon className="size-3.5" strokeWidth={2.1} aria-hidden />
        </motion.button>
      ))}
    </div>
  );
}
