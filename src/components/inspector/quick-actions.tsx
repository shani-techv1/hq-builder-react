"use client";

import { motion } from "framer-motion";
import { Sparkles, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  /** Marks AI-assisted actions with a spark. */
  ai?: boolean;
  tone?: "default" | "danger";
}

export interface QuickActionsProps {
  actions: QuickAction[];
  /** Columns in the grid. Three fits a 380px panel comfortably. */
  columns?: 2 | 3;
  className?: string;
}

/**
 * The first thing in the inspector: the handful of operations people reach for
 * before touching a single number.
 *
 * Icon above label rather than a list, so six actions occupy two rows instead
 * of six — the inspector's vertical space belongs to the properties below.
 */
export function QuickActions({
  actions,
  columns = 3,
  className,
}: QuickActionsProps) {
  return (
    <div
      className={cn(
        "grid gap-1.5",
        columns === 3 ? "grid-cols-3" : "grid-cols-2",
        className,
      )}
    >
      {actions.map((action) => (
        <motion.button
          key={action.id}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          whileHover={action.disabled ? undefined : { y: -2 }}
          whileTap={action.disabled ? undefined : { scale: 0.96 }}
          transition={{ type: "spring", stiffness: 440, damping: 28 }}
          className={cn(
            "group/action relative flex flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2.5",
            "transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
            "disabled:pointer-events-none disabled:opacity-40",
            action.tone === "danger"
              ? "border-border bg-card text-muted-foreground hover:border-destructive/35 hover:bg-destructive/5 hover:text-destructive"
              : "border-border bg-card text-muted-foreground hover:border-primary/35 hover:bg-primary-softer hover:text-primary",
          )}
        >
          {action.ai ? (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 text-primary/70"
            >
              <Sparkles className="size-2.5" strokeWidth={2.6} />
            </span>
          ) : null}

          <action.icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
          <span className="text-center text-[10px] font-semibold leading-tight">
            {action.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}
