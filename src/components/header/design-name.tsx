"use client";

import * as React from "react";
import { Pencil } from "lucide-react";

import { cn } from "@/lib/utils";

export interface DesignNameProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Roughly the width of the header's name field before it starts truncating. */
const MAX_CHARS = 34;

/**
 * The design name, edited in place.
 *
 * Click (or focus and press Enter) swaps the label for an input sized to its
 * own contents, so the header doesn't jump between the two modes. Enter and
 * blur commit; Escape reverts. An empty name is treated as a cancel rather
 * than accepted, since an untitled design still needs something to show.
 */
export function DesignName({ value, onChange, className }: DesignNameProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const startEditing = () => {
    setDraft(value);
    setIsEditing(true);
  };

  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onChange(next);
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      // Stop the editor shell from also reading this as "close the panel".
      event.stopPropagation();
      cancel();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        aria-label="Design name"
        maxLength={80}
        style={{ width: `${Math.min(MAX_CHARS, draft.length + 2)}ch` }}
        className={cn(
          "h-8 min-w-[10ch] rounded-lg border border-primary/50 bg-card px-2 text-sm font-bold tracking-tight",
          "text-foreground outline-none ring-3 ring-ring/25",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      title="Rename design"
      className={cn(
        "group flex h-8 max-w-[min(42vw,20rem)] items-center gap-1.5 rounded-lg px-2 text-left",
        "transition-colors hover:bg-muted",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        className,
      )}
    >
      <span className="truncate text-sm font-bold tracking-tight text-foreground">
        {value}
      </span>
      <Pencil
        className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />
    </button>
  );
}
