import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Product mark. Horizontal by default for the header; the wordmark drops away
 * on narrow screens so the mark alone anchors the left edge.
 */
export function AppLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-primary to-[#0f6ede] text-primary-foreground shadow-primary">
        <Sparkles className="size-[18px]" strokeWidth={2.2} aria-hidden />
      </span>
      <span className="hidden text-[15px] font-bold tracking-tight text-foreground sm:block">
        Design Builder
      </span>
    </span>
  );
}
