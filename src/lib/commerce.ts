/**
 * Commerce boundary.
 *
 * Standalone, the editor has nowhere to send a sheet: Save is the local draft
 * and there is no cart. Embedded in a storefront, `src/embed.tsx` registers an
 * adapter that persists the design through the Shopify app proxy and hands the
 * resulting line items to the shop's own cart.
 *
 * Unlike the sibling designer-lab editor, state here lives in React context
 * rather than a module-level store, so the adapter is *given* the design it is
 * to act on instead of reading it back out. That keeps this module free of any
 * dependency on the provider tree.
 */

import type { SerializedDesign } from "@/lib/design-document";

export type CommerceResult = { ok: true } | { ok: false; error: string };

/** Everything the storefront needs about the sheet being sold. */
export interface DesignPayload {
  /** The document and its artwork, exactly as a draft or export would hold it. */
  design: SerializedDesign;
  /** Flattened PNG data URL shown on the cart line, or null if it failed. */
  preview: string | null;
}

export interface CommerceAdapter {
  /** Persist the sheet server-side. */
  saveDesign: (payload: DesignPayload) => Promise<CommerceResult>;
  /**
   * Persist, resolve the sheet size to a variant, add it to the cart.
   *
   * `quantity` is the number of sheets — the sheet size itself travels inside
   * `payload.design.document.sheetSize`, because that is where the editor
   * already keeps it.
   */
  addToCart: (
    payload: DesignPayload,
    quantity: number,
  ) => Promise<CommerceResult>;
}

let adapter: CommerceAdapter | null = null;

export function setCommerceAdapter(next: CommerceAdapter | null): void {
  adapter = next;
}

export function getCommerceAdapter(): CommerceAdapter | null {
  return adapter;
}

/** True when the editor is running inside a storefront. */
export const isEmbedded = (): boolean => adapter !== null;

/* ------------------------------ Design source ----------------------------- */

/**
 * How a caller reaches the design without holding editor context.
 *
 * The document lives in a React provider, but Save sits above it in the tree
 * and the adapter isn't a component at all. Rather than thread the snapshot
 * through both, the provider publishes it here once and the two read it back —
 * the same shape the sibling editor gets for free from its module-level store.
 *
 * Rendering the preview is the caller's job, because it needs a DOM canvas and
 * this module has to stay callable from anywhere.
 */
export type DesignSource = () => DesignPayload;

let source: DesignSource | null = null;

export function setDesignSource(next: DesignSource | null): void {
  source = next;
}

export function getDesignSource(): DesignSource | null {
  return source;
}
