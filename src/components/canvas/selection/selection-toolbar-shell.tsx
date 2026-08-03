"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Clearance the toolbar needs above the selection before it flips below. */
const EDGE_PADDING = 8;

export interface SelectionToolbarShellProps {
  /** The selection badge, rendered above the toolbar surface. */
  badge: React.ReactNode;
  /**
   * Element the toolbar must stay inside — the scrolling canvas pane. Without
   * it the toolbar simply stays above the selection.
   */
  boundary?: React.RefObject<HTMLElement | null>;
  /** Changes to this re-run the placement check (selection geometry, zoom). */
  reflowKey?: string | number;
  children: React.ReactNode;
}

/**
 * Positions a floating toolbar against the current selection.
 *
 * Placement flips to below the selection when there isn't room above it, and
 * is written straight onto the element's `data-placement` attribute rather
 * than held in state — measuring and then re-rendering would cost a frame of
 * the toolbar visibly jumping, and the value is pure presentation.
 */
export function SelectionToolbarShell({
  badge,
  boundary,
  reflowKey,
  children,
}: SelectionToolbarShellProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const element = ref.current;
    const bounds = boundary?.current;
    if (!element) return;

    const place = () => {
      // Measure in the preferred placement, then flip only if it doesn't fit.
      element.dataset.placement = "above";
      if (!bounds) return;
      const toolbar = element.getBoundingClientRect();
      const container = bounds.getBoundingClientRect();
      if (toolbar.top < container.top + EDGE_PADDING) {
        element.dataset.placement = "below";
      }
    };

    place();
    bounds?.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => {
      bounds?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [boundary, reflowKey]);

  return (
    <motion.div
      ref={ref}
      data-placement="above"
      initial={{ opacity: 0, scale: 0.95, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 4 }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
      className={cn(
        "absolute left-1/2 z-30 flex w-max -translate-x-1/2 flex-col items-center gap-1.5",
        "data-[placement=above]:bottom-full data-[placement=above]:mb-3.5",
        "data-[placement=below]:top-full data-[placement=below]:mt-9",
      )}
    >
      {badge}

      <TooltipProvider delay={250}>
        <div
          role="toolbar"
          aria-label="Selection actions"
          className={cn(
            "flex h-12 items-center gap-0.5 rounded-lg border border-border/70 px-1.5",
            "bg-card/85 backdrop-blur-md",
            "shadow-[0_4px_14px_-4px_rgb(16_24_40/0.18),0_16px_36px_-16px_rgb(16_24_40/0.28)]",
          )}
        >
          {children}
        </div>
      </TooltipProvider>
    </motion.div>
  );
}
