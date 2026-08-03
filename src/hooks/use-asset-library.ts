"use client";

import * as React from "react";

import { MOCK_ASSETS, queryAssets, type Asset } from "@/lib/assets";

/** Files a mock upload pretends to be processing. */
const PENDING_UPLOADS = [
  {
    name: "poster-artwork.png",
    sizeBytes: 3_140_000,
    step: 9,
    swatch: "from-rose-400 to-red-600",
  },
  {
    name: "sleeve-print.svg",
    sizeBytes: 96_000,
    step: 17,
    swatch: "from-teal-400 to-cyan-600",
  },
];

/** How often mock upload progress advances. */
const UPLOAD_TICK_MS = 180;

/** Stamped on anything "uploaded" this session. */
const TODAY = "2026-08-03";

export interface UploadTask {
  id: string;
  name: string;
  sizeBytes: number;
  /** 0–100. */
  progress: number;
  /** Increment applied each tick — differs per file so they don't march. */
  step: number;
  swatch: string;
}

/** Turn a finished upload into a library asset. */
function taskToAsset(task: UploadTask): Asset {
  const isVectorFile = task.name.endsWith(".svg");
  return {
    id: task.id,
    name: task.name,
    format: isVectorFile ? "SVG" : "PNG",
    width: isVectorFile ? 1024 : 3000,
    height: isVectorFile ? 1024 : 2000,
    dpi: isVectorFile ? null : 300,
    sizeBytes: task.sizeBytes,
    uploadedAt: TODAY,
    favorite: false,
    usageCount: 0,
    transparent: true,
    swatch: task.swatch,
  };
}

/** `logo.png` → `logo copy.png`, so the extension stays where it belongs. */
function copyName(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${name} copy`;
  return `${name.slice(0, dot)} copy${name.slice(dot)}`;
}

export interface AssetLibrary {
  /** Every asset, unfiltered. */
  assets: Asset[];
  /** Assets matching the current search. */
  visibleAssets: Asset[];

  search: string;
  setSearch: (search: string) => void;

  previewAsset: Asset | null;
  openPreview: (id: string) => void;
  closePreview: () => void;

  uploads: UploadTask[];
  startMockUpload: () => void;

  toggleFavorite: (id: string) => void;
  renameAsset: (id: string, name: string) => void;
  duplicateAsset: (id: string) => void;
  deleteAsset: (id: string) => void;
}

/**
 * State for the asset library.
 *
 * Mock throughout: the catalogue is seeded from a constant and uploads advance
 * on a timer. Swapping this for a real data source later means preserving the
 * returned shape and nothing else.
 */
export function useAssetLibrary(): AssetLibrary {
  const [assets, setAssets] = React.useState<Asset[]>(MOCK_ASSETS);
  const [search, setSearch] = React.useState("");
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [uploads, setUploads] = React.useState<UploadTask[]>([]);

  /**
   * Progress ticks from a timer, so the in-flight list lives in a ref and the
   * state exists only to render it. Reading state inside the interval would
   * mean rebuilding the timer on every tick.
   */
  const uploadsRef = React.useRef<UploadTask[]>([]);
  const batchCount = React.useRef(0);
  const copyCount = React.useRef(0);

  React.useEffect(() => {
    if (uploads.length === 0) return;

    const timer = setInterval(() => {
      const advanced = uploadsRef.current.map((task) => ({
        ...task,
        progress: Math.min(100, task.progress + task.step),
      }));
      const finished = advanced.filter((task) => task.progress >= 100);
      const inFlight = advanced.filter((task) => task.progress < 100);

      uploadsRef.current = inFlight;
      setUploads(inFlight);
      if (finished.length > 0) {
        setAssets((current) => [...finished.map(taskToAsset), ...current]);
      }
    }, UPLOAD_TICK_MS);

    return () => clearInterval(timer);
  }, [uploads.length]);

  const startMockUpload = React.useCallback(() => {
    batchCount.current += 1;
    const batch = batchCount.current;
    const tasks = PENDING_UPLOADS.map((file, index) => ({
      id: `upload-${batch}-${index}`,
      name: file.name,
      sizeBytes: file.sizeBytes,
      progress: 0,
      step: file.step,
      swatch: file.swatch,
    }));

    uploadsRef.current = [...uploadsRef.current, ...tasks];
    setUploads(uploadsRef.current);
  }, []);

  const toggleFavorite = React.useCallback(
    (id: string) =>
      setAssets((current) =>
        current.map((asset) =>
          asset.id === id ? { ...asset, favorite: !asset.favorite } : asset,
        ),
      ),
    [],
  );

  const renameAsset = React.useCallback((id: string, name: string) => {
    const next = name.trim();
    if (!next) return;
    setAssets((current) =>
      current.map((asset) => (asset.id === id ? { ...asset, name: next } : asset)),
    );
  }, []);

  const duplicateAsset = React.useCallback((id: string) => {
    copyCount.current += 1;
    const suffix = copyCount.current;
    setAssets((current) => {
      const index = current.findIndex((asset) => asset.id === id);
      if (index < 0) return current;
      const source = current[index];
      const copy: Asset = {
        ...source,
        id: `${source.id}-copy-${suffix}`,
        name: copyName(source.name),
        favorite: false,
        usageCount: 0,
      };
      // Next to its source rather than at the top — the copy is easier to find
      // where the eye already is.
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  }, []);

  const deleteAsset = React.useCallback((id: string) => {
    setAssets((current) => current.filter((asset) => asset.id !== id));
    setPreviewId((current) => (current === id ? null : current));
  }, []);

  const visibleAssets = React.useMemo(
    () => queryAssets(assets, search),
    [assets, search],
  );

  const previewAsset = React.useMemo(
    () => assets.find((asset) => asset.id === previewId) ?? null,
    [assets, previewId],
  );

  return {
    assets,
    visibleAssets,

    search,
    setSearch,

    previewAsset,
    openPreview: React.useCallback((id: string) => setPreviewId(id), []),
    closePreview: React.useCallback(() => setPreviewId(null), []),

    uploads,
    startMockUpload,

    toggleFavorite,
    renameAsset,
    duplicateAsset,
    deleteAsset,
  };
}
