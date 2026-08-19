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
 * the whole bar slides back inside the pane when centring it on a selection
 * near an edge would hang it off one — a labelled toolbar is wide enough that
 * a small piece of artwork by the left margin would otherwise put half the
 * actions out of reach.
 *
 * Both are written straight onto the element — a data attribute and a custom
 * property — rather than held in state: measuring and then re-rendering would
 * cost a frame of the toolbar visibly jumping, and neither value is anything
 * but presentation.
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
      // Measure centred and in the preferred placement, then correct only what
      // doesn't fit. Resetting first is what stops corrections compounding.
      element.dataset.placement = "above";
      element.style.setProperty("--toolbar-shift", "0px");
      if (!bounds) return;

      const toolbar = element.getBoundingClientRect();
      const container = bounds.getBoundingClientRect();

      if (toolbar.top < container.top + EDGE_PADDING) {
        element.dataset.placement = "below";
      }

      /* Left edge wins when the toolbar is wider than the pane itself: the
         actions people reach for most are the ones at the start of it. */
      const pastLeft = container.left + EDGE_PADDING - toolbar.left;
      const pastRight = toolbar.right - (container.right - EDGE_PADDING);
      const shift = pastLeft > 0 ? pastLeft : pastRight > 0 ? -pastRight : 0;
      element.style.setProperty("--toolbar-shift", `${Math.round(shift)}px`);
    };

    place();

    // The toolbar's own width changes under it — an action appears for one kind
    // of artwork and not another, and a label grows while its work runs.
    const observer = new ResizeObserver(place);
    observer.observe(element);

    bounds?.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
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
        "absolute left-1/2 z-30 flex w-max flex-col items-center gap-1.5",
        "translate-x-[calc(-50%+var(--toolbar-shift,0px))]",
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
