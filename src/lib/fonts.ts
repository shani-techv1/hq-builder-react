/**
 * The typefaces the sheet can set.
 *
 * Every family here is really loaded by the app — see `layout.tsx`, which
 * self-hosts them through `next/font` and publishes each one as a CSS
 * variable. A picker that offered families the canvas could not draw would
 * silently render them all in the same fallback, which is worse than a short
 * list.
 *
 * The canvas is the reason this file exists at all. Fabric measures text
 * through a 2D context, which cannot resolve a CSS custom property and does
 * not wait for a webfont — so the variables are resolved to real family names
 * here, and {@link whenFontReady} exists to tell the renderer when it is safe
 * to measure.
 */

export interface FontFamily {
  /** Stored on the object, so the catalogue can be reordered freely. */
  id: string;
  label: string;
  /** How the family reads, shown under the name in the picker. */
  detail: string;
  /** CSS variable `layout.tsx` publishes the loaded family name on. */
  variable: string;
  /** Generic family the browser falls back to before the font arrives. */
  fallback: string;
  /**
   * Weights the family actually ships.
   *
   * Asking for a weight a font does not have gets it synthesised by the
   * browser — thickened outlines that look nothing like a real bold — so the
   * inspector offers each family only what it can really set.
   */
  weights: number[];
}

/** Weights available to families that ship a full range. */
const FULL_RANGE = [400, 500, 600, 700, 800];

/** Display and script faces are drawn at one weight by design. */
const SINGLE = [400];

export const FONT_FAMILIES: FontFamily[] = [
  {
    id: "sans",
    label: "Geist Sans",
    detail: "Clean, neutral",
    variable: "--font-art-sans",
    fallback: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    weights: FULL_RANGE,
  },
  {
    id: "condensed",
    label: "Oswald",
    detail: "Tall, condensed",
    variable: "--font-art-condensed",
    fallback: "'Arial Narrow', system-ui, sans-serif",
    weights: [400, 500, 600, 700],
  },
  {
    id: "display",
    label: "Anton",
    detail: "Heavy poster",
    variable: "--font-art-display",
    fallback: "'Arial Black', system-ui, sans-serif",
    weights: SINGLE,
  },
  {
    id: "serif",
    label: "Playfair Display",
    detail: "Elegant serif",
    variable: "--font-art-serif",
    fallback: "Georgia, 'Times New Roman', serif",
    weights: FULL_RANGE,
  },
  {
    id: "rounded",
    label: "Nunito",
    detail: "Soft, friendly",
    variable: "--font-art-rounded",
    fallback: "system-ui, -apple-system, sans-serif",
    weights: FULL_RANGE,
  },
  {
    id: "script",
    label: "Pacifico",
    detail: "Handwritten",
    variable: "--font-art-script",
    fallback: "'Brush Script MT', cursive",
    weights: SINGLE,
  },
  {
    id: "mono",
    label: "Geist Mono",
    detail: "Fixed width",
    variable: "--font-art-mono",
    fallback: "ui-monospace, 'SF Mono', Menlo, monospace",
    weights: [400, 500, 600, 700],
  },
];

const DEFAULT_FAMILY = FONT_FAMILIES[0];

export const findFontFamily = (id: string | undefined): FontFamily =>
  FONT_FAMILIES.find((family) => family.id === id) ?? DEFAULT_FAMILY;

/**
 * The nearest weight a family can actually draw.
 *
 * Switching from a family with a full range to a single-weight display face
 * has to land somewhere real, and the closest available weight is a better
 * answer than resetting to regular.
 */
export function nearestWeight(family: FontFamily, weight: number): number {
  return family.weights.reduce((best, candidate) =>
    Math.abs(candidate - weight) < Math.abs(best - weight) ? candidate : best,
  );
}

/* ------------------------------- Resolution ------------------------------ */

/** Resolved family names, keyed by CSS variable. Read once, then reused. */
const resolved = new Map<string, string>();

/**
 * The font stack to hand the canvas, with the loaded family first.
 *
 * `next/font` generates an obfuscated family name and exposes it on a CSS
 * variable, so the real name is only knowable at runtime, in the browser. The
 * fallback stays appended: until the file arrives the browser needs something
 * to draw, and after it arrives the first entry wins.
 */
export function fontStack(id: string | undefined): string {
  const family = findFontFamily(id);

  let name = resolved.get(family.variable);
  if (name === undefined) {
    name =
      typeof window === "undefined"
        ? ""
        : getComputedStyle(document.documentElement)
            .getPropertyValue(family.variable)
            .trim();
    // Cached even when empty: on the server there is nothing to resolve, and
    // in the browser the variable is set before any of this runs.
    resolved.set(family.variable, name);
  }

  return name ? `${name}, ${family.fallback}` : family.fallback;
}

/* -------------------------------- Loading -------------------------------- */

/** Faces already asked for, so a re-render doesn't re-request them. */
const requested = new Set<string>();

/**
 * Ask the browser to download a face, if it hasn't already.
 *
 * Drawing to a canvas does not trigger a font download the way rendering DOM
 * text does — the browser has no idea the 2D context is about to want it. So
 * anything that draws text has to request the file itself, or it will draw the
 * fallback forever.
 *
 * Fire and forget: the caller does not wait, because the canvas re-measures on
 * the document's `loadingdone` event instead. Failures are deliberately quiet
 * — the fallback is already legible on screen, and a font that will not load
 * is not a reason to fail an edit.
 */
export function requestFont(id: string | undefined, weight: number): void {
  if (typeof document === "undefined" || !document.fonts) return;

  const key = `${findFontFamily(id).variable}:${weight}`;
  if (requested.has(key)) return;
  requested.add(key);

  try {
    // The size is irrelevant to which file is fetched, but the shorthand is
    // not valid without one.
    void document.fonts.load(`${weight} 16px ${fontStack(id)}`);
  } catch {
    // An unparseable shorthand should not take the editor down with it.
  }
}
