"use client";

import * as React from "react";
import { ActiveSelection, Canvas, IText, type FabricObject } from "fabric";

import type { ObjectPatch } from "@/hooks/use-canvas-interaction";
import {
  absorbTextScale,
  applyObjectState,
  createFabricObject,
  measureBox,
  needsRebuild,
  objectIdOf,
  readObjectTransform,
  type ManagedObject,
  type SheetMetrics,
} from "@/lib/fabric-objects";
import {
  DEFAULT_TYPOGRAPHY,
  type CanvasObject,
  type CanvasObjectPatch,
} from "@/lib/canvas-objects";
import { requestFont } from "@/lib/fonts";
import {
  getAssetArtwork,
  getImageCacheVersion,
  getServerImageCacheVersion,
  subscribeToImageCache,
} from "@/lib/image-cache";

/** The decoded artwork for an object, if it has any and it has arrived. */
const artworkFor = (object: CanvasObject) =>
  object.assetId ? getAssetArtwork(object.assetId) : undefined;

/** Drop a Fabric object and the resources it holds. */
function discard(canvas: Canvas, target: ManagedObject) {
  canvas.remove(target);
  target.dispose();
}

/**
 * A counter that ticks every time the document finishes loading fonts.
 *
 * Used only as an effect dependency: the value itself means nothing, but a
 * change is the signal that text can now be measured against its real face.
 */
function useFontLoadCount(): number {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;

    const bump = () => setCount((current) => current + 1);
    fonts.addEventListener("loadingdone", bump);
    // Fonts already in flight when the canvas mounted still need one tick.
    void fonts.ready.then(bump);

    return () => fonts.removeEventListener("loadingdone", bump);
  }, []);

  return count;
}

export interface UseFabricCanvasOptions {
  /** Objects in stacking order — index 0 paints first. */
  objects: CanvasObject[];
  selectedIds: string[];
  /** Sheet size in base pixels, i.e. at 100% zoom. */
  sheet: SheetMetrics;
  /** Zoom as a percentage. Scales the viewport, never the objects. */
  zoom: number;
  onSelectionChange: (ids: string[]) => void;
  onTransform: (updates: ObjectPatch[]) => void;
  /** A text layer that should open for editing as soon as it exists. */
  pendingEditId?: string | null;
  /** Called once the caret is in that layer, so the request isn't repeated. */
  onEditStarted?: () => void;
  /** Content typed on the sheet. Coalesced upstream into one undo step. */
  onTextChange?: (id: string, text: string) => void;
  /** Text committed empty — the layer has nothing left to be. */
  onTextEmptied?: (id: string) => void;
  /** Boxes the renderer measured for objects that size themselves. */
  onMetrics?: (updates: ObjectPatch[]) => void;
}

/**
 * Renders the editor's objects with Fabric and reports interactions back.
 *
 * The contract is one-directional in each phase: state flows down through
 * `applyObjectState`, and user gestures flow up through `onTransform` /
 * `onSelectionChange`. Fabric never holds anything the editor doesn't already
 * know, which is why every effect below can safely re-apply state wholesale.
 *
 * `applying` guards the seam. Writing state into Fabric fires the same events
 * a user gesture does, and without the flag the canvas would answer its own
 * updates in a loop.
 */
