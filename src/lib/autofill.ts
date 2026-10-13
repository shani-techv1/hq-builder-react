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

import {
  boundingBox,
  type CanvasObject,
  type SelectionBox,
} from "@/lib/canvas-objects";
import { SHEET_SAFE_MARGIN_IN, sheetInches } from "@/lib/workspace";

/**
 * How a fill travels. Four of these walk a line from the selection; `free`
 * does not walk at all, and drops copies wherever the sheet has room.
 */
export type AutofillDirection = "right" | "left" | "down" | "up" | "free";

/** The directions that walk. Everything vector-shaped is keyed by these. */
type LinearDirection = Exclude<AutofillDirection, "free">;

export const AUTOFILL_DIRECTIONS: Array<{
  id: AutofillDirection;
  label: string;
}> = [
  { id: "right", label: "Right" },
  { id: "left", label: "Left" },
  { id: "down", label: "Down" },
  { id: "up", label: "Up" },
  { id: "free", label: "Into free spaces" },
];

/** Which way each direction walks, and which axis its stride is measured on. */
const VECTORS: Record<LinearDirection, { x: number; y: number }> = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
};

/**
 * Where a run continues once it reaches the end of a line.
 *
 * A sheet is filled, not scored through: a column that reaches the bottom
 * carries on at the top of the next one, the way text wraps. Always the
 * positive direction, because artwork is placed from the top-left and a run
 * that wrapped backwards would march off the side it started from.
 */
const WRAP_VECTORS: Record<LinearDirection, { x: number; y: number }> = {
  right: { x: 0, y: 1 },
  left: { x: 0, y: 1 },
  down: { x: 1, y: 0 },
  up: { x: 1, y: 0 },
};

/**
 * A ceiling on the spots a fill will look at.
 *
 * A fill maps every spot on the sheet a copy could go, because how many fit is
 * the most the count may ask for. Artwork of any printable size comes to a few
 * hundred spots; this only bites on very small artwork on a long sheet. Without
 * it, artwork a thousandth of an inch across would have the editor counting
 * cells for a visible pause.
 */
const MAX_SCANNED_CELLS = 20000;

/**
 * What the panel opens with.
 *
 * Into free spaces, because a gang sheet is priced by the sheet and the point
 * of one is to leave as little film unused as possible. A line fill is the
 * specific request — this is the one people mean.
 */
export const AUTOFILL_DEFAULTS = {
  count: 3,
  direction: "free" as AutofillDirection,
  gapInches: 0.2,
  keepInSafeZone: true,
};

/** How a fill is laid out — everything about it except how many copies. */
export interface AutofillOptions {
  direction: AutofillDirection;
  /** Distance between one copy and the next, in inches. */
  gapInches: number;
  /** Stop at the sheet's trim margin rather than at its edge. */
  keepInSafeZone: boolean;
}

/** One place a copy fits, as an offset from the selection in sheet percentages. */
interface AutofillSpot {
  x: number;
  y: number;
  /**
   * The row or column it lands on, numbered from 0 in fill order. A line fill
   * counts the selection's own line as 0; a free-space fill counts only the
   * rows that took a copy.
   */
  line: number;
}

/**
 * Every place on the sheet a copy of the selection fits, in the order a fill
 * takes them. How many there are is the most a single fill can make.
 */
export interface AutofillLayout {
  spots: AutofillSpot[];
}

export interface AutofillPlan {
  /** Copies that fit — what pressing the button actually creates. */
  fits: number;
  requested: number;
  /**
   * Where each copy goes, as an offset from the selection in sheet
   * percentages. A list rather than a single step, because a run that wraps
   * is no longer an even march in one direction.
   */
  offsets: Array<{ x: number; y: number }>;
  /** Rows or columns the copies land on, the selection's own included. */
  lines: number;
}

/** Percentages carry rounding error; a copy is not "off the sheet" by 1e-9. */
const TOLERANCE = 1e-6;

