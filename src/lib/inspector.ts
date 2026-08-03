import type { PropertyOption } from "@/components/inspector/property-dropdown";

/** Option lists the inspector's dropdowns and swatches read from. */

/**
 * Only the families actually loaded by the app.
 *
 * A longer list would render identically — every unloaded family falls back to
 * the same system font — so the picker offers what the sheet can really show.
 */
export const FONT_FAMILIES: PropertyOption[] = [
  { value: "sans", label: "Sans" },
  { value: "mono", label: "Mono" },
];

export const FONT_WEIGHTS: PropertyOption[] = [
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extrabold" },
];

/** Text colours offered next to the colour field. */
export const TEXT_SWATCHES = [
  "#1f2937",
  "#ffffff",
  "#1e88ff",
  "#e11d48",
  "#f59e0b",
  "#10b981",
  "#7c3aed",
];
