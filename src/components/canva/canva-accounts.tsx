"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, LoaderCircle, Plus, TriangleAlert, Unlink } from "lucide-react";

import { accountLabel, type CanvaAccount } from "@/lib/canva";
import { cn } from "@/lib/utils";

export interface CanvaAccountsProps {
  accounts: CanvaAccount[];
  selectedAccountId: string | null;
  /** True while an OAuth popup is open. */
  connecting: boolean;
  /** The account being removed, so only its row shows a spinner. */
  disconnectingId: string | null;
  onSelect: (accountId: string) => void;
  onConnect: () => void;
  onDisconnect: (accountId: string) => void;
}

/**
 * The connected Canva accounts, and which one the panel is showing.
 *
 * A list rather than a dropdown: with two or three accounts the whole point is
 * seeing at a glance that they are all still attached, and which one is about
 * to be imported from. A dropdown hides exactly that.
 *
 * State is per row. One account expiring, or being removed, has no bearing on
 * the others — so nothing here is disabled globally while one row is busy.
 */
export function CanvaAccounts({
  accounts,
  selectedAccountId,
  connecting,
  disconnectingId,
  onSelect,
  onConnect,
  onDisconnect,
}: CanvaAccountsProps) {
  return (
    <section className="space-y-2" aria-label="Canva accounts">
      <h3 className="px-0.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        Canva accounts
      </h3>

      <ul className="space-y-1.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              isSelected={account.id === selectedAccountId}
              isDisconnecting={disconnectingId === account.id}
              onSelect={() => onSelect(account.id)}
              onReconnect={onConnect}
              onDisconnect={() => onDisconnect(account.id)}
            />
          ))}
        </AnimatePresence>
      </ul>

      <button
        type="button"
        onClick={onConnect}
        disabled={connecting}
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border",
          "px-2.5 py-2 text-[11px] font-semibold text-muted-foreground",
          "transition-colors hover:border-primary/40 hover:bg-primary-softer hover:text-primary",
          "outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {connecting ? (
          <>
            <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2.4} aria-hidden />
            Waiting for Canva…
          </>
        ) : (
          <>
            <Plus className="size-3.5" strokeWidth={2.6} aria-hidden />
            Connect another Canva account
          </>
        )}
      </button>
    </section>
  );
}

interface AccountRowProps {
  account: CanvaAccount;
  isSelected: boolean;
  isDisconnecting: boolean;
  onSelect: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
}

function AccountRow({
  account,
  isSelected,
  isDisconnecting,
  onSelect,
  onReconnect,
  onDisconnect,
}: AccountRowProps) {
  const expired = account.status === "expired";
  const label = accountLabel(account);

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={cn(
        "flex items-center gap-2 rounded-xl border bg-card px-2.5 py-2 transition-colors",
        isSelected ? "border-primary/45 shadow-soft" : "border-border",
        isDisconnecting && "opacity-60",
      )}
    >
      {/* The row itself selects. Disconnect is a separate control, so it can't
          be hit by someone reaching for the account. */}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md text-left",
          "outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
            isSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border",
          )}
        >
          {isSelected ? <Check className="size-2.5" strokeWidth={3.2} /> : null}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-[11.5px] font-semibold text-foreground"
            title={label}
          >
            {label}
          </span>
          {expired ? (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
              <TriangleAlert className="size-2.5" strokeWidth={2.6} aria-hidden />
              Connection expired
            </span>
          ) : (
            <span className="block truncate text-[10px] leading-tight text-muted-foreground">
              {isSelected ? "Showing designs" : "Connected"}
            </span>
          )}
        </span>
      </button>

      {/* Reconnecting runs the same OAuth flow; the server recognises the Canva
          account and revives this row rather than adding a second one. */}
      {expired ? (
        <button
          type="button"
          onClick={onReconnect}
          className={cn(
            "shrink-0 rounded-md bg-primary-soft px-1.5 py-1 text-[10px] font-bold text-primary",
            "transition-colors hover:bg-primary-soft/70",
            "outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          )}
        >
          Reconnect
        </button>
      ) : null}

      <button
        type="button"
        onClick={onDisconnect}
        disabled={isDisconnecting}
        aria-label={`Disconnect ${label}`}
        title={`Disconnect ${label}`}
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground",
          "transition-colors hover:bg-muted hover:text-foreground",
          "outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          "disabled:cursor-not-allowed",
        )}
      >
        {isDisconnecting ? (
          <LoaderCircle className="size-3 animate-spin" strokeWidth={2.4} aria-hidden />
        ) : (
          <Unlink className="size-3" strokeWidth={2.4} aria-hidden />
        )}
      </button>
    </motion.li>
  );
}
