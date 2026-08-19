"use client";

import * as React from "react";
import {
  Blend,
  FlipHorizontal,
  FlipVertical,
  Layers,
  Lock,
  MoreHorizontal,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Unlock,
  type LucideIcon,
} from "lucide-react";

import { toolbarActionClass } from "@/components/canvas/selection/toolbar-action";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface SelectionOverflowMenuProps {
  locked: boolean;
  /** Clockwise degrees — negative turns the other way. */
  onRotate: (degrees: number) => void;
  onFlip: (axis: "horizontal" | "vertical") => void;
  onOpenPosition: () => void;
  onOpenFilters: () => void;
  onToggleLock: () => void;
  /** Opens the Settings panel on the opacity row. */
  onOpenOpacity: () => void;
}

/**
 * The rest of what can be done to one object.
 *
 * The toolbar carries the four things people reach for constantly; everything
 * else lives one click deeper rather than widening a bar that already floats
 * over the artwork.
 *
 * Rotate and Flip are submenus because each is a small set of one-shot actions,
 * while Position and Filters open panels — they are places to work rather than
 * buttons to press, and the drawer is a column beside the sheet rather than
 * something covering it.
 */
export function SelectionOverflowMenu({
  locked,
  onRotate,
  onFlip,
  onOpenPosition,
  onOpenFilters,
  onToggleLock,
  onOpenOpacity,
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
        <Submenu icon={RotateCw} label="Rotate" disabled={locked} width="w-48">
          <DropdownMenuItem onClick={() => onRotate(90)}>
            <RotateCw />
            Rotate right 90°
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRotate(-90)}>
            <RotateCcw />
            Rotate left 90°
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRotate(180)}>
            <RotateCw />
            Turn 180°
          </DropdownMenuItem>
        </Submenu>

        <Submenu
          icon={FlipHorizontal}
          label="Flip"
          disabled={locked}
          width="w-52"
        >
          <DropdownMenuItem onClick={() => onFlip("horizontal")}>
            <FlipHorizontal />
            Flip horizontally
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onFlip("vertical")}>
            <FlipVertical />
            Flip vertically
          </DropdownMenuItem>
        </Submenu>

        <DropdownMenuItem onClick={onOpenPosition}>
          <Layers />
          Position
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenFilters}>
          <SlidersHorizontal />
          Filters
        </DropdownMenuItem>

        <DropdownMenuSeparator />

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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A submenu that opens on hover *and* on click.
 *
 * Base UI gives one or the other: a trigger that opens on hover has
 * `ignoreMouse` set, so a press on it does nothing at all — and a row with a
 * chevron on it is a row people press. Worse, a hover-only submenu cannot be
 * reached on a touchscreen, where there is no hover to give.
 *
 * So the open state is held here: hover still drives it through Base UI's own
 * handling — including the diagonal grace area that keeps it open on the way to
 * an item — and the click adds the one path the library leaves out.
 */
function Submenu({
  icon: Icon,
  label,
  disabled,
  width,
  children,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  /** Width utility for the popup, sized to its longest item. */
  width: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenuSub open={open} onOpenChange={setOpen}>
      <DropdownMenuSubTrigger
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Icon />
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className={width}>
        {children}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
