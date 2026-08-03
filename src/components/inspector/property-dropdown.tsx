"use client";

import * as React from "react";

import { PropertyRow } from "@/components/inspector/property-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PropertyOption {
  value: string;
  label: string;
  /** Secondary line inside the menu — not shown on the trigger. */
  detail?: string;
}

export interface PropertyDropdownProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: PropertyOption[];
  disabled?: boolean;
  tooltip?: string;
  validation?: { tone: "info" | "warning" | "error"; message: string };
  /** Full-width trigger under the label, for long option names. */
  layout?: "row" | "stack";
  className?: string;
}

/** A property backed by a fixed list of choices. */
export function PropertyDropdown({
  label,
  value,
  onChange,
  options,
  disabled = false,
  tooltip,
  validation,
  layout = "row",
  className,
}: PropertyDropdownProps) {
  const id = React.useId();
  const labelFor = (next: string) =>
    options.find((option) => option.value === next)?.label ?? "";

  return (
    <PropertyRow
      label={label}
      htmlFor={id}
      layout={layout}
      tooltip={tooltip}
      validation={validation}
      disabled={disabled}
      className={className}
    >
      <Select
        value={value}
        onValueChange={(next) => onChange(String(next))}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className={cn(
            "h-8 rounded-lg border-border bg-card px-2 text-[12px] font-semibold data-[size=default]:h-8",
            layout === "row" ? "w-[140px]" : "w-full",
            className,
          )}
        >
          <SelectValue>{(next) => labelFor(String(next))}</SelectValue>
        </SelectTrigger>

        <SelectContent className="rounded-xl p-1">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="rounded-lg py-1.5 pl-2"
            >
              <span className="flex flex-col">
                <span className="text-[12.5px] font-semibold">
                  {option.label}
                </span>
                {option.detail ? (
                  <span className="text-[10.5px] text-muted-foreground">
                    {option.detail}
                  </span>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </PropertyRow>
  );
}
