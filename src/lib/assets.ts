/**
 * The asset library's data model.
 *
 * Every asset now comes from a file the user actually uploaded, so the shape
 * describes a real decoded image: its pixel dimensions, the URL the canvas
 * draws from, and a thumbnail generated at upload time. Dates are stored as
 * ISO strings for sorting and formatted by hand rather than through `Intl`, so
 * the server and the client always render the same string.
 *
 * Resolution is deliberately *not* stored. A file's print resolution depends
 * on how large it is placed, so DPI is computed against the sheet where it is
 * needed — see `effectiveDpi` — rather than frozen into the record.
 */

import { PRINT_READY_DPI } from "@/lib/workspace";

export type AssetFormat = "PNG" | "JPG" | "SVG";

export interface Asset {
  id: string;
  /** File name including extension. */
  name: string;
  format: AssetFormat;
  /** Canonical MIME type, e.g. `image/png`. */
  mimeType: string;
  /** Pixel dimensions for raster art, the SVG's own user units for vector. */
  width: number;
  height: number;
  /** File weight in bytes. */
  sizeBytes: number;
  /** ISO date the asset was added, used for sorting. */
  uploadedAt: string;
  favorite: boolean;
  /** How many times the asset has been placed on a sheet. */
  usageCount: number;
  transparent: boolean;
  /** Data URL of the preview generated at upload time. */
  thumbnail: string;
  /** Object URL of the uploaded file — what the canvas decodes and draws. */
  source: string;
}

/** SVG scales without resolution loss; the raster formats do not. */
export const isVectorAsset = (asset: Asset): boolean => asset.format === "SVG";

/**
 * Drag payload carrying an asset from the library to the sheet.
 *
 * A private MIME type rather than `text/plain`, so the canvas can tell an
 * asset being placed from a file being dropped or text from another app, and
 * only the id travels — never the artwork.
 */
export const ASSET_DRAG_TYPE = "application/x-design-builder-asset";

/* ------------------------------ Formatting ------------------------------ */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-07-31" → "31 Jul 2026". Locale-independent, so SSR and client agree. */
export function formatUploadDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const monthName = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthName} ${year}`;
}

/** Bytes to a one-decimal human size. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const formatDimensions = (asset: Asset) =>
  `${asset.width} × ${asset.height}`;

/** Widest this artwork prints while still holding {@link PRINT_READY_DPI}. */
export const printReadyInches = (pixels: number) => pixels / PRINT_READY_DPI;

/**
 * What can honestly be said about resolution before the artwork is placed.
 *
 * Vector art has no resolution to report. Raster art has no single DPI either
 * — only a largest size it can hold — so that is what the library shows, and
 * the inspector reports the real figure once the artwork is on a sheet.
 */
export function formatResolution(asset: Asset): string {
  if (isVectorAsset(asset)) return "Vector";
  return `${printReadyInches(asset.width).toFixed(1)}″ @ ${PRINT_READY_DPI}`;
}

/* -------------------------------- Search --------------------------------- */

/**
 * Filter by file name, newest first.
 *
 * Search is the only narrowing control the library has — tabs, format filters
 * and sort options were removed because they added surface without adding
 * anything the search box couldn't already do at this catalogue size.
 */
export function queryAssets(assets: Asset[], search: string): Asset[] {
  const needle = search.trim().toLowerCase();

  return assets
    .filter((asset) => !needle || asset.name.toLowerCase().includes(needle))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** Up to three other assets to show alongside a preview. */
export function relatedAssets(assets: Asset[], asset: Asset): Asset[] {
  return assets
    .filter((other) => other.id !== asset.id && other.format === asset.format)
    .slice(0, 3);
}
