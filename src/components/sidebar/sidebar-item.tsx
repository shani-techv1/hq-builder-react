"use client";

import { motion } from "framer-motion";

import type { NavIcon } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Shared across every rail item so the blue pill slides between them. */
const ACTIVE_PILL_ID = "sidebar-active-pill";

export interface SidebarItemProps {
  icon: NavIcon;
  label: string;
  /** The item whose panel is currently open. */
  isActive: boolean;
  /** The last item the user opened, still open or not. */
  isRemembered?: boolean;
  /**
   * Warnings waiting inside this menu. Rendered as a count over the icon and
   * left off entirely at zero — a badge showing "0" is noise pretending to be
   * information.
   */
  badge?: number;
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
  icon,
  label,
  isActive,
  isRemembered = false,
  badge = 0,
  onClick,
}: SidebarItemProps) {
  const warnings = badge > 0 ? `${badge} warning${badge === 1 ? "" : "s"}` : null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      title={warnings ? `${label} — ${warnings}` : label}
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

      {/* Ringed in whatever it sits on, so the count stays readable on the
          blue pill as well as on the rail. The screen-reader wording is left
          to the end of the button instead, so the menu is announced by name
          before it is announced by how much is wrong inside it. */}
      {warnings ? (
        <span
          aria-hidden
          className={cn(
            "absolute right-1 top-1 z-10 grid min-w-4 place-items-center rounded-full px-1",
            "bg-amber-500 text-[9.5px] font-bold leading-[15px] text-white tabular-nums",
            "ring-2",
            isActive ? "ring-primary" : "ring-card",
          )}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}

      <span className="relative z-10 flex flex-col items-center gap-1.5">
        <motion.span
          animate={{ scale: isActive ? 1.04 : 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
          className="grid place-items-center"
        >
          {icon.kind === "logo" ? (
            // Plain <img>, not next/image: the rail ships in the storefront
            // embed too, a Vite bundle that carries no `next/*` imports — and
            // a bundler-emitted 22px mark has nothing left to optimise.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={icon.src}
              alt=""
              width={22}
              height={22}
              className="size-[22px] object-contain"
              aria-hidden
            />
          ) : (
            <icon.glyph
              className="size-[22px]"
              strokeWidth={isActive ? 2.2 : 1.85}
              aria-hidden
            />
          )}
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

      {warnings ? <span className="sr-only">{warnings}</span> : null}
    </button>
  );
}
