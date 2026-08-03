/**
 * Artwork placed on the sheet.
 *
 * Geometry is expressed in percentages of the sheet, so a placement holds at
 * any zoom or sheet size. `x`/`y` are the top-left corner rather than the
 * centre, which keeps bounding-box maths over a multi-selection trivial.
 *
 * Objects backed by an uploaded file hold nothing but the asset's `id`. The
 * pixels live once in the image cache and the metadata lives once in the
 * library, so renaming an asset or reading its dimensions has exactly one
 * answer no matter how many times it has been placed.
 */

import { isVectorAsset, type Asset } from "@/lib/assets";
import { PRINT_READY_DPI, PX_PER_INCH } from "@/lib/workspace";

export type CanvasObjectKind = "image" | "text" | "vector" | "group";

/**
 * Where an object came from. Drives the inspector's print-validation and
 * metadata sections, which describe the file rather than the placement.
 */
export interface CanvasObjectSource {
  fileName: string;
  fileType: string;
  /** Effective print resolution, or `null` for resolution-independent art. */
  dpi: number | null;
  transparent: boolean;
  colorMode: "RGB" | "CMYK";
  uploadedAt: string;
  /** Sheets this file appears on. */
  usageCount: number;
}

/** Text styling. Flat rather than nested so a single patch can set any of it. */
export interface CanvasTypography {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  align: "left" | "center" | "right";
}

export interface CanvasObject {
  id: string;
  kind: CanvasObjectKind;
  /** Layer name, shown in menus and used as the accessible label. */
  name: string;
  /**
   * The library asset this object draws, when it draws one.
   *
   * A reference and nothing more: no pixels, no dimensions, no file metadata.
   * Anything the object needs to say about its artwork is looked up from the
   * asset, so the two can never disagree.
   */
  assetId?: string;
  /** Top-left corner, as a percentage of the sheet. */
  x: number;
  y: number;
  /** Size, as a percentage of the sheet. */
  width: number;
  height: number;
  /**
   * Size the object was placed at. The inspector's scale control is relative
   * to this, so "100%" keeps meaning the same thing after any number of
   * resizes. Stamped when artwork is added.
   */
  baseWidth?: number;
  baseHeight?: number;
  /** Clockwise rotation in degrees. */
  rotation: number;
  /** 0–100. Rendered, and edited from the toolbar's opacity control. */
  opacity: number;
  /** Locked objects keep their outline but lose their handles. */
  locked: boolean;
  /**
   * Hidden objects stay in the layer list but leave the sheet. Optional so
   * every object is visible unless something says otherwise.
   */
  hidden?: boolean;
  /**
   * Gradient stops standing in for raster artwork, as hex. Concrete colours
   * rather than Tailwind classes, because Fabric paints them directly.
   */
  fill?: { from: string; to: string };
  /** Copy for text objects. */
  text?: string;
  /** Fill colour — the text colour for text, the accent for vector and group. */
  accent?: string;

  /* ----------------------------- Appearance ---------------------------- */
  blendMode?: string;
  shadow?: boolean;
  strokeWidth?: number;
  strokeColor?: string;
  cornerRadius?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;

  /** Present on text objects. */
  typography?: CanvasTypography;
  /** Present on anything that came from a file. */
  source?: CanvasObjectSource;
}

/**
 * A change to an object.
 *
 * Typography is the one field that patches *into* rather than over: the
 * inspector sends only the property it changed, so the reducer can tell a font
 * change from a size change and history can keep them as separate steps.
 */
export type CanvasObjectPatch = Omit<Partial<CanvasObject>, "typography"> & {
  typography?: Partial<CanvasTypography>;
};

/** Apply a patch, merging typography rather than replacing it wholesale. */
export function applyPatch(
  object: CanvasObject,
  patch: CanvasObjectPatch,
): CanvasObject {
  const merged: CanvasObject = { ...object, ...patch } as CanvasObject;
  if (patch.typography) {
    merged.typography = {
      ...(object.typography ?? DEFAULT_TYPOGRAPHY),
      ...patch.typography,
    };
  }
  return merged;
}

/** Badge wording per object kind. */
export const KIND_LABELS: Record<CanvasObjectKind, string> = {
  image: "Image",
  text: "Text",
  vector: "Vector",
  group: "Group",
};

/**
 * A realistic gang-sheet arrangement: a logo and a die-cut sticker along the
 * top, a headline under them, a vector badge to the side, and a grouped crest
 * filling the lower half. Sizes deliberately differ so the selection overlay
 * gets exercised at several proportions.
 */
