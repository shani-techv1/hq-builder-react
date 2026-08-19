/**
 * A design, in a form that survives the tab being closed.
 *
 * Two things have to travel: the document — objects, sheet, the counters that
 * keep ids unique — and the artwork itself. The second is the reason this file
 * is not a `JSON.stringify` call. An uploaded image lives behind an object URL,
 * and object URLs die with the page, so the bytes have to be carried too or a
 * restored design comes back as a sheet full of blank rectangles.
 *
 * Everything read back in is treated as untrusted. A draft can be corrupt, a
 * schema can be a version behind, and an imported file is whatever the user
 * picked — so {@link deserializeDocument} rebuilds each object field by field
 * rather than casting, and returns `null` for anything it cannot vouch for.
 */

import type { Asset, AssetFormat } from "@/lib/assets";
import {
  DEFAULT_TYPOGRAPHY,
  type CanvasAdjustments,
  type CanvasObject,
  type CanvasObjectKind,
  type CanvasTypography,
} from "@/lib/canvas-objects";
import { DEFAULT_SHEET_SIZE } from "@/lib/workspace";

/** Bumped whenever the shape below changes incompatibly. */
export const DESIGN_SCHEMA_VERSION = 1;

/** The parts of the editor's document worth keeping. */
export interface DesignDocument {
  objects: CanvasObject[];
  sheetSize: string;
  /** Carried so restored ids can't collide with newly created ones. */
  copyCount: number;
  placeCount: number;
}

/**
 * An asset's metadata plus its bytes.
 *
 * `file` is a `Blob` in IndexedDB, which stores one natively, and a data URL in
 * exported JSON, which cannot. Both are accepted on the way back in.
 */
export interface SerializedAsset {
  id: string;
  name: string;
  format: AssetFormat;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  uploadedAt: string;
  favorite: boolean;
  usageCount: number;
  transparent: boolean;
  thumbnail: string;
  file: Blob | string;
}

export interface SerializedDesign {
  version: number;
  /** ISO timestamp, shown to the user when a draft is offered back. */
  savedAt: string;
  name: string;
  document: DesignDocument;
  assets: SerializedAsset[];
}

/** An asset on its way back in, before it has a URL to be drawn from. */
export type RestoredAsset = Omit<Asset, "source"> & { file: Blob };

export interface RestoredDesign {
  savedAt: string;
  name: string;
  document: DesignDocument;
  assets: RestoredAsset[];
}

export interface SerializeInput {
  name: string;
  document: DesignDocument;
  assets: Asset[];
  /** The bytes behind each asset, keyed by asset id. */
  files: Map<string, Blob>;
  /** Injected rather than read from the clock, so callers stay testable. */
  savedAt: string;
}

/**
 * Build the portable record for a design.
 *
 * Assets whose bytes are missing are dropped rather than written out half
 * complete — a record claiming an asset it cannot draw would restore into a
 * sheet of blanks, which is worse than restoring without it.
 */
export function serializeDocument(input: SerializeInput): SerializedDesign {
  const assets: SerializedAsset[] = [];

  for (const asset of input.assets) {
    const file = input.files.get(asset.id);
    if (!file) continue;
    assets.push({
      id: asset.id,
      name: asset.name,
      format: asset.format,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      sizeBytes: asset.sizeBytes,
      uploadedAt: asset.uploadedAt,
      favorite: asset.favorite,
      usageCount: asset.usageCount,
      transparent: asset.transparent,
      thumbnail: asset.thumbnail,
      file,
    });
  }

  return {
    version: DESIGN_SCHEMA_VERSION,
    savedAt: input.savedAt,
    name: input.name,
    document: {
      objects: input.document.objects,
      sheetSize: input.document.sheetSize,
      copyCount: input.document.copyCount,
      placeCount: input.document.placeCount,
    },
    assets,
  };
}

