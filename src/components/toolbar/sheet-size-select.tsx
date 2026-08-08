"use client";

import { Ruler } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSheetSizes, sheetSizeLabel } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export interface SheetSizeSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

/**
 * Sheet size picker. Sits in the toolbar as a text control rather than an icon
 * — the current dimensions are worth reading at a glance in a print workflow.
 */
export function SheetSizeSelect({
  value,
  onValueChange,
  className,
}: SheetSizeSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange(String(next))}
    >
      <SelectTrigger
        aria-label="Change sheet size"
        className={cn(
          "h-9 gap-1.5 rounded-lg border-transparent bg-transparent px-2.5 text-[12.5px] font-semibold",
          "text-foreground shadow-none transition-colors hover:bg-muted data-[size=default]:h-9",
          className,
        )}
      >
        <Ruler
          className="size-[17px] shrink-0 text-muted-foreground"
          strokeWidth={2}
          aria-hidden
        />
        <SelectValue>{(next) => sheetSizeLabel(String(next))}</SelectValue>
      </SelectTrigger>

      <SelectContent className="min-w-56 rounded-xl p-1">
        {getSheetSizes().map((size) => (
          <SelectItem
            key={size.id}
            value={size.id}
            className="rounded-lg py-2 pl-2.5"
          >
            <span className="flex flex-col">
              <span className="text-[13px] font-semibold">{size.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {size.description}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
