"use client";

import * as React from "react";

import { toast } from "@/components/ui/toast";
import {
  assetFromRecord,
  type AccountAssetRecord,
} from "@/lib/account-assets";
import {
  createAssetFromFile,
  formatOf,
  replacementFile,
  validateUpload,
  type UploadRejection,
} from "@/lib/asset-upload";
import { queryAssets, type AccountAssetLink, type Asset } from "@/lib/assets";
import {
  createOwnedObjectUrl,
  getAssetFile,
  getAssetHostedUrl,
  loadImage,
  registerAssetSource,
  setAssetHostedUrl,
} from "@/lib/image-cache";
import type { RestoredAsset } from "@/lib/design-document";
import { downloadArtwork, trimArtwork } from "@/lib/image-service";
import { hostAssetFile } from "@/lib/sheet-pieces";

/**
 * Stamped into every id this page load mints.
 *
 * A counter alone restarts at one on every visit, while the assets of a
 * restored draft or an opened design keep the ids they were given on an
 * earlier one — so the next upload would take an id already on the sheet, and
 * the artwork placed under it would turn into the new file.
 */
const SESSION = Date.now().toString(36);

/**
 * File an asset's bytes on the image host, in the background.
 *
 * Started the moment artwork enters the library rather than when the sheet is
 * ordered, because by then the shopper is waiting on a button: a design session
 * is minutes long and an upload is seconds, so doing it here means the URL is
 * already there at checkout instead of megabytes going up at the worst possible
 * moment.
 *
 * Deliberately unawaited and silent. Nothing on the sheet needs the URL to
 * render — the canvas draws from the local file — and a host that is down must
 * not stop someone designing. `collectSheetPieces` uploads what is still
 * missing when the order is placed, and carries the bytes itself if that fails
 * too.
 */
function fileOnHost(asset: Asset, file: Blob): void {
  void hostAssetFile(asset.id, file, asset.name);
}

/**
 * The file with its empty margin cropped off by the image service, or the file
 * itself when that could not happen.
 *
 * Vector artwork is never sent: the service answers in pixels, and flattening
 * an SVG to crop it would throw away the reason it was uploaded as a vector.
 * Any failure keeps the original too — untrimmed artwork is still artwork.
 */
async function trimmedFile(
  file: File,
  onProgress: (percent: number) => void,
): Promise<File> {
  if (formatOf(file) === "SVG") return file;
  const trimmed = await trimArtwork(file, file.name, onProgress);
  return (trimmed && replacementFile(file, trimmed)) ?? file;
}

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
  /**
   * 0–100: bytes sent to be trimmed when the file is, then the reader's own
   * progress events. Only ever moves forward, so the read never rewinds a bar
   * the trim already filled.
   */
  progress: number;
}

export interface UploadOptions {
  /**
   * Crop each file's empty margin on the image service, and keep the cropped
   * version instead of the original.
   *
   * For files straight off the user's device. Artwork that arrives some other
   * way — a cut-out, which the service has already trimmed, or a Canva export
   * — goes in as it is.
   */
  trim?: boolean;
}

export interface AssetLibrary {
  /** Every asset, unfiltered. */
  assets: Asset[];
  /**
   * Assets deleted from the library this session.
   *
   * Not listed, but still described: artwork already on the sheet stays when
   * its library entry goes, so the sheet — and every design saved from it —
   * still needs its details and file.
   */
  detached: Asset[];
  /** Assets matching the current search. */
  visibleAssets: Asset[];

  search: string;
  setSearch: (search: string) => void;

  previewAsset: Asset | null;
  openPreview: (id: string) => void;
  closePreview: () => void;

  uploads: UploadTask[];
  /**
   * Validate, trim when asked, read and decode files, resolving with the
   * assets that made it. Rejected files never become tasks — they surface
   * through {@link AssetLibrary.rejections} instead.
   */
  uploadFiles: (files: File[], options?: UploadOptions) => Promise<Asset[]>;
  /** Files that could not be used, and why. Replaced by the next upload. */
  rejections: UploadRejection[];
  dismissRejections: () => void;

  toggleFavorite: (id: string) => void;
  renameAsset: (id: string, name: string) => void;
  duplicateAsset: (id: string) => Promise<void>;
  deleteAsset: (id: string) => void;
  /** Count a placement against the asset, for the library's "used in" figure. */
  countPlacement: (id: string) => void;
  /**
   * Replace the library with artwork from a draft or an imported design.
   *
   * Each asset arrives as bytes and gets a fresh object URL — the one it had
   * last session died with that page, so the ids are all that survive the trip.
   *
   * The account's graphics stay unless `keepAccountAssets` is false: opening a
   * design doesn't change what the account has uploaded. Clearing the editor
   * for the next person at this browser does.
   */
  restoreAssets: (
    restored: RestoredAsset[],
    options?: { keepAccountAssets?: boolean },
  ) => void;

