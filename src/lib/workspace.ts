/** Sheet presets, zoom ladder and save states for the header and toolbar. */

export interface SheetSize {
  id: string;
  /** Short label for the toolbar trigger, e.g. `22″ × 36″`. */
  label: string;
  /** Longer description shown in the picker. */
  description: string;
}

/** The presets the editor ships with, used whenever nothing overrides them. */
const BUILT_IN_SHEET_SIZES: SheetSize[] = [
  { id: "22x12", label: '22″ × 12″', description: "Small gang sheet" },
  { id: "22x24", label: '22″ × 24″', description: "Standard gang sheet" },
  { id: "22x36", label: '22″ × 36″', description: "Large gang sheet" },
  { id: "22x60", label: '22″ × 60″', description: "Extra long run" },
  { id: "custom", label: "Custom", description: "Set your own dimensions" },
];

let sheetSizes: SheetSize[] = BUILT_IN_SHEET_SIZES;

/**
 * The sizes a sheet may be set to.
 *
 * A function rather than a constant because the storefront build replaces the
 * list with the sizes the merchant actually sells — offering a size with no
 * variant behind it would let a shopper design something that cannot be bought.
 */
export const getSheetSizes = (): SheetSize[] => sheetSizes;

/**
 * Replace the presets. Called once by the storefront entry before anything
 * renders; passing an empty list restores the built-ins rather than leaving
 * the picker with nothing to offer.
 */
export function setSheetSizes(next: SheetSize[]): void {
  sheetSizes = next.length > 0 ? next : BUILT_IN_SHEET_SIZES;
}

/**
 * Kept as a named export because it is the shape of the presets, not the live
 * list. Anything choosing a size at runtime wants {@link getSheetSizes}.
 */
export const SHEET_SIZES = BUILT_IN_SHEET_SIZES;

/**
 * The size a new sheet opens at.
 *
 * The standard gang sheet whenever it is on offer — it is the common case, and
 * the presets are ordered small-to-large rather than by likelihood. Falls back
 * to the first available size for a merchant whose list doesn't include it.
 */
export const defaultSheetSize = (): string => {
  const sizes = getSheetSizes();
  return sizes.some((size) => size.id === DEFAULT_SHEET_SIZE)
    ? DEFAULT_SHEET_SIZE
    : (sizes[0]?.id ?? DEFAULT_SHEET_SIZE);
};

/** A size's short label, for a trigger or a summary line. */
export const sheetSizeLabel = (id: string): string =>
  getSheetSizes().find((size) => size.id === id)?.label ?? "";

export const DEFAULT_SHEET_SIZE = "22x24";

/** Artwork formats the sheet accepts, listed in the canvas empty state. */
export const SHEET_FORMATS = ["PNG", "JPG", "SVG"];

/**
 * Colours the sheet can be previewed against.
 *
 * Garment colours, not a palette: the sheet itself prints on transparent film,
 * so this is standing in for whatever the transfer ends up on. Judging white
 * artwork against a white sheet tells you nothing — and light type on a dark
 * shirt is exactly the case that needs checking before an order goes out.
 *
 * The colour is a preview and never part of the design, so it is not exported,
 * not saved into a draft, and not on the undo stack.
 */
export interface SheetBackground {
  value: string;
  label: string;
}

export const SHEET_BACKGROUNDS: SheetBackground[] = [
  { value: "#ffffff", label: "White" },
  { value: "#e7e5e4", label: "Heather grey" },
  { value: "#d6d3d1", label: "Ash" },
  { value: "#e8dcc8", label: "Natural" },
  { value: "#fcd34d", label: "Gold" },
  { value: "#f97316", label: "Orange" },
  { value: "#dc2626", label: "Red" },
  { value: "#ec4899", label: "Pink" },
  { value: "#7c3aed", label: "Purple" },
  { value: "#2563eb", label: "Royal blue" },
  { value: "#1e3a8a", label: "Navy" },
  { value: "#15803d", label: "Kelly green" },
  { value: "#166534", label: "Forest" },
  { value: "#78350f", label: "Brown" },
  { value: "#44403c", label: "Charcoal" },
  { value: "#000000", label: "Black" },
];

export const DEFAULT_SHEET_BACKGROUND = SHEET_BACKGROUNDS[0].value;

/**
 * Fixed production specs shown on the sheet's spec card. Constants rather than
 * per-preset values because they describe the print process, not the sheet.
 */
