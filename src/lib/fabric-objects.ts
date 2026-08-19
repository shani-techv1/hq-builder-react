import {
  FabricImage,
  FabricObject,
  Gradient,
  Group,
  IText,
  Polygon,
  Rect,
  util,
} from "fabric";

import {
  DEFAULT_TYPOGRAPHY,
  MIN_FONT_SIZE,
  type CanvasObject,
  type CanvasTypography,
} from "@/lib/canvas-objects";
import type { DecodedArtwork } from "@/lib/image-cache";
import { fabricFilters, filterKey } from "@/lib/image-filters";
import { fontStack } from "@/lib/fonts";

/**
 * Translation layer between the editor's state and Fabric.
 *
 * Fabric is a renderer here, not a model. Everything in this file converts in
 * one direction or the other: state → a Fabric object's appearance and
 * transform, or a Fabric object's transform → the percentages the editor
 * stores. No business logic reads Fabric directly.
 *
 * Geometry convention: the editor stores `x`/`y` as the *unrotated* top-left
 * corner and rotates about the centre. Fabric objects therefore use centre
 * origins, and the conversions below move between the two.
 */

/** Sheet dimensions in base pixels — the size of the sheet at 100% zoom. */
export interface SheetMetrics {
  width: number;
  height: number;
}

/**
 * A Fabric object the canvas is managing, tagged with the state id it mirrors
 * and — for images — with the look already burned into its pixels.
 */
export type ManagedObject = FabricObject & {
  objectId: string;
  /** See {@link applyLook}: what `filters` were last applied, as a key. */
  lookKey?: string;
  /**
   * The decoded artwork behind an image, before any filtering.
   *
   * Tracked here rather than read back from the object, because applying a
   * filter replaces Fabric's element with a filtered canvas — comparing
   * against *that* would look like new artwork on every pass and re-filter the
   * image forever.
   */
  sourceElement?: CanvasImageSource;
};

export const objectIdOf = (object: FabricObject): string | undefined =>
  (object as unknown as Partial<ManagedObject>).objectId;

/** Intrinsic size every generated shape is built at, before scaling. */
const UNIT = 100;

/** Five-pointed star inscribed in a `UNIT` box. */
function starPoints(): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const outer = UNIT / 2;
  const inner = outer * 0.45;

  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    // Start at the top point rather than at 0°, so the star sits upright.
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push({
      x: outer + radius * Math.cos(angle),
      y: outer + radius * Math.sin(angle),
    });
  }
  return points;
}

/** Diagonal gradient across the object, matching the old CSS treatment. */
function gradientFill(fill: { from: string; to: string }): Gradient<"linear"> {
  return new Gradient({
    type: "linear",
    gradientUnits: "percentage",
    coords: { x1: 0, y1: 0, x2: 1, y2: 1 },
    colorStops: [
      { offset: 0, color: fill.from },
      { offset: 1, color: fill.to },
    ],
  });
}

const DEFAULT_FILL = { from: "#94a3b8", to: "#475569" };

/**
 * The editor's typography as Fabric understands it.
 *
 * One translation, used both when a text object is built and when it is
 * restyled, so a newly created layer and an edited one can't disagree.
 */
function textStyle(object: CanvasObject) {
  const type: CanvasTypography = object.typography ?? DEFAULT_TYPOGRAPHY;
  const fontSize = Math.max(MIN_FONT_SIZE, type.fontSize);

  return {
    fill: object.accent ?? "#1f2937",
    fontSize,
    fontWeight: type.fontWeight,
    fontFamily: fontStack(type.fontFamily),
    // Fabric measures character spacing in 1/1000 em; the inspector works in
    // pixels at the object's own font size.
    charSpacing: (type.letterSpacing / fontSize) * 1000,
    lineHeight: type.lineHeight,
    textAlign: type.align,
  };
}

/** Presentation every object shares, whatever it turns out to be. */
type SharedOptions = ReturnType<typeof sharedOptions>;

