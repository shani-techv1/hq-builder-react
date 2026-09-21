"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  type PanInfo,
} from "framer-motion";

import {
  PANEL_TRANSITION,
  PanelCrossfade,
} from "@/components/panels/panel-motion";

export interface BottomSheetProps {
  isOpen: boolean;
  /** Accessible name for the sheet — normally the active menu's title. */
  label: string;
  /** Wired to the panel controller, as the desktop drawer is. */
  panelRef: React.RefObject<HTMLElement | null>;
  /** Changing this crossfades the body — used when switching menus. */
  contentKey: string;
  /** Called when the sheet is swiped down by its handle. */
  onDismiss: () => void;
  children: React.ReactNode;
}

/**
 * Open height. The inner column is pinned to it, so nothing reflows while the
 * sheet grows, and it is capped so a tall phone still keeps most of the screen
 * for the sheet being designed.
 */
const SHEET_HEIGHT = "min(46dvh, 26rem)";

/**
 * How far the finger travels, or how fast, before letting go closes the sheet
 * rather than springing it back. Either is enough: a short flick is as clear a
 * dismissal as a long drag.
 */
const DISMISS_DISTANCE = 72;
const DISMISS_VELOCITY = 480;

/**
 * The drawer every menu renders into on a phone: a sheet across the bottom of
 * the screen, above the tab bar.
 *
 * A row in the editor's layout rather than a layer over it, for the same reason
 * the desktop drawer is a column — the workspace gets shorter to make room, so
 * the top of the design stays in view instead of disappearing under the menu.
 *
 * The handle is the only part that drags. Starting the gesture anywhere else
 * would turn every scroll through a list of artwork into an attempt to close
 * the menu it is in.
 */
export function BottomSheet({
  isOpen,
  label,
  panelRef,
  contentKey,
  onDismiss,
  children,
}: BottomSheetProps) {
  const dragControls = useDragControls();

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const dismissed =
      info.offset.y > DISMISS_DISTANCE || info.velocity.y > DISMISS_VELOCITY;
    if (dismissed) onDismiss();
  };

  return (
    <AnimatePresence initial={false}>
      {isOpen ? (
        <motion.aside
          key="sheet"
          ref={panelRef}
          role="complementary"
          aria-label={label}
          initial={{ height: 0 }}
          animate={{ height: "auto" }}
          exit={{ height: 0 }}
          transition={PANEL_TRANSITION}
          // Follows the finger downward only, and gives a little under it so
          // the sheet feels held rather than pinned; upward it stays put.
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={handleDragEnd}
          className="relative z-20 shrink-0 overflow-hidden rounded-t-card border-t border-border bg-card shadow-panel-up"
        >
          <div style={{ height: SHEET_HEIGHT }} className="flex flex-col">
            {/* Decorative to assistive tech: the panel header's close button is
                the way out that every input can reach. */}
            <div
              aria-hidden
              onPointerDown={(event) => dragControls.start(event)}
              className="flex h-5 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
            >
              <span className="h-1 w-10 rounded-full bg-foreground/15" />
            </div>

            <PanelCrossfade contentKey={contentKey}>{children}</PanelCrossfade>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
