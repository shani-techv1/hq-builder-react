"use client";

import * as React from "react";

/** Pointer buttons bitmask: primary button held. */
const PRIMARY_BUTTON = 1;

export interface SpacePan {
  /** True while the space bar is down — the workspace is in pan mode. */
  isPanning: boolean;
  /** Spread onto the scrolling pane. */
  handlers: {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  };
}

/**
 * Hold space, drag to pan the workspace.
 *
 * Panning moves the pane's scroll position rather than Fabric's viewport, so
 * the rulers — which already track scroll — stay in register, and zoom remains
 * the only thing that touches the canvas transform.
 *
 * The space bar is tracked on the document because the pane isn't focusable;
 * the default page-scroll behaviour is suppressed while it's held.
 */
export function useSpacePan(
  paneRef: React.RefObject<HTMLElement | null>,
): SpacePan {
  const [isPanning, setIsPanning] = React.useState(false);
  const origin = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return (
        element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.isContentEditable
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      setIsPanning(true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      origin.current = null;
      setIsPanning(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const handlers = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (!isPanning) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      origin.current = { x: event.clientX, y: event.clientY };
    },

    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      const start = origin.current;
      const pane = paneRef.current;
      if (!start || !pane || !(event.buttons & PRIMARY_BUTTON)) return;

      pane.scrollLeft -= event.clientX - start.x;
      pane.scrollTop -= event.clientY - start.y;
      origin.current = { x: event.clientX, y: event.clientY };
    },

    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      origin.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
  };

  return { isPanning, handlers };
}
