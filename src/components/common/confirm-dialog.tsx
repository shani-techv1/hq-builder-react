"use client";

import { Dialog } from "@base-ui/react/dialog";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { PrimaryButton } from "@/components/common/primary-button";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  /** Asked to close — ignored while `pending`, so a running action can't be walked away from. */
  onCancel: () => void;
  onConfirm: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  confirmLabel: string;
  /** Shown on the confirm button while the action runs. */
  pendingLabel: string;
  pending?: boolean;
  /** For actions that delete something. */
  destructive?: boolean;
}

/**
 * A yes-or-no question before something that can't be taken back.
 *
 * Styled like the draft recovery dialog. Unlike that one, this can be
 * dismissed: cancelling is always a safe answer here, so Escape and the
 * backdrop mean "no". While the action runs, the dialog stays open and
 * shows it — the answer has been given, and closing now would hide whether it
 * worked.
 */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  icon: Icon,
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending = false,
  destructive = false,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
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
            "fixed left-1/2 top-1/2 z-50 w-[min(26rem,calc(100vw-2rem))]",
            "-translate-x-1/2 -translate-y-1/2 outline-none",
          )}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="overflow-hidden rounded-card border border-border bg-card shadow-panel"
          >
            <div className="px-5 pb-4 pt-5">
              <span
                className={cn(
                  "mb-3 grid size-11 place-items-center rounded-2xl",
                  destructive
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary-soft text-primary",
                )}
              >
                <Icon className="size-5" strokeWidth={1.9} aria-hidden />
              </span>

              <Dialog.Title className="text-[16px] font-bold tracking-tight text-foreground">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                {description}
              </Dialog.Description>
            </div>

            <div className="flex items-center gap-2 border-t border-border bg-canvas/50 px-5 py-3">
              <PrimaryButton
                variant="outline"
                size="md"
                onClick={onCancel}
                disabled={pending}
              >
                Cancel
              </PrimaryButton>
              <PrimaryButton
                size="md"
                onClick={onConfirm}
                disabled={pending}
                className={cn(
                  destructive &&
                    "bg-destructive text-white shadow-none hover:bg-destructive/90",
                )}
              >
                {pending ? pendingLabel : confirmLabel}
              </PrimaryButton>
            </div>
          </motion.div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
