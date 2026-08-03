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
    iconColor: "text-emerald-600",
  },
  warning: {
    icon: TriangleAlert,
    surface: "border-amber-200 bg-amber-50 text-amber-800",
    iconColor: "text-amber-600",
  },
  error: {
    icon: CircleAlert,
    surface: "border-rose-200 bg-rose-50 text-rose-700",
    iconColor: "text-rose-600",
  },
  info: {
    icon: Info,
    surface: "border-border bg-muted text-muted-foreground",
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
  const { icon: Icon, surface, iconColor } = TONES[tone];

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
        "flex items-start gap-2 rounded-xl border px-2.5 py-2",
        surface,
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
          <p className="mt-0.5 text-[10.5px] leading-relaxed opacity-85">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