/* ------------------------------ Field readers ---------------------------- */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A finite number, or the fallback. Rejects `NaN`, which JSON can produce. */
function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optNum(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

const str = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

const optStr = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const optBool = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const KINDS: CanvasObjectKind[] = ["image", "text", "vector", "group"];
const FORMATS: AssetFormat[] = ["PNG", "JPG", "SVG"];

const oneOf = <T extends string>(value: unknown, allowed: T[]): T | null =>
  typeof value === "string" && (allowed as string[]).includes(value)
    ? (value as T)
    : null;

function readTypography(value: unknown): CanvasTypography | undefined {
  if (!isRecord(value)) return undefined;
  const align = oneOf(value.align, ["left", "center", "right"] as const);
  return {
    fontFamily: str(value.fontFamily, DEFAULT_TYPOGRAPHY.fontFamily),
    fontWeight: num(value.fontWeight, DEFAULT_TYPOGRAPHY.fontWeight),
    fontSize: num(value.fontSize, DEFAULT_TYPOGRAPHY.fontSize),
    letterSpacing: num(value.letterSpacing, DEFAULT_TYPOGRAPHY.letterSpacing),
    lineHeight: num(value.lineHeight, DEFAULT_TYPOGRAPHY.lineHeight),
    align: align ?? DEFAULT_TYPOGRAPHY.align,
  };
}

/** Clamped on the way in: a file could carry anything, and these drive filters. */
function readAdjustments(value: unknown): CanvasAdjustments | undefined {
  if (!isRecord(value)) return undefined;
  const level = (input: unknown) => Math.max(-100, Math.min(100, num(input, 0)));
  return {
    brightness: level(value.brightness),
    contrast: level(value.contrast),
    saturation: level(value.saturation),
  };
}

function readFill(value: unknown): CanvasObject["fill"] {
  if (!isRecord(value)) return undefined;
  const from = optStr(value.from);
  const to = optStr(value.to);
  return from && to ? { from, to } : undefined;
}

function readSource(value: unknown): CanvasObject["source"] {
  if (!isRecord(value)) return undefined;
  const colorMode = oneOf(value.colorMode, ["RGB", "CMYK"] as const);
  return {
    fileName: str(value.fileName, "Untitled"),
    fileType: str(value.fileType, ""),
    dpi: optNum(value.dpi) ?? null,
    transparent: bool(value.transparent, false),
    colorMode: colorMode ?? "RGB",
    uploadedAt: str(value.uploadedAt, ""),
    usageCount: num(value.usageCount, 0),
  };
}

/**
 * Rebuild one object, or `null` if it has no usable identity.
 *
 * Explicit field by field, never a cast: a draft is read back from storage the
 * user's other tabs can write to, and an import is a file off their disk.
 * Copying an unknown object wholesale would let either put arbitrary
 * properties onto something the renderer then hands to Fabric.
 */
function readObject(value: unknown): CanvasObject | null {
  if (!isRecord(value)) return null;

  const id = optStr(value.id);
  const kind = oneOf(value.kind, KINDS);
  if (!id || !kind) return null;

  return {
    id,
    kind,
    name: str(value.name, "Untitled"),
    assetId: optStr(value.assetId),
    x: num(value.x, 0),
    y: num(value.y, 0),
    // A zero-sized object cannot be seen or grabbed, so it would be a layer
    // the user can only delete from the list.
    width: Math.max(0.01, num(value.width, 10)),
    height: Math.max(0.01, num(value.height, 10)),
    baseWidth: optNum(value.baseWidth),
    baseHeight: optNum(value.baseHeight),
    rotation: num(value.rotation, 0),
    opacity: Math.min(100, Math.max(0, num(value.opacity, 100))),
    locked: bool(value.locked, false),
    hidden: optBool(value.hidden),
    fill: readFill(value.fill),
    text: optStr(value.text),
    accent: optStr(value.accent),
    blendMode: optStr(value.blendMode),
    shadow: optBool(value.shadow),
    strokeWidth: optNum(value.strokeWidth),
    strokeColor: optStr(value.strokeColor),
    cornerRadius: optNum(value.cornerRadius),
    flipHorizontal: optBool(value.flipHorizontal),
    flipVertical: optBool(value.flipVertical),
    filter: optStr(value.filter),
    adjustments: readAdjustments(value.adjustments),
    typography: readTypography(value.typography),
    source: readSource(value.source),
  };
}

/** Decode a data URL into a Blob, for assets arriving from exported JSON. */
function blobFromDataUrl(dataUrl: string, mimeType: string): Blob | null {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) return null;

  const meta = dataUrl.slice(5, comma);
  const body = dataUrl.slice(comma + 1);
  const type = meta.split(";")[0] || mimeType;

  try {
    if (!meta.includes("base64")) {
      return new Blob([decodeURIComponent(body)], { type });
    }
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type });
  } catch {
    // Truncated or otherwise malformed base64.
    return null;
  }
}

