import React from "react";
import ReactDOM from "react-dom/client";

import "./app/globals.css";
import { EditorShell } from "@/components/editor/editor-shell";
import { setCommerceAdapter, type DesignPayload } from "@/lib/commerce";
import {
  addItemsToCart,
  cartAddRequest,
  readBootstrap,
  resolveVariant,
  saveDesignRequest,
  toSheetSizes,
  type SheetBootstrap,
} from "@/lib/shopify";
import { setSheetSizes } from "@/lib/workspace";

/**
 * Storefront entry point.
 *
 * Mounted by the app-proxy page at /apps/designer/sheet-builder, which inlines
 * the merchant's product as `window.__SHEET_BOOTSTRAP__` and the asset base as
 * `window.__SHEET_ASSET_BASE__`.
 *
 * The standalone Next app never loads this file, which is what keeps the editor
 * usable — and buildable — with no Shopify anywhere in sight.
 *
 * Ordering matters: the merchant's sheet sizes are installed before anything
 * renders, because the size picker reads the list at render time.
 */

const MOUNT_ID = "sheet-builder-root";

function fail(container: HTMLElement, message: string) {
  container.innerHTML = "";
  const p = document.createElement("p");
  p.style.cssText =
    "display:flex;height:100%;align-items:center;justify-content:center;" +
    "font:500 15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:#b42318;padding:2rem;text-align:center";
  p.textContent = message;
  container.appendChild(p);
}

/**
 * Persist the sheet, and hand back the design id the cart line will carry.
 *
 * The chosen sheet size comes out of the document rather than being passed in,
 * because the document is the only thing that knows what the shopper actually
 * settled on.
 */
async function persist(bootstrap: SheetBootstrap, payload: DesignPayload) {
  const { design, preview } = payload;
  const sheetSize = design.document.sheetSize;
  const variant = resolveVariant(bootstrap.sheetSizes, sheetSize);

  const saved = await saveDesignRequest(bootstrap.endpoints.designs, {
    kind: "sheet",
    productId: bootstrap.product.id,
    variantId: variant?.variantId ?? null,
    // The whole document travels: a gang sheet is its layout, and the layout is
    // what has to be reproducible when the print file is generated.
    layers: { objects: design.document.objects, sheetSize },
    meta: {
      name: design.name,
      sheetSize,
      sheetLabel: variant?.label ?? sheetSize,
      objectCount: design.document.objects.length,
    },
    preview,
  });

  return { saved, variant };
}

function createAdapter(bootstrap: SheetBootstrap) {
  return {
    async saveDesign(payload: DesignPayload) {
      try {
        await persist(bootstrap, payload);
        return { ok: true as const };
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : "Could not save.",
        };
      }
    },

    async addToCart(payload: DesignPayload, quantity: number) {
      try {
        if (payload.design.document.objects.length === 0) {
          return {
            ok: false as const,
            error: "Add some artwork to the sheet before adding it to your cart.",
          };
        }

        const { saved, variant } = await persist(bootstrap, payload);
        // Refused rather than substituted: adding a sheet size the shopper did
        // not choose is worse than telling them this one can't be bought.
        if (!variant) {
          return {
            ok: false as const,
            error: "That sheet size isn't available. Pick another size.",
          };
        }
        if (!variant.available) {
          return {
            ok: false as const,
            error: `${variant.label} is sold out.`,
          };
        }

        const { items } = await cartAddRequest(bootstrap.endpoints.cartAdd, {
          productId: bootstrap.product.id,
          designId: saved.id,
          items: [
            {
              variantId: variant.variantId,
              quantity,
              sizeLabel: variant.label,
            },
          ],
        });

        await addItemsToCart(items);
        // Straight to checkout: the sheet is already configured, so the cart
        // page is a detour. The line stays in the cart if they back out.
        window.location.href = "/checkout";
        return { ok: true as const };
      } catch (error) {
        return {
          ok: false as const,
          error:
            error instanceof Error
              ? error.message
              : "Could not add this to your cart.",
        };
      }
    },
  };
}

function boot() {
  const container = document.getElementById(MOUNT_ID);
  if (!container) return;

  const bootstrap = readBootstrap();
  if (!bootstrap?.product) {
    fail(
      container,
      "The sheet builder couldn't load this product. Please go back and try again.",
    );
    return;
  }

  if (bootstrap.sheetSizes.length === 0) {
    fail(
      container,
      "This product has no sheet sizes set up yet, so there is nothing to order.",
    );
    return;
  }

  // Before render: the picker reads the list rather than subscribing to it.
  setSheetSizes(toSheetSizes(bootstrap.sheetSizes));
  setCommerceAdapter(createAdapter(bootstrap));

  container.innerHTML = "";
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <EditorShell />
    </React.StrictMode>,
  );
}

boot();