function sharedOptions() {
  return {
    originX: "center" as const,
    originY: "center" as const,
    // The editor mutates these objects in place on every state change, so a
    // cached bitmap would go stale.
    objectCaching: false,
    strokeUniform: true,
    borderColor: "#1e88ff",
    cornerColor: "#ffffff",
    cornerStrokeColor: "#1e88ff",
    cornerStyle: "circle" as const,
    cornerSize: 10,
    transparentCorners: false,
    padding: 0,
  };
}

/**
 * Build the Fabric object for a piece of state.
 *
 * One decision, taken once: an object with a decoded bitmap behind it is a
 * `FabricImage`, and everything else falls through to the generated shapes
 * below. There is no second rendering path for real artwork — the image branch
 * *is* the raster branch, and the shapes remain what the editor draws when
 * there is no file to draw instead.
 *
 * Created at an intrinsic size and then scaled by {@link applyObjectState} —
 * so the editor's width/height stay authoritative and nothing has to rebuild
 * an object just because it was resized.
 */
export function createFabricObject(
  object: CanvasObject,
  artwork?: DecodedArtwork,
): ManagedObject {
  const shared = sharedOptions();
  const created = artwork
    ? // The measured size rather than the element's, which is what makes a
      // viewBox-only SVG draw at all.
      new FabricImage(artwork.element, {
        ...shared,
        width: artwork.width,
        height: artwork.height,
      })
    : createGeneratedObject(object, shared);

  return Object.assign(created, {
    objectId: object.id,
    sourceElement: artwork?.element,
  });
}

/**
 * The editor's own shapes, for objects with no file behind them.
 *
 * Text, vector badges and groups are drawn rather than loaded, and a raster
 * layer whose artwork is still decoding paints as a gradient placeholder until
 * it arrives.
 */
function createGeneratedObject(
  object: CanvasObject,
  shared: SharedOptions,
): FabricObject {
  let created: FabricObject;

  switch (object.kind) {
    case "text":
      created = new IText(object.text ?? "", {
        ...shared,
        ...textStyle(object),
        editable: true,
        // Caret and selection are chrome, so they follow the editor's accent
        // rather than the text's own colour.
        cursorColor: "#1e88ff",
        cursorWidth: 2,
        selectionColor: "rgba(30,136,255,0.22)",
      });
      break;

    case "vector":
      created = new Polygon(starPoints(), {
        ...shared,
        fill: object.accent ?? "#7c3aed",
      });
      break;

    case "group":
      created = new Group(
        [
          new Rect({
            left: 0,
            top: 0,
            width: UNIT * 0.36,
            height: UNIT,
            fill: object.accent ?? "#0d9488",
            rx: 4,
            ry: 4,
          }),
          new Rect({
            left: UNIT * 0.44,
            top: 0,
            width: UNIT * 0.56,
            height: UNIT * 0.46,
            fill: object.accent ?? "#0d9488",
            opacity: 0.8,
            rx: 4,
            ry: 4,
          }),
          new Rect({
            left: UNIT * 0.44,
            top: UNIT * 0.54,
            width: UNIT * 0.56,
            height: UNIT * 0.46,
            fill: "rgba(31,41,55,0.16)",
            rx: 4,
            ry: 4,
          }),
        ],
        { ...shared, interactive: false },
      );
      break;

    default:
      created = new Rect({
        ...shared,
        width: UNIT,
        height: UNIT,
        rx: 6,
        ry: 6,
        fill: gradientFill(object.fill ?? DEFAULT_FILL),
      });
  }

  return created;
}

/**
 * Whether a managed object can still stand in for its state.
 *
 * The only change that survives no amount of patching is the kind of Fabric
 * object required — which happens exactly once per placement, when artwork
 * that was still decoding finishes and the placeholder has to become an image.
 */
export function needsRebuild(
  target: ManagedObject,
  artwork: DecodedArtwork | undefined,
): boolean {
  return Boolean(artwork) !== (target instanceof FabricImage);
}

