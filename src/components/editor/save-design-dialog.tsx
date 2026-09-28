"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { motion } from "framer-motion";
import { CopyPlus, FolderInput, LoaderCircle, Save, X } from "lucide-react";

import { PrimaryButton } from "@/components/common/primary-button";
import { useEditorState } from "@/components/editor/editor-state";
import { describeSavedDesign } from "@/components/editor/saved-designs-menu";
import { Input } from "@/components/ui/input";
import {
  useSavedDesigns,
  type SaveTarget,
  type SavedDesigns,
} from "@/hooks/use-saved-designs";
import { DEFAULT_DESIGN_NAME } from "@/lib/design-document";
import { cn } from "@/lib/utils";

/**
 * Which save this is.
 *
 * `first` is a design that isn't in My designs yet: it is named, and then put
 * either in a new entry or in place of one saved before. `copy` is "Save as
 * new" on a design that is already there, which only needs its name.
 */
export type SaveDesignMode = "first" | "copy";

type Step = "name" | "place";

/** The service's limit on a saved design's name. */
const MAX_NAME_LENGTH = 80;

export interface SaveDesignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: SaveDesignMode;
}

/**
 * Saving to My designs under a name the user chose.
 *
 * The shell only knows whether it is open; the form inside unmounts with it,
 * so every save starts from the design's current name rather than whatever was
 * typed the last time the dialog was dismissed.
 *
 * It can't be dismissed while the save is running: the answer has been given,
 * and closing now would hide whether it worked.
 */
