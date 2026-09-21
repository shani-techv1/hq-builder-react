"use client";

import { Grid2x2, Image, Magnet, Redo2, Type, Undo2 } from "lucide-react";

import { SheetSizeSelect } from "@/components/toolbar/sheet-size-select";
import { ToolbarButton } from "@/components/toolbar/toolbar-button";
import { ToolbarDivider } from "@/components/toolbar/toolbar-divider";
import { ToolbarOverflowMenu } from "@/components/toolbar/toolbar-overflow-menu";
import { ZoomControl } from "@/components/toolbar/zoom-control";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface EditorToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Adds a text layer, ready to type into. */
  onAddText: () => void;
  showBackground: boolean;
  onShowBackgroundChange: (value: boolean) => void;
  showGrid: boolean;
  onShowGridChange: (value: boolean) => void;
  snapEnabled: boolean;
  onSnapEnabledChange: (value: boolean) => void;
  sheetSize: string;
  onSheetSizeChange: (value: string) => void;
  zoom: number;
  onZoomChange: (value: number) => void;
  /** Zoom to the whole width of the sheet — offered on a phone. */
  onZoomToFit: () => void;
  className?: string;
}

/**
 * The toolbar above the canvas.
 *
 * One raised container holding four groups — history, canvas display toggles,
 * the sheet, and zoom — separated by hairlines. Grouping them into a single
 * surface is what stops the controls reading as a scatter of floating buttons.
 *
 * On a phone the grid, snap and zoom controls fold into a menu at the end, so
 * the rest fits the width of the screen instead of scrolling out of sight.
 * Switched in CSS, so the row is already the right one on first paint.
 *
 * Snap has nothing behind it yet; it is rendered in its real resting state
 * rather than omitted, so the layout is already final.
 */
export function EditorToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddText,
  showBackground,
  onShowBackgroundChange,
  showGrid,
  onShowGridChange,
  snapEnabled,
  onSnapEnabledChange,
  sheetSize,
  onSheetSizeChange,
  zoom,
  onZoomChange,
  onZoomToFit,
  className,
}: EditorToolbarProps) {
  return (
    <TooltipProvider delay={300}>
      <div
        className={cn(
          "scrollbar-slim flex items-center gap-2 overflow-x-auto px-2 py-2.5 sm:px-4",
          className,
        )}
      >
        {/* Centred on a phone, where it spans most of the width anyway. Auto
            margins rather than centring the row, because they fall back to the
            start edge if the toolbar ever overflows — centred content that
            overflows is cut off on both sides, and only one side scrolls. */}
        <div
          role="toolbar"
          aria-label="Canvas tools"
          className="mx-auto inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-border bg-card p-1 shadow-card md:mx-0"
        >
          <ToolbarButton
            icon={Undo2}
            label="Undo"
            hint="⌘Z"
            onClick={onUndo}
            disabled={!canUndo}
          />
          <ToolbarButton
            icon={Redo2}
            label="Redo"
            hint="⇧⌘Z"
            onClick={onRedo}
            disabled={!canRedo}
          />

          <ToolbarDivider />

          {/* The one control here that adds something to the sheet, so it sits
              apart from the display toggles rather than among them. */}
          <ToolbarButton icon={Type} label="Add text" onClick={onAddText} />

          <ToolbarDivider />

          <ToolbarButton
            icon={Image}
            label="Background preview"
            active={showBackground}
            onClick={() => onShowBackgroundChange(!showBackground)}
          />
          <span className="hidden md:contents">
            <ToolbarButton
              icon={Grid2x2}
              label="Grid"
              active={showGrid}
              onClick={() => onShowGridChange(!showGrid)}
            />
            <ToolbarButton
              icon={Magnet}
              label="Snap to guides"
              active={snapEnabled}
              onClick={() => onSnapEnabledChange(!snapEnabled)}
            />
          </span>

          <ToolbarDivider />

          <SheetSizeSelect value={sheetSize} onValueChange={onSheetSizeChange} />

          <ToolbarDivider />

          <ZoomControl
            zoom={zoom}
            onZoomChange={onZoomChange}
            className="hidden md:flex"
          />

          <span className="contents md:hidden">
            <ToolbarOverflowMenu
              showGrid={showGrid}
              onShowGridChange={onShowGridChange}
              snapEnabled={snapEnabled}
              onSnapEnabledChange={onSnapEnabledChange}
              zoom={zoom}
              onZoomChange={onZoomChange}
              onZoomToFit={onZoomToFit}
            />
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}
