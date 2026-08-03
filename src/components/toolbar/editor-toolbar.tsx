"use client";

import { Grid2x2, Image, Magnet, Redo2, Type, Undo2 } from "lucide-react";

import { SheetSizeSelect } from "@/components/toolbar/sheet-size-select";
import { ToolbarButton } from "@/components/toolbar/toolbar-button";
import { ToolbarDivider } from "@/components/toolbar/toolbar-divider";
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
  className?: string;
}

/**
 * The toolbar above the canvas.
 *
 * One raised container holding four groups — history, canvas display toggles,
 * the sheet, and zoom — separated by hairlines. Grouping them into a single
 * surface is what stops the controls reading as a scatter of floating buttons.
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
  className,
}: EditorToolbarProps) {
  return (
    <TooltipProvider delay={300}>
      <div
        className={cn(
          "scrollbar-slim flex items-center gap-2 overflow-x-auto px-3 py-2.5 sm:px-4",
          className,
        )}
      >
        <div
          role="toolbar"
          aria-label="Canvas tools"
          className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-border bg-card p-1 shadow-card"
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

          <ToolbarDivider />

          <SheetSizeSelect value={sheetSize} onValueChange={onSheetSizeChange} />

          <ToolbarDivider />

          <ZoomControl zoom={zoom} onZoomChange={onZoomChange} />
        </div>
      </div>
    </TooltipProvider>
  );
}
