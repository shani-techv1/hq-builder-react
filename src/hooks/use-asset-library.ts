"use client";

import * as React from "react";

import {
  createAssetFromFile,
  validateUpload,
  type UploadRejection,
} from "@/lib/asset-upload";
import { queryAssets, type Asset } from "@/lib/assets";
import {
  createOwnedObjectUrl,
  getAssetFile,
  loadImage,
  registerAssetSource,
} from "@/lib/image-cache";
import type { RestoredAsset } from "@/lib/design-document";

/** `logo.png` → `logo copy.png`, so the extension stays where it belongs. */
function copyName(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${name} copy`;
  return `${name.slice(0, dot)} copy${name.slice(dot)}`;
}

export interface UploadTask {
  id: string;
  name: string;
  sizeBytes: number;
  /** 0–100, from the reader's own progress events. */
  progress: number;
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
  /**
   * Validate, read and decode files, resolving with the assets that made it.
   * Rejected files never become tasks — they surface through
   * {@link AssetLibrary.rejections} instead.
   */
  uploadFiles: (files: File[]) => Promise<Asset[]>;
  /** Files that could not be used, and why. Replaced by the next upload. */
  rejections: UploadRejection[];
  dismissRejections: () => void;

  toggleFavorite: (id: string) => void;
  renameAsset: (id: string, name: string) => void;
  duplicateAsset: (id: string) => void;
  deleteAsset: (id: string) => void;
  /** Count a placement against the asset, for the library's "used in" figure. */
  countPlacement: (id: string) => void;
  /**
   * Replace the library with artwork from a draft or an imported design.
   *
   * Each asset arrives as bytes and gets a fresh object URL — the one it had
   * last session died with that page, so the ids are all that survive the trip.
   */
  restoreAssets: (restored: RestoredAsset[]) => void;
}

/**
 * State for the asset library: what has been uploaded, what is uploading, and
 * what was refused.
 *
 * Uploading is deliberately outside the editor's undo stack. The library is a
 * store of files, not part of the design — adding one changes nothing on the
 * sheet, and an undo that silently deleted an upload would be a trap. Placing
 * an asset *is* an edit, and that goes through the canvas reducer instead.
 */
export function useAssetLibrary(): AssetLibrary {
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [search, setSearch] = React.useState("");
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [uploads, setUploads] = React.useState<UploadTask[]>([]);
  const [rejections, setRejections] = React.useState<UploadRejection[]>([]);

  /** Ids are per-session and never reused, so a counter is enough. */
  const uploadCount = React.useRef(0);
  const copyCount = React.useRef(0);

  const trackProgress = React.useCallback((id: string, progress: number) => {
    setUploads((current) =>
      current.map((task) => (task.id === id ? { ...task, progress } : task)),
    );
  }, []);

  const uploadFiles = React.useCallback(
    async (files: File[]): Promise<Asset[]> => {
      if (files.length === 0) return [];

      const refused: UploadRejection[] = [];
      const accepted: Array<{ file: File; task: UploadTask }> = [];

      // Validated up front, so nothing is read before it is known to be usable
      // and a mixed drop reports all its problems at once rather than one per
      // failed file as each finishes.
      for (const file of files) {
        const problem = validateUpload(file);
        if (problem) {
          refused.push({ fileName: file.name, message: problem });
          continue;
        }
        uploadCount.current += 1;
        accepted.push({
          file,
          task: {
            id: `upload-${uploadCount.current}`,
            name: file.name,
            sizeBytes: file.size,
            progress: 0,
          },
        });
      }

      setRejections(refused);
      if (accepted.length === 0) return [];

      setUploads((current) => [...current, ...accepted.map((entry) => entry.task)]);

      // Concurrent: one slow file shouldn't hold up the rest of a drop, and
      // each reports its own progress against its own card.
      const results = await Promise.all(
        accepted.map(async ({ file, task }) => {
          try {
            const { asset, blob } = await createAssetFromFile(
              file,
              task.id,
              (progress) => trackProgress(task.id, progress),
            );
            // The canvas finds artwork by asset id alone, and has to keep
            // finding it after the asset leaves the library.
            registerAssetSource(asset.id, {
              src: asset.source,
              file: blob,
              width: asset.width,
              height: asset.height,
            });
            return asset;
          } catch (error) {
            setRejections((current) => [
              ...current,
              {
                fileName: file.name,
                message:
                  error instanceof Error
                    ? error.message
                    : "This file could not be processed.",
              },
            ]);
            return null;
          } finally {
            setUploads((current) =>
              current.filter((entry) => entry.id !== task.id),
            );
          }
        }),
      );

      const added = results.filter((asset): asset is Asset => asset !== null);
      if (added.length > 0) setAssets((current) => [...added, ...current]);
      return added;
    },
    [trackProgress],
  );

  const dismissRejections = React.useCallback(() => setRejections([]), []);

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
      // The copy points at its source's file rather than decoding a second
      // one — same bytes, same bitmap, one entry in the cache.
      const file = getAssetFile(source.id);
      if (file) {
        registerAssetSource(copy.id, {
          src: copy.source,
          file,
          width: copy.width,
          height: copy.height,
        });
      }
      // Next to its source rather than at the top — the copy is easier to find
      // where the eye already is.
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  }, []);

  /**
   * Remove an asset from the library.
   *
   * The file itself is not released. Artwork already on the sheet keeps
   * drawing, and undo can restore a placement whose asset was deleted several
   * steps earlier — only the library entry goes.
   */
  const deleteAsset = React.useCallback((id: string) => {
    setAssets((current) => current.filter((asset) => asset.id !== id));
    setPreviewId((current) => (current === id ? null : current));
  }, []);

  const countPlacement = React.useCallback((id: string) => {
    setAssets((current) =>
      current.map((asset) =>
        asset.id === id ? { ...asset, usageCount: asset.usageCount + 1 } : asset,
      ),
    );
  }, []);

  const restoreAssets = React.useCallback((restored: RestoredAsset[]) => {
    const rebuilt = restored.map(({ file, ...asset }) => {
      const source = createOwnedObjectUrl(file);
      registerAssetSource(asset.id, {
        src: source,
        file,
        width: asset.width,
        height: asset.height,
      });
      // Nothing else will ask for these. An upload decodes on its way through
      // the pipeline, but a restored asset arrives already described — without
      // this the canvas would draw placeholders and never replace them.
      void loadImage(source);
      return { ...asset, source };
    });

    setAssets(rebuilt);
    setPreviewId(null);
    // Uploads from the abandoned session are not coming back.
    setUploads([]);
    setRejections([]);
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
    uploadFiles,
    rejections,
    dismissRejections,

    toggleFavorite,
    renameAsset,
    duplicateAsset,
    deleteAsset,
    countPlacement,
    restoreAssets,
  };
}
