"use client";

import * as React from "react";
import { Eye, Minus, Plus, ShoppingCart } from "lucide-react";

import { PrimaryButton } from "@/components/common/primary-button";
import { SheetPreviewDialog } from "@/components/editor/sheet-preview-dialog";
import { HeaderButton } from "@/components/header/header-button";
import {
  getCommerceAdapter,
  getDesignSource,
  isEmbedded,
  type DesignPayload,
} from "@/lib/commerce";
import { cn } from "@/lib/utils";

/** A single order can't be an accident or a stress test. */
const MIN_SHEETS = 1;
const MAX_SHEETS = 99;

/**
 * Preview, quantity and Add to cart, for the storefront build only.
 *
 * Renders nothing when no commerce adapter is installed, which is how the
 * standalone editor stays exactly as it was — the alternative, a cart button
 * that does nothing outside a shop, teaches people to distrust the header.
 *
 * Quantity is sheets, not artwork: the sheet size is the variant, so a run of
 * ten identical sheets is one cart line with a quantity, not ten lines.
 *
 * Preview shows the flattened sheet the cart line will carry, drawn when the
 * button is pressed — the picture of what is being bought, not of the sheet as
 * it was a minute ago.
 */
export function SheetCartActions() {
  const [quantity, setQuantity] = React.useState(MIN_SHEETS);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<DesignPayload | null>(null);

  // Read once: the adapter is installed before React mounts, and it never
  // changes for the life of the page.
  const [embedded] = React.useState(isEmbedded);
  if (!embedded) return null;

  const step = (by: number) =>
    setQuantity((current) =>
      Math.max(MIN_SHEETS, Math.min(MAX_SHEETS, current + by)),
    );

  const openPreview = () => {
    const source = getDesignSource();
    if (!source) return;
    setError(null);
    setPreview(source());
  };

  const handleAddToCart = async () => {
    const adapter = getCommerceAdapter();
    const source = getDesignSource();
    if (!adapter || !source) return;

    setBusy(true);
    setError(null);
    try {
      const result = await adapter.addToCart(source(), quantity);
      // On success the adapter navigates away, so there is no success state to
      // render — only a failure worth reporting.
      if (!result.ok) setError(result.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      {/* The dialog repeats the reason while it is open. */}
      {error && !preview ? (
        <p
          role="alert"
          className="hidden max-w-56 truncate text-[12px] text-destructive md:block"
          title={error}
        >
          {error}
        </p>
      ) : null}

      <HeaderButton
        icon={Eye}
        label="Preview"
        variant="ghost"
        onClick={openPreview}
        disabled={busy}
        labelClassName="hidden lg:inline"
      />

      <div className="flex items-center rounded-lg border border-border">
        <QuantityStep
          label="One fewer sheet"
          icon={Minus}
          onClick={() => step(-1)}
          disabled={quantity <= MIN_SHEETS || busy}
        />
        <span
          aria-live="polite"
          aria-label={`${quantity} sheets`}
          className="w-8 text-center text-[12.5px] font-semibold tabular-nums"
        >
          {quantity}
        </span>
        <QuantityStep
          label="One more sheet"
          icon={Plus}
          onClick={() => step(1)}
          disabled={quantity >= MAX_SHEETS || busy}
        />
      </div>

      <PrimaryButton
        icon={ShoppingCart}
        size="md"
        block={false}
        onClick={() => void handleAddToCart()}
        disabled={busy}
      >
        <span className="hidden sm:inline">
          {busy ? "Adding…" : "Add to cart"}
        </span>
      </PrimaryButton>

      <SheetPreviewDialog
        payload={preview}
        onClose={() => setPreview(null)}
        onAddToCart={() => void handleAddToCart()}
        adding={busy}
        error={error}
      />
    </div>
  );
}

function QuantityStep({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: typeof Minus;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-muted-foreground",
        "transition-colors outline-none hover:bg-muted hover:text-foreground",
        "focus-visible:ring-3 focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      <Icon className="size-4" strokeWidth={2} aria-hidden />
    </button>
  );
}
