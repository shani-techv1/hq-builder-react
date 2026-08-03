"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Rendered under the copy — usually a secondary action. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * The "nothing here yet" block used wherever a panel has no content to show.
 * Deliberately quiet: dashed container, muted copy, no shadow — so it reads as
 * a placeholder rather than as a card the user is meant to act on.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border",
        "bg-muted/60 px-6 py-9 text-center",
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-card text-muted-foreground shadow-soft">
        <Icon className="size-5" strokeWidth={1.9} />
      </span>
      <div className="space-y-1">
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-[34ch] text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </motion.div>
  );
}
