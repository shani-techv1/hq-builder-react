"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  FolderOpen,
  LayoutGrid,
  LoaderCircle,
  LogIn,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

import { AccountDialog } from "@/components/account/account-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PrimaryButton } from "@/components/common/primary-button";
import { lastEdited } from "@/components/editor/draft-recovery-dialog";
import { HeaderButton } from "@/components/header/header-button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSavedDesigns, type SavedDesigns } from "@/hooks/use-saved-designs";
import type { SavedDesignSummary } from "@/lib/saved-designs";
import { cn } from "@/lib/utils";
import { sheetSizeLabel } from "@/lib/workspace";

/**
 * My designs: the account's saved designs, in the header on a desktop.
 *
 * A popover rather than a menu, because each row carries two actions — open
 * it, or delete it — and a menu item can't hold a second button that a
 * keyboard can reach.
 */
export function SavedDesignsMenu() {
  const saved = useSavedDesigns();
  const [open, setOpen] = React.useState(false);
  const flow = useSavedDesignsFlow(saved, () => setOpen(false));

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) saved.refresh();
        }}
      >
        <PopoverTrigger
          render={
            <HeaderButton icon={FolderOpen} label="My designs" variant="ghost" />
          }
        />
        <PopoverContent align="end" sideOffset={6} className="w-[22rem] gap-0 p-0">
          <div className="border-b border-border px-3 py-2.5">
            <PopoverTitle className="text-[13px] font-bold tracking-tight text-foreground">
              My designs
            </PopoverTitle>
          </div>
          <SavedDesignsPanel saved={saved} {...flow.handlers} />
        </PopoverContent>
      </Popover>

      {flow.dialogs}
    </>
  );
}

export interface SavedDesignsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The same list on a phone, opened from the toolbar's More menu: the header
 * there has no room left, and a popover needs something on screen to hang
 * from once that menu has closed.
 */
export function SavedDesignsDialog({ open, onOpenChange }: SavedDesignsDialogProps) {
  const saved = useSavedDesigns();
  const flow = useSavedDesignsFlow(saved, () => onOpenChange(false));
  const { refresh } = saved;

  // Loaded each time it opens — and again if signing in makes it reachable.
  React.useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
        <Dialog.Portal>
          <Dialog.Backdrop
            className={cn(
              "fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px]",
              "transition-opacity duration-200 data-starting-style:opacity-0",
            )}
          />
          <Dialog.Popup
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-[min(24rem,calc(100vw-2rem))]",
              "-translate-x-1/2 -translate-y-1/2 outline-none",
            )}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className="overflow-hidden rounded-card border border-border bg-card shadow-panel"
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <Dialog.Title className="text-[14px] font-bold tracking-tight text-foreground">
                  My designs
                </Dialog.Title>
                <Dialog.Close
                  aria-label="Close"
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <X className="size-4" aria-hidden />
                </Dialog.Close>
              </div>
              <SavedDesignsPanel saved={saved} {...flow.handlers} />
            </motion.div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {flow.dialogs}
    </>
  );
}

/* --------------------------------- Flow ---------------------------------- */

type Confirming =
  | { kind: "open"; design: SavedDesignSummary }
  | { kind: "delete"; design: SavedDesignSummary };

interface PanelHandlers {
  onChoose: (design: SavedDesignSummary) => void;
  onDelete: (design: SavedDesignSummary) => void;
  onSignIn: () => void;
}

/**
 * What choosing, deleting and signing in do, and the dialogs they raise.
 *
 * Kept outside whatever shows the list, because the list closes as a question
 * is asked and the question has to outlive it.
 *
 * Opening a design replaces the sheet, so it always asks first — the same
 * question every time, rather than one that appears only sometimes and leaves
 * the user unsure whether they were warned.
 */
function useSavedDesignsFlow(saved: SavedDesigns, close: () => void) {
  const [confirming, setConfirming] = React.useState<Confirming | null>(null);
  const [signingIn, setSigningIn] = React.useState(false);

  const handlers: PanelHandlers = {
    onChoose: (design) => {
      close();
      setConfirming({ kind: "open", design });
    },
    onDelete: (design) => {
      close();
      setConfirming({ kind: "delete", design });
    },
    onSignIn: () => {
      close();
      setSigningIn(true);
    },
  };

  const confirm = async () => {
    if (!confirming) return;
    if (confirming.kind === "open") await saved.open(confirming.design);
    else await saved.remove(confirming.design);
    // Closed whatever happened: a failure has its own toast, and the list is
    // one click away to try again.
    setConfirming(null);
  };

  const pending =
    confirming !== null &&
    saved.busy !== null &&
    saved.busy.kind === confirming.kind &&
    saved.busy.id === confirming.design.id;

  const name = confirming?.design.name ?? "";
  const isOpenDesign =
    confirming !== null && confirming.design.id === saved.currentId;

  const dialogs = (
    <>
      <ConfirmDialog
        open={confirming?.kind === "open"}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void confirm()}
        icon={TriangleAlert}
        title="Replace your current work?"
        description={
          isOpenDesign
            ? `This reopens “${name}” as it was last saved. Any changes you haven’t saved will be lost.`
            : `Opening “${name}” will replace your current work. Anything you haven’t saved will be lost.`
        }
        confirmLabel="Replace"
        pendingLabel="Opening…"
        pending={pending}
      />
      <ConfirmDialog
        open={confirming?.kind === "delete"}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void confirm()}
        icon={Trash2}
        title={`Delete “${name}”?`}
        description={
          isOpenDesign
            ? "It’s removed from My designs on every device. The design on your sheet stays as it is."
            : "It’s removed from My designs on every device. This can’t be undone."
        }
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending={pending}
        destructive
      />
      <AccountDialog open={signingIn} onOpenChange={setSigningIn} />
    </>
  );

  return { handlers, dialogs };
}

