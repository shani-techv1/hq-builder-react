import type { PropertyOption } from "@/components/inspector/property-dropdown";
import { FONT_FAMILIES, findFontFamily } from "@/lib/fonts";

/** Option lists the inspector's dropdowns and swatches read from. */

/**
 * Family choices, built from the catalogue the app actually loads.
 *
 * Derived rather than written out, so adding a typeface is a one-line change
 * in `lib/fonts.ts` and the picker cannot drift from what the canvas can draw.
 */
export const FONT_FAMILY_OPTIONS: PropertyOption[] = FONT_FAMILIES.map(
  (family) => ({
    value: family.id,
    label: family.label,
    detail: family.detail,
  }),
);

const WEIGHT_LABELS: Record<number, string> = {
  400: "Regular",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "Extrabold",
};

/**
 * Weights a given family can really set.
 *
 * A display face drawn at a single weight has no bold to offer, and letting
 * the picker ask for one would get a synthesised approximation — thickened
 * outlines that look nothing like a real bold and print worse than they look.
 */
export function fontWeightOptions(
  familyId: string | undefined,
): PropertyOption[] {
  return findFontFamily(familyId).weights.map((weight) => ({
    value: String(weight),
    label: WEIGHT_LABELS[weight] ?? String(weight),
  }));
}

/**
 * Text colours offered next to the colour field.
 *
 * Ordered the way a printer thinks about them: neutrals first, then a hue ring
 * running warm to cool. Every value is a solid, saturated ink rather than a
 * pastel — these have to survive being printed onto fabric, where light tints
 * sink into the garment.
 */
export const TEXT_SWATCHES = [
  /* Neutrals */
  "#000000",
  "#1f2937",
  "#64748b",
  "#cbd5e1",
  "#ffffff",

  /* Warm */
  "#7f1d1d",
  "#dc2626",
  "#ea580c",
  "#f59e0b",
  "#facc15",

  /* Green */
  "#166534",
  "#16a34a",
  "#10b981",
  "#14b8a6",

  /* Cool */
  "#0ea5e9",
  "#1e88ff",
  "#1e3a8a",
  "#4f46e5",

  /* Purple and pink */
  "#7c3aed",
  "#c026d3",
  "#db2777",
  "#f472b6",

  /* Earth */
  "#78350f",
  "#a8a29e",
];
