"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Link2Off, Sparkles } from "lucide-react";

import { CanvaProjectCard } from "@/components/canva/canva-project-card";
import { EmptyState } from "@/components/common/empty-state";
import { PrimaryButton } from "@/components/common/primary-button";
import { useEditorState } from "@/components/editor/editor-state";
import { PanelBody } from "@/components/panels/panel-body";
import type { PanelBodyProps } from "@/components/panels/panel-content";
import { ValidationBadge } from "@/components/inspector/validation-badge";
import { useCanva } from "@/hooks/use-canva";
import { cn } from "@/lib/utils";

/**
 * Canva — the user's designs, ready to place.
 *
 * Two states, switched wholesale rather than greyed in and out: not connected,
 * and connected. Importing goes through the same upload pipeline a dragged-in
 * file uses, so a Canva design becomes an ordinary library asset the moment it
 * lands and behaves like one from then on.
 */
export function CanvaPanel({ onOpenPanel }: PanelBodyProps) {
  const canva = useCanva();
  const { library, placeAsset } = useEditorState();

  /**
   * Export, then treat it as any other upload.
   *
   * `uploadFiles` is what gives the design its thumbnail, dimensions,
   * transparency and place in the saved draft — none of which needs a Canva
   * code path of its own.
   *
   * On success the user is handed to Graphics. The design is now an ordinary
   * library asset and everything they might do next — place it again, rename
   * it, check its resolution — lives there, while this panel has nothing left
   * to say about it.
   */
  const handleImport = async (projectId: string) => {
    const file = await canva.importDesign(projectId);
    if (!file) return;

    const [asset] = await library.uploadFiles([file]);
    // A failed upload leaves the panel where it is, with the reason on screen.
    if (!asset) return;

    // The asset, not its id: it was created a moment ago and is not in the
    // library this component closed over yet. See `placeAssetById`.
    placeAsset(asset);
    onOpenPanel("graphics");
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <PanelBody className="space-y-4">
        {canva.error ? (
          <ValidationBadge
            tone="error"
            label="Canva"
            detail={canva.error}
          />
        ) : null}

        {canva.status === "disconnected" ? (
          <Disconnected onConnect={canva.connect} onRetry={canva.retry} />
        ) : (
          <Connected canva={canva} onImport={handleImport} />
        )}
      </PanelBody>
    </div>
  );
}

/* ------------------------------ Not connected ----------------------------- */

function Disconnected({
  onConnect,
  onRetry,
}: {
  onConnect: () => void;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center rounded-card border border-dashed border-border",
        "bg-muted/50 px-6 py-8 text-center",
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-card text-primary shadow-soft">
        <Sparkles className="size-5" strokeWidth={1.9} aria-hidden />
      </span>

      <h3 className="mt-3 text-[13.5px] font-bold tracking-tight text-foreground">
        Connect your Canva account
      </h3>
      <p className="mt-1 max-w-[32ch] text-xs leading-relaxed text-muted-foreground">
        Bring designs you have already made straight onto the sheet, at print
        resolution.
      </p>

      <PrimaryButton
        icon={Sparkles}
        size="md"
        block={false}
        onClick={onConnect}
        className="mt-4"
      >
        Connect Canva
      </PrimaryButton>

      {/* A sign-in that opens in a new window can be missed entirely. */}
      <p className="mt-2 text-[10.5px] text-muted-foreground">
        Opens in a new window. Your design stays as it is.
      </p>

      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "mt-3 rounded-md px-2 py-1 text-[10.5px] font-semibold text-muted-foreground",
          "transition-colors hover:bg-muted hover:text-foreground",
          "outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        )}
      >
        Already connected? Check again
      </button>
    </motion.div>
  );
}

/* -------------------------------- Connected ------------------------------- */

function Connected({
  canva,
  onImport,
}: {
  canva: ReturnType<typeof useCanva>;
  onImport: (projectId: string) => Promise<void>;
}) {
  if (canva.isLoading) {
    return <ProjectSkeleton />;
  }

  if (canva.projects.length === 0) {
    return (
      <>
        <AccountRow onDisconnect={canva.disconnect} />
        <EmptyState
          icon={Sparkles}
          title="No designs yet"
          description="Designs you create in Canva will appear here."
        />
      </>
    );
  }

  return (
    <>
      <AccountRow onDisconnect={canva.disconnect} />

      <div className="grid grid-cols-2 gap-2.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {canva.projects.map((project) => (
            <CanvaProjectCard
              key={project.id}
              project={project}
              isImporting={canva.importingId === project.id}
              isBusy={canva.importingId !== null}
              onImport={() => void onImport(project.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {canva.hasMore ? (
        <PrimaryButton
          variant="outline"
          size="md"
          onClick={canva.loadMore}
          disabled={canva.isLoadingMore}
        >
          {canva.isLoadingMore ? "Loading…" : "Load more"}
        </PrimaryButton>
      ) : null}
    </>
  );
}

function AccountRow({ onDisconnect }: { onDisconnect: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-2.5 py-2">
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-foreground">
        <Sparkles className="size-3.5 text-primary" strokeWidth={2.2} aria-hidden />
        Canva connected
      </span>

      <button
        type="button"
        onClick={onDisconnect}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] font-semibold",
          "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          "outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        )}
      >
        <Link2Off className="size-3" strokeWidth={2.4} aria-hidden />
        Disconnect
      </button>
    </div>
  );
}

/** Placeholder cards, so the grid keeps its shape while the first page loads. */
function ProjectSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5" aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <div className="aspect-4/3 animate-pulse bg-muted" />
          <div className="space-y-1.5 px-2 py-2">
            <div className="h-2.5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-2 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