/**
 * Content that can change without the object being rebuilt: a text layer's
 * copy and styling, and an image layer's bitmap.
 *
 * Swapping the element rather than recreating the object is what keeps a
 * placement's selection, z-order and transform intact when its artwork
 * changes underneath it.
 */
function applyContent(
  target: ManagedObject,
  object: CanvasObject,
  artwork?: DecodedArtwork,
) {
  if (target instanceof FabricImage) {
    // Identity, not equality: the cache hands out one element per file, so a
    // different element means genuinely different artwork.
    if (artwork && target.sourceElement !== artwork.element) {
      target.setElement(artwork.element, {
        width: artwork.width,
        height: artwork.height,
      });
      target.sourceElement = artwork.element;
      // New pixels, so whatever was applied to the old ones is gone with them.
      target.lookKey = undefined;
    }
    applyLook(target, object);
    return;
  }

  if (!(target instanceof IText)) return;

  target.set(textStyle(object));

  // While the caret is in it, the object is the source of truth for its own
  // content — writing the text back would move the caret to the end on every
  // keystroke. Styling still applies, so the inspector stays live during edits.
  if (!target.isEditing && target.text !== object.text) {
    target.set({ text: object.text ?? "" });
  }
}

/**
 * Put the object's preset and adjustments onto its bitmap.
 *
 * Guarded by a key, because applying filters runs the whole pipeline over every
 * pixel of a print-resolution image — at 22 inches of 300 DPI artwork that is
 * tens of megapixels, and `applyObjectState` runs on every drag frame. The key
 * changes only when the look does.
 */
function applyLook(
  target: FabricImage & { lookKey?: string },
  object: CanvasObject,
) {
  const key = filterKey(object);
  if (target.lookKey === key) return;

  target.filters = fabricFilters(object);

  /*
   * Filtering is allowed to fail; the rest of this pass is not.
   *
   * Fabric picks a filter backend by probing WebGL, and that probe throws
   * outright where `WEBGL_lose_context` is missing — and `getImageData` throws
   * on a canvas tainted by cross-origin artwork. Uncaught, either would abort
   * `applyObjectState` before the transform below it ever ran, so one image
   * with an awkward look would freeze the position, size and rotation of every
   * object after it in the pass.
   *
   * The key is stamped either way: a look that cannot be applied here will not
   * apply on the next frame either, and retrying it forever would cost the
   * failure again on every render.
   */
  try {
    // With no filters this restores the original element, which is how a look
    // gets removed rather than merely stopped being added to.
    target.applyFilters();
  } catch {
    /*
     * Fabric swaps in a blank canvas to hold the filtered pixels *before* it
     * runs the backend, so a failure part-way leaves the object drawing
     * nothing at all. Emptying the list and re-applying takes the path above,
     * which puts the original element back without touching a backend — so
     * the artwork returns unfiltered rather than disappearing.
     */
    target.filters = [];
    target.applyFilters();
  }
  target.lookKey = key;
}

/**
 * Push a piece of state onto its Fabric object: appearance, transform and what
 * the user is allowed to do with it.
 *
 * A locked object stays selectable — that is how it gets unlocked — but loses
 * every handle and every axis of movement.
 */
