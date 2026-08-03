"use client";

import {
  Group,
  ImageIcon,
  Layers,
  Lock,
  PenTool,
  Type,
  type LucideIcon,
} from "lucide-react";

import type { CanvasObjectKind } from "@/lib/canvas-objects";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<CanvasObjectKind, LucideIcon> = {
  image: ImageIcon,
  text: Type,
  vector: PenTool,
  group: Group,
};

export interface SelectionBadgeProps {
  /** "Image", "Text", "Vector", "Group", or "3 Selected". */
  label: string;
  /** Absent for a multi-selection, which uses the generic layers icon. */
  kind?: CanvasObjectKind;
  locked?: boolean;
  className?: string;
}

/**
 * The pill above the floating toolbar naming what is selected. Filled rather
 * than outlined so it stays readable over any artwork underneath it.
 */
export function SelectionBadge({
  label,
  kind,
  locked = false,
  className,
}: SelectionBadgeProps) {
  const Icon = kind ? KIND_ICONS[kind] : Layers;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10.5px] font-bold leading-none",
        "shadow-[0_2px_8px_rgb(16_24_40/0.18)]",
        locked
          ? "bg-foreground text-background"
          : "bg-primary text-primary-foreground",
        className,
      )}
    >
      <Icon className="size-3" strokeWidth={2.4} aria-hidden />
      {label}
      {locked ? <Lock className="size-3" strokeWidth={2.6} aria-hidden /> : null}
    </span>
  );
}