export const MOCK_ARTWORK: CanvasObject[] = [
  {
    id: "logo",
    kind: "image",
    name: "Aurora logo",
    x: 7,
    y: 5,
    width: 32,
    height: 11,
    rotation: 0,
    opacity: 100,
    locked: false,
    fill: { from: "#0ea5e9", to: "#1d4ed8" },
    source: {
      fileName: "aurora-logo-mono.svg",
      fileType: "SVG",
      dpi: null,
      transparent: true,
      colorMode: "RGB",
      uploadedAt: "2026-07-30",
      usageCount: 34,
    },
  },
  {
    id: "sticker",
    kind: "image",
    name: "Flame sticker",
    x: 68,
    y: 4,
    width: 22,
    height: 18,
    rotation: -7,
    opacity: 100,
    locked: false,
    fill: { from: "#fb923c", to: "#f43f5e" },
    // Deliberately under 300 DPI, so the inspector's print warning has a
    // real object to fire on.
    source: {
      fileName: "holo-sticker.png",
      fileType: "PNG",
      dpi: 240,
      transparent: true,
      colorMode: "RGB",
      uploadedAt: "2026-07-08",
      usageCount: 15,
    },
  },
  {
    id: "headline",
    kind: "text",
    name: "Tour headline",
    x: 7,
    y: 24,
    width: 54,
    height: 7,
    rotation: 0,
    opacity: 100,
    locked: false,
    text: "SUMMER TOUR",
    accent: "#1f2937",
    typography: {
      // A catalogue id, not a typeface name — anything else silently resolves
      // to the default family.
      fontFamily: "condensed",
      fontWeight: 700,
      fontSize: 48,
      letterSpacing: -1,
      lineHeight: 1.1,
      align: "left",
    },
  },
  {
    id: "badge",
    kind: "vector",
    name: "Star badge",
    x: 67,
    y: 30,
    width: 24,
    height: 19,
    rotation: 8,
    opacity: 100,
    locked: false,
    accent: "#7c3aed",
    source: {
      fileName: "star-burst.eps",
      fileType: "EPS",
      dpi: null,
      transparent: true,
      colorMode: "CMYK",
      uploadedAt: "2026-07-19",
      usageCount: 1,
    },
  },
  {
    id: "crest",
    kind: "group",
    name: "Crest group",
    x: 9,
    y: 41,
    width: 44,
    height: 28,
    rotation: 0,
    opacity: 100,
    locked: false,
    accent: "#0d9488",
  },
];

/* ---------------------------------- Text --------------------------------- */

/** What a new text layer says until the user types over it. */
export const DEFAULT_TEXT = "Double-click to edit";

/** Styling a new text layer starts with, and the inspector falls back to. */
export const DEFAULT_TYPOGRAPHY: CanvasTypography = {
  fontFamily: "sans",
  fontWeight: 700,
  fontSize: 32,
  letterSpacing: 0,
  lineHeight: 1.16,
  align: "left",
};

/** Below this, type is unreadable on the sheet and unselectable on screen. */
export const MIN_FONT_SIZE = 4;

/**
 * Rough width of a string at a given font size, in pixels.
 *
 * Only ever a starting point: the canvas measures the real thing as soon as it
 * renders and corrects the box. This exists so a new layer is created at a
 * plausible size rather than at zero, which would flash on the first frame.
 */
const AVERAGE_GLYPH_RATIO = 0.55;

/**
 * Build a new text layer, centred on the sheet.
 *
 * The box is an estimate — text is sized by its font, and only the renderer
 * can measure the result — so `width`/`height` here are provisional and get
 * replaced the moment the object reaches the canvas.
 */
export function createTextObject(
  sheet: { width: number; height: number },
  id: string,
): CanvasObject {
  const sheetWidth = sheet.width * PX_PER_INCH;
  const sheetHeight = sheet.height * PX_PER_INCH;

  const longestLine = Math.max(
    ...DEFAULT_TEXT.split("\n").map((line) => line.length),
  );
  const estimatedWidth =
    longestLine * DEFAULT_TYPOGRAPHY.fontSize * AVERAGE_GLYPH_RATIO;
  const estimatedHeight =
    DEFAULT_TYPOGRAPHY.fontSize * DEFAULT_TYPOGRAPHY.lineHeight;

  const width = Math.min(100, (estimatedWidth / sheetWidth) * 100);
  const height = Math.min(100, (estimatedHeight / sheetHeight) * 100);

  return {
    id,
    kind: "text",
    name: DEFAULT_TEXT,
    text: DEFAULT_TEXT,
    x: 50 - width / 2,
    y: 50 - height / 2,
    width,
    height,
    baseWidth: width,
    baseHeight: height,
    rotation: 0,
    opacity: 100,
    locked: false,
    accent: "#1f2937",
    typography: { ...DEFAULT_TYPOGRAPHY },
  };
}

