"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AssetSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Result count, shown once a query narrows the library. */
  resultCount?: number;
  className?: string;
}

/**
 * The library's search field.
 *
 * Filtering is by file name only — enough to prove the interaction while the
 * catalogue is mock. The clear button appears rather than always occupying the
 * end of the field, so an empty search stays visually quiet.
 */
export function AssetSearch({
  value,
  onChange,
  resultCount,
  className,
}: AssetSearchProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />

      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search your assets..."
        aria-label="Search your assets"
        className={cn(
          "h-10 rounded-xl border-border bg-muted/60 pl-9 text-sm shadow-none",
          "transition-colors focus-visible:bg-card",
          value ? "pr-16" : "pr-3",
          // Safari renders its own clear affordance on search inputs.
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />

      <AnimatePresence>
        {value ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.14 }}
            className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1"
          >
            {typeof resultCount === "number" ? (
              <span className="text-[10.5px] font-semibold tabular-nums text-muted-foreground">
                {resultCount}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Clear search"
              className={cn(
                "grid size-6 place-items-center rounded-lg text-muted-foreground",
                "transition-colors hover:bg-muted hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              )}
            >
              <X className="size-3.5" strokeWidth={2.4} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
