"use client";

import * as React from "react";
import { ShoppingCart } from "lucide-react";

import { PrimaryButton } from "@/components/common/primary-button";
import { useEditorState } from "@/components/editor/editor-state";
import {
  MIN_SHEETS,
  QuantityStepper,
} from "@/components/editor/quantity-stepper";
import { SheetPreviewDialog } from "@/components/editor/sheet-preview-dialog";
import {
  getCommerceAdapter,
  getDesignSource,
  isEmbedded,
  type DesignPayload,
} from "@/lib/commerce";
import { summarisePreflight } from "@/lib/preflight";

/**
 * Quantity and Add to cart, for the storefront build only.
 *
 * Renders nothing when no commerce adapter is installed, which is how the
 * standalone editor stays exactly as it was — the alternative, a cart button
 * that does nothing outside a shop, teaches people to distrust the header.
 *
 * Quantity is sheets, not artwork: the sheet size is the variant, so a run of
 * ten identical sheets is one cart line with a quantity, not ten lines.
 *
 * Add to cart doesn't add straight away. It shows the sheet first — the
 * flattened picture the order will carry, drawn as the button is pressed — so
 * the shopper sees what they are buying and can go back to change it. What
 * goes in the cart is exactly the sheet that was shown.
 */
export function SheetCartActions() {
  const { preflight } = useEditorState();
  const [quantity, setQuantity] = React.useState(MIN_SHEETS);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [review, setReview] = React.useState<DesignPayload | null>(null);

  // Read once: the adapter is installed before React mounts, and it never
  // changes for the life of the page.
  const [embedded] = React.useState(isEmbedded);
  if (!embedded) return null;

  const openReview = () => {
    const source = getDesignSource();
    if (!source) return;
    setError(null);
    setReview(source());
  };

  const handleAddToCart = async () => {
    const adapter = getCommerceAdapter();
    if (!adapter || !review) return;

    setBusy(true);
    setError(null);
    try {
      const result = await adapter.addToCart(review, quantity);
      // On success the adapter navigates away, so there is no success state to
      // render — only a failure worth reporting, which the review shows.
      if (!result.ok) setError(result.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <QuantityStepper value={quantity} onChange={setQuantity} disabled={busy} />

      <PrimaryButton
        icon={ShoppingCart}
        size="md"
        block={false}
        onClick={openReview}
        disabled={busy}
        aria-label="Add to cart"
      >
        <span className="hidden sm:inline">
          {busy ? "Adding…" : "Add to cart"}
        </span>
      </PrimaryButton>

      <SheetPreviewDialog
        payload={review}
        warning={review ? summarisePreflight(preflight) : null}
        quantity={quantity}
        onQuantityChange={setQuantity}
        onClose={() => setReview(null)}
        onAddToCart={() => void handleAddToCart()}
        adding={busy}
        error={error}
      />
    </div>
  );
}