/* --------------------------------- Panel --------------------------------- */

function SavedDesignsPanel({
  saved,
  onChoose,
  onDelete,
  onSignIn,
}: { saved: SavedDesigns } & PanelHandlers) {
  if (saved.access !== "ready") {
    const again = saved.access === "sign-in-again";
    return (
      <div className="px-3 py-3">
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          {again
            ? "Your sign-in needs refreshing before your saved designs can load. Sign in again to see them."
            : "Sign in to save designs to your account and open them again on any device."}
        </p>
        <PrimaryButton icon={LogIn} size="md" className="mt-3" onClick={onSignIn}>
          {again ? "Sign in again" : "Sign in"}
        </PrimaryButton>
      </div>
    );
  }

  // Saving lives in the header, beside the cart; this is the list to open from.
  return (
    <div className="max-h-[min(30rem,70dvh)] overflow-y-auto p-1.5">
      <SavedDesignsList saved={saved} onChoose={onChoose} onDelete={onDelete} />
    </div>
  );
}

function SavedDesignsList({
  saved,
  onChoose,
  onDelete,
}: { saved: SavedDesigns } & Omit<PanelHandlers, "onSignIn">) {
  const { designs } = saved;

  // A list already on screen stays while it refreshes; only a first load, or a
  // first load that failed, replaces it.
  if (designs === null) {
    if (saved.loadError) {
      return (
        <div role="alert" className="px-1.5 py-3">
          <p className="text-[12px] text-destructive">{saved.loadError}</p>
          <button
            type="button"
            onClick={saved.refresh}
            className="mt-2 rounded-md text-[12px] font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            Try again
          </button>
        </div>
      );
    }
    return (
      <p
        aria-live="polite"
        className="flex items-center gap-2 px-1.5 py-3 text-[12px] text-muted-foreground"
      >
        <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2.4} aria-hidden />
        Loading your designs…
      </p>
    );
  }

  if (designs.length === 0) {
    return (
      <p className="px-1.5 py-3 text-[12px] leading-relaxed text-muted-foreground">
        No saved designs for this product yet. Save the one on your sheet to
        find it here next time.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {designs.map((design) => (
        <SavedDesignRow
          key={design.id}
          design={design}
          isCurrent={design.id === saved.currentId}
          opening={saved.busy?.kind === "open" && saved.busy.id === design.id}
          disabled={saved.busy !== null}
          onChoose={() => onChoose(design)}
          onDelete={() => onDelete(design)}
        />
      ))}
    </ul>
  );
}

/** "22″ × 24″ · 12 objects · Today at 2:43 PM", leaving out whatever is unknown. */
function describe(design: SavedDesignSummary): string {
  const parts = [
    sheetSizeLabel(design.sheetSize),
    design.objectCount === 1 ? "1 object" : `${design.objectCount} objects`,
    lastEdited(design.updatedAt),
  ];
  return parts.filter(Boolean).join(" · ");
}

function SavedDesignRow({
  design,
  isCurrent,
  opening,
  disabled,
  onChoose,
  onDelete,
}: {
  design: SavedDesignSummary;
  isCurrent: boolean;
  opening: boolean;
  disabled: boolean;
  onChoose: () => void;
  onDelete: () => void;
}) {
  const details = describe(design);

  return (
    <li className="flex items-center gap-1 rounded-lg transition-colors hover:bg-muted/60">
      <button
        type="button"
        onClick={onChoose}
        disabled={disabled}
        title={`Open “${design.name}”`}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left",
          "outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          "disabled:cursor-default",
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          {opening ? (
            <LoaderCircle className="size-4 animate-spin" strokeWidth={2.4} aria-hidden />
          ) : (
            <LayoutGrid className="size-4" strokeWidth={2} aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] font-semibold text-foreground">
              {design.name}
            </span>
            {isCurrent ? (
              <span className="shrink-0 rounded bg-primary-soft px-1.5 text-[10px] font-semibold text-primary">
                On sheet
              </span>
            ) : null}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {opening ? "Opening…" : details}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        aria-label={`Delete “${design.name}”`}
        title="Delete"
        className={cn(
          "mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground",
          "outline-none transition-colors hover:bg-destructive/10 hover:text-destructive",
          "focus-visible:ring-3 focus-visible:ring-ring/40",
          "disabled:pointer-events-none disabled:opacity-40",
        )}
      >
        <Trash2 className="size-4" strokeWidth={2} aria-hidden />
      </button>
    </li>
  );
}
