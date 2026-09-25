/**
 * My designs: the account's saved designs, kept by the account service.
 *
 * A saved design is the same record a draft or an export holds, with one
 * difference in how the artwork travels. A draft keeps the bytes and an export
 * inlines them; here each asset is a link to its file on the image host, where
 * the library files every upload anyway. That keeps a saved design to a few
 * hundred kilobytes however large the artwork is, and it is what lets the same
 * design open on another device.
 *
 * What comes back is treated as untrusted like any draft or file: it goes
 * through `deserializeDocument`, and the artwork has to download and be an
 * image before anything reaches the sheet.
 */

import { AuthError, authorizedRequest } from "@/lib/auth";
import {
  deserializeDocument,
  type RestoredDesign,
  type SerializedDesign,
} from "@/lib/design-document";
import { hostedUrlFor } from "@/lib/sheet-pieces";

/** One row of the list — enough to choose by, without the design itself. */
export interface SavedDesignSummary {
  id: string;
  name: string;
  sheetSize: string;
  objectCount: number;
  /** ISO timestamp of the last save. */
  updatedAt: string;
}

/**
 * Longer than a sign-in allows: a save carries every object and a thumbnail
 * per artwork, and a phone on a poor connection sends that slowly.
 */
const SAVE_TIMEOUT_MS = 60_000;

/** The same allowance per file as filing artwork, since it is the same files. */
const DOWNLOAD_TIMEOUT_MS = 120_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function readSummary(value: unknown): SavedDesignSummary | null {
  if (!isRecord(value)) return null;
  const { id, name, sheetSize, objectCount, updatedAt } = value;
  if (typeof id !== "string" || !id || typeof name !== "string") return null;
  return {
    id,
    name,
    sheetSize: typeof sheetSize === "string" ? sheetSize : "",
    objectCount:
      typeof objectCount === "number" && Number.isFinite(objectCount)
        ? objectCount
        : 0,
    updatedAt: typeof updatedAt === "string" ? updatedAt : "",
  };
}

function summaryFrom(payload: Record<string, unknown>): SavedDesignSummary {
  const summary = readSummary(payload.data);
  if (!summary) {
    throw new AuthError(
      "REQUEST_FAILED",
      "The account service returned something unexpected.",
    );
  }
  return summary;
}

const designPath = (id: string) => `/api/designs/${encodeURIComponent(id)}`;

/** The account's designs for this product, newest first. */
export async function listSavedDesigns(
  productId: string | null,
): Promise<SavedDesignSummary[]> {
  const query = productId ? `?productId=${encodeURIComponent(productId)}` : "";
  const payload = await authorizedRequest(`/api/designs${query}`);
  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows
    .map(readSummary)
    .filter((row): row is SavedDesignSummary => row !== null);
}

/**
 * The design as the service stores it: artwork as links, not bytes.
 *
 * Every asset has to have a link, filing it now if the background upload never
 * landed. A design saved with an asset missing would open with a blank where
 * that artwork was, so one that can't be filed fails the save instead.
 */
async function toStoredRecord(design: SerializedDesign) {
  const assets = await Promise.all(
    design.assets.map(async ({ file, ...asset }) => {
      const url = await hostedUrlFor({ ...asset, file });
      if (!url) {
        throw new Error(
          "Some artwork couldn’t be uploaded. Check your connection and try again.",
        );
      }
      return { ...asset, url };
    }),
  );

  return {
    version: design.version,
    savedAt: design.savedAt,
    name: design.name,
    document: design.document,
    assets,
  };
}

/**
 * Save the design, over `id` when it is given.
 *
 * An `id` the service no longer has — deleted on another device — is saved as a
 * new design rather than lost; the caller tells the two apart by the id that
 * comes back.
 */