export function useFabricCanvas({
  objects,
  selectedIds,
  sheet,
  zoom,
  onSelectionChange,
  onTransform,
  pendingEditId,
  onEditStarted,
  onTextChange,
  onTextEmptied,
  onMetrics,
}: UseFabricCanvasOptions) {
  const elementRef = React.useRef<HTMLCanvasElement>(null);
  const canvasRef = React.useRef<Canvas | null>(null);
  const registry = React.useRef(new Map<string, ManagedObject>());
  const applying = React.useRef(false);

  /**
   * Artwork decodes off the main flow, so the canvas cannot read the cache
   * once and be done. Subscribing means a placement made before its bitmap
   * arrived is re-applied the moment it does, without anything upstream having
   * to know an image was pending.
   */
  const imageVersion = React.useSyncExternalStore(
    subscribeToImageCache,
    getImageCacheVersion,
    getServerImageCacheVersion,
  );

  /**
   * Webfonts arrive after the text that asked for them.
   *
   * Until the file lands the browser draws — and Fabric measures — the
   * fallback, so a layer set in a new family would keep a box sized to the
   * wrong face. Counting load events re-runs the pass below, which re-measures
   * against the real metrics.
   */
  const fontVersion = useFontLoadCount();

  /* Latest values for the event handlers, which outlive any single render. */
  const latest = React.useRef({
    sheet,
    onSelectionChange,
    onTransform,
    onTextChange,
    onTextEmptied,
  });
  React.useEffect(() => {
    latest.current = {
      sheet,
      onSelectionChange,
      onTransform,
      onTextChange,
      onTextEmptied,
    };
  });

  /* ------------------------------ Lifecycle ----------------------------- */
  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Captured for the cleanup, which must clear the same map this effect
    // populated rather than whichever one is current when it runs.
    const managed = registry.current;

    const canvas = new Canvas(element, {
      selection: true,
      // Selected objects keep their place in the stack instead of jumping to
      // the front, so the canvas always matches the layer list.
      preserveObjectStacking: true,
      // Corner handles keep the aspect ratio; Shift releases it.
      uniformScaling: true,
      uniScaleKey: "shiftKey",
      selectionColor: "rgba(30,136,255,0.08)",
      selectionBorderColor: "#1e88ff",
      selectionLineWidth: 1,
    });
    canvasRef.current = canvas;

    const reportSelection = () => {
      if (applying.current) return;
      const ids = canvas
        .getActiveObjects()
        .map(objectIdOf)
        .filter((id): id is string => Boolean(id));
      latest.current.onSelectionChange(ids);
    };

    const reportTransform = (target: FabricObject) => {
      // A multi-selection reports one event for the whole group; each member's
      // absolute transform has to be decomposed individually.
      const targets =
        target instanceof ActiveSelection ? target.getObjects() : [target];

      const updates: ObjectPatch[] = [];
      for (const object of targets) {
        const id = objectIdOf(object);
        if (!id) continue;

        // Resizing type means resizing the font, so the gesture is converted
        // before the transform is read — otherwise the scale would be stored
        // as a stretched box and the letterforms with it.
        const fontSize = absorbTextScale(object);
        const patch: CanvasObjectPatch = readObjectTransform(
          object,
          latest.current.sheet,
        );

        // A partial typography patch; the reducer merges it into the rest.
        if (fontSize !== null) patch.typography = { fontSize };

        updates.push({ id, patch });
      }

      if (updates.length > 0) latest.current.onTransform(updates);
    };

    canvas.on("selection:created", reportSelection);
    canvas.on("selection:updated", reportSelection);
    canvas.on("selection:cleared", reportSelection);
    canvas.on("object:modified", (event) => {
      if (applying.current || !event.target) return;
      reportTransform(event.target);
    });

    /* ---------------------------- Text editing --------------------------- */

    // Fabric owns the caret, the selection and the keystrokes while a text
    // object is open; the editor only mirrors the result. Escape and clicking
    // away are handled by Fabric and by the selection effect respectively,
    // both of which end in `editing:exited`.
    canvas.on("text:changed", (event) => {
      const id = objectIdOf(event.target);
      if (!id) return;
      latest.current.onTextChange?.(id, event.target.text);
    });

    canvas.on("text:editing:exited", (event) => {
      const id = objectIdOf(event.target);
      if (!id) return;

      // Committing nothing means the layer says nothing, and an invisible
      // object that still catches clicks is worse than no object.
      if (event.target.text.trim() === "") {
        latest.current.onTextEmptied?.(id);
        return;
      }

      latest.current.onTextChange?.(id, event.target.text);
    });

    return () => {
      canvasRef.current = null;
      managed.clear();
      void canvas.dispose();
    };
  }, []);

  /* ------------------------- Viewport (zoom only) ----------------------- */
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scale = zoom / 100;
    // The element grows with zoom while object coordinates stay in base units,
    // so zooming is purely a viewport transform.
    canvas.setDimensions({
      width: sheet.width * scale,
      height: sheet.height * scale,
    });
    canvas.setZoom(scale);
    canvas.requestRenderAll();
  }, [sheet.width, sheet.height, zoom]);

  /* --------------------------- Objects & order -------------------------- */
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    applying.current = true;

    // Hidden objects leave the canvas but stay in state, so the layer list can
    // still show and restore them.
    const visible = objects.filter((object) => !object.hidden);
    const visibleIds = new Set(visible.map((object) => object.id));

    for (const [id, target] of registry.current) {
      if (visibleIds.has(id)) continue;
      discard(canvas, target);
      registry.current.delete(id);
    }

    /* Boxes that turned out to differ from what the editor had stored. */
    const measured: ObjectPatch[] = [];

    visible.forEach((object, index) => {
      // Canvas text never triggers a font download on its own, so every text
      // layer asks for its own face. Already-requested faces are a no-op.
      if (object.kind === "text") {
        const type = object.typography ?? DEFAULT_TYPOGRAPHY;
        requestFont(type.fontFamily, type.fontWeight);
      }

      const artwork = artworkFor(object);
      let target = registry.current.get(object.id);

      // A placeholder whose artwork has since decoded can't be patched into an
      // image, so it is replaced. Every other change applies in place.
      if (target && needsRebuild(target, artwork)) {
        discard(canvas, target);
        registry.current.delete(object.id);
        target = undefined;
      }

      if (!target) {
        target = createFabricObject(object, artwork);
        registry.current.set(object.id, target);
        canvas.add(target);
      }

      applyObjectState(target, object, sheet, artwork);

      // Text occupies whatever it measures, so the editor's copy of its box
      // may now be stale. Reported after the pass rather than during it, as a
      // non-recorded correction — see the `syncMetrics` history policy.
      const box = measureBox(target, object, sheet);
      if (box) measured.push({ id: object.id, patch: box });

      // Array order is the z-order; index 0 paints first.
      canvas.moveObjectTo(target, index);
    });

    canvas.requestRenderAll();
    applying.current = false;

    // Settles in one further pass: the corrected state measures the same, so
    // nothing is reported and the effect stops re-running.
    if (measured.length > 0) onMetrics?.(measured);
    // `imageVersion` is not read here — it stands in for the cache itself, so
    // a decode that lands after a placement still reaches the canvas.
  }, [objects, sheet, imageVersion, fontVersion, onMetrics]);

  /* ------------------------------ Selection ----------------------------- */
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const current = canvas
      .getActiveObjects()
      .map(objectIdOf)
      .filter((id): id is string => Boolean(id));

    const unchanged =
      current.length === selectedIds.length &&
      current.every((id) => selectedIds.includes(id));
    if (unchanged) return;

    const targets = selectedIds
      .map((id) => registry.current.get(id))
      .filter((target): target is ManagedObject => Boolean(target));

    applying.current = true;
    canvas.discardActiveObject();
    if (targets.length === 1) {
      canvas.setActiveObject(targets[0]);
    } else if (targets.length > 1) {
      canvas.setActiveObject(new ActiveSelection(targets, { canvas }));
    }
    canvas.requestRenderAll();
    applying.current = false;
  }, [selectedIds, objects]);

  /* ---------------------- Open a new text layer ------------------------- */
  /*
   * Last, so the object has been created by the objects effect and made active
   * by the selection effect before the caret goes into it — `enterEditing` on
   * an object the canvas has not selected leaves the two disagreeing about
   * what is focused.
   */
  React.useEffect(() => {
    if (!pendingEditId) return;

    const canvas = canvasRef.current;
    const target = registry.current.get(pendingEditId);
    if (!canvas || !(target instanceof IText)) return;

    // The effect re-runs whenever `objects` changes — including on the
    // measurement correction that immediately follows creation. Re-entering is
    // a no-op in Fabric, but selecting all again would throw away whatever the
    // user had already typed by then.
    if (target.isEditing) return;

    canvas.setActiveObject(target);
    target.enterEditing();
    // The placeholder is a prompt, not content: selecting it means the first
    // keystroke replaces it instead of appending to it.
    target.selectAll();
    canvas.requestRenderAll();

    onEditStarted?.();
  }, [pendingEditId, objects, onEditStarted]);

  return elementRef;
}
