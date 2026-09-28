"use client";

import * as React from "react";

import {
  useEditorState,
  type DesignVersion,
} from "@/components/editor/editor-state";
import { toast } from "@/components/ui/toast";
import { useAccount } from "@/hooks/use-account";
import { AuthError } from "@/lib/auth";
import { summarisePreflight } from "@/lib/preflight";
import {
  deleteSavedDesign,
  listSavedDesigns,
  openSavedDesign,
  saveDesignToAccount,
  type SavedDesignSummary,
} from "@/lib/saved-designs";
import { getSheetProduct } from "@/lib/workspace";

/**
 * Whether My designs can be reached, and if not, why not.
 *
 * `sign-in-again` is someone signed in without a token the service accepts —
 * a session remembered from before tokens, or one the service has refused.
 */
export type SavedDesignsAccess = "signed-out" | "sign-in-again" | "ready";

/** What is in flight. One thing at a time: each of these replaces the sheet or the list. */
export type SavedDesignsBusy =
  /** `auto` for the background autosave, which the header shows and the buttons don't. */
  | { kind: "save"; auto: boolean }
  | { kind: "open" | "delete"; id: string };

/**
 * Where a save goes: over the saved design on screen (a new entry when there
 * is none), into a new entry, or over another of the account's saved designs,
 * which then holds this sheet.
 */
export type SaveTarget = "current" | "new" | { id: string };

export interface SaveOptions {
  to: SaveTarget;
  /** The name to save under. The design on screen takes it too. */
  name?: string;
}

/**
 * How often a saved design on screen is saved again while it has changes.
 *
 * Only a design already in My designs: saving one for the first time asks for
 * a name and a place, and nothing can answer that in the background. Until
 * then the sheet is kept by the draft in this browser.
 */
const AUTOSAVE_INTERVAL_MS = 5000;

export interface SavedDesigns {
  access: SavedDesignsAccess;
  /** `null` until the list has loaded for this account. */
  designs: SavedDesignSummary[] | null;
  loading: boolean;
  /** Why the last load failed, until the next one starts. */
  loadError: string | null;
  /** Load the list. Called each time it is shown, so it is never stale. */
  refresh: () => void;
  /** The saved design on screen, if it is one. */
  currentId: string | null;
  /** Whether there is anything on the sheet to save. */
  hasWork: boolean;
  busy: SavedDesignsBusy | null;
  save: (options: SaveOptions) => Promise<boolean>;
  /** Replace what is on screen with a saved design. Doesn't ask — the caller does. */
  open: (design: SavedDesignSummary) => Promise<boolean>;
  remove: (design: SavedDesignSummary) => Promise<boolean>;
}

const messageOf = (cause: unknown): string =>
  cause instanceof Error && cause.message
    ? cause.message
    : "Something went wrong. Please try again.";

const isMissing = (cause: unknown) =>
  cause instanceof AuthError && cause.code === "NOT_FOUND";

const SavedDesignsContext = React.createContext<SavedDesigns | null>(null);

/**
 * One set of saved designs for the whole editor.
 *
 * The header's save buttons, My designs and the phone's More menu all act on
 * the same list and the same operation in flight. Separate copies could save
 * and open at once, each believing it had the sheet to itself.
 */
export function SavedDesignsProvider({ children }: { children: React.ReactNode }) {
  const value = useSavedDesignsState();
  return React.createElement(SavedDesignsContext.Provider, { value }, children);
}

export function useSavedDesigns(): SavedDesigns {
  const context = React.useContext(SavedDesignsContext);
  if (!context) {
    throw new Error("useSavedDesigns must be used inside a SavedDesignsProvider");
  }
  return context;
}

