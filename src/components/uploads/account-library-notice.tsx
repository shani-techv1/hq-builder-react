"use client";

import { CloudUpload, LoaderCircle, LogIn } from "lucide-react";

import { PrimaryButton } from "@/components/common/primary-button";
import type { AccountLibraryState } from "@/hooks/use-account-library";

export interface AccountLibraryNoticeProps {
  account: AccountLibraryState;
  onSignIn: () => void;
}

/**
 * Where the Graphics panel says whether uploads are being kept.
 *
 * Signed out, it says what signing in gets you and offers the button, because
 * the panel is where someone is when they find out their uploads matter.
 * Signed in, it says nothing once the account's graphics are in — the graphics
 * themselves are the message — and only speaks up while they load or if they
 * didn't.
 */
export function AccountLibraryNotice({ account, onSignIn }: AccountLibraryNoticeProps) {
  if (account.access !== "ready") {
    const again = account.access === "sign-in-again";
    return (
      <div className="rounded-card border border-border bg-primary-softer/60 p-3.5">
        <div className="flex items-start gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-card text-primary shadow-soft">
            <CloudUpload className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold tracking-tight text-foreground">
              {again ? "Sign in again to see your graphics" : "Keep your graphics"}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
              {again
                ? "Your sign-in has expired, so your saved graphics can’t load."
                : "Sign in and everything you upload is saved to your account, ready to use again any time, on any device."}
            </p>
          </div>
        </div>
        <PrimaryButton icon={LogIn} size="md" className="mt-3" onClick={onSignIn}>
          {again ? "Sign in again" : "Sign in"}
        </PrimaryButton>
      </div>
    );
  }

  if (account.error) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
        <p className="text-[12px] text-destructive">
          Your saved graphics couldn’t load. {account.error}
        </p>
        <button
          type="button"
          onClick={account.retry}
          className="mt-1 rounded-md text-[12px] font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          Try again
        </button>
      </div>
    );
  }

  if (account.loading) {
    return (
      <p
        aria-live="polite"
        className="flex items-center gap-2 text-[12px] text-muted-foreground"
      >
        <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2.4} aria-hidden />
        Loading your graphics…
      </p>
    );
  }

  return null;
}
