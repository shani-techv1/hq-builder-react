"use client";

import * as React from "react";

import type { Asset } from "@/lib/assets";
import {
  deserializeDocument,
  serializeDocument,
  type DesignDocument,
  type RestoredDesign,
} from "@/lib/design-document";
import {
  clearDraft,
  draftKey,
  loadDraft,
  saveDraft,
  type DraftScope,
} from "@/lib/draft-storage";
import { getAssetFile } from "@/lib/image-cache";

/**
 * How long the editor waits after a change before writing.
 *
 * Long enough that a slider drag or a run of typing is one write rather than
 * fifty, short enough that a tab closed on impulse loses nothing worth having.
 */
const AUTOSAVE_DELAY_MS = 1000;

/**
 * Where the current scope's lookup has got to.
 *
 * `checking` exists so autosave cannot run before the question is answered —
 * writing the empty document the editor starts with would destroy the draft
 * the user is about to be offered.
 */
export type RecoveryStatus = "checking" | "prompting" | "ready";

/**
 * Why a draft is on offer.
 *
 * `resume` is the ordinary case: the sheet is empty — the editor has just
 * opened, or an account was entered with nothing on screen — and a design was
 * waiting. `sign-in` is someone signing in over work already on the sheet, to
 * an account that kept a design of its own for this product: two designs for
 * one place, so the user picks.
 */
export type RecoveryReason = "resume" | "sign-in";

export interface DraftRecovery {
  status: RecoveryStatus;
  /** The draft on offer, while `status` is `prompting`. */
  draft: RestoredDesign | null;
  reason: RecoveryReason;
  /** Open the draft in place of what is on screen. */
  continueDraft: () => void;
  /** Keep what is on screen; it takes the draft's place. */
  discardDraft: () => void;
}

export interface UseDraftRecoveryOptions {
  /** Whose design this is, and which product it is for. */
  scope: DraftScope;
  document: DesignDocument;
  assets: Asset[];
  name: string;
  /** Applies a restored design — from the draft, or from an imported file. */
  onRestore: (design: RestoredDesign) => void;
  /** Empties the editor, for when the account whose design it holds leaves. */
  onReset: () => void;
  /**
   * Called once a write has landed, so the header can confirm it.
   *
   * Optional because the draft only speaks for the whole design where there is
   * nowhere else for it to go; embedded in a storefront the save indicator has
   * to keep following the request to the shop instead.
   */
  onSaved?: () => void;
}

/** What is on screen, in the parts a draft is written from. */
interface Snapshot {
  document: DesignDocument;
  assets: Asset[];
  name: string;
}

/**
 * Write what is on screen under `key`.
 *
 * An empty sheet is not a draft. Clearing rather than storing it is what stops
 * the recovery dialog appearing after the user tidies up — and it still counts
 * as a save: with the record gone, what is stored and what is on screen agree,
 * which is all the indicator claims.
 */
function persist(
  key: string,
  { document, assets, name }: Snapshot,
): Promise<boolean> {
  if (document.objects.length === 0 && assets.length === 0) {
    return clearDraft(key).then(() => true);
  }

  const files = new Map<string, Blob>();
  for (const asset of assets) {
    const file = getAssetFile(asset.id);
    if (file) files.set(asset.id, file);
  }

  return saveDraft(
    key,
    serializeDocument({
      name,
      document,
      assets,
      files,
      savedAt: new Date().toISOString(),
    }),
  );
}

/** What looking up one scope's draft settled on. */
interface Lookup {
  /** The scope it was for — anything else is a lookup still to be made. */
  key: string;
  status: "prompting" | "ready";
  draft: RestoredDesign | null;
  reason: RecoveryReason;
}

/**
 * Keeps the current design in local storage, filed under whoever is signed in
 * and the product it is for, and offers it back next visit.
 *
 * Autosave is driven by the identity of `document` and `assets` rather than by
 * a list of actions to remember to call. Selection, hover, zoom and pan never
 * replace either array, so they never reach this hook — and no future action
 * can forget to announce itself, because there is nothing to announce to.
 *
 * The scope can change under an open editor, and each direction means
 * something different. Signing out saves the design to the account and clears
 * the editor, so the next person at this browser starts on their own sheet.
 * Signing in brings the work on screen into the account — unless the account
 * already kept a design for this product, in which case the user is asked
 * which of the two to carry on with.
 */
