/**
 * The artwork on a sheet, piece by piece.
 *
 * A gang sheet reaches an order as one cart line and one flattened preview,
 * which is everything a shopper needs and not nearly enough for whoever prints
 * it: the sheet is a layout of separate jobs, and checking one means seeing it
 * on its own. This builds that list, and carries the file the shopper actually
 * uploaded rather than a render of it — so a piece can be re-run at size, not
 * only looked at.
 *
 * Copies collapse into a count. Autofill exists to repeat artwork, so a sheet
 * of forty is usually three designs over and over, and forty near-identical
 * entries would bury the three things there are to check.
 */

import type { CanvasObject } from "@/lib/canvas-objects";
import {
  toDataUrl,
  type SerializedAsset,
  type SerializedDesign,
} from "@/lib/design-document";
import { sheetInches } from "@/lib/workspace";

/**
 * How many bytes of original artwork one save may carry.
 *
 * The save endpoint refuses a sheet body over 48MB, and the flattened preview
 * and the object list have to fit under that too. Base64 is roughly a third
 * larger than the bytes behind it, so this is the real ceiling on originals
 * rather than a round number: a sheet built from print-resolution PNGs reaches
 * it far sooner than the file count suggests.
 */
const MAX_PIECE_PAYLOAD_BYTES = 32 * 1024 * 1024;

/** Percentages are 0–100; a placement is stored as a share of the sheet. */
const PERCENT = 100;

export interface SheetPiece {
  /**
   * Groups placements of the same artwork. The asset id for an upload, and a
   * synthetic key for text and vector, which have no file behind them.
   */
  key: string;
  /** What to call the piece: the file name, or the words for a text piece. */
  name: string;
  /** How many times this piece appears on the sheet. */
  count: number;
  /** Printed size in inches, as placed. */
  widthIn: number;
  heightIn: number;
  /** MIME type of {@link file}, when there is one. */
  mimeType: string | null;
  /**
   * The original upload, as a data URL.
   *
   * Null for a piece with no file behind it — text and vector are drawn by the
   * editor, not uploaded — and for one this save had no room left to carry.
   * Either way the piece is still listed: a printer knowing a piece exists and
   * having to ask for the file beats not knowing it is on the sheet.
   */
  file: string | null;
}

/** One entry per distinct piece, in the order it was first placed. */
interface Group {
  key: string;
  name: string;
  count: number;
  widthIn: number;
  heightIn: number;
  assetId?: string;
}

/**
 * What distinguishes one piece from another.
 *
 * Two placements of one asset are the same piece however differently they were
 * scaled or filtered, because the thing being previewed is the artwork. Text is
 * keyed by its words for the same reason — two objects reading "SUMMER" are one
 * piece repeated, not two to check.
 */
function pieceKey(object: CanvasObject): string {
  if (object.assetId) return object.assetId;
  if (object.kind === "text") return `text:${object.text ?? ""}`;
  return `${object.kind}:${object.name}`;
}

function pieceName(object: CanvasObject, asset?: SerializedAsset): string {
  if (asset) return asset.name;
  if (object.kind === "text") return object.text?.trim() || "Text";
  return object.name;
}

/**
 * Group the sheet's placements into distinct pieces.
 *
 * Hidden objects are left out: they are on the layer list and not on the print,
 * and a piece the printer cannot find on the sheet is a support ticket.
 */
function groupPieces(
  objects: CanvasObject[],
  sheetSize: string,
  assets: SerializedAsset[],
): Group[] {
  const sheet = sheetInches(sheetSize);
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const groups = new Map<string, Group>();

  for (const object of objects) {
    if (object.hidden) continue;

    const key = pieceKey(object);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    const asset = object.assetId ? byId.get(object.assetId) : undefined;
    groups.set(key, {
      key,
      name: pieceName(object, asset),
      count: 1,
      // Sized from the first placement. Copies are the same artwork whatever
      // they were scaled to, and the one that was placed first is the one the
      // rest were made from.
      widthIn: round((object.width / PERCENT) * sheet.width),
      heightIn: round((object.height / PERCENT) * sheet.height),
      assetId: asset?.id,
    });
  }

  return [...groups.values()];
}

/** Two decimals — the precision a tape measure and a print quote both use. */
const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * Build the piece list for a saved design.
 *
 * Attaching the originals is best-effort by design. A piece whose file will not
 * fit is skipped and the next one is still tried, so a single enormous upload
 * costs its own file rather than every file after it — and the save itself is
 * never failed over one, because a sheet that cannot be ordered is worse than
 * an order missing a reference image.
 */
export async function collectSheetPieces(
  design: SerializedDesign,
): Promise<SheetPiece[]> {
  const groups = groupPieces(
    design.document.objects,
    design.document.sheetSize,
    design.assets,
  );

  const byId = new Map(design.assets.map((asset) => [asset.id, asset]));
  let remaining = MAX_PIECE_PAYLOAD_BYTES;
  const pieces: SheetPiece[] = [];

  for (const group of groups) {
    const asset = group.assetId ? byId.get(group.assetId) : undefined;
    const piece: SheetPiece = {
      key: group.key,
      name: group.name,
      count: group.count,
      widthIn: group.widthIn,
      heightIn: group.heightIn,
      mimeType: asset?.mimeType ?? null,
      file: null,
    };

    if (asset) {
      const file = await readFile(asset);
      // A data URL is ASCII, so its length is its weight on the wire.
      if (file && file.length <= remaining) {
        piece.file = file;
        remaining -= file.length;
      }
    }

    pieces.push(piece);
  }

  return pieces;
}

/**
 * An asset's bytes as a data URL.
 *
 * Already a data URL when the design came back from an exported file, and a
 * Blob when it came from the library — both shapes are stored, so both are
 * read. Never throws: see {@link collectSheetPieces}.
 */
async function readFile(asset: SerializedAsset): Promise<string | null> {
  try {
    if (typeof asset.file === "string") {
      return asset.file.startsWith("data:") ? asset.file : null;
    }
    return await toDataUrl(asset.file);
  } catch {
    return null;
  }
}
