"use client";

import * as React from "react";
import {
  FlipHorizontal,
  FlipVertical,
  Link,
  Lock,
  Trash2,
  Unlink,
  Unlock,
} from "lucide-react";

import { InspectorCard } from "@/components/inspector/inspector-card";
import { InspectorSection } from "@/components/inspector/inspector-section";
import { IconButtonRow } from "@/components/inspector/icon-button-row";
import { MetadataTable } from "@/components/inspector/metadata-table";
import { PropertyInput } from "@/components/inspector/property-input";
import { PropertyRow } from "@/components/inspector/property-row";
import { PropertySlider } from "@/components/inspector/property-slider";
import { QuickActions } from "@/components/inspector/quick-actions";
import { ValidationBadge } from "@/components/inspector/validation-badge";
import type { CanvasInteraction } from "@/hooks/use-canvas-interaction";
import type { WorkspaceSettings } from "@/components/editor/editor-state";
import { KIND_LABELS, type CanvasObject } from "@/lib/canvas-objects";
import { formatUploadDate } from "@/lib/assets";
import {
  PRINT_READY_DPI,
  fromInches,
  sheetInches,
  toInches,
} from "@/lib/workspace";
import { cn } from "@/lib/utils";

export interface ImageInspectorProps {
  object: CanvasObject;
  canvas: CanvasInteraction;
  settings: WorkspaceSettings;
}

/**
 * The inspector for a single non-text object.
 *
 * Ordered by how often each group gets touched: placement first, then
 * transform and opacity, then the two read-only groups. Print validation sits
 * above file information because it is the one section that can stop an order.
 *
 * Geometry is stored as a percentage of the sheet, so every field converts
 * through the sheet's real dimensions and the user's chosen unit — the numbers
 * shown are the ones that end up on the press.
 */
