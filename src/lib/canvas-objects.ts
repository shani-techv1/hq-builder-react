/**
 * Mock artwork placed on the sheet.
 *
 * Geometry is expressed in percentages of the sheet, so a placement holds at
 * any zoom or sheet size. `x`/`y` are the top-left corner rather than the
 * centre, which keeps bounding-box maths over a multi-selection trivial.
 *
 * This is the shape the real canvas will hand the interaction layer once
 * Fabric is wired up — nothing here assumes how objects get rendered.
 */

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
      fontFamily: "Inter",
      fontWeight: 800,
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
