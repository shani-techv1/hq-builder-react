/**
 * Autofill — filling a sheet with copies of what is selected.
 *
 * A gang sheet is mostly the same artwork repeated, and placing thirty copies
 * by hand at an even spacing is the job nobody wants to do. This works out
 * where the copies go; the reducer creates them, so however many a fill makes,
 * it is one edit and one undo step.
 *
 * The maths is done in inches — a gap is a real distance, and a sheet is not
 * square, so a percentage step means two different things on the two axes —
 * and handed back in sheet percentages, which is how a placement is stored.
 */

import { boundingBox, type CanvasObject } from "@/lib/canvas-objects";
import { SHEET_SAFE_MARGIN_IN, sheetInches } from "@/lib/workspace";

export type AutofillDirection = "right" | "left" | "down" | "up";

export const AUTOFILL_DIRECTIONS: Array<{
  id: AutofillDirection;
  label: string;
}> = [
  { id: "right", label: "Right" },
  { id: "left", label: "Left" },
  { id: "down", label: "Down" },
  { id: "up", label: "Up" },
];

/** Which way each direction walks, and which axis its stride is measured on. */
const VECTORS: Record<AutofillDirection, { x: number; y: number }> = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
};

/**
 * A single fill can't be an accident or a stress test. Past this the sheet is
 * better filled by running autofill twice than by one enormous number typed
 * into a field.
 */
export const MAX_AUTOFILL_COPIES = 100;

/** What the panel opens with. */
export const AUTOFILL_DEFAULTS = {
  count: 3,
  direction: "right" as AutofillDirection,
  gapInches: 0.2,
  keepInSafeZone: true,
};

export interface AutofillRequest {
  /** Copies to add — the original is not one of them. */
  count: number;
  direction: AutofillDirection;
  /** Distance between one copy and the next, in inches. */
  gapInches: number;
  /** Stop at the sheet's trim margin rather than at its edge. */
  keepInSafeZone: boolean;
}

export interface AutofillPlan {
  /** Copies that fit — what pressing the button actually creates. */
  fits: number;
  requested: number;
  /** Offset from one copy to the next, in sheet percentages. */
  step: { x: number; y: number };
}

/** Percentages carry rounding error; a copy is not "off the sheet" by 1e-9. */
const TOLERANCE = 1e-6;

/** Clamp a typed number to something the fill can actually use. */
export const clampCopies = (count: number): number =>
  Math.max(0, Math.min(MAX_AUTOFILL_COPIES, Math.floor(count)));

/**
 * Work out how far apart the copies go and how many of them fit.
 *
 * The selection is treated as one block: its bounding box sets the stride, so
 * filling with two pieces selected repeats the pair rather than interleaving
 * them. Copies march in a straight line, so the first one that does not fit
 * ends the run — nothing behind it could fit either.
 *
 * Returns `null` when there is nothing selected to copy.
 */
export function planAutofill(
  selection: CanvasObject[],
  sheetSize: string,
  request: AutofillRequest,
): AutofillPlan | null {
  const box = boundingBox(selection);
  if (!box) return null;

  const sheet = sheetInches(sheetSize);
  const vector = VECTORS[request.direction];
  const requested = clampCopies(request.count);

  /* The span the copies advance by: the block's own size along the axis of
     travel, plus the gap the user asked for between them. */
  const spanInches =
    vector.x !== 0
      ? (box.width / 100) * sheet.width
      : (box.height / 100) * sheet.height;
  const strideInches = spanInches + Math.max(0, request.gapInches);

  const step = {
    x: vector.x * (strideInches / sheet.width) * 100,
    y: vector.y * (strideInches / sheet.height) * 100,
  };

  /* Safe zone off means the sheet's own edge is the limit — a copy hanging
     off the film is never what anyone meant by "duplicate". */
  const marginX = request.keepInSafeZone
    ? (SHEET_SAFE_MARGIN_IN / sheet.width) * 100
    : 0;
  const marginY = request.keepInSafeZone
    ? (SHEET_SAFE_MARGIN_IN / sheet.height) * 100
    : 0;

  let fits = 0;
  for (let copy = 1; copy <= requested; copy += 1) {
    const x = box.x + step.x * copy;
    const y = box.y + step.y * copy;

    const inside =
      x >= marginX - TOLERANCE &&
      y >= marginY - TOLERANCE &&
      x + box.width <= 100 - marginX + TOLERANCE &&
      y + box.height <= 100 - marginY + TOLERANCE;

    if (!inside) break;
    fits += 1;
  }

  return { fits, requested, step };
}
