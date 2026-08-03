/**
 * Whether artwork will still be visible against what it is printed on.
 *
 * The sheet prints on clear film, so a text colour is only ever legible
 * relative to the garment behind it — black type is perfect on white cotton
 * and gone entirely on a black tee. The editor can't know the garment, but it
 * knows what the user is previewing against, and that is enough to warn them
 * before the order goes out rather than after.
 */

/** `#1e88ff` → `[30, 136, 255]`. `null` for anything that isn't a 6-digit hex. */
function toRgb(colour: string): [number, number, number] | null {
  const hex = colour.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;

  return [0, 2, 4].map((offset) =>
    parseInt(hex.slice(offset, offset + 2), 16),
  ) as [number, number, number];
}

/**
 * WCAG relative luminance.
 *
 * The channel values are linearised first — sRGB is gamma-encoded, and
 * averaging the raw bytes would rate mid greens and mid blues as equally
 * bright, which they are not.
 */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928
      ? scaled / 12.92
      : Math.pow((scaled + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * WCAG contrast ratio between two colours, from 1 (identical) to 21
 * (black on white). Returns 21 for anything unparseable, so a colour this
 * can't read never produces a warning it can't justify.
 */
export function contrastRatio(a: string, b: string): number {
  const first = toRgb(a);
  const second = toRgb(b);
  if (!first || !second) return 21;

  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Below this, type is hard to read against its background.
 *
 * WCAG's threshold for large text. Artwork on a gang sheet is large by nature
 * — the stricter 4.5 figure is for body copy on a screen and would flag
 * perfectly printable combinations.
 */
export const MIN_TEXT_CONTRAST = 3;

export const hasReadableContrast = (text: string, background: string): boolean =>
  contrastRatio(text, background) >= MIN_TEXT_CONTRAST;

/** The two colours worth falling back to; one of them always contrasts. */
const INK = "#1f2937";
const PAPER = "#ffffff";

/**
 * The better of ink and paper against `background`.
 *
 * Deliberately only two candidates. Picking the nearest *readable* colour from
 * the whole palette would change the design's hue to fix a legibility problem,
 * which is a bigger decision than the user asked for.
 */
export function readableTextColour(background: string): string {
  return contrastRatio(PAPER, background) >= contrastRatio(INK, background)
    ? PAPER
    : INK;
}
