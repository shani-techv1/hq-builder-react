"use client";

import * as React from "react";
import { ActiveSelection, Canvas, type FabricObject } from "fabric";

import type { ObjectPatch } from "@/hooks/use-canvas-interaction";
import {
  applyObjectState,
  createFabricObject,
  objectIdOf,
  readObjectTransform,
  type ManagedObject,
  type SheetMetrics,
} from "@/lib/fabric-objects";
import type { CanvasObject } from "@/lib/canvas-objects";

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
}: UseFabricCanvasOptions) {
  const elementRef = React.useRef<HTMLCanvasElement>(null);
  const canvasRef = React.useRef<Canvas | null>(null);
  const registry = React.useRef(new Map<string, ManagedObject>());
  const applying = React.useRef(false);

  /* Latest values for the event handlers, which outlive any single render. */
  const latest = React.useRef({ sheet, onSelectionChange, onTransform });
  React.useEffect(() => {
    latest.current = { sheet, onSelectionChange, onTransform };
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
        updates.push({
          id,
          patch: readObjectTransform(object, latest.current.sheet),
        });
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
      canvas.remove(target);
      registry.current.delete(id);
    }

    visible.forEach((object, index) => {
      let target = registry.current.get(object.id);
      if (!target) {
        target = createFabricObject(object);
        registry.current.set(object.id, target);
        canvas.add(target);
      }
      applyObjectState(target, object, sheet);
      // Array order is the z-order; index 0 paints first.
      canvas.moveObjectTo(target, index);
    });

    canvas.requestRenderAll();
    applying.current = false;
  }, [objects, sheet]);

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

  return elementRef;
}
