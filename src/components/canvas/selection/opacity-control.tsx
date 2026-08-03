"use client";

import { Blend } from "lucide-react";

import { ToolbarAction } from "@/components/canvas/selection/toolbar-action";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";

export interface OpacityControlProps {
  /** 0–100, taken from the first selected object. */
  value: number;
  onChange: (value: number) => void;
}

/** Presets that cover the reasons anyone reaches for opacity on a print sheet. */
const PRESETS = [25, 50, 75, 100];

/**
 * Opacity, as a popover on the selection toolbar.
 *
 * A slider rather than a numeric field: opacity is judged by eye against the
 * artwork, so the control has to be draggable while the sheet stays visible.
 */
export function OpacityControl({ value, onChange }: OpacityControlProps) {
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        render={<span className="inline-flex" />}
      >
        <ToolbarAction icon={Blend} label="Opacity" />
      </PopoverTrigger>

      <PopoverContent align="center" sideOffset={10} className="w-60 gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-foreground">
            Opacity
          </span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {value}%
          </span>
        </div>

        <Slider
          value={value}
          min={0}
          max={100}
          step={1}
          onValueChange={(next) =>
            onChange(Array.isArray(next) ? next[0] : Number(next))
          }
          aria-label="Opacity"
        />

        <div className="flex items-center gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className="flex-1 rounded-md border border-border bg-card py-1 text-[11px] font-semibold tabular-nums text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-softer hover:text-primary"
            >
              {preset}%
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
