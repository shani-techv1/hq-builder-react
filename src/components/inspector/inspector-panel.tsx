"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Lock, SlidersHorizontal } from "lucide-react";

import { useEditorState } from "@/components/editor/editor-state";
import { CanvasInspector } from "@/components/inspector/states/canvas-inspector";
import { ImageInspector } from "@/components/inspector/states/image-inspector";
import { MultiSelectionInspector } from "@/components/inspector/states/multi-selection-inspector";
import { TextInspector } from "@/components/inspector/states/text-inspector";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KIND_LABELS } from "@/lib/canvas-objects";
import { cn } from "@/lib/utils";

/** Which of the four contextual states the panel is in. */
type InspectorState = "canvas" | "image" | "text" | "multi";

/**
 * The right-hand inspector.
 *
 * A fixed 380px column that switches wholesale between four states rather than
 * greying controls in and out — the panel should always be about the thing
 * that is selected, and a disabled section is still a section you have to read
 * past.
 *
 * The content crossfades while the column itself stays put, so switching
 * selections never shifts the workspace beside it.
 */
export function InspectorPanel({ className }: { className?: string }) {
  const { canvas, settings } = useEditorState();
  const { selectedObjects } = canvas;

  const state: InspectorState =
    selectedObjects.length === 0
      ? "canvas"
      : selectedObjects.length > 1
        ? "multi"
        : selectedObjects[0].kind === "text"
          ? "text"
          : "image";

  const primary = selectedObjects[0];

  const title =
    state === "canvas"
      ? "Canvas"
      : state === "multi"
        ? `${selectedObjects.length} objects`
        : primary.name;

  const subtitle =
    state === "canvas"
      ? "Sheet settings"
      : state === "multi"
        ? "Shared properties"
        : KIND_LABELS[primary.kind];

  return (
    <TooltipProvider delay={300}>
      <motion.aside
        aria-label="Inspector"
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 40 }}
        className={cn(
          "z-30 flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-card",
          className,
        )}
      >
        <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            <SlidersHorizontal className="size-4" strokeWidth={2.1} aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold tracking-tight text-foreground">
              {title}
            </p>
            <p className="truncate text-[10.5px] text-muted-foreground">
              {subtitle}
            </p>
          </div>

          {primary?.locked ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground"
              title="This object is locked"
            >
              <Lock className="size-3" strokeWidth={2.4} aria-hidden />
              Locked
            </span>
          ) : null}
        </header>

        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-canvas/60 px-3 py-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={state === "canvas" ? "canvas" : `${state}-${primary.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="space-y-2.5"
            >
              {state === "canvas" ? (
                <CanvasInspector settings={settings} />
              ) : state === "multi" ? (
                <MultiSelectionInspector
                  objects={selectedObjects}
                  canvas={canvas}
                />
              ) : state === "text" ? (
                <TextInspector object={primary} canvas={canvas} />
              ) : (
                <ImageInspector
                  object={primary}
                  canvas={canvas}
                  settings={settings}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
