"use client";

import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

/** Shortcut, then what it does. Order runs most to least used. */
const HINTS = [
  { keys: ["⌫"], label: "Delete" },
  { keys: ["⌘", "D"], label: "Duplicate" },
  { keys: ["⇧", "Click"], label: "Multi-select" },
  { keys: ["Esc"], label: "Deselect" },
];

export interface KeyboardHintsProps {
  /** Only shown while something is selected — otherwise it is noise. */
  visible: boolean;
  className?: string;
}

/**
 * The shortcut helper in the bottom-right of the canvas pane.
 *
 * Pinned to the pane rather than the sheet, so it holds its corner while the
 * canvas scrolls, and it fades rather than slides — it is a reference, and
 * movement would pull the eye away from the selection that triggered it.
 */
export function KeyboardHints({ visible, className }: KeyboardHintsProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "pointer-events-none absolute bottom-4 right-4 z-30 hidden flex-col gap-1.5",
            "rounded-lg border border-border/70 bg-card/85 px-3 py-2.5 backdrop-blur-md",
            "shadow-[0_4px_14px_-4px_rgb(16_24_40/0.16)] md:flex",
            className,
          )}
        >
          {HINTS.map((hint) => (
            <div
              key={hint.label}
              className="flex items-center justify-between gap-4"
            >
              <span className="flex items-center gap-1">
                {hint.keys.map((key) => (
                  <kbd
                    key={key}
                    className="grid h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-border bg-muted px-1 text-[10px] font-semibold text-muted-foreground"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {hint.label}
              </span>
            </div>
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
