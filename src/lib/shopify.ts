/**
 * The storefront's side of the sheet builder.
 *
 * Only reachable from the embed build: the standalone Next app never has a
 * bootstrap on `window`, so nothing here runs there. Mirrors the equivalent
 * module in the sibling designer-lab project, deliberately — the two editors
 * talk to the same app-proxy endpoints and should fail the same way.
 */

import type { SheetSize } from "@/lib/workspace";

/** One sellable sheet size: a Shopify variant, described in sheet terms. */
export interface SheetVariant {
  /** `"22x24"` — parsed from the variant so `sheetInches` can read it. */
  id: string;
  variantId: string;
  label: string;
  description: string;
  price: number;
  available: boolean;
}

export interface SheetBootstrap {
  shop: string;
  customerId: string | null;
  product: {
    id: string;
    handle: string;
    name: string;
    currency: string;
  };
  /** The sizes this product actually sells, one variant each. */
  sheetSizes: SheetVariant[];
  initialVariantId: string | null;
  endpoints: { designs: string; cartAdd: string };
}

/** Present only when the bundle is running inside the storefront page. */
export function readBootstrap(): SheetBootstrap | null {
  if (typeof window === "undefined") return null;
  const raw = (window as unknown as Record<string, unknown>).__SHEET_BOOTSTRAP__;
  return raw && typeof raw === "object" ? (raw as SheetBootstrap) : null;
}

/** The editor's own preset shape, so the picker can render merchant sizes. */
export const toSheetSizes = (variants: SheetVariant[]): SheetSize[] =>
  variants.map((variant) => ({
    id: variant.id,
    label: variant.label,
    description: variant.description,
  }));

/**
 * The variant a chosen sheet size resolves to.
 *
 * Returns undefined rather than falling back to the first variant: adding a
 * sheet the shopper did not choose is worse than telling them the size is
 * unavailable.
 */
export const resolveVariant = (
  variants: SheetVariant[],
  sheetSizeId: string,
): SheetVariant | undefined =>
  variants.find((variant) => variant.id === sheetSizeId);

/* -------------------------------- Requests -------------------------------- */

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (data as { error?: string }).error ?? "Something went wrong. Try again.",
    );
  }
  return data as T;
}

export interface SaveSheetPayload {
  /** Discriminates this from a garment design in the shared designs table. */
  kind: "sheet";
  productId: string;
  variantId: string | null;
  /** The document and its artwork, as the editor serialises them. */
  layers: unknown;
  meta: Record<string, unknown>;
  preview: string | null;
}

export const saveDesignRequest = (endpoint: string, payload: SaveSheetPayload) =>
  postJson<{ id: string; previewUrl: string | null }>(endpoint, payload);

export interface CartItem {
  id: number;
  quantity: number;
  properties: Record<string, string>;
}

export const cartAddRequest = (
  endpoint: string,
  payload: {
    productId: string;
    designId: string;
    /** A gang sheet is one line: the chosen size, times how many were ordered. */
    items: Array<{ variantId: string; quantity: number; sizeLabel: string }>;
  },
) => postJson<{ items: CartItem[] }>(endpoint, payload);

/** Hand the server-built line items to Shopify's own cart (same origin). */
export async function addItemsToCart(items: CartItem[]): Promise<void> {
  const response = await fetch("/cart/add.js", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      (data as { description?: string; message?: string }).description ??
        (data as { message?: string }).message ??
        "Shopify rejected that cart line.",
    );
  }
}
