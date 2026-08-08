"use client";

import { Dialog } from "@base-ui/react/dialog";
import { motion } from "framer-motion";
import { History } from "lucide-react";

import { PrimaryButton } from "@/components/common/primary-button";
import { formatUploadDate } from "@/lib/assets";
import type { RestoredDesign } from "@/lib/design-document";
import { SHEET_SPEC, sheetSizeLabel } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export interface DraftRecoveryDialogProps {
  open: boolean;
  draft: RestoredDesign | null;
  onContinue: () => void;
  onStartNew: () => void;
}

/**
 * 14:05 → "2:05 PM". Written out rather than left to `Intl`, matching how the
 * rest of the app formats dates.
 */
function clockTime(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const suffix = hours < 12 ? "AM" : "PM";
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour}:${minutes} ${suffix}`;
}

/** Local calendar date as `YYYY-MM-DD`, which is what the app formats from. */
const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

/**
 * "Today at 2:43 PM" for something from this session, a date for anything
 * older — the relative form is what tells the user whether this is the work
 * they were doing five minutes ago or something they had long forgotten.
 */
function lastEdited(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

  const days = Math.round(
    (startOfDay(new Date()) - startOfDay(date)) / 86_400_000,
  );
  const time = clockTime(date);

  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Yesterday at ${time}`;
  return `${formatUploadDate(isoDate(date))} at ${time}`;
}

/**
 * Offered at startup when the last session left something behind.
 *
 * Modal on purpose: it decides which document the editor is about to hold, and
 * anything the user did while it was merely hovering would be thrown away by
 * whichever answer they gave. There is no dismiss — closing without choosing
 * would leave that question open.
 *
 * The summary is the whole point. "You have a draft" asks the user to guess;
 * the sheet, the object count and when they left it are what make Continue or
 * Start New an informed choice.
 */
export function DraftRecoveryDialog({
  open,
  draft,
  onContinue,
  onStartNew,
}: DraftRecoveryDialogProps) {
  const objectCount = draft?.document.objects.length ?? 0;
  const sheetLabel = draft ? sheetSizeLabel(draft.document.sheetSize) : "";
  const edited = draft ? lastEdited(draft.savedAt) : null;

  return (
    // Controlled with no `onOpenChange`, so Escape has nothing to close it
    // with, and pointer dismissal is off. Both exits are deliberate answers —
    // there is no safe default to dismiss to.
    <Dialog.Root open={open && draft !== null} modal disablePointerDismissal>
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
              <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary">
                <History className="size-5" strokeWidth={1.9} aria-hidden />
              </span>

              <Dialog.Title className="text-[16px] font-bold tracking-tight text-foreground">
                Continue your previous design?
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                We found an unfinished design from your last session.
              </Dialog.Description>
            </div>

            <dl className="mx-5 mb-4 overflow-hidden rounded-xl border border-border">
              {edited ? <SummaryRow label="Last edited" value={edited} /> : null}
              <SummaryRow label="Design" value={draft?.name ?? ""} />
              <SummaryRow label="Product" value={SHEET_SPEC.product} />
              {sheetLabel ? (
                <SummaryRow label="Sheet" value={sheetLabel} />
              ) : null}
              <SummaryRow
                label="Contents"
                value={objectCount === 1 ? "1 object" : `${objectCount} objects`}
                last
              />
            </dl>

            <div className="flex items-center gap-2 border-t border-border bg-canvas/50 px-5 py-3">
              <PrimaryButton variant="outline" size="md" onClick={onStartNew}>
                Start New
              </PrimaryButton>
              <PrimaryButton size="md" onClick={onContinue}>
                Continue
              </PrimaryButton>
            </div>
          </motion.div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SummaryRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2",
        !last && "border-b border-border",
      )}
    >
      <dt className="shrink-0 text-[11.5px] text-muted-foreground">{label}</dt>
      <dd
        className="min-w-0 truncate text-[11.5px] font-semibold text-foreground"
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
