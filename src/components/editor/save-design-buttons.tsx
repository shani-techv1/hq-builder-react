"use client";

import * as React from "react";
import { CopyPlus, Save } from "lucide-react";

import { AccountDialog } from "@/components/account/account-dialog";
import {
  SaveDesignDialog,
  type SaveDesignMode,
} from "@/components/editor/save-design-dialog";
import { HeaderButton } from "@/components/header/header-button";
import { useSavedDesigns } from "@/hooks/use-saved-designs";

/**
 * Saving, at the right end of the header: to My designs, the one place a
 * design is kept.
 *
 * A design that isn't in My designs yet gets "Save", which asks for a name and
 * then whether it is a new design or replaces one saved before. Once it is
 * there it gets "Save changes", which saves straight over it — as the autosave
 * does every few seconds — and "Save as new", which asks for the copy's name.
 * Signed out, or holding a sign-in the service no longer accepts, it asks for a
 * sign-in first — there is nowhere to save to until then.
 *
 * On a phone "Save as new" moves to the toolbar's More menu, beside My designs,
 * and leaves this bar to the cart.
 */
export function SaveDesignButtons() {
  const saved = useSavedDesigns();
  const [signingIn, setSigningIn] = React.useState(false);
  const [naming, setNaming] = React.useState(false);
  const [mode, setMode] = React.useState<SaveDesignMode>("first");

  const ready = saved.access === "ready";
  const linked = ready && saved.currentId !== null;
  const saving = saved.busy?.kind === "save" && !saved.busy.auto;
  const label = saving ? "Saving…" : linked ? "Save changes" : "Save";

  const ask = (next: SaveDesignMode) => {
    setMode(next);
    setNaming(true);
  };

  const save = () => {
    if (!ready) setSigningIn(true);
    else if (linked) void saved.save({ to: "current" });
    else ask("first");
  };

  return (
    <>
      {linked ? (
        <span className="hidden md:contents">
          <HeaderButton
            icon={CopyPlus}
            label="Save as new"
            variant="ghost"
            onClick={() => ask("copy")}
            disabled={saved.busy !== null}
            labelClassName="hidden xl:inline"
          />
        </span>
      ) : null}

      <HeaderButton
        icon={Save}
        label={label}
        title={ready ? label : "Sign in to save to My designs"}
        variant="outline"
        onClick={save}
        disabled={saved.busy !== null}
        // Beside a storefront's cart, a tablet has room for the icon only.
        labelClassName="hidden lg:inline"
      />

      <SaveDesignDialog open={naming} onOpenChange={setNaming} mode={mode} />
      <AccountDialog open={signingIn} onOpenChange={setSigningIn} />
    </>
  );
}