/**
 * Work out every place a copy of the selection fits.
 *
 * The selection is treated as one block: its bounding box sets the stride, so
 * filling with two pieces selected repeats the pair rather than interleaving
 * them.
 *
 * A run that reaches the end of its line wraps onto the next one — down
 * continues in the column to the right, right continues in the row below — so
 * "fill the sheet" fills the sheet rather than stopping at the first edge it
 * meets with three quarters of the film still empty. Each new line starts
 * level with the selection, which makes the result a grid aligned to the
 * original rather than a staircase. The run ends when a fresh line has no room
 * either, because nothing after that could fit.
 *
 * `free` ignores all of that and packs instead — see {@link packFreeSpace}.
 *
 * `occupied` is everything already on the sheet, which only the free-space
 * fill reads. A line fill deliberately does not: marching copies through
 * artwork that is in the way is how you fill a row, and stopping short of it
 * would make the count depend on what happened to be underneath.
 *
 * The count is left out on purpose: a fill of N copies is the first N spots,
 * so this is worked out once per change to the sheet or the settings and
 * {@link planAutofill} picks from it as the count is typed.
 *
 * Returns `null` when there is nothing selected to copy.
 */
export function layoutAutofill(
  selection: CanvasObject[],
  sheetSize: string,
  options: AutofillOptions,
  occupied: CanvasObject[],
): AutofillLayout | null {
  const box = boundingBox(selection);
  if (!box) return null;

  const sheet = sheetInches(sheetSize);
  const gapInches = Math.max(0, options.gapInches);

  /* The gap as a share of each axis. A sheet is not square, so one distance
     in inches is two different percentages. */
  const gapX = (gapInches / sheet.width) * 100;
  const gapY = (gapInches / sheet.height) * 100;

  /* How far apart two copies sit, centre to centre: the block's own size on
     that axis plus the gap between them. */
  const strideX = box.width + gapX;
  const strideY = box.height + gapY;

  /* Safe zone off means the sheet's own edge is the limit — a copy hanging
     off the film is never what anyone meant by "duplicate". */
  const marginX = options.keepInSafeZone
    ? (SHEET_SAFE_MARGIN_IN / sheet.width) * 100
    : 0;
  const marginY = options.keepInSafeZone
    ? (SHEET_SAFE_MARGIN_IN / sheet.height) * 100
    : 0;

  // Artwork with no size has no stride to step by; without this every copy
  // lands on the same spot and the walk never reaches an edge.
  if (strideX <= TOLERANCE || strideY <= TOLERANCE) return { spots: [] };

  if (options.direction === "free") {
    return packFreeSpace({
      box,
      strideX,
      strideY,
      gapX,
      gapY,
      marginX,
      marginY,
      occupied,
    });
  }

  const vector = VECTORS[options.direction];
  const wrapVector = WRAP_VECTORS[options.direction];
  const step = { x: vector.x * strideX, y: vector.y * strideY };
  const wrapStep = { x: wrapVector.x * strideX, y: wrapVector.y * strideY };

  /**
   * Whether a copy at this offset has somewhere to be.
   *
   * An axis the copy has not moved on is not tested: it covers exactly the
   * span the selection already covers there, so it is no further out than the
   * artwork the user is copying. Without that, artwork nudged into the trim
   * margin could not be filled in *any* direction, however empty the sheet.
   */
  const hasRoom = (offset: { x: number; y: number }) => {
    const x = box.x + offset.x;
    const y = box.y + offset.y;

    const roomX =
      offset.x === 0 ||
      (x >= marginX - TOLERANCE && x + box.width <= 100 - marginX + TOLERANCE);
    const roomY =
      offset.y === 0 ||
      (y >= marginY - TOLERANCE && y + box.height <= 100 - marginY + TOLERANCE);

    return roomX && roomY;
  };

  const spots: AutofillSpot[] = [];
  /* Line 0 slot 0 is the selection itself, so the first copy is slot 1. */
  let line = 0;
  let slot = 1;

  for (let scanned = 0; scanned < MAX_SCANNED_CELLS; scanned += 1) {
    const offset = {
      x: step.x * slot + wrapStep.x * line,
      y: step.y * slot + wrapStep.y * line,
    };

    if (hasRoom(offset)) {
      spots.push({ ...offset, line });
      slot += 1;
      continue;
    }

    // A fresh line with no room for even its first copy is the end of the
    // sheet, not the end of a line.
    if (slot === 0) break;

    line += 1;
    slot = 0;
  }

  return { spots };
}

