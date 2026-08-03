/**
 * The asset library's data model and mock catalogue.
 *
 * Everything here is static: there is no upload pipeline yet, so the shape of
 * an asset is what matters. Dates are stored as ISO strings for sorting and
 * formatted by hand rather than through `Intl`, so the server and the client
 * always render the same string.
 */

export type AssetFormat = "PNG" | "SVG" | "PDF" | "AI" | "EPS";

export interface Asset {
  id: string;
  /** File name including extension. */
  name: string;
  format: AssetFormat;
  /** Pixel dimensions for raster art, artboard size for vector. */
  width: number;
  height: number;
  /** Effective print resolution, or `null` for resolution-independent art. */
  dpi: number | null;
  sizeBytes: number;
  /** ISO date, used for sorting. */
  uploadedAt: string;
  favorite: boolean;
  /** How many times the asset has been placed on a sheet. */
  usageCount: number;
  transparent: boolean;
  /** Tailwind gradient stops standing in for the thumbnail. */
  swatch: string;
}

export const MOCK_ASSETS: Asset[] = [
  {
    id: "a1",
    name: "summer-tour-front.png",
    format: "PNG",
    width: 3600,
    height: 2400,
    dpi: 300,
    sizeBytes: 2_517_000,
    uploadedAt: "2026-07-31",
    favorite: true,
    usageCount: 12,
    transparent: true,
    swatch: "from-sky-400 to-blue-600",
  },
  {
    id: "a2",
    name: "aurora-logo-mono.svg",
    format: "SVG",
    width: 512,
    height: 512,
    dpi: null,
    sizeBytes: 18_400,
    uploadedAt: "2026-07-30",
    favorite: true,
    usageCount: 34,
    transparent: true,
    swatch: "from-slate-600 to-slate-900",
  },
  {
    id: "a3",
    name: "flame-badge.png",
    format: "PNG",
    width: 1800,
    height: 1800,
    dpi: 300,
    sizeBytes: 1_140_000,
    uploadedAt: "2026-07-29",
    favorite: false,
    usageCount: 8,
    transparent: true,
    swatch: "from-orange-400 to-rose-500",
  },
  {
    id: "a4",
    name: "team-crest.pdf",
    format: "PDF",
    width: 2480,
    height: 3508,
    dpi: 300,
    sizeBytes: 842_000,
    uploadedAt: "2026-07-27",
    favorite: false,
    usageCount: 5,
    transparent: false,
    swatch: "from-emerald-400 to-teal-600",
  },
  {
    id: "a5",
    name: "retro-type-lockup.png",
    format: "PNG",
    width: 2400,
    height: 900,
    dpi: 300,
    sizeBytes: 3_210_000,
    uploadedAt: "2026-07-24",
    favorite: true,
    usageCount: 19,
    transparent: true,
    swatch: "from-violet-400 to-fuchsia-600",
  },
  {
    id: "a6",
    name: "wave-pattern.ai",
    format: "AI",
    width: 1024,
    height: 1024,
    dpi: null,
    sizeBytes: 456_000,
    uploadedAt: "2026-07-22",
    favorite: false,
    usageCount: 3,
    transparent: true,
    swatch: "from-cyan-400 to-sky-600",
  },
  {
    id: "a7",
    name: "star-burst.eps",
    format: "EPS",
    width: 800,
    height: 800,
    dpi: null,
    sizeBytes: 212_000,
    uploadedAt: "2026-07-19",
    favorite: false,
    usageCount: 1,
    transparent: true,
    swatch: "from-amber-300 to-orange-500",
  },
  {
    id: "a8",
    name: "tour-back-panel.png",
    format: "PNG",
    width: 4200,
    height: 5400,
    dpi: 300,
    sizeBytes: 6_880_000,
    uploadedAt: "2026-07-16",
    favorite: false,
    usageCount: 7,
    transparent: true,
    swatch: "from-indigo-400 to-blue-800",
  },
  {
    id: "a9",
    name: "sponsor-row.svg",
    format: "SVG",
    width: 1600,
    height: 240,
    dpi: null,
    sizeBytes: 44_000,
    uploadedAt: "2026-07-12",
    favorite: false,
    usageCount: 22,
    transparent: true,
    swatch: "from-zinc-400 to-zinc-700",
  },
  {
    id: "a10",
    name: "holo-sticker.png",
    format: "PNG",
    width: 1500,
    height: 1500,
    dpi: 240,
    sizeBytes: 1_960_000,
    uploadedAt: "2026-07-08",
    favorite: true,
    usageCount: 15,
    transparent: true,
    swatch: "from-pink-400 to-purple-600",
  },
  {
    id: "a11",
    name: "mascot-outline.ai",
    format: "AI",
    width: 1400,
    height: 1800,
    dpi: null,
    sizeBytes: 688_000,
    uploadedAt: "2026-07-03",
    favorite: false,
    usageCount: 2,
    transparent: true,
    swatch: "from-lime-400 to-green-600",
  },
  {
    id: "a12",
    name: "grunge-overlay.png",
    format: "PNG",
    width: 3000,
    height: 3000,
    dpi: 150,
    sizeBytes: 4_720_000,
    uploadedAt: "2026-06-28",
    favorite: false,
    usageCount: 0,
    transparent: false,
    swatch: "from-stone-400 to-stone-700",
  },
];

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

/** Resolution reads as a number for raster art and as "Vector" otherwise. */
export const formatResolution = (asset: Asset) =>
  asset.dpi === null ? "Vector" : `${asset.dpi} DPI`;

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

/* -------------------------------- Uploads -------------------------------- */

export const SUPPORTED_FILE_TYPES = ["PNG", "JPG", "SVG", "PDF", "AI"];

/** Largest file the uploader advertises, shown next to the file types. */
export const MAX_UPLOAD_LABEL = "Up to 50 MB per file";
