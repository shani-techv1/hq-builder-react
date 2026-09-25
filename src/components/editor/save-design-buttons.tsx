"use client";

import * as React from "react";
import { CopyPlus, Save } from "lucide-react";

import { AccountDialog } from "@/components/account/account-dialog";
import { HeaderButton } from "@/components/header/header-button";
import { useSavedDesigns } from "@/hooks/use-saved-designs";

/**
 * Saving, at the right end of the header: to My designs, the one place a
 * design is kept.
 *
 * A design opened from My designs, or saved there already, gets "Save changes"
 * and "Save as new". Anything else gets "Save", which files it as a new entry.
 * Signed out, or holding a sign-in the service no longer accepts, it asks for a
 * sign-in first — there is nowhere to save to until then.
 *
 * On a phone "Save as new" moves to the toolbar's More menu, beside My designs,
 * and leaves this bar to the cart.
 */
export function SaveDesignButtons() {
  const saved = useSavedDesigns();
  const [signingIn, setSigningIn] = React.useState(false);

  const ready = saved.access === "ready";
  const linked = ready && saved.currentId !== null;
  const saving = saved.busy?.kind === "save";
  const label = saving ? "Saving…" : linked ? "Save changes" : "Save";

  const save = (asNew: boolean) => {
    if (!ready) {
      setSigningIn(true);
      return;
    }
    void saved.save({ asNew });
  };

  return (
    <>
      {linked ? (
        <span className="hidden md:contents">
          <HeaderButton
            icon={CopyPlus}
            label="Save as new"
            variant="ghost"
            onClick={() => save(true)}
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
        onClick={() => save(false)}
        disabled={saved.busy !== null}
        // Beside a storefront's cart, a tablet has room for the icon only.
        labelClassName="hidden lg:inline"
      />

      <AccountDialog open={signingIn} onOpenChange={setSigningIn} />
    </>
  );
}
