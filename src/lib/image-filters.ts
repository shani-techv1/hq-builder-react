/**
 * Looks that can be put on placed artwork.
 *
 * Two engines have to agree about what a look is: Fabric applies it to the real
 * bitmap on the sheet, and CSS applies it to a thumbnail in the picker. So every
 * preset is built from primitives both express — greyscale, sepia, invert,
 * saturation and hue — rather than from Fabric's own colour-matrix presets,
 * which CSS could only approximate. What the grid shows is what prints.
 *
 * The one place the two differ is brightness: CSS multiplies, Fabric adds. At
 * the strengths used here that is a few percent on a thumbnail, and the sheet
 * itself is the preview that counts for the sliders.
 */

import { filters } from "fabric";
import type { FabricImage } from "fabric";

/**
 * What an image's `filters` array holds. Taken from the property itself rather
 * than imported: Fabric keeps `BaseFilter` off its public entry point, and this
 * cannot drift from what the renderer will actually accept.
 */
type FabricFilter = FabricImage["filters"][number];

import {
  NEUTRAL_ADJUSTMENTS,
  hasAdjustments,
  type CanvasAdjustments,
  type CanvasObject,
} from "@/lib/canvas-objects";

/**
 * A look, in the terms both engines share. Multipliers are CSS's: `1` leaves
 * the channel alone.
 */
export interface FilterSpec {
  grayscale?: boolean;
  sepia?: boolean;
  invert?: boolean;
  saturate?: number;
  contrast?: number;
  brightness?: number;
  /** Degrees around the colour wheel. */
  hueRotate?: number;
}

export interface FilterPreset {
  id: string;
  label: string;
  spec: FilterSpec;
}

/** The id of "leave it alone", which is also what an object with no filter has. */
export const NO_FILTER = "none";

/**
 * The catalogue, ordered from the quietest to the loudest.
 *
 * A gang sheet prints what it is given, so these are looks a printer would
 * accept — a duotone, a warm cast, a punchier version of the same picture —
 * before the two that are frankly effects.
 */
export const FILTER_PRESETS: FilterPreset[] = [
  { id: NO_FILTER, label: "Original", spec: {} },
  { id: "mono", label: "Mono", spec: { grayscale: true } },
  { id: "noir", label: "Noir", spec: { grayscale: true, contrast: 1.35 } },
  { id: "sepia", label: "Sepia", spec: { sepia: true } },
  {
    id: "faded",
    label: "Faded",
    spec: { saturate: 0.7, contrast: 0.88, brightness: 1.08 },
  },
  {
    id: "warm",
    label: "Warm",
    spec: { sepia: true, saturate: 1.6, hueRotate: -12 },
  },
  { id: "cool", label: "Cool", spec: { hueRotate: 24, saturate: 1.15 } },
  { id: "vivid", label: "Vivid", spec: { saturate: 1.7, contrast: 1.1 } },
  {
    id: "punch",
    label: "Punch",
    spec: { saturate: 2.4, contrast: 1.2, hueRotate: 300 },
  },
  { id: "invert", label: "Invert", spec: { invert: true } },
];

export const findFilterPreset = (id: string | undefined): FilterPreset =>
  FILTER_PRESETS.find((preset) => preset.id === id) ?? FILTER_PRESETS[0];

/** Whether anything about this object changes how its artwork looks. */
export const hasLook = (object: CanvasObject): boolean =>
  (object.filter !== undefined && object.filter !== NO_FILTER) ||
  hasAdjustments(object.adjustments);

/* ---------------------------------- CSS ---------------------------------- */

/**
 * The look as a CSS `filter` value, for previewing on a thumbnail.
 *
 * Returns `undefined` rather than `"none"` for an untouched image, so callers
 * can leave the property off the element entirely.
 */
export function cssFilter(
  spec: FilterSpec,
  adjustments: CanvasAdjustments = NEUTRAL_ADJUSTMENTS,
): string | undefined {
  const parts: string[] = [];

  if (spec.grayscale) parts.push("grayscale(1)");
  if (spec.sepia) parts.push("sepia(1)");
  if (spec.invert) parts.push("invert(1)");
  if (spec.hueRotate) parts.push(`hue-rotate(${spec.hueRotate}deg)`);

  const saturate = (spec.saturate ?? 1) * (1 + adjustments.saturation / 100);
  const contrast = (spec.contrast ?? 1) * (1 + adjustments.contrast / 100);
  const brightness = (spec.brightness ?? 1) * (1 + adjustments.brightness / 100);

  if (saturate !== 1) parts.push(`saturate(${round(saturate)})`);
  if (contrast !== 1) parts.push(`contrast(${round(contrast)})`);
  if (brightness !== 1) parts.push(`brightness(${round(brightness)})`);

  return parts.length > 0 ? parts.join(" ") : undefined;
}

const round = (value: number) => Math.round(value * 100) / 100;

/* -------------------------------- Fabric --------------------------------- */

/** CSS multiplier → the −1…1 offset Fabric's saturation and contrast take. */
const toOffset = (multiplier: number) =>
  Math.max(-1, Math.min(1, multiplier - 1));

/**
 * The look as Fabric filters, preset first and the user's own adjustments over
 * the top — the same order the picker previews them in.
 *
 * An empty array is meaningful: handing it to an image and re-applying is how
 * the original pixels come back when a look is removed.
 */
export function fabricFilters(object: CanvasObject): FabricFilter[] {
  const { spec } = findFilterPreset(object.filter);
  const adjustments = object.adjustments ?? NEUTRAL_ADJUSTMENTS;
  const built: FabricFilter[] = [];

  if (spec.grayscale) built.push(new filters.Grayscale());
  if (spec.sepia) built.push(new filters.Sepia());
  if (spec.invert) built.push(new filters.Invert());
  if (spec.hueRotate) {
    // Fabric measures the rotation in turns of π rather than in degrees.
    built.push(new filters.HueRotation({ rotation: spec.hueRotate / 180 }));
  }

  const saturate = (spec.saturate ?? 1) * (1 + adjustments.saturation / 100);
  const contrast = (spec.contrast ?? 1) * (1 + adjustments.contrast / 100);
  const brightness = (spec.brightness ?? 1) * (1 + adjustments.brightness / 100);

  if (saturate !== 1) {
    built.push(new filters.Saturation({ saturation: toOffset(saturate) }));
  }
  if (contrast !== 1) {
    built.push(new filters.Contrast({ contrast: toOffset(contrast) }));
  }
  if (brightness !== 1) {
    built.push(new filters.Brightness({ brightness: toOffset(brightness) }));
  }

  return built;
}

/**
 * A short string that changes exactly when the look does.
 *
 * Applying filters means re-running the pipeline over every pixel of a
 * print-resolution bitmap, so the renderer compares this instead of doing that
 * work on every state change.
 */
export function filterKey(object: CanvasObject): string {
  const adjustments = object.adjustments ?? NEUTRAL_ADJUSTMENTS;
  return [
    object.filter ?? NO_FILTER,
    adjustments.brightness,
    adjustments.contrast,
    adjustments.saturation,
  ].join(":");
}
