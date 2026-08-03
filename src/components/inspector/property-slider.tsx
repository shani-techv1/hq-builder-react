"use client";

import { motion } from "framer-motion";

import { PropertyRow } from "@/components/inspector/property-row";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export interface PropertySliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  tooltip?: string;
  validation?: { tone: "info" | "warning" | "error"; message: string };
  className?: string;
}

/**
 * A slider with a live readout.
 *
 * Used for anything judged by eye rather than typed — opacity, spacing,
 * rotation. The readout is a chip rather than an editable field so the row
 * stays one interaction; properties that want typing use `PropertyInput`.
 */
export function PropertySlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "%",
  disabled = false,
  tooltip,
  validation,
  className,
}: PropertySliderProps) {
  return (
    <PropertyRow
      label={label}
      layout="stack"
      tooltip={tooltip}
      validation={validation}
      disabled={disabled}
      className={className}
    >
      <div className="flex items-center gap-3">
        <Slider
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={label}
          onValueChange={(next) =>
            onChange(Array.isArray(next) ? next[0] : Number(next))
          }
          className="flex-1"
        />
        <motion.span
          key={value}
          initial={{ opacity: 0.55 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "w-[52px] shrink-0 rounded-md bg-muted px-1.5 py-1 text-center",
            "text-[11px] font-semibold tabular-nums text-foreground",
          )}
        >
          {value}
          {unit}
        </motion.span>
      </div>
    </PropertyRow>
  );
}
