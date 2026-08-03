"use client";

import { motion } from "framer-motion";
import { FileUp, X } from "lucide-react";

import { formatFileSize } from "@/lib/assets";
import type { UploadTask } from "@/hooks/use-asset-library";
import { cn } from "@/lib/utils";

export interface UploadProgressCardProps {
  task: UploadTask;
  onCancel?: () => void;
  className?: string;
}

/**
 * A file mid-upload.
 *
 * Shows the name, the weight and a determinate bar — determinate because the
 * real pipeline will report bytes transferred, and a spinner here would have
 * to be replaced rather than wired up.
 */
export function UploadProgressCard({
  task,
  onCancel,
  className,
}: UploadProgressCardProps) {
  const isFinishing = task.progress >= 100;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 shadow-soft",
        className,
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        <FileUp className="size-[17px]" strokeWidth={1.9} aria-hidden />
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[11.5px] font-semibold text-foreground">
            {task.name}
          </p>
          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {isFinishing ? "Processing…" : `${task.progress}%`}
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={task.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Uploading ${task.name}`}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <motion.span
            animate={{ width: `${task.progress}%` }}
            transition={{ ease: "linear", duration: 0.18 }}
            className="block h-full rounded-full bg-primary"
          />
        </div>

        <p className="text-[10px] text-muted-foreground">
          {formatFileSize(task.sizeBytes)}
        </p>
      </div>

      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          aria-label={`Cancel upload of ${task.name}`}
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-lg text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          )}
        >
          <X className="size-3.5" strokeWidth={2.4} />
        </button>
      ) : null}
    </motion.div>
  );
}
