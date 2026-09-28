"use client";

import { Dialog } from "@base-ui/react/dialog";
import { motion } from "framer-motion";
import { ShoppingCart, X } from "lucide-react";

import { PrimaryButton } from "@/components/common/primary-button";
import type { DesignPayload } from "@/lib/commerce";
import { cn } from "@/lib/utils";
import { sheetSizeLabel } from "@/lib/workspace";

export interface SheetPreviewDialogProps {
  /** The sheet as it stood when Preview was pressed. `null` while closed. */
  payload: DesignPayload | null;
  onClose: () => void;
  onAddToCart: () => void;
  adding: boolean;
  /** Why the last attempt to add it failed, if it did. */
  error: string | null;
}

/**
 * The whole sheet, flattened, before it goes in the cart.
 *
 * The same picture the cart line and the order carry, so what is checked here
 * is what the shop receives — on the checkerboard, because the sheet prints on
 * clear film and anything not covered by artwork is see-through.
 *
 * Add to cart is repeated here: a preview that looks right is the moment to
 * order, and sending someone back to the header to do it wastes the moment.
 */
export function SheetPreviewDialog({
  payload,
  onClose,
  onAddToCart,
  adding,
  error,
}: SheetPreviewDialogProps) {
  const objectCount =
    payload?.design.document.objects.filter((object) => !object.hidden).length ?? 0;
  const sheet = payload ? sheetSizeLabel(payload.design.document.sheetSize) : "";

  return (
    <Dialog.Root
      open={payload !== null}
      onOpenChange={(next) => {
        if (!next && !adding) onClose();
      }}
      modal
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px]",
            "transition-opacity duration-200 data-starting-style:opacity-0",
          )}
        />

        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(34rem,calc(100vw-2rem))]",
            "-translate-x-1/2 -translate-y-1/2 outline-none",
          )}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="overflow-hidden rounded-card border border-border bg-card shadow-panel"
          >
            <div className="relative px-5 pb-3 pt-5">
              <Dialog.Title className="text-[16px] font-bold tracking-tight text-foreground">
                Preview your sheet
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                {[
                  sheet,
                  objectCount === 1 ? "1 piece of artwork" : `${objectCount} pieces of artwork`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                . Checkered areas print clear.
              </Dialog.Description>

              <Dialog.Close
                aria-label="Close"
                disabled={adding}
                className={cn(
                  "absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-muted-foreground",
                  "transition-colors outline-none hover:bg-muted hover:text-foreground",
                  "focus-visible:ring-3 focus-visible:ring-ring/40",
                  "disabled:pointer-events-none disabled:opacity-40",
                )}
              >
                <X className="size-4" strokeWidth={2} aria-hidden />
              </Dialog.Close>
            </div>

            <div className="px-5">
              <div className="bg-checkerboard grid max-h-[min(60dvh,36rem)] place-items-center overflow-auto rounded-xl border border-border p-3">
                {objectCount === 0 ? (
                  <p className="py-10 text-center text-[12.5px] text-muted-foreground">
                    Nothing on the sheet yet. Add artwork to see it here.
                  </p>
                ) : payload?.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a locally rendered data URL.
                  <img
                    src={payload.preview}
                    alt={`Preview of the ${sheet || "gang"} sheet`}
                    className="max-h-[min(56dvh,34rem)] w-auto max-w-full object-contain shadow-soft"
                  />
                ) : (
                  <p className="py-10 text-center text-[12.5px] text-muted-foreground">
                    The preview couldn’t be drawn in this browser. The sheet is
                    unaffected.
                  </p>
                )}
              </div>

              {error ? (
                <p role="alert" className="mt-2 text-[12px] text-destructive">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex items-center gap-2 border-t border-border bg-canvas/50 px-5 py-3">
              <PrimaryButton
                variant="outline"
                size="md"
                onClick={onClose}
                disabled={adding}
              >
                Keep editing
              </PrimaryButton>
              <PrimaryButton
                icon={ShoppingCart}
                size="md"
                onClick={onAddToCart}
                disabled={adding || objectCount === 0}
              >
                {adding ? "Adding…" : "Add to cart"}
              </PrimaryButton>
            </div>
          </motion.div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
