"use client";

import * as React from "react";

import { DesignSheet } from "@/components/canvas/design-sheet";
import { KeyboardHints } from "@/components/canvas/keyboard-hints";
import { Ruler, RulerCorner } from "@/components/canvas/rulers";
import { EditorToolbar } from "@/components/toolbar/editor-toolbar";
import { useEditorState } from "@/components/editor/editor-state";
import { useCanvasShortcuts } from "@/hooks/use-canvas-shortcuts";
import { useElementSize } from "@/hooks/use-element-size";
import { useFilePicker } from "@/hooks/use-file-picker";
import { useSpacePan } from "@/hooks/use-space-pan";
import type { PlacementPoint } from "@/lib/canvas-objects";
import type { PanelId } from "@/lib/navigation";
import { PX_PER_INCH, sheetInches, sheetSizeLabel } from "@/lib/workspace";
import { cn } from "@/lib/utils";

/**
 * Smallest space between the pane's edges and the sheet, in pixels.
 *
 * The sheet is centred in the pane, so these are floors rather than fixed
 * gutters: they take over once the sheet outgrows the pane and the view starts
 * to scroll. The top one is deeper than the sides because the spec card floats
 * in it, and because the sheet wants clear air under the toolbar.
 */
const MIN_GUTTER_X = 56;
const MIN_GUTTER_TOP = 92;
const MIN_GUTTER_BOTTOM = 72;

/**
 * How far apart, in sheet percentages, consecutive files from one drop land.
 * Enough to see there are several; not enough to scatter them.
 */
const PLACEMENT_DRIFT = 3;

export interface WorkspaceProps {
  /** Reveal a panel — used to show artwork uploaded from the canvas. */
  onOpenPanel: (id: PanelId) => void;
  /** Reveal a panel scrolled to one of its rows. */
  onOpenPanelAt: (id: PanelId, focus: string) => void;
  className?: string;
}

/**
 * The canvas pane: toolbar, rulers, and the sheet they measure.
 *
 * The geometry is the point here: the sheet takes its proportions from the
 * selected size, scales with zoom, and stays centred in the pane until it
 * outgrows it, at which point the pane scrolls from a fixed gutter instead.
 *
 * Sheet settings and the selection come from the editor's shared state rather
 * than living here, because the inspector drives the same switches.
 */
export function Workspace({ onOpenPanel, onOpenPanelAt, className }: WorkspaceProps) {
  const { canvas, settings, library, placeAsset, placeAssetById } =
    useEditorState();
  const {
    zoom,
    setZoom,
    sheetSize,
    setSheetSize,
    showBackground,
    setShowBackground,
    backgroundColor,
    showGrid,
    setShowGrid,
    snapEnabled,
    setSnapEnabled,
  } = settings;

  const horizontalRuler = React.useRef<HTMLDivElement>(null);
  const verticalRuler = React.useRef<HTMLDivElement>(null);
  const pane = React.useRef<HTMLDivElement>(null);
  const paneSize = useElementSize(pane);

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
  const sheetLabel = sheetSizeLabel(sheetSize);

  const baseWidth = width * PX_PER_INCH;
  const baseHeight = height * PX_PER_INCH;

  /**
   * Where the sheet's top-left corner sits in the pane's scrollable content.
   *
   * Centred while the sheet fits, so it never sits in a corner with dead space
   * beside it, and clamped to the gutter once it doesn't, so an oversized sheet
   * scrolls from a consistent edge rather than being cropped at the start.
   *
   * The rulers take these same two numbers as their origin, so zero always
   * lands on the sheet's top-left corner however the sheet is placed.
   */
  const originX = Math.max(
    MIN_GUTTER_X,
    (paneSize.width - (baseWidth * zoom) / 100) / 2,
  );
  const originY = Math.max(
    MIN_GUTTER_TOP,
    (paneSize.height - (baseHeight * zoom) / 100) / 2,
  );

  /**
   * Files dropped on the sheet are uploaded and then placed where they landed.
   *
   * Dropping artwork onto a sheet says "put it here", so stopping at the
   * library would leave the gesture half-done. Files chosen from the empty
   * state have no drop point, so they go to the middle.
   *
   * Each file is offset a little from the last so a multi-file drop doesn't
   * stack every piece on the same spot.
   */
  const uploadAndPlace = React.useCallback(
    async (files: File[], at?: PlacementPoint) => {
      /*
       * Opened before the upload starts, not after it finishes.
       *
       * The Graphics panel is where progress and rejections are rendered, so
       * revealing it first means a slow upload shows itself working and a drop
       * that is entirely rejected explains why — waiting for the promise would
       * leave both of those cases looking like nothing happened.
       */
      onOpenPanel("graphics");

      const added = await library.uploadFiles(files);
      // The assets themselves, not their ids: see `placeAssetById`.
      added.forEach((asset, index) => {
        const drift = index * PLACEMENT_DRIFT;
        placeAsset(asset, {
          x: (at?.x ?? 50) + drift,
          y: (at?.y ?? 50) + drift,
        });
      });
    },
    [library, placeAsset, onOpenPanel],
  );

  const picker = useFilePicker(
    React.useCallback((files: File[]) => void uploadAndPlace(files), [
      uploadAndPlace,
    ]),
  );

  return (
    <div className={cn("flex h-full flex-col bg-canvas", className)}>
      <input {...picker.inputProps} />

      <EditorToolbar
        canUndo={canvas.canUndo}
        canRedo={canvas.canRedo}
        onUndo={canvas.undo}
        onRedo={canvas.redo}
        onAddText={canvas.addText}
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
            origin={originX}
            className="flex-1"
          />
        </div>

        <div className="relative flex min-h-0 flex-1">
          <Ruler
            ref={verticalRuler}
            orientation="vertical"
            zoom={zoom}
            origin={originY}
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
                // Leading edges carry the centring offset; trailing ones stay
                // at the floor, since they only ever show once it scrolls.
                padding: `${originY}px ${MIN_GUTTER_X}px ${MIN_GUTTER_BOTTOM}px ${originX}px`,
                width: "max-content",
              }}
            >
              <DesignSheet
                baseWidth={baseWidth}
                baseHeight={baseHeight}
                zoom={zoom}
                sizeLabel={sheetLabel}
                showBackground={showBackground}
                backgroundColor={backgroundColor}
                showGrid={showGrid}
                interaction={canvas}
                boundary={pane}
                interactive={!isPanning}
                onOpenAutofill={() => onOpenPanel("autofill")}
                onOpenOpacity={() => onOpenPanelAt("settings", "opacity")}
                onPlaceAsset={placeAssetById}
                onDropFiles={(files, at) => void uploadAndPlace(files, at)}
                onBrowse={picker.open}
              />
            </div>
          </div>

          <KeyboardHints visible={canvas.hasSelection} />
        </div>
      </div>
    </div>
  );
}
