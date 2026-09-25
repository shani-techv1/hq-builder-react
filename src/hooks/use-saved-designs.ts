"use client";

import * as React from "react";

import { useEditorState } from "@/components/editor/editor-state";
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
  | { kind: "save" }
  | { kind: "open" | "delete"; id: string };

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
  /** Save over the design on screen's entry, or as a new one. */
  save: (options: { asNew: boolean }) => Promise<boolean>;
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
 */
function useSavedDesignsState(): SavedDesigns {
  const { user, isAuthorized } = useAccount();
  const {
    canvas,
    library,
    preflight,
    snapshotDesign,
    restoreDesign,
    savedDesignId,
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
    if (inFlight.current || access !== "ready") return false;
    inFlight.current = true;
    setBusy(what);
    try {
      return await work();
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const hasWork = canvas.objects.length > 0 || library.assets.length > 0;

  const save = ({ asNew }: { asNew: boolean }) =>
    run({ kind: "save" }, async () => {
      if (!hasWork) {
        toast.warning("Nothing to save yet", "Add artwork to the sheet to save it.");
        return false;
      }

      // Warned as the save starts rather than after it lands, because it is
      // about the artwork and not about whether the save worked — and it never
      // stands in the way of one: an overlap can be the design, and artwork
      // under 300 DPI can still be fine for the job.
      const summary = summarisePreflight(preflight);
      if (summary) {
        toast.warning(
          "Check this sheet before printing",
          `${summary}. Open Checks to review.`,
        );
      }

      const startedAs = owner;
      const linked = asNew ? null : savedDesignId;
      // What this save holds. Edits made while it uploads come after it, and
      // leave the sheet unsaved once it lands.
      const held = version;

      try {
        const saved = await saveDesignToAccount({
          id: linked,
          productId,
          design: snapshotDesign(),
        });
        if (currentOwner.current !== startedAs) return false;

        linkSavedDesign(saved.id, held);
        updateList((rows) => [saved, ...rows.filter((row) => row.id !== saved.id)]);

        if (linked && saved.id !== linked) {
          toast.success(
            "Saved as a new design",
            "The saved copy had been deleted, so this was saved fresh.",
          );
        } else {
          toast.success(
            linked ? "Changes saved" : "Design saved",
            `“${saved.name}” is in My designs.`,
          );
        }
        return true;
      } catch (cause) {
        toast.error("Couldn’t save the design", messageOf(cause));
        return false;
      }
    });

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
