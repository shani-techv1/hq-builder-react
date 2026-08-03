/**
 * Decoded artwork, shared by everything that draws it.
 *
 * One `HTMLImageElement` per uploaded file, decoded once and handed to every
 * Fabric object that references it. Without this a sheet with the same logo
 * placed six times would hold six copies of the same bitmap, and every
 * placement would pay the decode again.
 *
 * The store is module-level rather than React state on purpose: the canvas
 * reads it during a render pass that must stay synchronous, and the cache
 * outlives any component that happens to be mounted.
 */

/** Decoded images, keyed by the URL they were loaded from. */
const decoded = new Map<string, HTMLImageElement>();

/** Decodes already under way, so concurrent callers share one request. */
const inFlight = new Map<string, Promise<HTMLImageElement>>();

/** A decoded bitmap and the size it should be drawn at. */
export interface DecodedArtwork {
  element: HTMLImageElement;
  /**
   * Intrinsic size, measured when the file was read.
   *
   * Authoritative over the element's `naturalWidth`, which a browser given an
   * SVG that declares only a `viewBox` may report as zero or as some default
   * of its own. The renderer would draw nothing at all in that case.
   */
  width: number;
  height: number;
}

interface AssetSource extends Omit<DecodedArtwork, "element"> {
  src: string;
  /**
   * The bytes themselves.
   *
   * Kept because an object URL is a handle, not data: it cannot be written to
   * storage and it dies with the page. Saving a draft or exporting a design
   * needs the file back, and re-fetching every URL to get it would be a round
   * trip for something already in memory.
   */
  file: Blob;
}

/**
 * Asset id → the file behind it.
 *
 * Append-only for the life of the session. Removing an asset from the library
 * must not blank artwork already on the sheet, and undo can bring a deleted
 * placement back long after its asset is gone — so the mapping outlives the
 * library entry it came from.
 */
const sources = new Map<string, AssetSource>();

/** Object URLs this module owns, revoked together when the editor unmounts. */
const ownedUrls = new Set<string>();

const listeners = new Set<() => void>();

/** Bumped whenever a decode finishes, so subscribers can re-read the cache. */
let version = 0;

function announce() {
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribeToImageCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getImageCacheVersion = (): number => version;

/** Nothing is decoded during a server render, and the value must be stable. */
export const getServerImageCacheVersion = (): number => 0;

/**
 * Decode `src`, or hand back the decode already running for it.
 *
 * Resolves with the same element on every call, which is what makes the
 * caching worth anything — Fabric compares elements by identity to decide
 * whether an image actually changed.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  const ready = decoded.get(src);
  if (ready) return Promise.resolve(ready);

  const running = inFlight.get(src);
  if (running) return running;

  const request = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The file could not be decoded."));
    image.src = src;
  })
    .then((image) => {
      decoded.set(src, image);
      inFlight.delete(src);
      announce();
      return image;
    })
    .catch((error: unknown) => {
      inFlight.delete(src);
      throw error;
    });

  inFlight.set(src, request);
  return request;
}

/** Record which file backs an asset, so placements can find it by id alone. */
export function registerAssetSource(
  assetId: string,
  source: AssetSource,
): void {
  sources.set(assetId, source);
}

/** The bytes behind an asset, for saving a draft or exporting a design. */
export function getAssetFile(assetId: string): Blob | undefined {
  return sources.get(assetId)?.file;
}

/**
 * The artwork for an asset, or `undefined` while it is still decoding.
 *
 * Callers draw a placeholder in the meantime and are re-run by
 * {@link subscribeToImageCache} once the decode lands.
 */
export function getAssetArtwork(assetId: string): DecodedArtwork | undefined {
  const source = sources.get(assetId);
  if (!source) return undefined;

  const element = decoded.get(source.src);
  if (!element) return undefined;

  return { element, width: source.width, height: source.height };
}

/** Wrap a file in a URL the cache will revoke when the session ends. */
export function createOwnedObjectUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  ownedUrls.add(url);
  return url;
}

/**
 * Drop every decoded bitmap and revoke every URL handed out.
 *
 * Called when the editor unmounts. Releasing earlier — when an asset leaves
 * the library, say — would break undo, which can restore a placement whose
 * asset was deleted several steps ago.
 */
export function releaseImageCache(): void {
  for (const url of ownedUrls) URL.revokeObjectURL(url);
  ownedUrls.clear();
  decoded.clear();
  inFlight.clear();
  sources.clear();
  announce();
}