function readAsset(value: unknown): RestoredAsset | null {
  if (!isRecord(value)) return null;

  const id = optStr(value.id);
  const format = oneOf(value.format, FORMATS);
  if (!id || !format) return null;

  const mimeType = str(value.mimeType, "application/octet-stream");

  const raw = value.file;
  const file =
    raw instanceof Blob
      ? raw
      : typeof raw === "string"
        ? blobFromDataUrl(raw, mimeType)
        : null;
  // Without the bytes there is nothing to draw, and a metadata-only asset
  // would sit in the library looking usable.
  if (!file) return null;

  return {
    id,
    name: str(value.name, "Untitled"),
    format,
    mimeType,
    width: Math.max(1, Math.round(num(value.width, 1))),
    height: Math.max(1, Math.round(num(value.height, 1))),
    sizeBytes: num(value.sizeBytes, file.size),
    uploadedAt: str(value.uploadedAt, ""),
    favorite: bool(value.favorite, false),
    usageCount: num(value.usageCount, 0),
    transparent: bool(value.transparent, false),
    thumbnail: str(value.thumbnail, ""),
    file,
  };
}

/**
 * Validate a stored or imported record into something the editor can apply.
 *
 * Returns `null` when the record is unusable — the wrong schema version, not an
 * object, or an empty design. Individual objects and assets that fail are
 * dropped instead: losing one layer of a twenty-layer sheet beats refusing the
 * other nineteen.
 */
export function deserializeDocument(value: unknown): RestoredDesign | null {
  if (!isRecord(value)) return null;
  if (num(value.version, 0) !== DESIGN_SCHEMA_VERSION) return null;

  const source = isRecord(value.document) ? value.document : {};

  const objects = (Array.isArray(source.objects) ? source.objects : [])
    .map(readObject)
    .filter((object): object is CanvasObject => object !== null);

  const assets = (Array.isArray(value.assets) ? value.assets : [])
    .map(readAsset)
    .filter((asset): asset is RestoredAsset => asset !== null);

  // Nothing to restore is not a draft worth offering back.
  if (objects.length === 0 && assets.length === 0) return null;

  /*
   * Counters have to stay ahead of the ids already on the sheet.
   *
   * They are stored, but a file that lost them — or was written by an older
   * build — would restart both at zero and mint an id that is already taken.
   * Reading the highest suffix back out of the objects makes the record
   * self-correcting; the patterns mirror how the reducer builds each id.
   */
  const highest = (pattern: RegExp) =>
    objects.reduce((best, object) => {
      const match = pattern.exec(object.id);
      return match ? Math.max(best, Number(match[1])) : best;
    }, 0);

  return {
    savedAt: str(value.savedAt, ""),
    name: str(value.name, "Untitled design"),
    document: {
      objects,
      sheetSize: str(source.sheetSize, DEFAULT_SHEET_SIZE),
      copyCount: Math.max(num(source.copyCount, 0), highest(/-copy-(\d+)$/)),
      placeCount: Math.max(
        num(source.placeCount, 0),
        highest(/^asset-.+-(\d+)$/),
      ),
    },
    assets,
  };
}

/* --------------------------------- JSON ---------------------------------- */

/**
 * Encoded in chunks, because `String.fromCharCode(...bytes)` spreads every
 * byte as an argument and overflows the call stack somewhere around a
 * megabyte — well inside the size of artwork this handles.
 */
const BASE64_CHUNK = 0x8000;

/** Base64 data URL for a blob, so a design can travel as one text file. */
async function toDataUrl(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + BASE64_CHUNK),
    );
  }

  const type = file.type || "application/octet-stream";
  return `data:${type};base64,${btoa(binary)}`;
}

/**
 * A design as one self-contained JSON file.
 *
 * Artwork is inlined as data URLs, which is what makes the file portable at
 * the cost of roughly a third more bytes than the originals. A design that
 * referenced its images would be a design that only opens on this machine.
 */
export async function designToJson(design: SerializedDesign): Promise<string> {
  const assets = await Promise.all(
    design.assets.map(async (asset) => ({
      ...asset,
      file: asset.file instanceof Blob ? await toDataUrl(asset.file) : asset.file,
    })),
  );

  return JSON.stringify({ ...design, assets }, null, 2);
}

/** Parse an exported file. `null` for anything that isn't one. */
export function designFromJson(text: string): RestoredDesign | null {
  try {
    return deserializeDocument(JSON.parse(text));
  } catch {
    // Not JSON at all.
    return null;
  }
}

/** File name for an exported design, from the name the user gave it. */
export function exportFileName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "design"}.json`;
}