/**
 * The first `count` copies of a layout — what pressing the button creates.
 *
 * Fewer when the sheet has less room than was asked for; `fits` says how many.
 */
export function planAutofill(
  layout: AutofillLayout,
  count: number,
): AutofillPlan {
  const requested = Math.max(0, Math.floor(count));
  const spots = layout.spots.slice(0, requested);
  const last = spots[spots.length - 1];

  return {
    fits: spots.length,
    requested,
    offsets: spots.map(({ x, y }) => ({ x, y })),
    lines: last ? last.line + 1 : 1,
  };
}

interface FreeSpaceRequest {
  box: SelectionBox;
  strideX: number;
  strideY: number;
  gapX: number;
  gapY: number;
  marginX: number;
  marginY: number;
  occupied: CanvasObject[];
}

/**
 * Drop copies wherever the sheet still has room for one.
 *
 * A line fill answers "put more of this over there". This answers the
 * question a gang sheet is actually about: the film is paid for by the sheet,
 * so what matters is how little of it goes to waste. Copies go into the gaps
 * between what is already placed, not just off the end of a row.
 *
 * Candidate spots are the lattice the selection itself sits on, extended both
 * ways across the sheet, so copies line up with the artwork they are copies of
 * instead of landing at a half-offset beside it. Each is taken only if it is
 * inside the boundary and clear of everything already on the sheet — the
 * selection included, which is what stops the first copy landing on top of the
 * original. Reading order, so a fill looks deliberate rather than scattered.
 */
function packFreeSpace({
  box,
  strideX,
  strideY,
  gapX,
  gapY,
  marginX,
  marginY,
  occupied,
}: FreeSpaceRequest): AutofillLayout {
  /* Hidden artwork is not on the sheet — it is in the layer list. Filling
     around something the printer will never see would leave a hole in the
     middle of the sheet for no reason. */
  const blockers = occupied.filter((object) => !object.hidden);

  /* How many strides from the selection to each edge, on each axis. */
  const firstIndex = (start: number, stride: number, margin: number) =>
    Math.ceil((margin - start) / stride - TOLERANCE);
  const lastIndex = (
    start: number,
    size: number,
    stride: number,
    margin: number,
  ) => Math.floor((100 - margin - size - start) / stride + TOLERANCE);

  const columnFrom = firstIndex(box.x, strideX, marginX);
  const columnTo = lastIndex(box.x, box.width, strideX, marginX);
  const rowFrom = firstIndex(box.y, strideY, marginY);
  const rowTo = lastIndex(box.y, box.height, strideY, marginY);

  /**
   * Whether a copy here would touch anything already placed.
   *
   * The candidate is grown by the gap on every side before the test, so a
   * copy keeps its distance from *all* artwork rather than only from the
   * copies beside it in its own row. Two spots exactly one stride apart come
   * out touching, not overlapping, which is the whole point of the lattice.
   */
  const isClear = (x: number, y: number) => {
    const left = x - gapX;
    const right = x + box.width + gapX;
    const top = y - gapY;
    const bottom = y + box.height + gapY;

    return !blockers.some(
      (object) =>
        left < object.x + object.width - TOLERANCE &&
        object.x < right - TOLERANCE &&
        top < object.y + object.height - TOLERANCE &&
        object.y < bottom - TOLERANCE,
    );
  };

  const spots: AutofillSpot[] = [];
  /* Lines are the rows that took a copy, not the rows scanned: a row the fill
     found full is not one it covers. */
  let line = 0;
  let scanned = 0;

  for (let row = rowFrom; row <= rowTo; row += 1) {
    const before = spots.length;

    for (let column = columnFrom; column <= columnTo; column += 1) {
      if (scanned >= MAX_SCANNED_CELLS) return { spots };
      scanned += 1;

      const offset = { x: strideX * column, y: strideY * row };
      if (!isClear(box.x + offset.x, box.y + offset.y)) continue;

      spots.push({ ...offset, line });
    }

    if (spots.length > before) line += 1;
  }

  return { spots };
}
