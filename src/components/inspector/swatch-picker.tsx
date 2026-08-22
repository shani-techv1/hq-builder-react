"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SwatchOption {
  /** CSS colour, and the value reported on change. */
  value: string;
  /** Accessible name — a colour a user can't name is a colour they can't ask for. */
  label: string;
}

/**
 * `transparent` is a real CSS colour, so it paints as nothing at all.
 *
 * Given the checkerboard behind it, the swatch reads as the absence of a
 * colour rather than as the panel showing through a gap in the row.
 */
const TRANSPARENT = "transparent";

export interface SwatchPickerProps {
  swatches: SwatchOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * A row of colours, one of them chosen.
 *
 * Radio semantics rather than a row of buttons: exactly one is selected at a
 * time, and arrow keys should move between them the way they do in any other
 * single-choice control.
 *
 * The tick on the selected swatch is what makes the choice legible on a light
 * colour, where a ring alone can be lost against the panel behind it.
 */
export function SwatchPicker({
  swatches,
  value,
  onChange,
  disabled = false,
  className,
}: SwatchPickerProps) {
  return (
    <div
      role="radiogroup"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {swatches.map((swatch) => {
        const isSelected = value.toLowerCase() === swatch.value.toLowerCase();

        return (
          <button
            key={swatch.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={swatch.label}
            title={swatch.label}
            disabled={disabled}
            onClick={() => onChange(swatch.value)}
            style={
              swatch.value === TRANSPARENT
                ? undefined
                : { backgroundColor: swatch.value }
            }
            className={cn(
              "grid size-6 place-items-center overflow-hidden rounded-lg border transition-transform outline-none",
              "hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/40",
              "disabled:pointer-events-none disabled:opacity-50",
              swatch.value === TRANSPARENT && "bg-checkerboard bg-card",
              isSelected
                ? "border-primary ring-2 ring-primary/30"
                : "border-border",
            )}
          >
            {isSelected ? (
              <Check
                className={cn("size-3", contrastClass(swatch.value))}
                strokeWidth={3}
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Whether a tick drawn on this colour should be dark or light.
 *
 * Relative luminance from the sRGB channels rather than a hand-kept list, so
 * adding a colour anywhere never leaves an invisible tick behind.
 */
function contrastClass(colour: string): string {
  // The checkerboard is drawn on the card, so the tick takes the card's own
  // foreground and stays legible in either theme.
  if (colour === TRANSPARENT) return "text-foreground";

  const hex = colour.replace("#", "");
  if (hex.length !== 6) return "text-white";

  const [r, g, b] = [0, 2, 4].map((offset) =>
    parseInt(hex.slice(offset, offset + 2), 16),
  );
  // Rec. 601 weighting — close enough for a tick, and cheap.
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance > 140 ? "text-foreground" : "text-white";
}