export function SaveDesignDialog({ open, onOpenChange, mode }: SaveDesignDialogProps) {
  const saved = useSavedDesigns();
  const saving = saved.busy?.kind === "save" && !saved.busy.auto;
  const nameField = React.useRef<HTMLInputElement>(null);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && saving) return;
        onOpenChange(next);
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
          initialFocus={nameField}
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
            <SaveDesignForm
              mode={mode}
              saved={saved}
              saving={saving}
              nameFieldRef={nameField}
              onDone={() => onOpenChange(false)}
            />
          </motion.div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SaveDesignForm({
  mode,
  saved,
  saving,
  nameFieldRef,
  onDone,
}: {
  mode: SaveDesignMode;
  saved: SavedDesigns;
  saving: boolean;
  nameFieldRef: React.RefObject<HTMLInputElement | null>;
  onDone: () => void;
}) {
  const { version } = useEditorState();
  const { designs, refresh } = saved;

  const [step, setStep] = React.useState<Step>("name");
  // The placeholder name isn't one anybody chose, so a first save starts blank.
  const [name, setName] = React.useState(() =>
    mode === "first" && version.name === DEFAULT_DESIGN_NAME ? "" : version.name,
  );
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<SaveTarget>("new");

  const errorId = React.useId();

  // The designs it could go in place of, loaded as the question is asked so
  // they are there by the time it is answered.
  React.useEffect(() => {
    if (mode === "first") refresh();
  }, [mode, refresh]);

  const save = async (to: SaveTarget) => {
    if (await saved.save({ to, name: name.trim() })) onDone();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    if (step === "place") {
      void save(target);
      return;
    }

    if (!name.trim()) {
      setNameError("Give the design a name.");
      nameFieldRef.current?.focus();
      return;
    }

    // "Save as new" has already said where it goes, and an account with
    // nothing saved has nowhere else for it to go.
    if (mode === "copy" || designs?.length === 0) {
      void save("new");
      return;
    }
    setStep("place");
  };

  const placing = step === "place";
  const replacing = placing && target !== "new";
  const Icon = mode === "copy" ? CopyPlus : placing ? FolderInput : Save;

  const title = placing
    ? "Save as new, or replace one?"
    : mode === "copy"
      ? "Save as a new design"
      : "Name your design";

  const description = placing
    ? `Keep “${name.trim()}” as a new design, or put it in place of one you’ve saved before.`
    : mode === "copy"
      ? "The copy gets its own place in My designs. The design you opened stays as it was."
      : "Give this sheet a name so you can find it in My designs.";

  const submitLabel = saving
    ? "Saving…"
    : placing
      ? replacing
        ? "Replace design"
        : "Save design"
      : mode === "copy"
        ? "Save copy"
        : "Continue";

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="relative px-5 pb-4 pt-5">
        <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Icon className="size-5" strokeWidth={1.9} aria-hidden />
        </span>

        <Dialog.Title className="text-[16px] font-bold tracking-tight text-foreground">
          {title}
        </Dialog.Title>
        <Dialog.Description className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          {description}
        </Dialog.Description>

        <Dialog.Close
          aria-label="Close"
          disabled={saving}
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
        {placing ? (
          <PlaceChoice
            saved={saved}
            target={target}
            onTargetChange={setTarget}
            disabled={saving}
          />
        ) : (
          <div className="space-y-1.5">
            <label
              htmlFor={`${errorId}-name`}
              className="block text-[12px] font-semibold text-foreground"
            >
              Design name
            </label>
            <Input
              id={`${errorId}-name`}
              ref={nameFieldRef}
              value={name}
              maxLength={MAX_NAME_LENGTH}
              placeholder="e.g. Summer tees, run 2"
              autoComplete="off"
              disabled={saving}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? errorId : undefined}
              className="h-10 rounded-xl px-3 text-[13px]"
              onChange={(event) => {
                setName(event.target.value);
                setNameError(null);
              }}
            />
            {nameError ? (
              <p id={errorId} className="text-[11.5px] font-medium text-destructive">
                {nameError}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border bg-canvas/50 px-5 py-3">
        {placing ? (
          <PrimaryButton
            variant="outline"
            size="md"
            onClick={() => setStep("name")}
            disabled={saving}
          >
            Back
          </PrimaryButton>
        ) : (
          <PrimaryButton
            variant="outline"
            size="md"
            onClick={onDone}
            disabled={saving}
          >
            Cancel
          </PrimaryButton>
        )}
        <PrimaryButton type="submit" size="md" disabled={saving}>
          {submitLabel}
        </PrimaryButton>
      </div>
    </form>
  );
}

/**
 * The second question: a new entry, or one of the account's saved designs.
 *
 * Radio buttons rather than a list of actions, so choosing is reversible until
 * the button is pressed — replacing a design is the one answer here that can't
 * be undone.
 */
function PlaceChoice({
  saved,
  target,
  onTargetChange,
  disabled,
}: {
  saved: SavedDesigns;
  target: SaveTarget;
  onTargetChange: (target: SaveTarget) => void;
  disabled: boolean;
}) {
  const { designs } = saved;
  const selectedId = typeof target === "object" ? target.id : null;

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="sr-only">Where to save the design</legend>

      <div className="space-y-1.5">
        <Choice
          checked={target === "new"}
          onSelect={() => onTargetChange("new")}
          title="New design"
          detail="Adds it to My designs."
        />

        {designs === null ? (
          saved.loadError ? (
            <div role="alert" className="px-1 py-2">
              <p className="text-[12px] text-destructive">{saved.loadError}</p>
              <button
                type="button"
                onClick={saved.refresh}
                className="mt-1 rounded-md text-[12px] font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                Try again
              </button>
            </div>
          ) : (
            <p
              aria-live="polite"
              className="flex items-center gap-2 px-1 py-2 text-[12px] text-muted-foreground"
            >
              <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2.4} aria-hidden />
              Loading your designs…
            </p>
          )
        ) : designs.length > 0 ? (
          <>
            <p className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Or replace a saved design
            </p>
            <div className="max-h-[min(16rem,40dvh)] space-y-1.5 overflow-y-auto">
              {designs.map((design) => (
                <Choice
                  key={design.id}
                  checked={selectedId === design.id}
                  onSelect={() => onTargetChange({ id: design.id })}
                  title={design.name}
                  detail={describeSavedDesign(design)}
                  destructive
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </fieldset>
  );
}

function Choice({
  checked,
  onSelect,
  title,
  detail,
  destructive = false,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
  /** Choosing it overwrites something. */
  destructive?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
        "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
        checked
          ? destructive
            ? "border-destructive/50 bg-destructive/5"
            : "border-primary/50 bg-primary-softer"
          : "border-border hover:bg-muted/60",
      )}
    >
      <input
        type="radio"
        name="save-target"
        checked={checked}
        onChange={onSelect}
        className="size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-foreground">
          {title}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {checked && destructive ? "Replaces what’s saved there." : detail}
        </span>
      </span>
    </label>
  );
}