export function ImageInspector({
  object,
  canvas,
  settings,
}: ImageInspectorProps) {
  const [lockRatio, setLockRatio] = React.useState(true);
  const sheet = sheetInches(settings.sheetSize);
  const unit = settings.unit;
  const locked = object.locked;

  /* Percentages of the sheet ⇄ the unit shown in the fields. */
  const toDisplay = (percent: number, axis: "x" | "y") =>
    fromInches((percent / 100) * (axis === "x" ? sheet.width : sheet.height), unit);

  const toPercent = (value: number, axis: "x" | "y") =>
    (toInches(value, unit) / (axis === "x" ? sheet.width : sheet.height)) * 100;

  const ratio = object.height / object.width;

  const setWidth = (next: number) => {
    const width = toPercent(next, "x");
    canvas.patchSelection(
      lockRatio ? { width, height: width * ratio } : { width },
    );
  };

  const setHeight = (next: number) => {
    const height = toPercent(next, "y");
    canvas.patchSelection(
      lockRatio ? { height, width: height / ratio } : { height },
    );
  };

  const dpi = object.source?.dpi ?? null;
  const isVectorSource = dpi === null;
  const isPrintReady = isVectorSource || dpi >= PRINT_READY_DPI;

  return (
    <>
      <InspectorCard>
        <QuickActions
          columns={2}
          actions={[
            {
              id: "lock",
              label: locked ? "Unlock" : "Lock",
              icon: locked ? Unlock : Lock,
              onClick: canvas.toggleLockSelection,
            },
            {
              id: "delete",
              label: "Delete",
              icon: Trash2,
              tone: "danger",
              onClick: canvas.deleteSelection,
              disabled: locked,
            },
          ]}
        />
      </InspectorCard>

      <InspectorSection
        id="object-position"
        title="Position"
        summary={`${toDisplay(object.x, "x")} · ${toDisplay(object.y, "y")}`}
      >
        <div className="grid grid-cols-2 gap-2">
          <PropertyInput
            bare
            label="X position"
            value={toDisplay(object.x, "x")}
            onChange={(next) => canvas.patchSelection({ x: toPercent(next, "x") })}
            unit={unit}
            disabled={locked}
            step={0.1}
          />
          <PropertyInput
            bare
            label="Y position"
            value={toDisplay(object.y, "y")}
            onChange={(next) => canvas.patchSelection({ y: toPercent(next, "y") })}
            unit={unit}
            disabled={locked}
            step={0.1}
          />
        </div>
      </InspectorSection>

      <InspectorSection
        id="object-size"
        title="Size"
        summary={`${toDisplay(object.width, "x")} × ${toDisplay(object.height, "y")}`}
      >
        <div className="flex items-end gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2">
            <PropertyInput
              bare
              label="Width"
              value={toDisplay(object.width, "x")}
              onChange={setWidth}
              unit={unit}
              min={0.1}
              step={0.1}
              disabled={locked}
            />
            <PropertyInput
              bare
              label="Height"
              value={toDisplay(object.height, "y")}
              onChange={setHeight}
              unit={unit}
              min={0.1}
              step={0.1}
              disabled={locked}
            />
          </div>

          <button
            type="button"
            onClick={() => setLockRatio((current) => !current)}
            aria-pressed={lockRatio}
            aria-label={lockRatio ? "Unlock aspect ratio" : "Lock aspect ratio"}
            title={lockRatio ? "Unlock aspect ratio" : "Lock aspect ratio"}
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg border transition-colors outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/40",
              lockRatio
                ? "border-primary/40 bg-primary-soft text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {lockRatio ? (
              <Link className="size-3.5" strokeWidth={2.2} />
            ) : (
              <Unlink className="size-3.5" strokeWidth={2.2} />
            )}
          </button>
        </div>
      </InspectorSection>

      <InspectorSection
        id="object-transform"
        title="Transform"
        summary={`${object.rotation}°`}
      >
        <PropertyInput
          label="Rotation"
          value={object.rotation}
          onChange={(rotation) => canvas.patchSelection({ rotation })}
          unit="°"
          min={-360}
          max={360}
          disabled={locked}
        />

        <PropertyRow label="Flip" disabled={locked}>
          <IconButtonRow
            fill={false}
            choices={[
              {
                id: "flip-h",
                label: "Flip horizontal",
                icon: FlipHorizontal,
                active: object.flipHorizontal ?? false,
                onClick: () =>
                  canvas.patchSelection({
                    flipHorizontal: !(object.flipHorizontal ?? false),
                  }),
              },
              {
                id: "flip-v",
                label: "Flip vertical",
                icon: FlipVertical,
                active: object.flipVertical ?? false,
                onClick: () =>
                  canvas.patchSelection({
                    flipVertical: !(object.flipVertical ?? false),
                  }),
              },
            ]}
          />
        </PropertyRow>

        <PropertySlider
          label="Opacity"
          value={object.opacity}
          onChange={(opacity) => canvas.setSelectionOpacity(opacity)}
          disabled={locked}
        />
      </InspectorSection>

      <InspectorSection
        id="object-print"
        title="Print"
        badge={
          <ValidationBadge
            compact
            tone={isPrintReady ? "ok" : "warning"}
            label={isPrintReady ? "Print ready" : "Check DPI"}
          />
        }
      >
        <ValidationBadge
          tone={isPrintReady ? "ok" : "warning"}
          label={
            isPrintReady
              ? "Print ready"
              : `Resolution below ${PRINT_READY_DPI} DPI`
          }
          detail={
            isVectorSource
              ? "Vector artwork scales to any size without losing detail."
              : isPrintReady
                ? "Resolution passes at this size."
                : `At this size the artwork prints at ${dpi} DPI. Scale it down or replace it with a higher-resolution file.`
          }
        />

        <MetadataTable
          entries={[
            {
              label: "Resolution",
              value: isVectorSource ? "Vector" : `${dpi} DPI`,
            },
            { label: "Required", value: `${PRINT_READY_DPI} DPI`, muted: true },
          ]}
        />
      </InspectorSection>

      <InspectorSection id="object-file" title="File" defaultOpen={false}>
        <MetadataTable
          entries={[
            {
              label: "Filename",
              value: object.source?.fileName ?? object.name,
            },
            {
              label: "Type",
              value: object.source?.fileType ?? KIND_LABELS[object.kind],
            },
            {
              label: "Transparency",
              value: object.source?.transparent ? "Transparent" : "Flattened",
            },
            {
              label: "Colour mode",
              value: object.source?.colorMode ?? "RGB",
            },
            {
              label: "Uploaded",
              value: object.source
                ? formatUploadDate(object.source.uploadedAt)
                : "—",
              muted: !object.source,
            },
          ]}
        />
      </InspectorSection>
    </>
  );
}
