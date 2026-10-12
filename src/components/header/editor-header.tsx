"use client";

import { AppLogo } from "@/components/common/app-logo";
import { DesignName } from "@/components/header/design-name";
import { SaveStatus } from "@/components/header/save-status";
import { Separator } from "@/components/ui/separator";
import type { SaveState } from "@/lib/workspace";

export interface EditorHeaderProps {
  designName: string;
  onDesignNameChange: (name: string) => void;
  saveStatus: SaveState;
  /** The way out of the editor, at the far left. */
  exit?: React.ReactNode;
  /** Controls that need the editor's state, saving last. */
  actions?: React.ReactNode;
}

/**
 * The editor's top bar: the way out and identity on the left, the design being
 * worked on in the middle, and saving on the right.
 *
 * Share and Confirm were removed in the MVP cleanup — neither did anything
 * yet, and a header full of inert buttons teaches people to ignore the header.
 *
 * The mark is left off on a phone. There the storefront's quantity and cart
 * buttons take most of the bar, and the room is worth more to the name of the
 * design than to a logo.
 */
export function EditorHeader({
  designName,
  onDesignNameChange,
  saveStatus,
  exit,
  actions,
}: EditorHeaderProps) {
  return (
    <header className="relative z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-4">
      {exit ? (
        <>
          {exit}
          <Separator
            orientation="vertical"
            className="mx-1 hidden data-vertical:h-6 md:block"
          />
        </>
      ) : null}

      <AppLogo className="hidden shrink-0 md:flex" />

      <Separator
        orientation="vertical"
        className="mx-1 hidden data-vertical:h-6 md:block"
      />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <DesignName value={designName} onChange={onDesignNameChange} />
        <SaveStatus status={saveStatus} className="hidden shrink-0 sm:inline-flex" />
      </div>

      {actions}
    </header>
  );
}
