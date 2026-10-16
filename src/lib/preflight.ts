/**
 * Print checks run against the whole sheet.
 *
 * Two things go wrong on a gang sheet that nothing else in the editor would
 * catch: artwork placed larger than its own pixels can carry, and artwork
 * sitting on top of other artwork. Both are warnings rather than blocks — a
 * slightly soft print is sometimes acceptable, and an overlap is sometimes the
 * design — so this reports what it finds and leaves the decision alone.
 *
 * Pure, and the only place either check is defined: the rail badge, the Checks
 * panel, the layer list and the save warning all read one report, so no two
 * surfaces can disagree about whether a sheet is ready.
 */

import { isVectorAsset, type Asset } from "@/lib/assets";
import {
  layerLabel,
  outlineInches,
  type CanvasObject,
  type SheetPoint,
} from "@/lib/canvas-objects";
import { PRINT_READY_DPI, effectiveDpi, sheetInches } from "@/lib/workspace";

/* ------------------------------- Resolution ------------------------------ */

export interface SheetInches {
  width: number;
  height: number;
}

/** What a placement measures on the sheet, in inches. */
export function renderedInches(
  object: CanvasObject,
  sheet: SheetInches,
): SheetInches {
  return {
    width: (object.width / 100) * sheet.width,
    height: (object.height / 100) * sheet.height,
  };
}

export interface PlacementResolution {
  /** Effective print resolution, or `null` for resolution-independent art. */
  dpi: number | null;
  /** Vector artwork, which scales to any size without losing detail. */
  isVector: boolean;
  isPrintReady: boolean;
}

/**
 * What a placement actually prints at, right now.
 *
 * Uploaded artwork carries no stored resolution — the same file is 600 DPI
 * across two inches and 120 across ten — so the figure comes from the file's
 * pixels divided by the size it is currently placed at. Objects with no asset
 * behind them fall back to whatever their mock source declared.
 */
export function placementResolution(
  object: CanvasObject,
  asset: Asset | undefined,
  sheet: SheetInches,
): PlacementResolution {
  const isVector = asset ? isVectorAsset(asset) : !object.source?.dpi;
  const dpi = asset
    ? isVector
      ? null
      : effectiveDpi(asset.width, renderedInches(object, sheet).width)
    : (object.source?.dpi ?? null);

  return { dpi, isVector, isPrintReady: dpi === null || dpi >= PRINT_READY_DPI };
}

/* -------------------------------- Overlap -------------------------------- */

/**
 * Two pieces that merely touch, or that share a hairline where one was snapped
 * against the other, are not what this check is for. An overlap has to cover
 * this much of the smaller piece, and this much of the sheet, to be worth
 * saying anything about.
 */
const MIN_OVERLAP_RATIO = 0.02;
const MIN_OVERLAP_AREA_SQ_IN = 0.01;

/**
 * What a placement covers on the sheet, in inches: its outline as drawn, plus
 * that outline's axis-aligned bounds for a cheap first test.
 *
 * The outline, not the stored box, because the stored box is unrotated. A
 * wide piece turned 90° covers a tall strip of the sheet, and measured by its
 * stored box it was reported overlapping the empty space beside it while
 * artwork laid above or below it, on top of it visibly, went unremarked.
 */
interface Footprint {
  corners: SheetPoint[];
  left: number;
  top: number;
  right: number;
  bottom: number;
  area: number;
}

function footprintOf(object: CanvasObject, sheet: SheetInches): Footprint {
  const corners = outlineInches(object, sheet);
  const { width, height } = renderedInches(object, sheet);
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);

  return {
    corners,
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
    area: width * height,
  };
}

/** Twice the signed area of a polygon — its sign is its winding. */
function doubledSignedArea(points: SheetPoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

/** Which side of the line through `a` and `b` a point is on, by sign. */
const side = (a: SheetPoint, b: SheetPoint, p: SheetPoint) =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

/** Where segment `p`–`q` crosses the line through `a` and `b`. */
function crossing(
  p: SheetPoint,
  q: SheetPoint,
  a: SheetPoint,
  b: SheetPoint,
): SheetPoint {
  const sp = side(a, b, p);
  const t = sp / (sp - side(a, b, q));
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
}

/**
 * The part of `subject` inside `clip`, both convex — every outline is a
 * rectangle, turned or not. Sutherland–Hodgman: cut the subject down by each
 * of the clip's edges in turn.
 */
function clipConvex(subject: SheetPoint[], clip: SheetPoint[]): SheetPoint[] {
  const winding = Math.sign(doubledSignedArea(clip));
  let result = subject;

  for (let i = 0; i < clip.length && result.length > 0; i += 1) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const inside = (p: SheetPoint) => winding * side(a, b, p) >= 0;

    const input = result;
    result = [];
    for (let j = 0; j < input.length; j += 1) {
      const current = input[j];
      const previous = input[(j + input.length - 1) % input.length];
      if (inside(current)) {
        if (!inside(previous)) result.push(crossing(previous, current, a, b));
        result.push(current);
      } else if (inside(previous)) {
        result.push(crossing(previous, current, a, b));
      }
    }
  }

  return result;
}

/** Area the two outlines share, in square inches. */
function intersectionArea(a: Footprint, b: Footprint): number {
  if (a.area <= 0 || b.area <= 0) return 0;
  // Bounds that don't meet can't share anything — most pairs on a sheet end
  // here, which keeps the exact test below off the quadratic path.
  if (
    a.right <= b.left ||
    b.right <= a.left ||
    a.bottom <= b.top ||
    b.bottom <= a.top
  ) {
    return 0;
  }
  return Math.abs(doubledSignedArea(clipConvex(a.corners, b.corners))) / 2;
}

