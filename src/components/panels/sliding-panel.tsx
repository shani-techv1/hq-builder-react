"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import {
  PANEL_TRANSITION,
  PanelCrossfade,
} from "@/components/panels/panel-motion";
import { cn } from "@/lib/utils";

export interface SlidingPanelProps {
  isOpen: boolean;
  /** Accessible name for the drawer — normally the active menu's title. */
  label: string;
  /** Wired to the panel controller so outside-clicks can skip the panel. */
  panelRef: React.RefObject<HTMLElement | null>;
  /** Changing this crossfades the body — used when switching menus. */
  contentKey: string;
  children: React.ReactNode;
}

/** Open width. The inner column is pinned to this so nothing reflows. */
const PANEL_WIDTH = 420;

/**
 * The 420px drawer that every menu renders into on a desktop-sized screen —
 * see `BottomSheet` for the one a phone gets.
 *
 * A column in the editor's layout rather than a sheet floating over it — the
 * workspace narrows to make room and the sheet stays visible, so artwork can
 * be dragged from a panel onto a canvas that was never hidden behind it.
 *
 * The animated property is the width; the contents sit in a child pinned to
 * the open width. Without that the text would reflow on every frame of the
 * transition, which reads as the panel's contents scrambling into place.
 */
export function SlidingPanel({
  isOpen,
  label,
  panelRef,
  contentKey,
  children,
}: SlidingPanelProps) {
  return (
    <AnimatePresence initial={false}>
      {isOpen ? (
        <motion.aside
          key="panel"
          ref={panelRef}
          role="complementary"
          aria-label={label}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: PANEL_WIDTH, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={PANEL_TRANSITION}
          className={cn(
            "relative z-20 h-full shrink-0 overflow-hidden",
            // Never more than the viewport can spare once the rail is placed.
            "max-w-[calc(100vw-5rem)]",
            "border-r border-border bg-card shadow-panel",
          )}
        >
          <div
            style={{ width: PANEL_WIDTH }}
            className="flex h-full max-w-full flex-col"
          >
            <PanelCrossfade contentKey={contentKey}>{children}</PanelCrossfade>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
