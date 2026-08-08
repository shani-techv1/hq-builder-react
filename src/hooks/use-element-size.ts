"use client";

import * as React from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * An element's visible box, tracked across resizes.
 *
 * Read from `clientWidth`/`clientHeight` rather than the observer's
 * `contentRect`, so a scrolling element reports the space its content is laid
 * out against instead of the extent of that content.
 *
 * Measured in a layout effect so the first value lands before paint, which is
 * what keeps geometry derived from it from visibly settling into place.
 */
export function useElementSize(
  ref: React.RefObject<HTMLElement | null>,
): ElementSize {
  const [size, setSize] = React.useState<ElementSize>({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Bail on an unchanged box: a resize observer fires for scrollbar and
    // subpixel churn too, and re-rendering the sheet for those is wasted work.
    const measure = () =>
      setSize((current) =>
        current.width === element.clientWidth &&
        current.height === element.clientHeight
          ? current
          : { width: element.clientWidth, height: element.clientHeight },
      );

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