/**
 * The signed-in account's saved designs for this product, and what can be
 * done with them.
 *
 * The list is kept against the account it was loaded for, and read back only
 * for that account: switching accounts shows nothing rather than, for a render,
 * the last person's designs. Results that land after the account has changed
 * are dropped for the same reason.
 *
 * Failures are reported here, as toasts, because the menu that started them has
 * usually closed by the time they arrive.
 *
 * A design that is already in My designs is saved again every few seconds
 * while it has changes, so "Saved" in the header stays true without anyone
 * pressing a button.
 */
function useSavedDesignsState(): SavedDesigns {
  const { user, isAuthorized } = useAccount();
  const {
    preflight,
    hasWork,
    recovery,
    snapshotDesign,
    restoreDesign,
    setDesignName,
    savedDesignId,
    matchesSavedDesign,
    version,
    linkSavedDesign,
    unlinkSavedDesign,
  } = useEditorState();

  const owner = user?.id ?? null;
  const productId = getSheetProduct().id;
  const access: SavedDesignsAccess = !user
    ? "signed-out"
    : isAuthorized
      ? "ready"
      : "sign-in-again";

  const [list, setList] = React.useState<{
    owner: string;
    designs: SavedDesignSummary[];
  } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<SavedDesignsBusy | null>(null);

  const designs = list && list.owner === owner ? list.designs : null;

  /** The account as of the latest render, for results that outlive the one that started them. */
  const currentOwner = React.useRef(owner);
  React.useEffect(() => {
    currentOwner.current = owner;
  }, [owner]);

  /** Set synchronously, so a double click can't start two operations. */
  const inFlight = React.useRef(false);
  /** Only the newest load may write the list. */
  const loadRun = React.useRef(0);
  /**
   * The autosave running now. Something the user asked for waits for it to
   * finish rather than being turned away because it happened to be running.
   */
  const autosaving = React.useRef<Promise<boolean> | null>(null);
  /**
   * The version an autosave last failed on. Not retried until the design
   * changes, so a save the service keeps refusing isn't sent every few seconds.
   */
  const failedAutosave = React.useRef<DesignVersion | null>(null);

  const refresh = React.useCallback(() => {
    if (!owner || !isAuthorized) return;
    const run = ++loadRun.current;
    setLoading(true);
    setLoadError(null);

    listSavedDesigns(productId).then(
      (rows) => {
        if (run !== loadRun.current) return;
        setList({ owner, designs: rows });
        setLoading(false);
      },
      (cause: unknown) => {
        if (run !== loadRun.current) return;
        setLoadError(messageOf(cause));
        setLoading(false);
      },
    );
  }, [owner, isAuthorized, productId]);

  /** Change the loaded list, if it is still this account's. */
  const updateList = (
    change: (designs: SavedDesignSummary[]) => SavedDesignSummary[],
  ) =>
    setList((current) =>
      current && current.owner === owner
        ? { owner: current.owner, designs: change(current.designs) }
        : current,
    );

  /** Run one operation, unless another is already running. */
  const run = async (
    what: SavedDesignsBusy,
    work: () => Promise<boolean>,
  ): Promise<boolean> => {
    const auto = what.kind === "save" && what.auto;
    if (!auto && autosaving.current) await autosaving.current;
    if (inFlight.current || access !== "ready") return false;
    inFlight.current = true;
    setBusy(what);

    const task = (async () => {
      try {
        return await work();
      } finally {
        inFlight.current = false;
        setBusy(null);
      }
    })();

    if (auto) {
      autosaving.current = task;
      void task.finally(() => {
        if (autosaving.current === task) autosaving.current = null;
      });
    }
    return task;
  };

  const performSave = ({ to, name }: SaveOptions, auto: boolean) =>
    run({ kind: "save", auto }, async () => {
      if (!hasWork) {
        if (!auto) {
          toast.warning("Nothing to save yet", "Add artwork to the sheet to save it.");
        }
        return false;
      }

      // Warned as the save starts rather than after it lands, because it is
      // about the artwork and not about whether the save worked — and it never
      // stands in the way of one: an overlap can be the design, and artwork
      // under 300 DPI can still be fine for the job. Not on every autosave,
      // which would repeat it every few seconds.
      const summary = auto ? null : summarisePreflight(preflight);
      if (summary) {
        toast.warning(
          "Check this sheet before printing",
          `${summary}. Open Checks to review.`,
        );
      }

      const startedAs = owner;
      const target =
        to === "new" ? null : to === "current" ? savedDesignId : to.id;
      const snapshot = snapshotDesign();
      // What this save holds. Edits made while it uploads come after it, and
      // leave the sheet unsaved once it lands.
      const held = name ? { ...version, name } : version;
      if (name) setDesignName(name);

      try {
        const saved = await saveDesignToAccount({
          id: target,
          productId,
          design: name ? { ...snapshot, name } : snapshot,
        });
        if (currentOwner.current !== startedAs) return false;

        linkSavedDesign(saved.id, held);
        updateList((rows) => [saved, ...rows.filter((row) => row.id !== saved.id)]);
        failedAutosave.current = null;

        if (target && saved.id !== target) {
          toast.success(
            "Saved as a new design",
            "The saved copy had been deleted, so this was saved fresh.",
          );
        } else if (!auto) {
          toast.success(
            !target
              ? "Design saved"
              : to === "current"
                ? "Changes saved"
                : "Design replaced",
            `“${saved.name}” is in My designs.`,
          );
        }
        return true;
      } catch (cause) {
        if (!auto) {
          toast.error("Couldn’t save the design", messageOf(cause));
        } else if (failedAutosave.current === null) {
          // Once per run of failures, not once every few seconds.
          toast.error("Couldn’t save your changes", messageOf(cause));
        }
        if (auto) failedAutosave.current = held;
        return false;
      }
    });

  const save = (options: SaveOptions) => performSave(options, false);

  /* ------------------------------ Autosave ------------------------------ */

  /** Whether an autosave is due now — read by the timer, refreshed each render. */
  const autosaveIfDue = React.useRef<() => void>(() => {});
  React.useEffect(() => {
    autosaveIfDue.current = () => {
      if (access !== "ready" || !savedDesignId || matchesSavedDesign) return;
      // Nothing to save, or something else — a save, an open, the draft
      // prompt — has the sheet.
      if (!hasWork || inFlight.current || recovery.status !== "ready") return;
      if (failedAutosave.current === version) return;
      void performSave({ to: "current" }, true);
    };
  });

  React.useEffect(() => {
    const timer = window.setInterval(
      () => autosaveIfDue.current(),
      AUTOSAVE_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  const open = (design: SavedDesignSummary) =>
    run({ kind: "open", id: design.id }, async () => {
      const startedAs = owner;
      try {
        const restored = await openSavedDesign(design.id);
        if (currentOwner.current !== startedAs) return false;
        restoreDesign(restored);
        return true;
      } catch (cause) {
        if (isMissing(cause)) {
          updateList((rows) => rows.filter((row) => row.id !== design.id));
          toast.error(
            "That design no longer exists",
            "It may have been deleted on another device.",
          );
        } else {
          toast.error("Couldn’t open the design", messageOf(cause));
        }
        return false;
      }
    });

  const remove = (design: SavedDesignSummary) =>
    run({ kind: "delete", id: design.id }, async () => {
      try {
        await deleteSavedDesign(design.id);
        updateList((rows) => rows.filter((row) => row.id !== design.id));
        // The sheet stays; it just isn't that saved design any more, so the
        // next save makes a new one rather than failing to find this.
        unlinkSavedDesign(design.id);
        toast.success("Design deleted", `“${design.name}” was removed from My designs.`);
        return true;
      } catch (cause) {
        toast.error("Couldn’t delete the design", messageOf(cause));
        return false;
      }
    });

  return {
    access,
    designs,
    loading,
    loadError,
    refresh,
    currentId: savedDesignId,
    hasWork,
    busy,
    save,
    open,
    remove,
  };
}
