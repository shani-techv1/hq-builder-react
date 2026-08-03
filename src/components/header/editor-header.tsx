"use client";

import { Save } from "lucide-react";

import { AppLogo } from "@/components/common/app-logo";
import { DesignName } from "@/components/header/design-name";
import { HeaderButton } from "@/components/header/header-button";
import { SaveStatus } from "@/components/header/save-status";
import { Separator } from "@/components/ui/separator";
import type { SaveState } from "@/lib/workspace";

export interface EditorHeaderProps {
  designName: string;
  onDesignNameChange: (name: string) => void;
  saveStatus: SaveState;
  onSave: () => void;
}

/**
 * The editor's top bar: identity on the left, the design being worked on in
 * the middle, and saving on the right.
 *
 * Close, Share, Account and Confirm were removed in the MVP cleanup — none of
 * them did anything yet, and a header full of inert buttons teaches people to
 * ignore the header.
 */
export function EditorHeader({
  designName,
  onDesignNameChange,
  saveStatus,
  onSave,
}: EditorHeaderProps) {
  return (
    <header className="relative z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-4">
      <AppLogo className="shrink-0" />

      <Separator
        orientation="vertical"
        className="mx-1 hidden data-vertical:h-6 sm:block"
      />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <DesignName value={designName} onChange={onDesignNameChange} />
        <SaveStatus status={saveStatus} className="hidden shrink-0 sm:inline-flex" />
      </div>

      <HeaderButton
        icon={Save}
        label="Save"
        variant="outline"
        onClick={onSave}
        disabled={saveStatus === "saving"}
        labelClassName="hidden sm:inline"
      />
    </header>
  );
}
