"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * How the drawer opens and closes, in either of its forms.
 *
 * Grown rather than slid: the workspace makes room for it instead of being
 * covered by it, so the edge that moves is the one the canvas is measured from.
 */
export const PANEL_TRANSITION = {
  type: "spring" as const,
  stiffness: 420,
  damping: 42,
  mass: 0.9,
};

/**
 * Crossfades the drawer's contents when the user switches menus, without the
 * drawer itself closing and reopening around them.
 */
export function PanelCrossfade({
  contentKey,
  children,
}: {
  /** Changing this swaps the contents. */
  contentKey: string;
  children: React.ReactNode;
}) {
  return (
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
  );
}
