"use client";

import * as React from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ChevronsDown,
  ChevronsUp,
  MousePointerSquareDashed,
  MoveDown,
  MoveUp,
  type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { SectionTitle } from "@/components/common/section-title";
import { useEditorState } from "@/components/editor/editor-state";
import { PropertyToggle } from "@/components/inspector/property-toggle";
import { PanelBody } from "@/components/panels/panel-body";
import { TooltipProvider } from "@/components/ui/tooltip";
import { boundingBox, type CanvasObject } from "@/lib/canvas-objects";
import { SHEET_SAFE_MARGIN_IN, fromInches, sheetInches } from "@/lib/workspace";
import { cn } from "@/lib/utils";

/** Where an edge of the selection is being sent. */
type Alignment = "top" | "left" | "bottom" | "right" | "middle" | "center";

const ALIGNMENTS: Array<{ id: Alignment; label: string; icon: LucideIcon }> = [
  { id: "top", label: "Top", icon: AlignStartHorizontal },
  { id: "left", label: "Left", icon: AlignStartVertical },
  { id: "bottom", label: "Bottom", icon: AlignEndHorizontal },
  { id: "right", label: "Right", icon: AlignEndVertical },
  { id: "middle", label: "Middle", icon: AlignCenterHorizontal },
  { id: "center", label: "Center", icon: AlignCenterVertical },
];

/**
 * Position — line the selection up with the sheet, and order the stack.
 *
 * Alignment moves the selection as one block: the whole bounding box is sent to
 * the edge and each object keeps its offset inside it, so aligning a pair of
 * pieces does not stack them on top of each other.
 *
 * "Keep in safe zone" is the same margin Autofill respects, and for the same
 * reason — artwork flush against the edge of the film comes back trimmed.
 */
export function PositionPanel() {
  const { canvas, settings } = useEditorState();
  const { selectedObjects } = canvas;
  const [keepInSafeZone, setKeepInSafeZone] = React.useState(true);

  const box = boundingBox(selectedObjects);

  if (!box) {
    return (
      <PanelBody>
        <EmptyState
          icon={MousePointerSquareDashed}
          title="Nothing selected"
          description="Select artwork on the sheet to line it up or reorder it."
        />
      </PanelBody>
    );
  }

  const sheet = sheetInches(canvas.sheetSize);
  /* The margin is a real distance, so it is a different percentage per axis. */
  const marginX = keepInSafeZone
    ? (SHEET_SAFE_MARGIN_IN / sheet.width) * 100
    : 0;
  const marginY = keepInSafeZone
    ? (SHEET_SAFE_MARGIN_IN / sheet.height) * 100
    : 0;

  /** Where the selection's box lands, per alignment. */
  const destination = (alignment: Alignment): { x?: number; y?: number } => {
    switch (alignment) {
      case "top":
        return { y: marginY };
      case "bottom":
        return { y: 100 - marginY - box.height };
      case "middle":
        return { y: (100 - box.height) / 2 };
      case "left":
        return { x: marginX };
      case "right":
        return { x: 100 - marginX - box.width };
      case "center":
        return { x: (100 - box.width) / 2 };
    }
  };

  const align = (alignment: Alignment) => {
    const target = destination(alignment);
    const shiftX = target.x === undefined ? 0 : target.x - box.x;
    const shiftY = target.y === undefined ? 0 : target.y - box.y;
    if (shiftX === 0 && shiftY === 0) return;

    // Every object moves by the same amount, which is what keeps a
    // multi-selection's internal arrangement intact.
    canvas.patchObjects(
      selectedObjects.map((object: CanvasObject) => ({
        id: object.id,
        patch: { x: object.x + shiftX, y: object.y + shiftY },
      })),
    );
  };

  const locked = selectedObjects.every((object) => object.locked);
  const single = selectedObjects.length === 1 ? selectedObjects[0] : null;

  return (
    <TooltipProvider delay={300}>
      <PanelBody className="space-y-5">
        <section className="space-y-2.5">
          <SectionTitle title="Align to page" />

          <div className="grid grid-cols-2 gap-2">
            {ALIGNMENTS.map((alignment) => (
              <PositionButton
                key={alignment.id}
                icon={alignment.icon}
                label={alignment.label}
                disabled={locked}
                onClick={() => align(alignment.id)}
              />
            ))}
          </div>

          <PropertyToggle
            label="Keep in safe zone"
            value={keepInSafeZone}
            onChange={setKeepInSafeZone}
            tooltip={`Edges stop ${fromInches(
              SHEET_SAFE_MARGIN_IN,
              settings.unit,
            )} ${settings.unit} short of the sheet, so trimming cannot clip them.`}
          />
        </section>

        <section className="space-y-2.5">
          <SectionTitle title="Layers" />

          {single ? (
            <div className="grid grid-cols-2 gap-2">
              <PositionButton
                icon={MoveUp}
                label="Bring forward"
                disabled={locked}
                onClick={() => canvas.stepObjectOrder(single.id, 1)}
              />
              <PositionButton
                icon={MoveDown}
                label="Send backward"
                disabled={locked}
                onClick={() => canvas.stepObjectOrder(single.id, -1)}
              />
              <PositionButton
                icon={ChevronsUp}
                label="Bring to front"
                disabled={locked}
                onClick={() => canvas.moveObjectToEdge(single.id, "front")}
              />
              <PositionButton
                icon={ChevronsDown}
                label="Send to back"
                disabled={locked}
                onClick={() => canvas.moveObjectToEdge(single.id, "back")}
              />
            </div>
          ) : (
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Stacking moves one layer at a time. Select a single piece of
              artwork to reorder it.
            </p>
          )}
        </section>
      </PanelBody>
    </TooltipProvider>
  );
}

/** One square action in the panel's two-column grids. */
function PositionButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5",
        "text-[12.5px] font-semibold text-foreground shadow-soft transition-colors",
        "outline-none hover:border-primary/40 hover:bg-primary-softer hover:text-primary",
        "focus-visible:ring-3 focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:opacity-45",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden />
      {label}
    </button>
  );
}
