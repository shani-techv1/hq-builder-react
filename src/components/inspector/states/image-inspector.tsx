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
import {
  formatFileSize,
  formatUploadDate,
  isVectorAsset,
  printReadyInches,
  type Asset,
} from "@/lib/assets";
import {
  PRINT_READY_DPI,
  effectiveDpi,
  fromInches,
  sheetInches,
  toInches,
  type MeasurementUnit,
} from "@/lib/workspace";
import { cn } from "@/lib/utils";

/** The widest this artwork prints while still holding {@link PRINT_READY_DPI}. */
const printReadyWidth = (asset: Asset, unit: MeasurementUnit) =>
  `${fromInches(printReadyInches(asset.width), unit)} ${unit}`;

export interface ImageInspectorProps {
  object: CanvasObject;
  /** The library asset behind the object, when it has one. */
  asset: Asset | undefined;
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
  asset,
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

  /* -------------------------- Print resolution -------------------------- */

  /** What the artwork actually measures on the sheet right now. */
  const renderedWidth = (object.width / 100) * sheet.width;
  const renderedHeight = (object.height / 100) * sheet.height;

  /**
   * Real DPI, recomputed on every resize.
   *
   * Uploaded artwork carries no stored resolution — the same file is 600 DPI
   * across two inches and 120 across ten — so the figure comes from the file's
   * pixels divided by the size it is currently placed at. Objects with no
   * asset behind them fall back to whatever their mock source declared.
   */
  const isVectorSource = asset ? isVectorAsset(asset) : !object.source?.dpi;
  const dpi = asset
    ? isVectorSource
      ? null
      : effectiveDpi(asset.width, renderedWidth)
    : (object.source?.dpi ?? null);

  // A warning, never a block: low-resolution artwork still places, and the
  // operator decides whether it is good enough for the job.
  const isPrintReady = dpi === null || dpi >= PRINT_READY_DPI;

  const uploadedAt = asset?.uploadedAt ?? object.source?.uploadedAt;

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
          data-inspector-focus="opacity"
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
                : `At this size the artwork prints at ${dpi} DPI. Scale it down${
                    asset
                      ? ` — it holds ${PRINT_READY_DPI} DPI up to ${printReadyWidth(
                          asset,
                          unit,
                        )} wide — or replace it with a higher-resolution file.`
                      : " or replace it with a higher-resolution file."
                  }`
          }
        />

        <MetadataTable
          entries={[
            {
              label: "Current DPI",
              value: isVectorSource ? "Vector" : `${dpi} DPI`,
            },
            { label: "Required", value: `${PRINT_READY_DPI} DPI`, muted: true },
            {
              label: "Rendered size",
              value: `${fromInches(renderedWidth, unit)} × ${fromInches(
                renderedHeight,
                unit,
              )} ${unit}`,
            },
            {
              label: "Original size",
              value: asset
                ? `${asset.width} × ${asset.height} px`
                : "—",
              muted: !asset,
            },
          ]}
        />
      </InspectorSection>

      <InspectorSection id="object-file" title="File" defaultOpen={false}>
        <MetadataTable
          entries={[
            {
              label: "Filename",
              value: asset?.name ?? object.source?.fileName ?? object.name,
            },
            {
              label: "Format",
              value:
                asset?.format ??
                object.source?.fileType ??
                KIND_LABELS[object.kind],
            },
            {
              label: "File size",
              value: asset ? formatFileSize(asset.sizeBytes) : "—",
              muted: !asset,
            },
            {
              label: "Transparency",
              value: (asset?.transparent ?? object.source?.transparent)
                ? "Transparent"
                : "Flattened",
            },
            {
              label: "Colour mode",
              // Anything decoded in the browser is RGB by the time it is here.
              value: asset ? "RGB" : (object.source?.colorMode ?? "RGB"),
            },
            {
              label: "Uploaded",
              value: uploadedAt ? formatUploadDate(uploadedAt) : "—",
              muted: !uploadedAt,
            },
          ]}
        />
      </InspectorSection>
    </>
  );
}