/**
 * What the layer list calls an object.
 *
 * A text layer is named by its own first line rather than by a stored label,
 * so the two can never drift apart — there is one piece of state, and the
 * layer list is a view of it.
 */
export function layerLabel(object: CanvasObject): string {
  if (object.kind !== "text") return object.name;
  const firstLine = (object.text ?? "").split("\n", 1)[0].trim();
  return firstLine || "Empty text";
}

/**
 * Apply a renamed first line back to the text, keeping the rest.
 *
 * Renaming a layer edits the line the name came from; lines below it are not
 * the layer's name and have no business being replaced by it.
 */
export function renameFirstLine(text: string, firstLine: string): string {
  const lines = text.split("\n");
  lines[0] = firstLine;
  return lines.join("\n");
}

/* ------------------------------- Placement ------------------------------- */

/** Largest share of the sheet a freshly placed asset is allowed to cover. */
const MAX_PLACEMENT_COVERAGE = 0.6;

/** Where on the sheet a placement is centred, in percentages. */
export interface PlacementPoint {
  x: number;
  y: number;
}

/** Keep a placement's box inside the sheet, given its size. */
const clampCentre = (centre: number, size: number) =>
  Math.min(Math.max(centre, size / 2), 100 - size / 2);

/**
 * Build the object for an asset being placed on the sheet.
 *
 * Sized so the artwork lands print-ready: a raster file starts at the largest
 * size that still holds {@link PRINT_READY_DPI}, which is the size its author
 * intended it to print at. Anything that would then dominate the sheet is
 * scaled down to fit, because a placement the user immediately has to shrink
 * is worse than one that is slightly conservative.
 *
 * Pure and deterministic — `sequence` supplies the identity the reducer would
 * otherwise need a random source for.
 */
export function createPlacedAsset(
  asset: Asset,
  sheet: { width: number; height: number },
  sequence: number,
  at?: PlacementPoint,
): CanvasObject {
  const naturalWidth = asset.width / PRINT_READY_DPI;
  const naturalHeight = asset.height / PRINT_READY_DPI;

  const fit = Math.min(
    1,
    (sheet.width * MAX_PLACEMENT_COVERAGE) / naturalWidth,
    (sheet.height * MAX_PLACEMENT_COVERAGE) / naturalHeight,
  );

  const width = ((naturalWidth * fit) / sheet.width) * 100;
  const height = ((naturalHeight * fit) / sheet.height) * 100;

  return {
    id: `asset-${asset.id}-${sequence}`,
    // Vector art keeps its own badge in the layer list and the inspector; both
    // panels treat the two the same otherwise, as does the renderer.
    kind: isVectorAsset(asset) ? "vector" : "image",
    name: asset.name,
    assetId: asset.id,
    x: clampCentre(at?.x ?? 50, width) - width / 2,
    y: clampCentre(at?.y ?? 50, height) - height / 2,
    width,
    height,
    // The size the inspector's scale control measures its 100% against.
    baseWidth: width,
    baseHeight: height,
    rotation: 0,
    opacity: 100,
    locked: false,
  };
}

export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Axis-aligned box enclosing every object passed in.
 *
 * Rotation is ignored: a rotated object contributes its unrotated box. Real
 * editors do the same for multi-selections, and it keeps the overlay's maths
 * independent of how the canvas ends up transforming things.
 */
export function boundingBox(objects: CanvasObject[]): SelectionBox | null {
  if (objects.length === 0) return null;

  const left = Math.min(...objects.map((object) => object.x));
  const top = Math.min(...objects.map((object) => object.y));
  const right = Math.max(...objects.map((object) => object.x + object.width));
  const bottom = Math.max(...objects.map((object) => object.y + object.height));

  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Objects grouped by kind, e.g. `[{ kind: "image", count: 3 }, …]`, ordered
 * biggest group first. Feeds the inspector's selection summary.
 */
export function summariseSelection(
  objects: CanvasObject[],
): Array<{ kind: CanvasObjectKind; count: number }> {
  const counts = new Map<CanvasObjectKind, number>();
  for (const object of objects) {
    counts.set(object.kind, (counts.get(object.kind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);
}

/** Label for the selection badge — the kind when one object, a count when more. */
export function selectionLabel(objects: CanvasObject[]): string {
  if (objects.length === 1) return KIND_LABELS[objects[0].kind];
  return `${objects.length} Selected`;
}
