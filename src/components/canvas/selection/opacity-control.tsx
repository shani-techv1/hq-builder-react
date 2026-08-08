"use client";

import { Blend } from "lucide-react";

import { ToolbarAction } from "@/components/canvas/selection/toolbar-action";

export interface OpacityControlProps {
  /** Opens the Settings panel on the opacity row. */
  onOpen: () => void;
}

/**
 * Opacity, as a jump to the inspector rather than a control of its own.
 *
 * It used to be a popover with a second slider in it. Two controls for one
 * property is one too many — they had to be kept in step, and the popover sat
 * over the artwork you were adjusting the opacity of, which is the one thing
 * you need to see while you do it. The panel is a column beside the sheet, so
 * nothing is covered.
 */
export function OpacityControl({ onOpen }: OpacityControlProps) {
  return <ToolbarAction icon={Blend} label="Opacity" onClick={onOpen} />;
}