export const SHEET_SPEC = {
  product: "UV DTF Gang Sheet",
  resolution: "300 DPI",
  background: "Transparent background",
} as const;

/** Fallback dimensions for presets that don't encode a size, e.g. "custom". */
const FALLBACK_SHEET = { width: 22, height: 36 };

/**
 * Sheet dimensions in inches, parsed from the preset id (`"22x36"`). Drives
 * the proportions of the sheet on the canvas and the extent of the rulers.
 */
export function sheetInches(id: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(id);
  if (!match) return FALLBACK_SHEET;
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * Inches-to-pixels at 100% zoom.
 *
 * Sized so a standard sheet is a substantial object on screen — big enough to
 * judge a placement on without zooming, while a full 22×60 run still scrolls
 * rather than being unreadably small.
 */
export const PX_PER_INCH = 26;

/** Candidate spacings, in inches, for the rulers' labelled major ticks. */
const MAJOR_CANDIDATES = [1, 2, 5, 10, 20, 50];

/** A labelled tick never gets closer than this to its neighbour. */
const MIN_MAJOR_PX = 56;

export interface RulerScale {
  /** Pixels per inch at the current zoom. */
  pxPerInch: number;
  /** Inches between labelled ticks. */
  majorInches: number;
  majorPx: number;
  minorPx: number;
}

/**
 * Pick a tick spacing for the current zoom.
 *
 * The interval steps up as you zoom out so labels never collide, which is what
 * separates a ruler that stays readable from one that turns into a smear.
 */
export function rulerScale(zoom: number): RulerScale {
  const pxPerInch = (PX_PER_INCH * zoom) / 100;
  const majorInches =
    MAJOR_CANDIDATES.find(
      (candidate) => candidate * pxPerInch >= MIN_MAJOR_PX,
    ) ?? MAJOR_CANDIDATES[MAJOR_CANDIDATES.length - 1];
  const majorPx = majorInches * pxPerInch;

  return { pxPerInch, majorInches, majorPx, minorPx: majorPx / 5 };
}

/**
 * Zoom steps the +/- buttons walk through. A fixed ladder rather than a linear
 * increment, so a single click is a meaningful jump at every scale.
 */
const ZOOM_STEPS = [25, 50, 75, 100, 125, 150, 200, 300, 400];

export const DEFAULT_ZOOM = 100;
export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

/** Next step up the ladder, or the current value when already at the top. */
export function zoomIn(current: number): number {
  return ZOOM_STEPS.find((step) => step > current) ?? MAX_ZOOM;
}

/** Next step down the ladder, or the current value when already at the bottom. */
export function zoomOut(current: number): number {
  const lower = ZOOM_STEPS.filter((step) => step < current);
  return lower.length > 0 ? lower[lower.length - 1] : MIN_ZOOM;
}

/** Where a design stands relative to the last save. */
export type SaveState = "saved" | "saving" | "unsaved";

/* ------------------------ Canvas settings options ------------------------ */

export type MeasurementUnit = "in" | "cm" | "mm";

export const MEASUREMENT_UNITS: Array<{
  id: MeasurementUnit;
  label: string;
}> = [
  { id: "in", label: "Inches" },
  { id: "cm", label: "Centimetres" },
  { id: "mm", label: "Millimetres" },
];

/** Inches per unit, for converting sheet-relative geometry into a readout. */
const UNIT_FACTORS: Record<MeasurementUnit, number> = {
  in: 1,
  cm: 2.54,
  mm: 25.4,
};

/** Inches → the display unit, rounded to something a field can hold. */
export function fromInches(inches: number, unit: MeasurementUnit): number {
  const value = inches * UNIT_FACTORS[unit];
  return unit === "mm" ? Math.round(value) : Math.round(value * 100) / 100;
}

/** Display unit → inches. The inverse of {@link fromInches}. */
export function toInches(value: number, unit: MeasurementUnit): number {
  return value / UNIT_FACTORS[unit];
}

/** Resolution a file has to reach to be considered print ready. */
export const PRINT_READY_DPI = 300;

/**
 * Real print resolution: how many of the file's own pixels land in each inch
 * of the printed result.
 *
 * This is why DPI is never stored on an asset. The same file prints at 600 DPI
 * across two inches and at 120 across ten, so the only honest figure is the
 * one computed against the size the artwork is actually placed at.
 */
export function effectiveDpi(pixels: number, inches: number): number {
  if (inches <= 0) return 0;
  return Math.round(pixels / inches);
}
