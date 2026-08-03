"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Dot, LoaderCircle } from "lucide-react";

import type { SaveState } from "@/lib/workspace";
import { cn } from "@/lib/utils";

const LABELS: Record<SaveState, string> = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved changes",
};

/**
 * The save indicator beside the design name.
 *
 * Deliberately quiet — it is ambient status, not a control, so it stays at
 * caption size with no chrome. Only "unsaved" picks up colour, because that is
 * the one state the user may need to act on.
 */
export function SaveStatus({
  status,
  className,
}: {
  status: SaveState;
  className?: string;
}) {
  return (
    <span
      aria-live="polite"
      className={cn(
        "inline-flex h-5 items-center gap-1 text-[11.5px] font-medium",
        status === "unsaved" ? "text-amber-600" : "text-muted-foreground",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="inline-flex items-center gap-1"
        >
          <StatusIcon status={status} />
          {LABELS[status]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function StatusIcon({ status }: { status: SaveState }) {
  if (status === "saving") {
    return (
      <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2.2} aria-hidden />
    );
  }
  if (status === "saved") {
    return <Check className="size-3.5" strokeWidth={2.6} aria-hidden />;
  }
  return <Dot className="size-3.5" strokeWidth={6} aria-hidden />;
}
