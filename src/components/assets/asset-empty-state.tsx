"use client";

import { motion } from "framer-motion";
import { FolderOpen, SearchX, Upload, type LucideIcon } from "lucide-react";

import { PrimaryButton } from "@/components/common/primary-button";
import { cn } from "@/lib/utils";

export type AssetEmptyVariant = "library" | "search";

export interface AssetEmptyStateProps {
  variant: AssetEmptyVariant;
  /** Uploads for the empty library, clears the search otherwise. */
  onAction: () => void;
  className?: string;
}

interface EmptyCopy {
  icon: LucideIcon;
  title: string;
  description: string;
  action: { label: string; icon: LucideIcon };
}

/**
 * Each state says what is missing and what to do about it — an empty library
 * needs an upload, an empty search needs clearing, and treating them the same
 * is what makes a new library feel broken rather than new.
 */
const COPY: Record<AssetEmptyVariant, EmptyCopy> = {
  library: {
    icon: FolderOpen,
    title: "Your library is empty",
    description:
      "Upload artwork once and reuse it across every sheet you build.",
    action: { label: "Upload artwork", icon: Upload },
  },
  search: {
    icon: SearchX,
    title: "No assets match",
    description: "Try a different name, or clear the search.",
    action: { label: "Clear search", icon: SearchX },
  },
};

/** Empty state for the asset library, in each of the ways it can be empty. */
export function AssetEmptyState({
  variant,
  onAction,
  className,
}: AssetEmptyStateProps) {
  const copy = COPY[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center rounded-card border border-dashed border-border",
        "bg-muted/50 px-6 py-8 text-center",
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-card text-muted-foreground shadow-soft">
        <copy.icon className="size-5" strokeWidth={1.9} aria-hidden />
      </span>

      <h3 className="mt-3 text-[13.5px] font-bold tracking-tight text-foreground">
        {copy.title}
      </h3>
      <p className="mt-1 max-w-[32ch] text-xs leading-relaxed text-muted-foreground">
        {copy.description}
      </p>

      <PrimaryButton
        icon={copy.action.icon}
        size="md"
        block={false}
        onClick={onAction}
        className="mt-4"
      >
        {copy.action.label}
      </PrimaryButton>
    </motion.div>
  );
}
