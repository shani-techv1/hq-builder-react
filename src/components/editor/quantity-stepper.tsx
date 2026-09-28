"use client";

import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/** A single order can't be an accident or a stress test. */
export const MIN_SHEETS = 1;
export const MAX_SHEETS = 99;

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * How many sheets to order, one step at a time — in the header, and again in
 * the review before the sheet goes in the cart.
 */
export function QuantityStepper({
  value,
  onChange,
  disabled = false,
  className,
}: QuantityStepperProps) {
  const step = (by: number) =>
    onChange(Math.max(MIN_SHEETS, Math.min(MAX_SHEETS, value + by)));

  return (
    <div className={cn("flex items-center rounded-lg border border-border", className)}>
      <StepButton
        label="One fewer sheet"
        icon={Minus}
        onClick={() => step(-1)}
        disabled={value <= MIN_SHEETS || disabled}
      />
      <span
        aria-live="polite"
        aria-label={value === 1 ? "1 sheet" : `${value} sheets`}
        className="w-8 text-center text-[12.5px] font-semibold tabular-nums"
      >
        {value}
      </span>
      <StepButton
        label="One more sheet"
        icon={Plus}
        onClick={() => step(1)}
        disabled={value >= MAX_SHEETS || disabled}
      />
    </div>
  );
}

function StepButton({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: typeof Minus;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-muted-foreground",
        "transition-colors outline-none hover:bg-muted hover:text-foreground",
        "focus-visible:ring-3 focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      <Icon className="size-4" strokeWidth={2} aria-hidden />
    </button>
  );
}
