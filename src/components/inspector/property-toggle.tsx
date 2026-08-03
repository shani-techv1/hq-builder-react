"use client";

import * as React from "react";

import { PropertyRow } from "@/components/inspector/property-row";
import { Switch } from "@/components/ui/switch";

export interface PropertyToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  tooltip?: string;
  validation?: { tone: "info" | "warning" | "error"; message: string };
  className?: string;
}

/**
 * An on/off property.
 *
 * A bare row rather than the bordered `SwitchField` used in the left panels —
 * the inspector already groups its rows inside cards, so a second border here
 * would read as a box inside a box.
 */
export function PropertyToggle({
  label,
  value,
  onChange,
  disabled = false,
  tooltip,
  validation,
  className,
}: PropertyToggleProps) {
  const id = React.useId();

  return (
    <PropertyRow
      label={label}
      htmlFor={id}
      tooltip={tooltip}
      validation={validation}
      disabled={disabled}
      className={className}
    >
      <Switch
        id={id}
        checked={value}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </PropertyRow>
  );
}
