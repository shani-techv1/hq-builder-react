"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { PropertyRow } from "@/components/inspector/property-row";
import { cn } from "@/lib/utils";

export interface PropertyInputProps {
  label: string;
  value: number | string;
  onChange: (value: number) => void;
  /** Unit suffix rendered inside the field, e.g. `%`, `in`, `°`. */
  unit?: string;
  /** Small glyph in place of a text label — used for X/Y and W/H pairs. */
  glyph?: LucideIcon;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  tooltip?: string;
  validation?: { tone: "info" | "warning" | "error"; message: string };
  /** Hide the label row and render the field alone, for grid pairs. */
  bare?: boolean;
  className?: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * A numeric property field.
 *
 * Values are committed on change but clamped to the property's range, so a
 * control can never hand the canvas a number it would have to reject. The
 * `bare` variant drops the label row for the X/Y and W/H pairs, where the
 * glyph inside the field carries the meaning.
 */
export function PropertyInput({
  label,
  value,
  onChange,
  unit,
  glyph: Glyph,
  min = -9999,
  max = 9999,
  step = 1,
  disabled = false,
  tooltip,
  validation,
  bare = false,
  className,
}: PropertyInputProps) {
  const id = React.useId();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.value === "") return onChange(min > 0 ? min : 0);
    const parsed = Number(event.target.value);
    if (!Number.isFinite(parsed)) return;
    onChange(clamp(parsed, min, max));
  };

  const field = (
    <div
      className={cn(
        "flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2",
        "transition-colors focus-within:border-primary/50 focus-within:ring-3 focus-within:ring-ring/25",
        disabled && "pointer-events-none opacity-50",
        bare ? "w-full" : "w-[104px]",
        className,
      )}
    >
      {Glyph ? (
        <Glyph
          className="size-3.5 shrink-0 text-muted-foreground"
          strokeWidth={2.2}
          aria-hidden
        />
      ) : null}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={handleChange}
        className={cn(
          "w-full min-w-0 [appearance:textfield] bg-transparent text-[12px] font-semibold",
          "text-foreground outline-none",
          "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        )}
      />
      {unit ? (
        <span className="pointer-events-none shrink-0 text-[10.5px] font-medium text-muted-foreground">
          {unit}
        </span>
      ) : null}
    </div>
  );

  if (bare) return field;

  return (
    <PropertyRow
      label={label}
      htmlFor={id}
      tooltip={tooltip}
      validation={validation}
      disabled={disabled}
    >
      {field}
    </PropertyRow>
  );
}
