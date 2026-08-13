"use client";

import * as React from "react";
import { ChevronDown, LogIn, LogOut } from "lucide-react";

import {
  AccountDialog,
  type AccountMode,
} from "@/components/account/account-dialog";
import { HeaderButton } from "@/components/header/header-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccount } from "@/hooks/use-account";
import { displayName, initials } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * The account control in the header: sign in, or who you are signed in as.
 *
 * The dialog is rendered in both states rather than only when signed out, so
 * the sign-in that closes it doesn't unmount it mid-animation — it renders
 * nothing while closed either way.
 *
 * Signing in is optional. The editor works exactly as before without an
 * account, which is why this is one quiet button and not a gate: nothing in the
 * design flow depends on knowing who is drawing.
 */
export function AccountMenu() {
  const { user, logOut } = useAccount();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<AccountMode>("signin");

  const start = (next: AccountMode) => {
    setMode(next);
    setOpen(true);
  };

  return (
    <>
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={`Account: ${displayName(user)}`}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card pl-1 pr-1.5",
                  "text-[13px] font-semibold text-foreground shadow-soft transition-colors",
                  "outline-none hover:border-primary/35 hover:bg-primary-softer",
                  "focus-visible:ring-3 focus-visible:ring-ring/40",
                )}
              >
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-md bg-primary-soft text-[11px] font-bold text-primary"
                >
                  {initials(user)}
                </span>
                <span className="hidden max-w-28 truncate lg:inline">
                  {displayName(user)}
                </span>
                <ChevronDown
                  className="size-3.5 shrink-0 text-muted-foreground"
                  strokeWidth={2.2}
                  aria-hidden
                />
              </button>
            }
          />

          <DropdownMenuContent align="end" sideOffset={6} className="w-56">
            {/* The address, not the name: it is what the account actually is,
                and the only way to tell two of them apart. */}
            <div className="px-2 py-1.5">
              <p className="truncate text-[12.5px] font-semibold text-foreground">
                {displayName(user)}
              </p>
              <p
                className="truncate text-[11.5px] text-muted-foreground"
                title={user.email}
              >
                {user.email}
              </p>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem className="px-2 py-1.5" onClick={logOut}>
              <LogOut aria-hidden />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <HeaderButton
          icon={LogIn}
          label="Sign in"
          variant="outline"
          onClick={() => start("signin")}
          labelClassName="hidden sm:inline"
        />
      )}

      <AccountDialog open={open} onOpenChange={setOpen} initialMode={mode} />
    </>
  );
}
