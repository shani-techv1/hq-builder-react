"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";

import { ValidationBadge } from "@/components/inspector/validation-badge";
import type { UploadRejection } from "@/lib/asset-upload";
import { cn } from "@/lib/utils";

export interface UploadRejectionsProps {
  rejections: UploadRejection[];
  onDismiss: () => void;
  className?: string;
}

/**
 * Files the library refused, and why.
 *
 * One entry per file rather than a single summary: a drop of six files where
 * two were the wrong type should say *which* two, and dropping five good files
 * and one bad one must not read as though the whole batch failed.
 *
 * Stays until dismissed or until the next upload replaces it. A message that
 * disappears on a timer is one the user can miss entirely.
 */
export function UploadRejections({
  rejections,
  onDismiss,
  className,
}: UploadRejectionsProps) {
  if (rejections.length === 0) return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      role="alert"
      className={cn("space-y-1.5", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-muted-foreground">
          {rejections.length === 1
            ? "1 file wasn’t added"
            : `${rejections.length} files weren’t added`}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss upload errors"
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          )}
        >
          <X className="size-3.5" strokeWidth={2.4} />
        </button>
      </div>

      {rejections.map((rejection, index) => (
        <ValidationBadge
          // File names repeat within a drop, so position is part of identity.
          key={`${rejection.fileName}-${index}`}
          tone="error"
          label={rejection.fileName}
          detail={rejection.message}
        />
      ))}
    </motion.div>
  );
}
