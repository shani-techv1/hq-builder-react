"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CloudUpload } from "lucide-react";

import { PrimaryButton } from "@/components/common/primary-button";
import { MAX_UPLOAD_LABEL, SUPPORTED_FILE_TYPES } from "@/lib/assets";
import { cn } from "@/lib/utils";

export interface UploadCardProps {
  /** Fired when the drop zone or its button is activated. */
  onBrowse?: () => void;
  /**
   * `full` is the hero drop zone shown to an empty library; `compact` is the
   * slim button it collapses into once there is artwork to look at.
   */
  variant?: "full" | "compact";
  className?: string;
}

/**
 * The drag-and-drop drop zone at the top of the Graphics panel.
 *
 * Drag events are tracked purely to drive the hover treatment — this phase has
 * no upload pipeline, so a dropped file is acknowledged visually and nothing
 * else. `dragDepth` counts enter/leave pairs because dragging across a child
 * element fires `dragleave` on the parent, which would otherwise flicker the
 * active state off and on.
 *
 * Both variants share that drag handling, so dropping onto the collapsed
 * button behaves exactly like dropping onto the full card.
 */
export function UploadCard({
  onBrowse,
  variant = "full",
  className,
}: UploadCardProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const dragDepth = React.useRef(0);

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
  };

  const dragHandlers = {
    onDragEnter: handleDragEnter,
    onDragOver: (event: React.DragEvent) => event.preventDefault(),
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  if (variant === "compact") {
    return (
      <div
        {...dragHandlers}
        className={cn(
          "rounded-xl border-2 border-dashed p-1 transition-colors duration-200",
          isDragging
            ? "border-primary bg-primary-soft"
            : "border-transparent",
          className,
        )}
      >
        <PrimaryButton icon={CloudUpload} onClick={onBrowse} size="md">
          {isDragging ? "Drop to upload" : "Upload artwork"}
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div
      {...dragHandlers}
      className={cn(
        "relative overflow-hidden rounded-card border-2 border-dashed p-6 text-center transition-colors duration-200",
        isDragging
          ? "border-primary bg-primary-soft"
          : "border-border bg-primary-softer/60 hover:border-primary/45 hover:bg-primary-softer",
        className,
      )}
    >
      <motion.div
        animate={isDragging ? { scale: 1.04 } : { scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 24 }}
        className="flex flex-col items-center gap-1"
      >
        <span
          className={cn(
            "mb-3 grid size-14 place-items-center rounded-2xl transition-colors",
            isDragging
              ? "bg-primary text-primary-foreground shadow-primary"
              : "bg-card text-primary shadow-card",
          )}
        >
          <CloudUpload className="size-6" strokeWidth={1.9} aria-hidden />
        </span>

        <p className="text-sm font-bold tracking-tight text-foreground">
          {isDragging ? "Drop to add your artwork" : "Drag & drop your artwork"}
        </p>
        <p className="text-xs text-muted-foreground">
          or browse the files on your device
        </p>
      </motion.div>

      <PrimaryButton
        icon={CloudUpload}
        onClick={onBrowse}
        className="mt-4"
        size="md"
      >
        Upload files
      </PrimaryButton>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
        {SUPPORTED_FILE_TYPES.map((type: string) => (
          <span
            key={type}
            className="rounded-md bg-card px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground shadow-soft"
          >
            {type}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {MAX_UPLOAD_LABEL}
      </p>
    </div>
  );
}