export async function saveDesignToAccount({
  id,
  productId,
  design,
}: {
  id: string | null;
  productId: string | null;
  design: SerializedDesign;
}): Promise<SavedDesignSummary> {
  const body = {
    productId,
    name: design.name,
    design: await toStoredRecord(design),
  };

  if (id) {
    try {
      return summaryFrom(
        await authorizedRequest(designPath(id), {
          method: "PUT",
          body,
          timeoutMs: SAVE_TIMEOUT_MS,
        }),
      );
    } catch (cause) {
      if (!(cause instanceof AuthError && cause.code === "NOT_FOUND")) {
        throw cause;
      }
    }
  }

  return summaryFrom(
    await authorizedRequest("/api/designs", {
      method: "POST",
      body,
      timeoutMs: SAVE_TIMEOUT_MS,
    }),
  );
}

/**
 * One asset's bytes, back off the image host.
 *
 * Typed by the saved record rather than by the response when the two differ:
 * the host names files by extension, and an asset renamed without one is
 * served as whatever it guessed — an SVG under the wrong type would not draw.
 */
async function downloadArtwork(url: string, mimeType: unknown): Promise<Blob> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("This design links to artwork that isn’t a valid address.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("This design links to artwork that isn’t a valid address.");
  }

  const response = await fetch(parsed, {
    mode: "cors",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("Some of this design’s artwork is missing.");

  const bytes = await response.blob();
  if (bytes.size === 0) throw new Error("Some of this design’s artwork is missing.");

  const recorded =
    typeof mimeType === "string" && mimeType.startsWith("image/")
      ? mimeType
      : null;
  if (recorded && bytes.type !== recorded) {
    return new Blob([bytes], { type: recorded });
  }
  if (!bytes.type.startsWith("image/")) {
    throw new Error("Some of this design’s artwork isn’t an image.");
  }
  return bytes;
}

/**
 * Fetch a saved design and its artwork, ready for `restoreDesign`.
 *
 * All or nothing: if any artwork fails to download, nothing is returned, so the
 * sheet on screen is never swapped for one with holes in it.
 */
export async function openSavedDesign(id: string): Promise<RestoredDesign> {
  const payload = await authorizedRequest(designPath(id));
  const data = isRecord(payload.data) ? payload.data : null;
  const record = data && isRecord(data.design) ? data.design : null;
  if (!record) throw new Error("That design couldn’t be read.");

  const hosted = new Map<string, string>();
  const stored = Array.isArray(record.assets) ? record.assets : [];

  const assets = await Promise.all(
    stored.map(async (asset: unknown) => {
      // Malformed entries are left for `deserializeDocument` to drop.
      if (!isRecord(asset) || typeof asset.id !== "string") return asset;
      if (typeof asset.url !== "string") return asset;

      const file = await downloadArtwork(asset.url, asset.mimeType);
      hosted.set(asset.id, asset.url);
      // The link rides along unread: the asset reader keeps only known fields.
      return { ...asset, file };
    }),
  ).catch((cause: unknown) => {
    // Offline surfaces from fetch as a bare TypeError, and a timeout as a
    // DOMException — neither says anything worth showing.
    if (cause instanceof TypeError || cause instanceof DOMException) {
      throw new Error(
        "The design’s artwork couldn’t be downloaded. Check your connection and try again.",
      );
    }
    throw cause;
  });

  const design = deserializeDocument({ ...record, assets });
  if (!design) {
    throw new Error(
      "That design is empty, or was saved by a newer version of the editor.",
    );
  }

  return {
    ...design,
    savedDesignId: id,
    matchesSavedDesign: true,
    assets: design.assets.map((asset) => ({
      ...asset,
      hostedUrl: hosted.get(asset.id),
    })),
  };
}

export async function deleteSavedDesign(id: string): Promise<void> {
  try {
    await authorizedRequest(designPath(id), { method: "DELETE" });
  } catch (cause) {
    // Already gone is what was asked for.
    if (!(cause instanceof AuthError && cause.code === "NOT_FOUND")) throw cause;
  }
}
