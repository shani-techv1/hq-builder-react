"use client";

import { Minus, Plus } from "lucide-react";

import { ToolbarButton } from "@/components/toolbar/toolbar-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  zoomIn,
  zoomOut,
} from "@/lib/workspace";
import { cn } from "@/lib/utils";

export interface ZoomControlProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  className?: string;
}

/**
 * `[-] 100% [+]` as one control rather than three loose buttons.
 *
 * The readout is itself a button that snaps back to 100% — the shortcut people
 * reach for most after zooming in to check a placement.
 */
export function ZoomControl({
  zoom,
  onZoomChange,
  className,
}: ZoomControlProps) {
  return (
    <div className={cn("flex shrink-0 items-center", className)}>
      <ToolbarButton
        icon={Minus}
        label="Zoom out"
        onClick={() => onZoomChange(zoomOut(zoom))}
        disabled={zoom <= MIN_ZOOM}
      />

      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <button
            type="button"
            onClick={() => onZoomChange(DEFAULT_ZOOM)}
            aria-label={`Zoom ${zoom} percent. Reset to 100%.`}
            className={cn(
              "h-9 w-14 rounded-lg text-[12.5px] font-semibold tabular-nums text-foreground",
              "transition-colors outline-none hover:bg-muted",
              "focus-visible:ring-3 focus-visible:ring-ring/40",
            )}
          >
            {zoom}%
          </button>
        </TooltipTrigger>
        <TooltipContent>Reset zoom to 100%</TooltipContent>
      </Tooltip>

      <ToolbarButton
        icon={Plus}
        label="Zoom in"
        onClick={() => onZoomChange(zoomIn(zoom))}
        disabled={zoom >= MAX_ZOOM}
      />
    </div>
  );
}
