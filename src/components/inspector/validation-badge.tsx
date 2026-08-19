"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type ValidationTone = "ok" | "warning" | "error" | "info";

export interface ValidationBadgeProps {
  tone: ValidationTone;
  label: string;
  /** Second line — why it matters, or what to do about it. */
  detail?: string;
  /** Compact pill with no detail line, for inline use. */
  compact?: boolean;
  className?: string;
}

const TONES = {
  ok: {
    icon: CircleCheck,
    surface: "border-emerald-200 bg-emerald-50 text-emerald-700",
    accent: "border-l-emerald-400",
    iconColor: "text-emerald-600",
  },
  warning: {
    icon: TriangleAlert,
    surface: "border-amber-200 bg-amber-50 text-amber-800",
    accent: "border-l-amber-400",
    iconColor: "text-amber-600",
  },
  error: {
    icon: CircleAlert,
    surface: "border-rose-200 bg-rose-50 text-rose-700",
    accent: "border-l-rose-400",
    iconColor: "text-rose-600",
  },
  info: {
    icon: Info,
    surface: "border-border bg-muted text-muted-foreground",
    // Structure without colour: neutral news has nothing to flag.
    accent: "border-l-border",
    iconColor: "text-muted-foreground",
  },
} as const;

/**
 * Print-readiness verdict.
 *
 * Colour alone doesn't carry it — each tone has its own icon and its own
 * wording, so the state survives a monochrome screen and a colour-blind
 * reader, which for a print warning is the whole point.
 */
export function ValidationBadge({
  tone,
  label,
  detail,
  compact = false,
  className,
}: ValidationBadgeProps) {
  const { icon: Icon, surface, accent, iconColor } = TONES[tone];

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
          "text-[10.5px] font-bold leading-none",
          surface,
          className,
        )}
      >
        <Icon className={cn("size-3", iconColor)} strokeWidth={2.4} aria-hidden />
        {label}
      </span>
    );
  }

  return (
    <div
      className={cn(
        // The accent edge is what makes a verdict scannable in a column of
        // cards: the tone is legible from the margin, before any of it is read.
        "flex items-start gap-2.5 rounded-xl border border-l-[3px] px-3 py-2.5",
        surface,
        accent,
        className,
      )}
    >
      <Icon
        className={cn("mt-px size-4 shrink-0", iconColor)}
        strokeWidth={2.2}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-[11.5px] font-bold leading-tight">{label}</p>
        {detail ? (
          <p className="mt-1 text-[10.5px] leading-relaxed opacity-85">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