export function useDraftRecovery({
  scope,
  document,
  assets,
  name,
  onRestore,
  onReset,
  onSaved,
}: UseDraftRecoveryOptions): DraftRecovery {
  const key = draftKey(scope);
  const isAccount = scope.accountId !== null;

  const [lookup, setLookup] = React.useState<Lookup | null>(null);

  /*
   * Derived rather than stored: a scope that hasn't been looked up yet is
   * still being checked. A sign-in or sign-out therefore pauses autosave in the
   * very render that makes it, before a write could land under the wrong key.
   */
  const current = lookup?.key === key ? lookup : null;
  const status: RecoveryStatus = current?.status ?? "checking";

  /**
   * The guest draft a sign-in carried into the account, still to be removed.
   *
   * Only removed once the account's own copy has been written. Until then the
   * guest copy is the one on disk, and a tab closed in between loses nothing.
   */
  const carriedFrom = React.useRef<string | null>(null);

  /** The scope last looked up, and whether it was an account's. */
  const entered = React.useRef<{ key: string; isAccount: boolean } | null>(
    null,
  );

  /*
   * The latest render's values, for the handlers and effects that outlive it.
   *
   * Refreshed by an effect declared *after* the scope effect, on purpose: when
   * the scope changes, that effect needs the design as it stood in the scope
   * being left, and whether that scope had settled — which is exactly what
   * this still holds when it runs.
   */
  const latest = React.useRef({
    document,
    assets,
    name,
    onRestore,
    onReset,
    onSaved,
    /** The scope autosave was writing to, or `null` while it was paused. */
    readyKey: null as string | null,
    current,
  });

  /* -------------------------- Entering a scope -------------------------- */
  React.useEffect(() => {
    let cancelled = false;

    const previous = entered.current;
    entered.current = { key, isAccount };

    let carry: string | null = null;

    // Strict Mode runs this twice for one scope; only a new scope is a change.
    if (previous && previous.key !== key) {
      const left = latest.current;
      const settled = left.readyKey === previous.key;
      const hasWork =
        left.document.objects.length > 0 || left.assets.length > 0;

      // The last second of editing goes where it belongs before anything
      // else moves. Autosave was waiting on a timer the change has cancelled.
      if (settled) void persist(previous.key, left);

      if (previous.isAccount) {
        // Signing out, or another tab signing in as someone else. The design
        // is the account's, and it doesn't stay on screen for whoever uses
        // this browser next.
        left.onReset();
      } else if (settled && hasWork) {
        // Signing in over work in progress: it comes along.
        carry = previous.key;
      }
    }

    void loadDraft(key).then((stored) => {
      if (cancelled) return;
      const draft = deserializeDocument(stored);
      carriedFrom.current = carry;

      // Nothing waiting, so whatever is on screen is simply this scope's now.
      // A carried design is written here by the next autosave, which then
      // removes the guest copy.
      if (!draft) {
        setLookup({ key, status: "ready", draft: null, reason: "resume" });
        return;
      }

      setLookup({
        key,
        status: "prompting",
        draft,
        reason: carry ? "sign-in" : "resume",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [key, isAccount]);

  React.useEffect(() => {
    latest.current = {
      document,
      assets,
      name,
      onRestore,
      onReset,
      onSaved,
      readyKey: status === "ready" ? key : null,
      current,
    };
  });

  const continueDraft = React.useCallback(() => {
    const offered = latest.current.current;
    if (!offered?.draft) return;
    latest.current.onRestore(offered.draft);
    // What it replaces stays where it was last saved — for a sign-in, under
    // the guest, so signing back out finds it there.
    carriedFrom.current = null;
    setLookup({ ...offered, status: "ready", draft: null });
  }, []);

  const discardDraft = React.useCallback(() => {
    const offered = latest.current.current;
    if (!offered) return;
    // Starting afresh throws the draft away now. Keeping the design on screen
    // over a saved one needs no delete: the next autosave writes over it.
    if (offered.reason === "resume") void clearDraft(offered.key);
    setLookup({ ...offered, status: "ready", draft: null });
  }, []);

  /* ------------------------------ Autosave ------------------------------ */
  React.useEffect(() => {
    if (status !== "ready") return;

    /**
     * Set once a later edit has superseded this write.
     *
     * IndexedDB resolves on its own schedule, so without this a slow put could
     * report success after the design had moved on — and the header would read
     * "Saved" over changes still held only in memory.
     */
    let superseded = false;

    const timer = setTimeout(() => {
      void persist(key, { document, assets, name }).then((stored) => {
        if (!stored || superseded) return;
        latest.current.onSaved?.();

        const carried = carriedFrom.current;
        if (carried) {
          carriedFrom.current = null;
          void clearDraft(carried);
        }
      });
    }, AUTOSAVE_DELAY_MS);

    return () => {
      superseded = true;
      clearTimeout(timer);
    };
  }, [status, key, document, assets, name]);

  return {
    status,
    draft: current?.status === "prompting" ? current.draft : null,
    reason: current?.reason ?? "resume",
    continueDraft,
    discardDraft,
  };
}