export function applyObjectState(
  target: ManagedObject,
  object: CanvasObject,
  sheet: SheetMetrics,
  artwork?: DecodedArtwork,
) {
  applyContent(target, object, artwork);

  /*
   * Text sizes itself.
   *
   * Every other object is stretched to the box the editor stores for it, but
   * type is measured from its font: scaling it would squash the letterforms
   * the moment a character was added. So a text object keeps a scale of 1 and
   * occupies whatever it measures, and the stored box follows — see
   * `measureBox`, which reports the result back.
   */
  const isText = target instanceof IText;

  const targetWidth = (object.width / 100) * sheet.width;
  const targetHeight = (object.height / 100) * sheet.height;
  const intrinsicWidth = target.width || 1;
  const intrinsicHeight = target.height || 1;

  const boxWidth = isText ? intrinsicWidth : targetWidth;
  const boxHeight = isText ? intrinsicHeight : targetHeight;

  target.set({
    // The stored `x`/`y` are the unrotated top-left; Fabric works from the
    // centre, so half the box it actually occupies is added back.
    left: (object.x / 100) * sheet.width + boxWidth / 2,
    top: (object.y / 100) * sheet.height + boxHeight / 2,
    scaleX: isText ? 1 : targetWidth / intrinsicWidth,
    scaleY: isText ? 1 : targetHeight / intrinsicHeight,
    angle: object.rotation,
    opacity: object.opacity / 100,
    flipX: object.flipHorizontal ?? false,
    flipY: object.flipVertical ?? false,

    selectable: true,
    evented: true,
    hasControls: !object.locked,
    hasBorders: true,
    lockMovementX: object.locked,
    lockMovementY: object.locked,
    lockRotation: object.locked,
    lockScalingX: object.locked,
    lockScalingY: object.locked,
    hoverCursor: object.locked ? "not-allowed" : "move",
  });

  target.setCoords();
}

/**
 * Difference below which a measured box is treated as unchanged.
 *
 * Sub-hundredth-of-a-percent wobble is sub-pixel on any sheet, and reporting
 * it would bounce the editor between two equivalent states forever.
 */
const MEASUREMENT_EPSILON = 0.01;

/**
 * The box a text object actually occupies, when that differs from the stored
 * one — otherwise `null`, so callers can skip the update entirely.
 *
 * This is the return leg of "text sizes itself": the renderer is the only
 * thing that can measure a font, so it reports what it found and the editor's
 * geometry follows. Nothing else derives its size this way.
 */
export function measureBox(
  target: ManagedObject,
  object: CanvasObject,
  sheet: SheetMetrics,
): Pick<CanvasObject, "width" | "height"> | null {
  if (!(target instanceof IText)) return null;

  const width = (target.width / sheet.width) * 100;
  const height = (target.height / sheet.height) * 100;

  const settled =
    Math.abs(width - object.width) < MEASUREMENT_EPSILON &&
    Math.abs(height - object.height) < MEASUREMENT_EPSILON;

  return settled ? null : { width, height };
}

/**
 * Fold a text object's scale back into its font size.
 *
 * Dragging a corner handle scales every other object, but scaled type is
 * stretched type — so for text the gesture means "make the font bigger" and
 * the scale is converted and reset before anything reads the transform.
 *
 * Returns the new font size, or `null` when the object was not scaled.
 */
export function absorbTextScale(target: FabricObject): number | null {
  if (!(target instanceof IText)) return null;

  // Corner handles scale uniformly, so either axis describes the gesture.
  const scale = Math.abs(target.scaleY);
  if (Math.abs(scale - 1) < 1e-3) return null;

  const fontSize = Math.max(MIN_FONT_SIZE, Math.round(target.fontSize * scale));
  target.set({ fontSize, scaleX: 1, scaleY: 1 });
  target.setCoords();
  return fontSize;
}

/**
 * Read a Fabric object's absolute transform back into the editor's units.
 *
 * Decomposing the transform matrix rather than reading `left`/`top` directly
 * is what makes this work for objects inside a multi-selection, whose own
 * coordinates are relative to the selection group.
 */
export function readObjectTransform(
  target: FabricObject,
  sheet: SheetMetrics,
): Pick<CanvasObject, "x" | "y" | "width" | "height" | "rotation"> {
  const { translateX, translateY, angle, scaleX, scaleY } = util.qrDecompose(
    target.calcTransformMatrix(),
  );

  const width = target.width * Math.abs(scaleX);
  const height = target.height * Math.abs(scaleY);

  return {
    // `translate` is the centre, because every object uses a centre origin.
    x: ((translateX - width / 2) / sheet.width) * 100,
    y: ((translateY - height / 2) / sheet.height) * 100,
    width: (width / sheet.width) * 100,
    height: (height / sheet.height) * 100,
    rotation: Math.round(angle),
  };
}
