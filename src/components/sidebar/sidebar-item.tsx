"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Shared across every rail item so the blue pill slides between them. */
const ACTIVE_PILL_ID = "sidebar-active-pill";

export interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  /** The item whose panel is currently open. */
  isActive: boolean;
  /** The last item the user opened, still open or not. */
  isRemembered?: boolean;
  onClick: () => void;
}

/**
 * One icon + label entry in the 80px rail.
 *
 * Active is the strong blue pill. `isRemembered` is the quieter state a menu
 * keeps after its panel is dismissed, so the rail still shows where the user
 * left off without competing with the open selection.
 */
export function SidebarItem({
  icon: Icon,
  label,
  isActive,
  isRemembered = false,
  onClick,
}: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      title={label}
      className={cn(
        "group relative flex w-16 flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2.5",
        "outline-none transition-colors duration-200",
        "focus-visible:ring-3 focus-visible:ring-ring/40",
        isActive
          ? "text-primary-foreground"
          : isRemembered
            ? "text-primary hover:bg-primary-soft"
            : "text-muted-foreground hover:bg-primary-soft hover:text-primary",
      )}
    >
      {isActive ? (
        <motion.span
          layoutId={ACTIVE_PILL_ID}
          transition={{ type: "spring", stiffness: 480, damping: 38 }}
          className="absolute inset-0 rounded-xl bg-primary shadow-primary"
        />
      ) : null}

      <span className="relative z-10 flex flex-col items-center gap-1.5">
        <motion.span
          animate={{ scale: isActive ? 1.04 : 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
          className="grid place-items-center"
        >
          <Icon
            className="size-[22px]"
            strokeWidth={isActive ? 2.2 : 1.85}
            aria-hidden
          />
        </motion.span>
        <span
          className={cn(
            "text-[10.5px] leading-none tracking-tight transition-[font-weight]",
            isActive ? "font-bold" : "font-medium",
          )}
        >
          {label}
        </span>
      </span>
    </button>
  );
}
