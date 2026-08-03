"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

export interface SlidingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Accessible name for the drawer — normally the active menu's title. */
  label: string;
  /** Wired to the panel controller so outside-clicks can skip the panel. */
  panelRef: React.RefObject<HTMLElement | null>;
  /** Changing this crossfades the body — used when switching menus. */
  contentKey: string;
  children: React.ReactNode;
}

/** Slide, not fade: the panel emerges from behind the fixed rail. */
const PANEL_TRANSITION = {
  type: "spring" as const,
  stiffness: 420,
  damping: 42,
  mass: 0.9,
};

/**
 * The 420px drawer that every menu renders into.
 *
 * One instance is mounted for the whole editor — switching menus swaps the
 * content inside it rather than remounting the drawer, so the slide only plays
 * when the panel actually opens or closes.
 *
 * On narrow screens it takes the width it can get and dims the workspace
 * behind it, since there isn't room for the canvas and the panel side by side.
 */
export function SlidingPanel({
  isOpen,
  onClose,
  label,
  panelRef,
  contentKey,
  children,
}: SlidingPanelProps) {
  return (
    <AnimatePresence initial={false}>
      {isOpen ? (
        <motion.div
          key="panel-scrim"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={onClose}
          className="absolute inset-0 z-10 bg-foreground/15 backdrop-blur-[1px] md:hidden"
        />
      ) : null}

      {isOpen ? (
        <motion.aside
          key="panel"
          ref={panelRef}
          role="dialog"
          aria-label={label}
          initial={{ x: "-100%", opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "-100%", opacity: 0.4 }}
          transition={PANEL_TRANSITION}
          className={cn(
            "absolute inset-y-0 left-0 z-20 flex w-[420px] max-w-[calc(100vw-5rem)] flex-col",
            "border-r border-border bg-card shadow-panel",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={contentKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="flex min-h-0 flex-1 flex-col"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
