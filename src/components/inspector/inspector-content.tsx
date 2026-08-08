"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Lock } from "lucide-react";

import { useEditorState } from "@/components/editor/editor-state";
import { CanvasInspector } from "@/components/inspector/states/canvas-inspector";
import { ImageInspector } from "@/components/inspector/states/image-inspector";
import { MultiSelectionInspector } from "@/components/inspector/states/multi-selection-inspector";
import { TextInspector } from "@/components/inspector/states/text-inspector";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KIND_LABELS } from "@/lib/canvas-objects";

/** Which of the four contextual states the inspector is in. */
type InspectorState = "canvas" | "image" | "text" | "multi";

/**
 * The inspector's body: sheet settings, or the properties of the selection.
 *
 * Switches wholesale between four states rather than greying controls in and
 * out — the panel should always be about the thing that is selected, and a
 * disabled section is still a section you have to read past. The content
 * crossfades in place so switching selections never shifts the layout.
 *
 * The panel's own heading is static ("Settings"), so the strip at the top is
 * what says which of the four states you are looking at — without it, selecting
 * a layer would silently change every control below.
 */
export function InspectorContent() {
  const { canvas, settings, findAsset } = useEditorState();
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
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-2.5">
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
        </div>

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
                <TextInspector
                  object={primary}
                  canvas={canvas}
                  settings={settings}
                />
              ) : (
                <ImageInspector
                  object={primary}
                  asset={findAsset(primary.assetId)}
                  canvas={canvas}
                  settings={settings}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </TooltipProvider>
  );
}
