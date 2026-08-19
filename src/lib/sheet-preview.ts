/**
 * Flattens a sheet into a single PNG for the cart line and the order admin.
 *
 * Drawn onto an offscreen canvas from the objects themselves rather than
 * captured from the live Fabric canvas. The live one carries the workspace's
 * zoom, scroll and selection handles, and is sized to the screen — none of
 * which belong in a preview that has to be legible at cart-thumbnail size and
 * identical however the shopper happened to be looking at it.
 *
 * This is a *preview*, not the print file. It is deliberately small; the
 * artwork that actually gets printed travels as the original uploads.
 */

import {
  DEFAULT_TYPOGRAPHY,
  NEUTRAL_ADJUSTMENTS,
  type CanvasObject,
} from "@/lib/canvas-objects";
import { getAssetArtwork } from "@/lib/image-cache";
import { cssFilter, findFilterPreset } from "@/lib/image-filters";
import { PX_PER_INCH, sheetInches } from "@/lib/workspace";

/**
 * Longest edge of the rendered preview, in pixels.
 *
 * Big enough to read the artwork on an order, small enough that the data URL
 * stays a sensible fraction of the request that carries it.
 */
const MAX_EDGE = 1200;

/** Percentages are 0–100; geometry is multiplied by this against the canvas. */
const PERCENT = 100;

/** Canvas dimensions for a sheet, capped at {@link MAX_EDGE}. */
function previewSize(sheetSize: string): { width: number; height: number } {
  const { width, height } = sheetInches(sheetSize);
  const scale = MAX_EDGE / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Paint one object into the already-translated, already-rotated frame.
 *
 * `scale` converts base sheet pixels — the units the editor authors type in —
 * into preview pixels. Geometry needs no such conversion because it is stored
 * as percentages of the sheet.
 */
function paint(
  ctx: CanvasRenderingContext2D,
  object: CanvasObject,
  width: number,
  height: number,
  scale: number,
): void {
  if (object.kind === "text") {
    const type = object.typography ?? DEFAULT_TYPOGRAPHY;
    const size = Math.max(1, type.fontSize * scale);
    ctx.fillStyle = object.accent ?? "#111111";
    ctx.font = `${type.fontWeight} ${size}px ${type.fontFamily}, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign =
      type.align === "center" ? "center" : type.align === "right" ? "right" : "left";
    const x = type.align === "center" ? width / 2 : type.align === "right" ? width : 0;
    ctx.fillText(object.text ?? "", x, height / 2);
    return;
  }

  const artwork = object.assetId ? getAssetArtwork(object.assetId) : undefined;
  if (artwork) {
    /*
     * The look goes on here too, or the preview — which is what a shopper sees
     * in their cart — would show the artwork as uploaded rather than as it will
     * print. The caller's `save`/`restore` clears it again.
     *
     * A browser without `filter` on a 2D context ignores it and draws the
     * artwork plain, which is the right way for a preview to degrade.
     */
    const look = cssFilter(
      findFilterPreset(object.filter).spec,
      object.adjustments ?? NEUTRAL_ADJUSTMENTS,
    );
    if (look) ctx.filter = look;

    ctx.drawImage(artwork.element, 0, 0, width, height);
    return;
  }

  // Nothing decoded behind it — the gradient placeholder the canvas shows.
  if (object.fill) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, object.fill.from);
    gradient.addColorStop(1, object.fill.to);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * Render the sheet to a PNG data URL, or `null` if the browser gave us no
 * drawing context. Never throws: a preview is worth having, not worth failing
 * an order over.
 */
export function renderSheetPreview(
  objects: CanvasObject[],
  sheetSize: string,
): string | null {
  try {
    const { width, height } = previewSize(sheetSize);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Base sheet pixels → preview pixels, for anything not stored as a
    // percentage. Type is the only such thing today.
    const scale = width / (sheetInches(sheetSize).width * PX_PER_INCH);

    // Bottom of the layer list is the back of the sheet, same as the canvas.
    for (const object of objects) {
      if (object.hidden) continue;

      const w = (object.width / PERCENT) * width;
      const h = (object.height / PERCENT) * height;
      if (w <= 0 || h <= 0) continue;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, object.opacity / PERCENT));

      // Rotate about the object's centre, which is what the editor rotates
      // about — anchoring at the corner would swing artwork off the sheet.
      const cx = (object.x / PERCENT) * width + w / 2;
      const cy = (object.y / PERCENT) * height + h / 2;
      ctx.translate(cx, cy);
      if (object.rotation) ctx.rotate((object.rotation * Math.PI) / 180);
      ctx.scale(object.flipHorizontal ? -1 : 1, object.flipVertical ? -1 : 1);
      ctx.translate(-w / 2, -h / 2);

      paint(ctx, object, w, h, scale);
      ctx.restore();
    }

    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
