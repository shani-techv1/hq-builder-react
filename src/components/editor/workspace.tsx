"use client";

import * as React from "react";

import { DesignSheet } from "@/components/canvas/design-sheet";
import { KeyboardHints } from "@/components/canvas/keyboard-hints";
import { Ruler, RulerCorner } from "@/components/canvas/rulers";
import { EditorToolbar } from "@/components/toolbar/editor-toolbar";
import { useEditorState } from "@/components/editor/editor-state";
import { useCanvasShortcuts } from "@/hooks/use-canvas-shortcuts";
import { useSpacePan } from "@/hooks/use-space-pan";
import { PX_PER_INCH, SHEET_SIZES, sheetInches } from "@/lib/workspace";
import { cn } from "@/lib/utils";

/**
 * Space between the pane's edges and the sheet, in pixels.
 *
 * The top gutter is deeper than the sides because the spec card floats in it,
 * and because the sheet wants clear air under the toolbar. The rulers take
 * these same values as their origin, so zero always lands on the sheet's
 * top-left corner.
 */
const GUTTER_X = 56;
const GUTTER_TOP = 92;
const GUTTER_BOTTOM = 72;

export interface WorkspaceProps {
  className?: string;
}

/**
 * The canvas pane: toolbar, rulers, and the sheet they measure.
 *
 * The sheet is still a placeholder — no canvas, no layers. What is real is the
 * geometry around it: the sheet takes its proportions from the selected size,
 * scales with zoom, and sits at a fixed gutter from the pane's origin.
 *
 * Sheet settings and the selection come from the editor's shared state rather
 * than living here, because the inspector drives the same switches.
 */
export function Workspace({ className }: WorkspaceProps) {
  const { canvas, settings } = useEditorState();
  const {
    zoom,
    setZoom,
    sheetSize,
    setSheetSize,
    showBackground,
    setShowBackground,
    showGrid,
    setShowGrid,
    snapEnabled,
    setSnapEnabled,
  } = settings;

  const horizontalRuler = React.useRef<HTMLDivElement>(null);
  const verticalRuler = React.useRef<HTMLDivElement>(null);
  const pane = React.useRef<HTMLDivElement>(null);

  const { isPanning, handlers: panHandlers } = useSpacePan(pane);

  useCanvasShortcuts({
    enabled: canvas.hasSelection,
    onDelete: canvas.deleteSelection,
    onDuplicate: canvas.duplicateSelection,
    onDeselect: canvas.clearSelection,
    onUndo: canvas.undo,
    onRedo: canvas.redo,
  });

  /**
   * Push the pane's scroll position onto both rulers as a CSS variable. Done
   * through refs rather than state so scrolling never re-renders the sheet.
   */
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const scroller = event.currentTarget;
    horizontalRuler.current?.style.setProperty(
      "--ruler-offset",
      `${-scroller.scrollLeft}px`,
    );
    verticalRuler.current?.style.setProperty(
      "--ruler-offset",
      `${-scroller.scrollTop}px`,
    );
  };

  const { width, height } = sheetInches(sheetSize);
  const sheetLabel =
    SHEET_SIZES.find((size) => size.id === sheetSize)?.label ?? "";

  return (
    <div className={cn("flex h-full flex-col bg-canvas", className)}>
      <EditorToolbar
        canUndo={canvas.canUndo}
        canRedo={canvas.canRedo}
        onUndo={canvas.undo}
        onRedo={canvas.redo}
        showBackground={showBackground}
        onShowBackgroundChange={setShowBackground}
        showGrid={showGrid}
        onShowGridChange={setShowGrid}
        snapEnabled={snapEnabled}
        onSnapEnabledChange={setSnapEnabled}
        sheetSize={sheetSize}
        onSheetSizeChange={setSheetSize}
        zoom={zoom}
        onZoomChange={setZoom}
      />

      <div className="flex min-h-0 flex-1 flex-col border-t border-border">
        <div className="flex shrink-0">
          <RulerCorner />
          <Ruler
            ref={horizontalRuler}
            orientation="horizontal"
            zoom={zoom}
            origin={GUTTER_X}
            className="flex-1"
          />
        </div>

        <div className="relative flex min-h-0 flex-1">
          <Ruler
            ref={verticalRuler}
            orientation="vertical"
            zoom={zoom}
            origin={GUTTER_TOP}
            className="shrink-0"
          />

          <div
            ref={pane}
            onScroll={handleScroll}
            {...panHandlers}
            onPointerDown={(event) => {
              panHandlers.onPointerDown(event);
              if (isPanning) return;
              // A press that reaches the pane from outside the sheet missed
              // the artwork entirely, so it deselects. Presses inside the
              // sheet belong to the canvas, which owns hit-testing.
              const target = event.target as HTMLElement;
              if (target.closest("[data-design-sheet]")) return;
              canvas.clearSelection();
            }}
            className={cn(
              "bg-dot-texture scrollbar-none min-w-0 flex-1 overflow-auto",
              isPanning && "cursor-grab select-none active:cursor-grabbing",
            )}
          >
            <div
              style={{
                padding: `${GUTTER_TOP}px ${GUTTER_X}px ${GUTTER_BOTTOM}px`,
                width: "max-content",
              }}
            >
              <DesignSheet
                baseWidth={width * PX_PER_INCH}
                baseHeight={height * PX_PER_INCH}
                zoom={zoom}
                sizeLabel={sheetLabel}
                showBackground={showBackground}
                showGrid={showGrid}
                interaction={canvas}
                boundary={pane}
                interactive={!isPanning}
              />
            </div>
          </div>

          <KeyboardHints visible={canvas.hasSelection} />
        </div>
      </div>
    </div>
  );
}
