/**
 * The account's graphics: every upload a signed-in user makes, kept by the
 * account service so the Graphics panel has it again on any visit, on any
 * device.
 *
 * The service keeps a record per graphic; the file and a small thumbnail live
 * on the image host, where the library files every upload anyway. So listing
 * the library costs a few kilobytes, and a graphic's file is only downloaded
 * when it is put on a sheet.
 *
 * What comes back is untrusted like any response: records are rebuilt field by
 * field, and a graphic's file has to download and be an image before it is
 * used.
 */

import { AuthError, authorizedRequest } from "@/lib/auth";
import type { Asset, AssetFormat } from "@/lib/assets";
import { blobFromDataUrl } from "@/lib/design-document";
import { hostArtwork } from "@/lib/image-service";
import { hostAssetFile } from "@/lib/sheet-pieces";

/** One of the account's graphics, as the service describes it. */
export interface AccountAssetRecord {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  format: AssetFormat;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  transparent: boolean;
  favorite: boolean;
  /** ISO timestamp of the upload. */
  createdAt: string;
}

/** The service's limit on a graphic's name. */
const MAX_NAME_LENGTH = 200;

const FORMATS: AssetFormat[] = ["PNG", "JPG", "SVG"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isHttpUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value);

const positive = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

function readRecord(value: unknown): AccountAssetRecord | null {
  if (!isRecord(value)) return null;
  const { id, name, url, thumbnailUrl, format, mimeType } = value;
  const width = positive(value.width);
  const height = positive(value.height);

  if (typeof id !== "string" || !id || typeof name !== "string") return null;
  if (!isHttpUrl(url) || !isHttpUrl(thumbnailUrl)) return null;
  if (!FORMATS.includes(format as AssetFormat)) return null;
  if (typeof mimeType !== "string" || !mimeType.startsWith("image/")) return null;
  if (!width || !height) return null;

  return {
    id,
    name,
    url,
    thumbnailUrl,
    format: format as AssetFormat,
    mimeType,
    width: Math.round(width),
    height: Math.round(height),
    sizeBytes: positive(value.sizeBytes) ?? 0,
    transparent: value.transparent === true,
    favorite: value.favorite === true,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
  };
}

function recordFrom(payload: Record<string, unknown>): AccountAssetRecord {
  const record = readRecord(payload.data);
  if (!record) {
    throw new AuthError(
      "REQUEST_FAILED",
      "The account service returned something unexpected.",
    );
  }
  return record;
}

const assetPath = (id: string) => `/api/assets/${encodeURIComponent(id)}`;

/** The account's graphics, newest first. */
export async function listAccountAssets(): Promise<AccountAssetRecord[]> {
  const payload = await authorizedRequest("/api/assets");
  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows
    .map(readRecord)
    .filter((row): row is AccountAssetRecord => row !== null);
}

/**
 * Where the thumbnail lives on the image host, filing it if it is still the
 * data URL made at upload time.
 */
async function hostedThumbnail(asset: Asset): Promise<string | null> {
  if (isHttpUrl(asset.thumbnail)) return asset.thumbnail;
  const bytes = blobFromDataUrl(asset.thumbnail, "image/png");
  if (!bytes) return null;
  const base = asset.name.replace(/\.[^.]+$/, "") || "graphic";
  return hostArtwork(bytes, `${base}-thumbnail.png`);
}

/**
 * Keep an upload on the account: file it and its thumbnail on the image host
 * if they aren't there yet, then record both.
 */
export async function addAccountAsset(
  asset: Asset,
  file: Blob,
): Promise<AccountAssetRecord> {
  const [url, thumbnailUrl] = await Promise.all([
    hostAssetFile(asset.id, file, asset.name),
    hostedThumbnail(asset),
  ]);
  if (!url || !thumbnailUrl) {
    throw new Error("It couldn’t be uploaded. Check your connection and try again.");
  }

  return recordFrom(
    await authorizedRequest("/api/assets", {
      method: "POST",
      body: {
        name: asset.name.slice(0, MAX_NAME_LENGTH),
        url,
        thumbnailUrl,
        format: asset.format,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        sizeBytes: asset.sizeBytes,
        transparent: asset.transparent,
        favorite: asset.favorite,
      },
    }),
  );
}

/** Set a graphic's name and favourite flag on the account. */
export async function updateAccountAsset(
  id: string,
  { name, favorite }: { name: string; favorite: boolean },
): Promise<void> {
  await authorizedRequest(assetPath(id), {
    method: "PUT",
    body: { name: name.slice(0, MAX_NAME_LENGTH), favorite },
  });
}

/** Remove a graphic from the account. Its file stays on the image host. */
export async function deleteAccountAsset(id: string): Promise<void> {
  try {
    await authorizedRequest(assetPath(id), { method: "DELETE" });
  } catch (cause) {
    // Already gone is what was asked for.
    if (!(cause instanceof AuthError && cause.code === "NOT_FOUND")) throw cause;
  }
}

/**
 * A library entry for one of the account's graphics, before its file has been
 * fetched — see `Asset.source`.
 */
export function assetFromRecord(record: AccountAssetRecord): Asset {
  return {
    id: `account-${record.id}`,
    name: record.name,
    format: record.format,
    mimeType: record.mimeType,
    width: record.width,
    height: record.height,
    sizeBytes: record.sizeBytes,
    // The library sorts and formats by calendar date.
    uploadedAt: record.createdAt.slice(0, 10),
    favorite: record.favorite,
    usageCount: 0,
    transparent: record.transparent,
    thumbnail: record.thumbnailUrl,
    source: "",
    accountAsset: { id: record.id, url: record.url },
  };
}
