"use client";

import {
  ArrowDownToLine,
  ArrowUpToLine,
  Blend,
  Lock,
  MoreHorizontal,
  RotateCw,
  Unlock,
} from "lucide-react";

import { toolbarActionClass } from "@/components/canvas/selection/toolbar-action";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface SelectionOverflowMenuProps {
  locked: boolean;
  onRotate: () => void;
  onToggleLock: () => void;
  /** Opens the Settings panel on the opacity row. */
  onOpenOpacity: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}

/**
 * The rest of what can be done to one object.
 *
 * The toolbar carries the four things people reach for constantly; everything
 * else lives one click deeper rather than widening a bar that already floats
 * over the artwork. Lock is in here too — it is not a frequent action, and
 * a locked object's toolbar still leads to it in one click.
 */
export function SelectionOverflowMenu({
  locked,
  onRotate,
  onToggleLock,
  onOpenOpacity,
  onBringToFront,
  onSendToBack,
}: SelectionOverflowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More actions"
        className={toolbarActionClass()}
      >
        <MoreHorizontal className="size-[17px]" strokeWidth={2} aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={onRotate} disabled={locked}>
          <RotateCw />
          Rotate 90°
        </DropdownMenuItem>
        {/* Opens the inspector rather than carrying a slider of its own. Two
            controls for one property is one too many, and a popover would sit
            over the artwork whose opacity is being judged; the panel is a
            column beside the sheet, so nothing is covered. */}
        <DropdownMenuItem onClick={onOpenOpacity}>
          <Blend />
          Opacity…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleLock}>
          {locked ? <Unlock /> : <Lock />}
          {locked ? "Unlock" : "Lock"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onBringToFront} disabled={locked}>
          <ArrowUpToLine />
          Bring to front
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSendToBack} disabled={locked}>
          <ArrowDownToLine />
          Send to back
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
