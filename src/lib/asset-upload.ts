/**
 * Turning a file the user chose into a library asset.
 *
 * Validation first, then a single read, then one decode that both measures the
 * artwork and produces its thumbnail. Everything here runs in the browser
 * against a local file — nothing is sent anywhere — but the file is still
 * treated as untrusted input: the type is checked against a fixed allow-list
 * rather than trusted from the extension, SVG markup is parsed before it is
 * accepted, and the artwork is only ever rendered through an `<img>`, which
 * does not execute script the way an inlined `<svg>` would.
 */

import { createOwnedObjectUrl, loadImage } from "@/lib/image-cache";
import type { Asset, AssetFormat } from "@/lib/assets";

/* ------------------------------ Configuration ---------------------------- */

/** The only formats the editor accepts, keyed by canonical MIME type. */
const ACCEPTED_TYPES: Record<string, AssetFormat> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/svg+xml": "SVG",
};

/**
 * Extension fallback for the same set.
 *
 * Some platforms hand over an empty `File.type` — SVG especially — so the
 * extension gets a say. It never *widens* what is accepted: both lookups
 * resolve into the same table above.
 */
const ACCEPTED_EXTENSIONS: Record<string, AssetFormat> = {
  png: "PNG",
  jpg: "JPG",
  jpeg: "JPG",
  svg: "SVG",
};

/** Canonical MIME type per format, so the stored value never varies by OS. */
const MIME_TYPES: Record<AssetFormat, string> = {
  PNG: "image/png",
  JPG: "image/jpeg",
  SVG: "image/svg+xml",
};

/** Largest file accepted. The single place this limit is configured. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Longest edge of a generated thumbnail, in pixels. */
const THUMBNAIL_SIZE = 320;

/** Fallback dimensions for an SVG that declares neither size nor viewBox. */
const FALLBACK_SVG_SIZE = 512;

/** Format badges listed on the upload zone. */
export const SUPPORTED_FILE_TYPES = Object.values(ACCEPTED_TYPES);

/** `accept` attribute for the file picker, from the same allow-list. */
export const UPLOAD_ACCEPT = [
  ...Object.keys(ACCEPTED_TYPES),
  ...Object.keys(ACCEPTED_EXTENSIONS).map((extension) => `.${extension}`),
].join(",");

export const MAX_UPLOAD_LABEL = `Up to ${Math.round(
  MAX_UPLOAD_BYTES / (1024 * 1024),
)} MB per file`;

/* ------------------------------- Validation ------------------------------ */

/** The format of a file the editor accepts, or `null` if it accepts none. */
export function formatOf(file: File): AssetFormat | null {
  const byType = ACCEPTED_TYPES[file.type.toLowerCase()];
  if (byType) return byType;

  const dot = file.name.lastIndexOf(".");
  if (dot < 0) return null;
  return ACCEPTED_EXTENSIONS[file.name.slice(dot + 1).toLowerCase()] ?? null;
}

export interface UploadRejection {
  fileName: string;
  /** Shown to the user verbatim, so it says what to do rather than what broke. */
  message: string;
}

/**
 * Check a file before any of it is read.
 *
 * Returns the reason it cannot be used, or `null` when it can — which reads
 * the right way round at the call site: `const problem = validateUpload(file)`.
 */
