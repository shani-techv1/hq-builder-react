"use client";

import * as React from "react";
import { ChevronDown, Link, Ruler, Unlink } from "lucide-react";

import { toolbarActionClass } from "@/components/canvas/selection/toolbar-action";
import { useEditorState } from "@/components/editor/editor-state";
import { PropertyInput } from "@/components/inspector/property-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CanvasObject } from "@/lib/canvas-objects";
import { fromInches, sheetInches, toInches } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export interface DimensionsControlProps {
  object: CanvasObject;
}

/**
 * The selection's printed size, editable where it is being looked at.
 *
 * The inspector has the same two fields, and this is deliberately the same
 * numbers rather than a second idea of size: geometry is stored as a share of
 * the sheet, so both convert through the sheet's real dimensions and the unit
 * the editor is set to. What ends up here is what ends up on the press.
 *
 * A popover rather than two fields in the toolbar itself — size is checked far
 * more often than it is typed, and a toolbar wide enough to edit it would sit
 * over the artwork every time something was selected.
 */
export function DimensionsControl({ object }: DimensionsControlProps) {
  const { canvas, settings } = useEditorState();
  const [lockRatio, setLockRatio] = React.useState(true);

  const sheet = sheetInches(canvas.sheetSize);
  const unit = settings.unit;
  const locked = object.locked;

  /* Percentages of the sheet ⇄ the unit shown in the fields. */
  const toDisplay = (percent: number, axis: "x" | "y") =>
    fromInches(
      (percent / 100) * (axis === "x" ? sheet.width : sheet.height),
      unit,
    );

  const toPercent = (value: number, axis: "x" | "y") =>
    (toInches(value, unit) / (axis === "x" ? sheet.width : sheet.height)) * 100;

  const ratio = object.height / object.width;

  const setWidth = (next: number) => {
    const width = toPercent(next, "x");
    canvas.patchObject(
      object.id,
      lockRatio ? { width, height: width * ratio } : { width },
    );
  };

  const setHeight = (next: number) => {
    const height = toPercent(next, "y");
    canvas.patchObject(
      object.id,
      lockRatio ? { height, width: height / ratio } : { height },
    );
  };

  return (
    <Popover>
      <PopoverTrigger
        className={cn(toolbarActionClass({ hasLabel: true }), "gap-1")}
        aria-label="Dimensions"
      >
        <Ruler className="size-[17px] shrink-0" strokeWidth={2} aria-hidden />
        <span className="whitespace-nowrap">Dimensions</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-70" strokeWidth={2.4} aria-hidden />
      </PopoverTrigger>

      <PopoverContent align="center" side="bottom" className="w-64 gap-2">
        <p className="text-[11px] font-semibold text-muted-foreground">
          Printed size
        </p>

        <div className="flex items-end gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2">
            <PropertyInput
              bare
              label="Width"
              value={toDisplay(object.width, "x")}
              onChange={setWidth}
              unit={unit}
              min={0.1}
              step={unit === "mm" ? 1 : 0.1}
              disabled={locked}
            />
            <PropertyInput
              bare
              label="Height"
              value={toDisplay(object.height, "y")}
              onChange={setHeight}
              unit={unit}
              min={0.1}
              step={unit === "mm" ? 1 : 0.1}
              disabled={locked}
            />
          </div>

          <button
            type="button"
            onClick={() => setLockRatio((current) => !current)}
            aria-pressed={lockRatio}
            aria-label={lockRatio ? "Unlock aspect ratio" : "Lock aspect ratio"}
            title={lockRatio ? "Unlock aspect ratio" : "Lock aspect ratio"}
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg border transition-colors outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/40",
              lockRatio
                ? "border-primary/40 bg-primary-soft text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {lockRatio ? (
              <Link className="size-3.5" strokeWidth={2.2} />
            ) : (
              <Unlink className="size-3.5" strokeWidth={2.2} />
            )}
          </button>
        </div>

        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          {locked
            ? "This layer is locked. Unlock it to resize."
            : "Measured on the sheet, at the size it prints."}
        </p>
      </PopoverContent>
    </Popover>
  );
}
