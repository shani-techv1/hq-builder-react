"use client";

import { motion } from "framer-motion";
import { ImageIcon, Upload } from "lucide-react";

import { PrimaryButton } from "@/components/common/primary-button";
import { SHEET_FORMATS } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export interface CanvasEmptyStateProps {
  onUpload?: () => void;
  className?: string;
}

/**
 * What an empty sheet shows.
 *
 * Sits inside the sheet rather than over the workspace, so the invitation to
 * add artwork lands exactly where the artwork will go. Everything is centred
 * on one narrow column — an empty state that spans the full sheet reads as
 * chrome, not as an offer.
 */
export function CanvasEmptyState({
  onUpload,
  className,
}: CanvasEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={cn(
        "flex w-full max-w-[340px] flex-col items-center px-6 text-center",
        className,
      )}
    >
      <ArtworkIllustration />

      <h3 className="mt-5 text-[17px] font-bold tracking-tight text-foreground">
        Start your design
      </h3>
      <p className="mt-1.5 max-w-[30ch] text-[12.5px] leading-relaxed text-muted-foreground">
        Drag &amp; drop artwork here or upload from your assets.
      </p>

      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5">
        {SHEET_FORMATS.map((format) => (
          <span
            key={format}
            className="rounded-md border border-border/70 bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground"
          >
            {format}
          </span>
        ))}
      </div>

      <PrimaryButton
        icon={Upload}
        size="md"
        block={false}
        onClick={onUpload}
        className="mt-6 min-w-[160px]"
      >
        Upload Artwork
      </PrimaryButton>
    </motion.div>
  );
}

/**
 * Illustration placeholder — a stack of artwork boards rather than a stock
 * drawing, so it reads as "your files go here" without committing to a style
 * the brand hasn't chosen yet.
 */
function ArtworkIllustration() {
  return (
    <motion.div
      aria-hidden
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      className="relative grid h-[92px] w-[132px] place-items-center"
    >
      <span className="absolute left-1 top-4 size-16 -rotate-[10deg] rounded-xl border border-border/70 bg-card shadow-soft" />
      <span className="absolute right-1 top-3 size-16 rotate-[10deg] rounded-xl border border-border/70 bg-linear-to-br from-primary-soft to-primary-softer shadow-soft" />
      <span className="relative grid size-[68px] place-items-center rounded-2xl border border-border/70 bg-card shadow-card">
        <ImageIcon
          className="size-6 text-primary"
          strokeWidth={1.7}
          aria-hidden
        />
      </span>
    </motion.div>
  );
}