/* -------------------------------- Report --------------------------------- */

export type PreflightIssueKind = "resolution" | "overlap";

export interface PreflightIssue {
  id: string;
  kind: PreflightIssueKind;
  /** The objects it is about: one for resolution, both for an overlap. */
  objectIds: string[];
  /** One line naming the problem, in the user's own layer names. */
  title: string;
  /** What it means and what to do about it. */
  detail: string;
}

export interface PreflightReport {
  /**
   * The warnings worth listing, resolution first.
   *
   * Capped per kind — see {@link MAX_LISTED_PER_KIND}. `counts` is what was
   * actually found, so nothing is quietly dropped: the panel says how many it
   * left out, and the rail badge still counts them.
   */
  issues: PreflightIssue[];
  /** Everything found, listed or not. */
  counts: Record<PreflightIssueKind, number>;
  total: number;
  /** Objects carrying at least one warning, for the layer list's marker. */
  flagged: Set<string>;
}

/**
 * How many warnings of one kind are worth writing out.
 *
 * Overlaps are counted pairwise, so a stack of twenty duplicates is nearly two
 * hundred of them. Past a certain point the list stops being something anyone
 * works through one row at a time, and building it costs more than reading it
 * would be worth — the count still tells the honest story.
 */
const MAX_LISTED_PER_KIND = 50;

const EMPTY_REPORT: PreflightReport = {
  issues: [],
  counts: { resolution: 0, overlap: 0 },
  total: 0,
  flagged: new Set(),
};

/**
 * Check every printed object on the sheet.
 *
 * Hidden layers are skipped throughout — they leave the sheet, so neither their
 * resolution nor what they sit on top of has any bearing on the print.
 *
 * Overlaps are compared pair by pair, on each piece's outline as drawn.
 * Quadratic, but most pairs are ruled out by four comparisons of their bounds,
 * the exact shapes are only intersected where those meet, and only the first
 * {@link MAX_LISTED_PER_KIND} of a kind are written up.
 * The result is memoised against the document, so it is recomputed only when
 * the design itself changes.
 */
export function runPreflight(
  objects: CanvasObject[],
  sheetSize: string,
  assets: Asset[],
): PreflightReport {
  const printed = objects.filter((object) => !object.hidden);
  if (printed.length === 0) return EMPTY_REPORT;

  const sheet = sheetInches(sheetSize);
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const issues: PreflightIssue[] = [];
  const counts: Record<PreflightIssueKind, number> = {
    resolution: 0,
    overlap: 0,
  };
  const flagged = new Set<string>();

  for (const object of printed) {
    const asset = object.assetId ? byId.get(object.assetId) : undefined;
    const { dpi, isPrintReady } = placementResolution(object, asset, sheet);
    if (isPrintReady || dpi === null) continue;

    counts.resolution += 1;
    flagged.add(object.id);
    if (counts.resolution > MAX_LISTED_PER_KIND) continue;

    issues.push({
      id: `resolution:${object.id}`,
      kind: "resolution",
      objectIds: [object.id],
      title: layerLabel(object),
      detail:
        `Prints at ${dpi} DPI at this size, under the ${PRINT_READY_DPI} DPI ` +
        "needed. Scale it down, or replace it with a higher-resolution file.",
    });
  }

  const footprints = printed.map((object) => footprintOf(object, sheet));

  for (let lower = 0; lower < printed.length; lower += 1) {
    for (let upper = lower + 1; upper < printed.length; upper += 1) {
      const area = intersectionArea(footprints[lower], footprints[upper]);
      if (area < MIN_OVERLAP_AREA_SQ_IN) continue;

      // Measured against the smaller piece, because that is the one being
      // covered — half of a small sticker is lost under a logo that barely
      // notices it.
      const smallest = Math.min(footprints[lower].area, footprints[upper].area);
      if (smallest <= 0) continue;
      const ratio = area / smallest;
      if (ratio < MIN_OVERLAP_RATIO) continue;

      // Later in the array paints on top, so `upper` is the piece on top —
      // which the title says, and which is not necessarily the bigger one.
      const top = printed[upper];
      const bottom = printed[lower];
      const smaller =
        footprints[lower].area <= footprints[upper].area ? bottom : top;

      counts.overlap += 1;
      flagged.add(bottom.id);
      flagged.add(top.id);
      if (counts.overlap > MAX_LISTED_PER_KIND) continue;

      issues.push({
        id: `overlap:${bottom.id}:${top.id}`,
        kind: "overlap",
        objectIds: [bottom.id, top.id],
        title: `${layerLabel(top)} overlaps ${layerLabel(bottom)}`,
        detail:
          `The overlap covers ${Math.round(ratio * 100)}% of ` +
          `“${layerLabel(smaller)}”. Fine when it is deliberate — otherwise ` +
          "move them apart before printing.",
      });
    }
  }

  return {
    issues,
    counts,
    total: counts.resolution + counts.overlap,
    flagged,
  };
}

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * One line for a toast or a heading — "2 overlaps · 1 below 300 DPI" — or
 * `null` when the sheet is clean, so callers can treat "nothing to say" as
 * nothing to render.
 */
export function summarisePreflight(report: PreflightReport): string | null {
  const { resolution, overlap } = report.counts;

  const parts: string[] = [];
  if (overlap > 0) parts.push(plural(overlap, "overlap"));
  if (resolution > 0) {
    parts.push(`${plural(resolution, "layer")} below ${PRINT_READY_DPI} DPI`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