export function validateUpload(file: File): string | null {
  if (formatOf(file) === null) {
    return `${SUPPORTED_FILE_TYPES.join(", ")} files only.`;
  }
  if (file.size === 0) {
    return "This file is empty.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Files must be under ${MAX_UPLOAD_LABEL.replace("Up to ", "").replace(
      " per file",
      "",
    )}.`;
  }
  return null;
}

/* -------------------------------- Reading -------------------------------- */

/**
 * Read a file, reporting progress as it goes.
 *
 * `FileReader` rather than `File.arrayBuffer()` because only the former emits
 * progress events, and a determinate bar is the difference between "the editor
 * is working" and "the editor is stuck" on a 40 MB upload.
 */
function readFile(
  file: File,
  onProgress: (percent: number) => void,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    reader.onload = () => {
      onProgress(100);
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = () => reject(new Error("The file could not be read."));

    reader.readAsArrayBuffer(file);
  });
}

/* ------------------------------- Measuring ------------------------------- */

interface Size {
  width: number;
  height: number;
}

/** `"512"`, `"512px"` → 512. Percentages and other units have no pixel size. */
function parseSvgLength(value: string | null): number | null {
  if (!value) return null;
  const match = /^\s*([\d.]+)\s*(px)?\s*$/.exec(value);
  const parsed = match ? Number(match[1]) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * An SVG's intrinsic size, and a check that it parses at all.
 *
 * SVGs need not declare pixel dimensions, and a browser asked to decode one
 * that only carries a `viewBox` may report a zero or a default natural size —
 * so the markup is the authority here, not the decoded element.
 *
 * Throws for markup that isn't a parseable SVG, which is the only way to tell
 * a real vector file from something merely named `.svg`.
 */
function measureSvg(markup: string): Size {
  const document = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = document.querySelector("svg");
  if (!root || document.querySelector("parsererror")) {
    throw new Error("This SVG could not be read.");
  }

  const width = parseSvgLength(root.getAttribute("width"));
  const height = parseSvgLength(root.getAttribute("height"));
  if (width && height) return { width, height };

  const viewBox = root
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: viewBox[2], height: viewBox[3] };
  }

  return { width: FALLBACK_SVG_SIZE, height: FALLBACK_SVG_SIZE };
}

/* ------------------------------- Thumbnail ------------------------------- */

interface Preview {
  /** PNG data URL, so transparency survives into the library grid. */
  dataUrl: string;
  transparent: boolean;
}

/**
 * Draw the artwork small, once, and learn two things from the same pass: what
 * the library grid shows, and whether the file has an alpha channel.
 *
 * Transparency is measured rather than assumed from the format — plenty of
 * PNGs are fully opaque, and telling a print operator otherwise is worse than
 * saying nothing.
 */
function renderPreview(
  image: HTMLImageElement,
  size: Size,
  format: AssetFormat,
): Preview {
  const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(size.width, size.height));
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This artwork could not be previewed.");

  context.drawImage(image, 0, 0, width, height);

  try {
    return {
      dataUrl: canvas.toDataURL("image/png"),
      // JPEG has no alpha channel, so the scan below can only ever confirm it.
      transparent: format === "JPG" ? false : hasAlpha(context, width, height),
    };
  } catch {
    // An SVG that pulls in an image from another origin taints the canvas, and
    // both reading it back and exporting it then throw. Nothing can be done
    // with such a file here, so say what would fix it.
    throw new Error(
      "This artwork links to an image from another site. Embed the artwork in the file and upload it again.",
    );
  }
}

/** True as soon as one pixel is not fully opaque. */
function hasAlpha(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  const { data } = context.getImageData(0, 0, width, height);
  for (let offset = 3; offset < data.length; offset += 4) {
    if (data[offset] < 255) return true;
  }
  return false;
}

/* -------------------------------- Pipeline ------------------------------- */

/** ISO date for today. Uploads only ever happen client-side, on a gesture. */
const todayIso = () => new Date().toISOString().slice(0, 10);

/** A finished upload: the library entry, and the bytes behind it. */
export interface PreparedAsset {
  asset: Asset;
  /**
   * The file, normalised to its canonical type. Handed back rather than
   * discarded because a draft has to store the artwork, not a URL to it.
   */
  blob: Blob;
}

/**
 * Read, decode and describe one validated file.
 *
 * The caller is expected to have run {@link validateUpload} first — this
 * assumes the file is one the editor accepts and concerns itself with the
 * work, not the gate.
 */
export async function createAssetFromFile(
  file: File,
  id: string,
  onProgress: (percent: number) => void,
): Promise<PreparedAsset> {
  const format = formatOf(file);
  if (!format) throw new Error("This file type is not supported.");

  const mimeType = MIME_TYPES[format];
  const buffer = await readFile(file, onProgress);

  // Rebuilt from the bytes read rather than wrapping the `File` directly, so
  // the URL carries the canonical type even when the OS reported none.
  const blob = new Blob([buffer], { type: mimeType });

  // Measured from the markup before decoding: a browser given a viewBox-only
  // SVG may report a default natural size, and it also settles whether the
  // file is really an SVG at all.
  const declared =
    format === "SVG" ? measureSvg(new TextDecoder().decode(buffer)) : null;

  const source = createOwnedObjectUrl(blob);
  const image = await loadImage(source);

  const size = declared ?? {
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
  if (size.width < 1 || size.height < 1) {
    throw new Error("This artwork has no usable dimensions.");
  }

  const preview = renderPreview(image, size, format);

  return {
    asset: {
      id,
      name: file.name,
      format,
      mimeType,
      width: Math.round(size.width),
      height: Math.round(size.height),
      sizeBytes: file.size,
      uploadedAt: todayIso(),
      favorite: false,
      usageCount: 0,
      transparent: preview.transparent,
      thumbnail: preview.dataUrl,
      source,
    },
    blob,
  };
}
