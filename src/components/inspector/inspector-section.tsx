"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { useInspectorSections } from "@/hooks/use-inspector-sections";
import { cn } from "@/lib/utils";

export interface InspectorSectionProps {
  /** Stable key — the open/closed state is remembered against it. */
  id: string;
  title: string;
  /** Frequently used sections start open; advanced ones start collapsed. */
  defaultOpen?: boolean;
  /** Shown in the header while the section is closed, e.g. a summary value. */
  summary?: React.ReactNode;
  /** Always-visible badge, e.g. a print-ready verdict. */
  badge?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * A collapsible group of properties.
 *
 * This is where progressive disclosure lives: everything past the first two
 * groups ships collapsed, and whatever the user opens stays open next time
 * they select something. The summary in the header means a collapsed section
 * still reports its state instead of going silent.
 */
export function InspectorSection({
  id,
  title,
  defaultOpen = true,
  summary,
  badge,
  className,
  children,
}: InspectorSectionProps) {
  const sections = useInspectorSections();
  const open = sections.isOpen(id, defaultOpen);
  const contentId = `inspector-section-${id}`;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-card border border-border bg-card shadow-soft",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => sections.toggle(id, defaultOpen)}
        aria-expanded={open}
        aria-controls={contentId}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors",
          "outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40",
        )}
      >
        <motion.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ type: "spring", stiffness: 520, damping: 34 }}
          className="grid shrink-0 place-items-center text-muted-foreground"
        >
          <ChevronDown className="size-3.5" strokeWidth={2.4} aria-hidden />
        </motion.span>

        <h3 className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>

        {badge}
        {!open && summary ? (
          <span className="shrink-0 truncate text-[10.5px] font-semibold text-muted-foreground/80">
            {summary}
          </span>
        ) : null}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={contentId}
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { type: "spring", stiffness: 420, damping: 38 },
              opacity: { duration: 0.15 },
            }}
            className="overflow-hidden"
          >
            <div className="space-y-2.5 px-3 pb-3 pt-0.5">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
