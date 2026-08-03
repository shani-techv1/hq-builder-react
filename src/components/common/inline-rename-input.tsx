"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface InlineRenameInputProps {
  value: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
  /** Accessible name for the field. */
  label: string;
  className?: string;
}

/**
 * Inline rename field, used by layer rows and asset cards.
 *
 * Enter and blur commit, Escape cancels. An empty name is treated as a cancel
 * rather than accepted — a nameless layer would be unusable in the list.
 *
 * Key events are stopped here so the editor's Delete and Escape shortcuts
 * can't fire while a name is being typed.
 */
export function InlineRenameInput({
  value,
  onCommit,
  onCancel,
  label,
  className,
}: InlineRenameInputProps) {
  const [draft, setDraft] = React.useState(value);
  const ref = React.useRef<HTMLInputElement>(null);
  // Blur fires after Escape too; this stops the cancel being re-committed.
  const settled = React.useRef(false);

  React.useEffect(() => {
    ref.current?.select();
  }, []);

  const commit = () => {
    if (settled.current) return;
    settled.current = true;
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else onCancel();
  };

  const cancel = () => {
    if (settled.current) return;
    settled.current = true;
    onCancel();
  };

  return (
    <input
      ref={ref}
      value={draft}
      autoFocus
      aria-label={label}
      maxLength={60}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
      className={cn(
        "h-6 w-full min-w-0 rounded-md border border-primary/50 bg-card px-1.5",
        "text-[12px] font-semibold text-foreground outline-none ring-3 ring-ring/25",
        className,
      )}
    />
  );
}
