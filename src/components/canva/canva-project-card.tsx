"use client";

import { motion } from "framer-motion";
import { LoaderCircle, Plus } from "lucide-react";

import { formatUploadDate } from "@/lib/assets";
import type { CanvaProject } from "@/lib/canva";
import { cn } from "@/lib/utils";

export interface CanvaProjectCardProps {
  project: CanvaProject;
  /** True while this design is being exported. */
  isImporting: boolean;
  /** True while any design is, so the grid can't queue a second export. */
  isBusy: boolean;
  onImport: () => void;
}

/** ISO timestamp → the same date format the asset library uses. */
const editedOn = (iso: string | null) =>
  iso ? formatUploadDate(iso.slice(0, 10)) : null;

/**
 * One Canva design in the picker.
 *
 * The image is Canva's thumbnail — a preview, and never what gets placed. The
 * full-resolution export only happens once this card is chosen, which is why
 * the card is a button rather than something draggable: there is nothing to
 * drag until the export has run.
 */
export function CanvaProjectCard({
  project,
  isImporting,
  isBusy,
  onImport,
}: CanvaProjectCardProps) {
  const edited = editedOn(project.updatedAt);

  return (
    <motion.button
      type="button"
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      onClick={onImport}
      disabled={isBusy}
      aria-label={`Add ${project.title} to the sheet`}
      className={cn(
        "group/canva relative overflow-hidden rounded-xl border border-border bg-card text-left shadow-soft",
        "transition-[border-color,box-shadow] duration-200 outline-none",
        "hover:border-primary/35 hover:shadow-card",
        "focus-visible:ring-3 focus-visible:ring-ring/40",
        "disabled:cursor-not-allowed",
        // Only the card being imported dims; the rest stay legible.
        isBusy && !isImporting && "opacity-60",
      )}
    >
      <div className="bg-checkerboard relative aspect-4/3 overflow-hidden">
        {project.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element --
             a remote Canva CDN URL of unknown dimensions; the optimiser would
             need it allow-listed per host and gains nothing on a preview. */
          <img
            src={project.thumbnail}
            alt=""
            loading="lazy"
            className={cn(
              "absolute inset-0 size-full object-contain p-1.5",
              "transition-transform duration-300 group-hover/canva:scale-[1.04]",
            )}
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-[10px] text-muted-foreground">
            No preview
          </span>
        )}

        <span
          aria-hidden
          className={cn(
            "absolute inset-0 grid place-items-center bg-foreground/45 backdrop-blur-[1px]",
            "transition-opacity duration-200",
            isImporting
              ? "opacity-100"
              : "opacity-0 group-hover/canva:opacity-100",
          )}
        >
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-card px-2 py-1 text-[11px] font-bold text-foreground shadow-card">
            {isImporting ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2.4} />
                Exporting…
              </>
            ) : (
              <>
                <Plus className="size-3.5" strokeWidth={2.6} />
                Add to sheet
              </>
            )}
          </span>
        </span>
      </div>

      <div className="space-y-0.5 px-2 py-2">
        <p
          className="truncate text-[11.5px] font-semibold text-foreground"
          title={project.title}
        >
          {project.title}
        </p>
        <p className="truncate text-[10px] leading-tight text-muted-foreground">
          {edited ? `Edited ${edited}` : "Canva design"}
        </p>
      </div>
    </motion.button>
  );
}
