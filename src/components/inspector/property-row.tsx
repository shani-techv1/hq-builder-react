"use client";

import * as React from "react";
import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface PropertyRowProps {
  label: string;
  /** Associates the label with the control. */
  htmlFor?: string;
  /** Explanation shown behind an info icon beside the label. */
  tooltip?: string;
  /** `row` puts the control beside the label; `stack` puts it underneath. */
  layout?: "row" | "stack";
  /** Message under the control — warnings colour themselves. */
  validation?: { tone: "info" | "warning" | "error"; message: string };
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

const VALIDATION_TONES = {
  info: "text-muted-foreground",
  warning: "text-amber-600",
  error: "text-destructive",
} as const;

/**
 * Label, control and validation for one property.
 *
 * Every inspector control goes through this so the label column, the control
 * column and the message slot line up down the whole panel — the thing that
 * stops a properties panel reading as a stack of unrelated form fields.
 */
export function PropertyRow({
  label,
  htmlFor,
  tooltip,
  layout = "row",
  validation,
  disabled = false,
  className,
  children,
}: PropertyRowProps) {
  const labelNode = (
    <span className="flex items-center gap-1">
      <label
        htmlFor={htmlFor}
        className={cn(
          "text-[11.5px] font-medium text-muted-foreground",
          layout === "row" && "truncate",
        )}
      >
        {label}
      </label>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                tabIndex={0}
                className="inline-flex cursor-help text-muted-foreground/70 outline-none focus-visible:text-primary"
              />
            }
          >
            <Info className="size-3" strokeWidth={2.2} aria-label={tooltip} />
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );

  return (
    <div
      className={cn(
        layout === "row"
          ? "flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
          : "space-y-1.5",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {labelNode}
      <div className={cn(layout === "row" && "shrink-0")}>{children}</div>

      {validation ? (
        <p
          className={cn(
            "text-[10.5px] leading-tight",
            VALIDATION_TONES[validation.tone],
            layout === "row" && "basis-full text-right",
          )}
        >
          {validation.message}
        </p>
      ) : null}
    </div>
  );
}
