"use client";

import * as React from "react";
import { ArrowLeft, TriangleAlert } from "lucide-react";

import { AccountDialog } from "@/components/account/account-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SaveDesignDialog } from "@/components/editor/save-design-dialog";
import { HeaderButton } from "@/components/header/header-button";
import { useSavedDesigns } from "@/hooks/use-saved-designs";
import { leaveEditor } from "@/lib/exit";
import type { SaveState } from "@/lib/workspace";

/** The question on screen: leave, then — to save first — a name or a sign-in. */
type Asking = "leave" | "name" | "sign-in";

/**
 * The way out of the editor, at the left end of the header.
 *
 * A sheet the header calls saved — in My designs as it stands, or empty —
 * leaves straight away. Anything else asks first: save and leave, leave
 * without saving, or stay. Saving goes the way the header's Save button does:
 * over the saved design on screen, through the naming dialog for one that was
 * never saved, and through a sign-in when there is nowhere to save to yet.
 *
 * The question closes before the page goes, rather than staying up until it
 * has: a page kept for Back and Forward comes back as it was left, and it
 * would come back stuck behind the dialog.
 */
export function ExitEditorButton({ saveStatus }: { saveStatus: SaveState }) {
  const saved = useSavedDesigns();
  const [asking, setAsking] = React.useState<Asking | null>(null);

  const ready = saved.access === "ready";
  const linked = ready && saved.currentId !== null;
  // The autosave too: leaving under it could cut off the save it is making.
  const saving = saved.busy?.kind === "save";

  const exit = () => {
    if (saveStatus === "saved") leaveEditor();
    else setAsking("leave");
  };

  const leave = () => {
    setAsking(null);
    leaveEditor();
  };

  const saveAndLeave = async () => {
    if (!ready) setAsking("sign-in");
    else if (!linked) setAsking("name");
    // A failed save has its own toast, and the question stays up to try
    // again or leave anyway.
    else if (await saved.save({ to: "current" })) leave();
  };

  /** Closing one of the save dialogs drops the exit with it. */
  const stayOpen = (step: Asking) => (open: boolean) =>
    setAsking(open ? step : null);

  return (
    <>
      <HeaderButton icon={ArrowLeft} label="Exit" onClick={exit} />

      <ConfirmDialog
        open={asking === "leave"}
        onCancel={() => setAsking(null)}
        onConfirm={() => void saveAndLeave()}
        alternative={{ label: "Don’t save", onSelect: leave }}
        icon={TriangleAlert}
        title="Save before you leave?"
        description={
          ready
            ? "This sheet has changes that aren’t in My designs yet. If you leave without saving, they’ll be lost."
            : "Sign in to save this sheet to My designs. If you leave without saving, it’ll be lost."
        }
        confirmLabel={ready ? "Save & exit" : "Sign in to save"}
        pendingLabel="Saving…"
        pending={saving}
      />
      <SaveDesignDialog
        open={asking === "name"}
        onOpenChange={stayOpen("name")}
        mode="first"
        onSaved={leaveEditor}
      />
      <AccountDialog
        open={asking === "sign-in"}
        onOpenChange={stayOpen("sign-in")}
      />
    </>
  );
}
