"use client";

import * as React from "react";

import { useEditorState } from "@/components/editor/editor-state";
import { toast } from "@/components/ui/toast";
import { isVectorAsset } from "@/lib/assets";
import type { CanvasObject } from "@/lib/canvas-objects";
import { getAssetFile } from "@/lib/image-cache";
import { removeBackground } from "@/lib/image-service";

/** `logo.png` → `logo (no background).png`, extension left where it belongs. */
function cutoutName(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${stem} (no background).png`;
}

export interface BackgroundRemoval {
  /** True while this object's artwork is away being cut out. */
  isPending: (id: string) => boolean;
  /** Whether there is a background here that could be removed at all. */
  canRemove: (object: CanvasObject) => boolean;
  remove: (object: CanvasObject) => Promise<void>;
}

/**
 * Removing the background from a placement's artwork.
 *
 * The cut-out arrives as a new library asset rather than overwriting the old
 * one: the original file is what a second attempt, an export and an undo all
 * need, and the placement only ever held a reference to an asset anyway. So the
 * edit is one field — which asset this object draws — which means undo puts the
 * background back in a single step and costs nothing.
 *
 * Vector artwork is left alone. An SVG has no background to cut out, and
 * flattening one to a PNG to find that out would throw away the reason it was
 * uploaded as a vector.
 */
export function useBackgroundRemoval(): BackgroundRemoval {
  const { canvas, library, findAsset } = useEditorState();
  const [pending, setPending] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const mark = React.useCallback((id: string, running: boolean) => {
    setPending((current) => {
      const next = new Set(current);
      if (running) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const canRemove = React.useCallback(
    (object: CanvasObject) => {
      const asset = findAsset(object.assetId);
      return asset !== undefined && !isVectorAsset(asset);
    },
    [findAsset],
  );

  const remove = React.useCallback(
    async (object: CanvasObject) => {
      if (pending.has(object.id)) return;

      const asset = findAsset(object.assetId);
      const file = object.assetId ? getAssetFile(object.assetId) : undefined;
      if (!asset || !file) return;

      mark(object.id, true);
      try {
        const { blob, alreadyRemoved } = await removeBackground(
          file,
          asset.name,
        );

        /*
         * Nothing was cut out, so nothing is kept. What came back is the same
         * picture re-encoded, and filing it as a second asset would leave the
         * library holding two copies of one image and the sheet pointing at
         * the newer one for no reason.
         */
        if (alreadyRemoved) {
          toast.success(
            "Already cut out",
            "This artwork has no background left to remove.",
          );
          return;
        }

        /*
         * Back through the upload pipeline rather than straight into the cache:
         * that is what validates the bytes, measures them, builds a thumbnail
         * and registers the source, so a cut-out is an asset in every way an
         * uploaded file is — including being placeable again from Graphics.
         */
        const cutout = new File([blob], cutoutName(asset.name), {
          type: blob.type || "image/png",
        });
        const [added] = await library.uploadFiles([cutout]);
        if (!added) {
          // uploadFiles reports its own reason through the Graphics panel; this
          // is only so the toolbar doesn't fall quiet on a failure.
          throw new Error("The cut-out came back in a format we can’t read.");
        }

        canvas.patchObject(object.id, { assetId: added.id });
        toast.success(
          "Background removed",
          "The original is still in Graphics, and undo brings it back.",
        );
      } catch (error) {
        toast.error(
          "Could not remove the background",
          error instanceof Error ? error.message : "Something went wrong.",
        );
      } finally {
        mark(object.id, false);
      }
    },
    [canvas, findAsset, library, mark, pending],
  );

  return {
    isPending: React.useCallback((id: string) => pending.has(id), [pending]),
    canRemove,
    remove,
  };
}