  /**
   * The asset with its file ready to draw, fetching it first for an account's
   * graphic that hasn't been used yet. `null` if it couldn't be — the reason
   * has been raised as a toast.
   */
  ensureLocal: (id: string) => Promise<Asset | null>;
  /** Assets whose files are being fetched, for the grid to show as busy. */
  downloading: string[];
  /** Add the account's graphics that the library doesn't already hold. */
  addAccountAssets: (records: AccountAssetRecord[]) => void;
  /** Record that an upload is now kept on the account. */
  linkAccountAsset: (id: string, link: AccountAssetLink) => void;
}

/**
 * The URL an asset's file is served from, for telling two copies of the same
 * artwork apart from two different ones.
 */
const hostedUrlOf = (asset: Asset) =>
  asset.accountAsset?.url ?? getAssetHostedUrl(asset.id);

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
  const [downloading, setDownloading] = React.useState<string[]>([]);
  const [detached, setDetached] = React.useState<Asset[]>([]);

  /** Counted per page load, and made unique across loads by {@link SESSION}. */
  const uploadCount = React.useRef(0);
  const copyCount = React.useRef(0);

  /** The library as of the latest render, for work that finishes after it. */
  const latestAssets = React.useRef(assets);
  React.useEffect(() => {
    latestAssets.current = assets;
  }, [assets]);

  /** Files being fetched, by asset id, so asking twice fetches once. */
  const fetching = React.useRef(new Map<string, Promise<Asset | null>>());

  const trackProgress = React.useCallback((id: string, progress: number) => {
    setUploads((current) =>
      current.map((task) =>
        // Forward only: see `UploadTask.progress`.
        task.id === id
          ? { ...task, progress: Math.max(task.progress, progress) }
          : task,
      ),
    );
  }, []);

  const uploadFiles = React.useCallback(
    async (
      files: File[],
      { trim = false }: UploadOptions = {},
    ): Promise<Asset[]> => {
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
            id: `upload-${SESSION}-${uploadCount.current}`,
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
          const onProgress = (progress: number) =>
            trackProgress(task.id, progress);
          try {
            // Everything after this works from the trimmed file, so the
            // library, the sheet and the hosted copy all hold the same artwork.
            const source = trim ? await trimmedFile(file, onProgress) : file;
            const { asset, blob } = await createAssetFromFile(
              source,
              task.id,
              onProgress,
            );
            // The canvas finds artwork by asset id alone, and has to keep
            // finding it after the asset leaves the library.
            registerAssetSource(asset.id, {
              src: asset.source,
              file: blob,
              width: asset.width,
              height: asset.height,
            });
            fileOnHost(asset, blob);
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

  const ensureLocal = React.useCallback((id: string): Promise<Asset | null> => {
    const asset = latestAssets.current.find((entry) => entry.id === id);
    if (!asset) return Promise.resolve(null);
    if (getAssetFile(id)) return Promise.resolve(asset);

    const link = asset.accountAsset;
    if (!link) return Promise.resolve(null);

    const running = fetching.current.get(id);
    if (running) return running;

    setDownloading((current) => [...current, id]);
    const task = downloadArtwork(link.url, asset.mimeType)
      .then((file) => {
        const source = createOwnedObjectUrl(file);
        registerAssetSource(id, {
          src: source,
          file,
          width: asset.width,
          height: asset.height,
          // It came from the host, so it is never filed there a second time.
          hostedUrl: link.url,
        });
        void loadImage(source);
        setAssets((current) =>
          current.map((entry) => (entry.id === id ? { ...entry, source } : entry)),
        );
        return { ...asset, source };
      })
      .catch((cause: unknown) => {
        toast.error(
          `Couldn’t load “${asset.name}”`,
          cause instanceof Error && !(cause instanceof TypeError)
            ? cause.message
            : "Check your connection and try again.",
        );
        return null;
      })
      .finally(() => {
        fetching.current.delete(id);
        setDownloading((current) => current.filter((entry) => entry !== id));
      });

    fetching.current.set(id, task);
    return task;
  }, []);

  const duplicateAsset = React.useCallback(
    async (id: string) => {
      // A copy shares its source's file, so the file has to be here first.
      if (!(await ensureLocal(id))) return;

      copyCount.current += 1;
      const suffix = `${SESSION}-${copyCount.current}`;
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
          // A graphic of its own, which the account keeps separately.
          accountAsset: undefined,
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
          // Same bytes, so the same hosted copy — uploading them a second time
          // would put an identical file on the host under a new name.
          const hosted = getAssetHostedUrl(source.id);
          if (hosted) setAssetHostedUrl(copy.id, hosted);
          else fileOnHost(copy, file);
        }
        // Next to its source rather than at the top — the copy is easier to find
        // where the eye already is.
        return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
      });
    },
    [ensureLocal],
  );

  /**
   * Remove an asset from the library.
   *
   * The file itself is not released. Artwork already on the sheet keeps
   * drawing, and undo can restore a placement whose asset was deleted several
   * steps earlier — only the library entry goes, into {@link detached}.
   */
  const deleteAsset = React.useCallback((id: string) => {
    const removed = latestAssets.current.find((asset) => asset.id === id);
    setAssets((current) => current.filter((asset) => asset.id !== id));
    if (removed) {
      setDetached((current) => [
        ...current.filter((asset) => asset.id !== id),
        { ...removed, deleted: true },
      ]);
    }
    setPreviewId((current) => (current === id ? null : current));
  }, []);

  const countPlacement = React.useCallback((id: string) => {
    setAssets((current) =>
      current.map((asset) =>
        asset.id === id ? { ...asset, usageCount: asset.usageCount + 1 } : asset,
      ),
    );
  }, []);

  const restoreAssets = React.useCallback(
    (
      restored: RestoredAsset[],
      { keepAccountAssets = true }: { keepAccountAssets?: boolean } = {},
    ) => {
      const rebuilt = restored.map(({ file, hostedUrl, ...asset }) => {
        const source = createOwnedObjectUrl(file);
        registerAssetSource(asset.id, {
          src: source,
          file,
          width: asset.width,
          height: asset.height,
          hostedUrl: hostedUrl ?? asset.accountAsset?.url,
        });
        // A draft can be days old and was never ordered, so its artwork has
        // almost certainly never been filed. Start now, on the same terms. A
        // saved design's artwork came from the host, and is skipped.
        fileOnHost({ ...asset, source } as Asset, file);
        // Nothing else will ask for these. An upload decodes on its way through
        // the pipeline, but a restored asset arrives already described — without
        // this the canvas would draw placeholders and never replace them.
        void loadImage(source);
        return { ...asset, source };
      });

      // What the design carries only for its sheet stays off the list.
      const listed = rebuilt.filter((asset) => !asset.deleted);
      setAssets((current) => {
        if (!keepAccountAssets) return listed;
        // The account's graphics stay, less any the design brought back itself.
        const restoredIds = new Set(rebuilt.map((asset) => asset.accountAsset?.id));
        const restoredUrls = new Set(rebuilt.map(hostedUrlOf));
        const kept = current.filter(
          (asset) =>
            asset.accountAsset &&
            !restoredIds.has(asset.accountAsset.id) &&
            !restoredUrls.has(asset.accountAsset.url),
        );
        return [...listed, ...kept];
      });
      // Those kept for the sheet being replaced go; the new one's arrive.
      setDetached(rebuilt.filter((asset) => asset.deleted));
      setPreviewId(null);
      // Uploads from the abandoned session are not coming back.
      setUploads([]);
      setRejections([]);
    },
    [],
  );

  const addAccountAssets = React.useCallback(
    (records: AccountAssetRecord[]) =>
      setAssets((current) => {
        const linked = new Set(current.map((asset) => asset.accountAsset?.id));
        // An upload with the same file is this graphic before it was linked —
        // one saved in a design, say — and becomes it rather than a twin.
        const unlinkedUrls = new Set(
          current.filter((asset) => !asset.accountAsset).map(hostedUrlOf),
        );
        const added = records
          .filter((record) => !linked.has(record.id) && !unlinkedUrls.has(record.url))
          .map(assetFromRecord);
        return added.length > 0 ? [...current, ...added] : current;
      }),
    [],
  );

  const linkAccountAsset = React.useCallback(
    (id: string, link: AccountAssetLink) =>
      setAssets((current) =>
        current.map((asset) =>
          asset.id === id ? { ...asset, accountAsset: link } : asset,
        ),
      ),
    [],
  );

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
    detached,
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

    ensureLocal,
    downloading,
    addAccountAssets,
    linkAccountAsset,
  };
}
