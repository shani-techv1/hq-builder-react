"use client";

import * as React from "react";

export interface CanvasShortcutHandlers {
  /** Gates only the selection-dependent shortcuts. */
  enabled: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onDeselect: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

/** True when the user is typing, in which case shortcuts must stay out of it. */
function isTypingInto(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.isContentEditable
  );
}

/**
 * The editor's keyboard shortcuts.
 *
 * Two listeners, because they have different lifetimes. Delete, duplicate and
 * deselect only mean something with a selection; undo and redo have to work
 * whatever is on screen — including immediately after a delete, when there is
 * nothing selected at all.
 *
 * Both are bound in the capture phase so Escape can claim the event before the
 * editor shell reads it as "close the open panel" — with a selection on the
 * canvas, Escape means deselect. `preventDefault` is what signals that.
 */
export function useCanvasShortcuts({
  enabled,
  onDelete,
  onDuplicate,
  onDeselect,
  onUndo,
  onRedo,
}: CanvasShortcutHandlers) {
  // The callbacks are fresh closures on every render. Holding them in a ref
  // keeps the listener subscriptions tied to `enabled` alone, so they aren't
  // torn down and rebuilt on each render.
  const handlers = React.useRef({
    onDelete,
    onDuplicate,
    onDeselect,
    onUndo,
    onRedo,
  });
  React.useEffect(() => {
    handlers.current = { onDelete, onDuplicate, onDeselect, onUndo, onRedo };
  });

  /* ----------------------------- Always on ------------------------------ */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A text field has its own undo stack; the editor's must not steal it.
      if (isTypingInto(event.target)) return;
      if (!event.metaKey && !event.ctrlKey) return;

      const key = event.key.toLowerCase();

      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) handlers.current.onRedo();
        else handlers.current.onUndo();
        return;
      }

      // Ctrl+Y is the Windows convention for redo.
      if (key === "y") {
        event.preventDefault();
        handlers.current.onRedo();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  /* -------------------- Only while something is selected ----------------- */
  React.useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingInto(event.target)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        handlers.current.onDeselect();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        handlers.current.onDelete();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        handlers.current.onDuplicate();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);
}
