"use client";

import { Eraser, LoaderCircle } from "lucide-react";

import { ToolbarAction } from "@/components/canvas/selection/toolbar-action";
import { useBackgroundRemoval } from "@/hooks/use-background-removal";
import type { CanvasObject } from "@/lib/canvas-objects";

export interface RemoveBackgroundActionProps {
  object: CanvasObject;
}

/**
 * Cut the background out of the selected artwork.
 *
 * Renders nothing for artwork that has no background to cut — a text layer, a
 * vector, or a placement whose file this session never saw — rather than
 * offering a button that would explain itself only after being pressed.
 *
 * The work happens on a server and takes seconds, so the button becomes the
 * progress indicator. It stays in place with a spinner rather than being
 * replaced, because a control that vanishes mid-action reads as a crash.
 */
export function RemoveBackgroundAction({ object }: RemoveBackgroundActionProps) {
  const { canRemove, isPending, remove } = useBackgroundRemoval();
  if (!canRemove(object)) return null;

  const busy = isPending(object.id);

  return (
    <ToolbarAction
      icon={busy ? LoaderCircle : Eraser}
      iconClassName={busy ? "animate-spin" : undefined}
      label={busy ? "Removing background…" : "Remove background"}
      showLabel
      disabled={busy || object.locked}
      onClick={() => void remove(object)}
    />
  );
}
