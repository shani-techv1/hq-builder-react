import {
  FabricObject,
  FabricText,
  Gradient,
  Group,
  Polygon,
  Rect,
  util,
} from "fabric";

import type { CanvasObject } from "@/lib/canvas-objects";

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

/** A Fabric object the canvas is managing, tagged with the state id it mirrors. */
export type ManagedObject = FabricObject & { objectId: string };

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
 * Fabric measures text through the 2D context, which can't resolve a CSS
 * custom property — so the inspector's family ids map to real stacks here.
 */
const FONT_STACKS: Record<string, string> = {
  sans: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, monospace",
};

const fontStack = (family: string | undefined) =>
  FONT_STACKS[family ?? "sans"] ?? FONT_STACKS.sans;

/**
 * Build the Fabric object for a piece of state.
 *
 * Created at an intrinsic size and then scaled by {@link applyObjectState} —
 * so the editor's width/height stay authoritative and nothing has to rebuild
 * an object just because it was resized.
 *
 * Uploaded artwork is still mock, so raster layers paint as gradients. When
 * real files arrive this is the one branch that changes: an `Image` layer with
 * a `src` becomes `FabricImage.fromURL`.
 */
export function createFabricObject(object: CanvasObject): ManagedObject {
  const shared = {
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

  let created: FabricObject;

  switch (object.kind) {
    case "text":
      created = new FabricText(object.text ?? "", {
        ...shared,
        fill: object.accent ?? "#1f2937",
        fontSize: object.typography?.fontSize ?? 48,
        fontWeight: object.typography?.fontWeight ?? 700,
        fontFamily: fontStack(object.typography?.fontFamily),
        charSpacing: 0,
        lineHeight: object.typography?.lineHeight ?? 1.16,
        textAlign: object.typography?.align ?? "left",
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

  return Object.assign(created, { objectId: object.id });
}

/** Text content and styling can change without the object being rebuilt. */
function applyContent(target: FabricObject, object: CanvasObject) {
  if (object.kind !== "text") return;

  const text = target as FabricText;
  const type = object.typography;
  text.set({
    text: object.text ?? "",
    fill: object.accent ?? "#1f2937",
    fontSize: type?.fontSize ?? 48,
    fontWeight: type?.fontWeight ?? 700,
    fontFamily: fontStack(type?.fontFamily),
    // Fabric measures character spacing in 1/1000 em; the inspector works in
    // pixels at the object's own font size.
    charSpacing: ((type?.letterSpacing ?? 0) / (type?.fontSize ?? 48)) * 1000,
    lineHeight: type?.lineHeight ?? 1.16,
    textAlign: type?.align ?? "left",
  });
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
) {
  applyContent(target, object);

  const targetWidth = (object.width / 100) * sheet.width;
  const targetHeight = (object.height / 100) * sheet.height;
  const intrinsicWidth = target.width || 1;
  const intrinsicHeight = target.height || 1;

  target.set({
    left: ((object.x + object.width / 2) / 100) * sheet.width,
    top: ((object.y + object.height / 2) / 100) * sheet.height,
    scaleX: targetWidth / intrinsicWidth,
    scaleY: targetHeight / intrinsicHeight,
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
