"use client";

import * as React from "react";

import type { Asset } from "@/lib/assets";
import {
  deserializeDocument,
  serializeDocument,
  type DesignDocument,
  type RestoredDesign,
} from "@/lib/design-document";
import { clearDraft, loadDraft, saveDraft } from "@/lib/draft-storage";
import { getAssetFile } from "@/lib/image-cache";

/**
 * How long the editor waits after a change before writing.
 *
 * Long enough that a slider drag or a run of typing is one write rather than
 * fifty, short enough that a tab closed on impulse loses nothing worth having.
 */
const AUTOSAVE_DELAY_MS = 1000;

/**
 * Where startup has got to.
 *
 * `checking` exists so autosave cannot run before the question is answered —
 * writing the empty document the editor starts with would destroy the draft
 * the user is about to be offered.
 */
export type RecoveryStatus = "checking" | "prompting" | "ready";

export interface DraftRecovery {
  status: RecoveryStatus;
  /** The draft on offer, while `status` is `prompting`. */
  draft: RestoredDesign | null;
  /** Restore it and start autosaving over it. */
  continueDraft: () => void;
  /** Throw it away and begin on an empty sheet. */
  startNew: () => void;
}

export interface UseDraftRecoveryOptions {
  document: DesignDocument;
  assets: Asset[];
  name: string;
  /** Applies a restored design — from the draft, or from an imported file. */
  onRestore: (design: RestoredDesign) => void;
}

/**
 * Keeps the current design in local storage, and offers it back next visit.
 *
 * Autosave is driven by the identity of `document` and `assets` rather than by
 * a list of actions to remember to call. Selection, hover, zoom and pan never
 * replace either array, so they never reach this hook — and no future action
 * can forget to announce itself, because there is nothing to announce to.
 */
export function useDraftRecovery({
  document,
  assets,
  name,
  onRestore,
}: UseDraftRecoveryOptions): DraftRecovery {
  const [status, setStatus] = React.useState<RecoveryStatus>("checking");
  const [draft, setDraft] = React.useState<RestoredDesign | null>(null);

  /* --------------------------- Startup check ---------------------------- */
  React.useEffect(() => {
    let cancelled = false;

    void loadDraft().then((stored) => {
      if (cancelled) return;
      const restored = deserializeDocument(stored);
      // An unreadable or empty record is not worth interrupting anyone for.
      if (!restored) {
        setStatus("ready");
        return;
      }
      setDraft(restored);
      setStatus("prompting");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const latest = React.useRef({ onRestore, draft });
  React.useEffect(() => {
    latest.current = { onRestore, draft };
  });

  const continueDraft = React.useCallback(() => {
    const pending = latest.current.draft;
    if (pending) latest.current.onRestore(pending);
    setDraft(null);
    setStatus("ready");
  }, []);

  const startNew = React.useCallback(() => {
    void clearDraft();
    setDraft(null);
    setStatus("ready");
  }, []);

  /* ------------------------------ Autosave ------------------------------ */
  React.useEffect(() => {
    if (status !== "ready") return;

    const timer = setTimeout(() => {
      // An empty sheet is not a draft. Clearing rather than storing it is what
      // stops the recovery dialog appearing after the user tidies up.
      if (document.objects.length === 0 && assets.length === 0) {
        void clearDraft();
        return;
      }

      const files = new Map<string, Blob>();
      for (const asset of assets) {
        const file = getAssetFile(asset.id);
        if (file) files.set(asset.id, file);
      }

      void saveDraft(
        serializeDocument({
          name,
          document,
          assets,
          files,
          savedAt: new Date().toISOString(),
        }),
      );
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [status, document, assets, name]);

  return { status, draft, continueDraft, startNew };
}
