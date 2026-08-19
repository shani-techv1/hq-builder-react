"use client";

import { ImageOff, RotateCcw } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { SectionTitle } from "@/components/common/section-title";
import { useEditorState } from "@/components/editor/editor-state";
import { PropertySlider } from "@/components/inspector/property-slider";
import { PanelBody } from "@/components/panels/panel-body";
import { NEUTRAL_ADJUSTMENTS, type CanvasObject } from "@/lib/canvas-objects";
import {
  FILTER_PRESETS,
  NO_FILTER,
  cssFilter,
  hasLook,
  type FilterPreset,
} from "@/lib/image-filters";
import { cn } from "@/lib/utils";

/**
 * Filters — a look for the selected artwork, and the dials behind it.
 *
 * Only ever about one piece of artwork: a look is judged against the picture it
 * is on, and a grid of thumbnails showing three different pictures at once
 * would be a worse decision aid than no grid at all.
 *
 * The previews are the object's own thumbnail under the same numbers the canvas
 * applies, so choosing from the grid is choosing what prints — see
 * `lib/image-filters`, which is where both halves come from.
 */
export function FiltersPanel() {
  const { canvas, findAsset } = useEditorState();
  const { selectedObjects } = canvas;

  const object = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const asset = findAsset(object?.assetId);

  if (!object || !asset) {
    return (
      <PanelBody>
        <EmptyState
          icon={ImageOff}
          title={
            selectedObjects.length > 1
              ? "One piece at a time"
              : "No artwork selected"
          }
          description={
            selectedObjects.length > 1
              ? "A look is judged against the picture it is on. Select a single image."
              : "Select an uploaded image on the sheet to give it a look."
          }
        />
      </PanelBody>
    );
  }

  const adjustments = object.adjustments ?? NEUTRAL_ADJUSTMENTS;
  const activePreset = object.filter ?? NO_FILTER;

  const setAdjustment = (key: keyof typeof adjustments, value: number) =>
    canvas.patchObject(object.id, { adjustments: { [key]: value } });

  return (
    <PanelBody className="space-y-5">
      <section className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle title="Adjust" />
          {hasLook(object) ? (
            <button
              type="button"
              onClick={() =>
                canvas.patchObject(object.id, {
                  filter: NO_FILTER,
                  adjustments: NEUTRAL_ADJUSTMENTS,
                })
              }
              className={cn(
                "inline-flex items-center gap-1 rounded-md text-[11.5px] font-semibold text-primary",
                "transition-colors outline-none hover:text-primary/80",
                "focus-visible:ring-3 focus-visible:ring-ring/40",
              )}
            >
              <RotateCcw className="size-3" strokeWidth={2.4} aria-hidden />
              Reset
            </button>
          ) : null}
        </div>

        {/* Signed, and centred on zero: the original is the middle of each
            range rather than one end of it, so "back to how it was" is a
            place on the track rather than a number to remember. */}
        <PropertySlider
          label="Brightness"
          value={adjustments.brightness}
          onChange={(value) => setAdjustment("brightness", value)}
          min={-100}
          max={100}
          disabled={object.locked}
        />
        <PropertySlider
          label="Contrast"
          value={adjustments.contrast}
          onChange={(value) => setAdjustment("contrast", value)}
          min={-100}
          max={100}
          disabled={object.locked}
        />
        <PropertySlider
          label="Saturation"
          value={adjustments.saturation}
          onChange={(value) => setAdjustment("saturation", value)}
          min={-100}
          max={100}
          disabled={object.locked}
        />
      </section>

      <section className="space-y-2.5">
        <SectionTitle title="Looks" />

        <div className="grid grid-cols-2 gap-2">
          {FILTER_PRESETS.map((preset) => (
            <PresetTile
              key={preset.id}
              preset={preset}
              thumbnail={asset.thumbnail}
              object={object}
              isActive={preset.id === activePreset}
              onSelect={() =>
                canvas.patchObject(object.id, { filter: preset.id })
              }
            />
          ))}
        </div>

        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          Looks are applied to the artwork on the sheet, not to the file — the
          original stays in Graphics, and undo puts it back.
        </p>
      </section>
    </PanelBody>
  );
}

/**
 * One look, previewed on the artwork it would be applied to.
 *
 * The adjustments ride along in the preview, so the tiles show the picture as
 * it stands rather than as it was uploaded — otherwise every tile would
 * contradict the sheet the moment a slider moved.
 */
function PresetTile({
  preset,
  thumbnail,
  object,
  isActive,
  onSelect,
}: {
  preset: FilterPreset;
  thumbnail: string;
  object: CanvasObject;
  isActive: boolean;
  onSelect: () => void;
}) {
  const filter = cssFilter(
    preset.spec,
    object.adjustments ?? NEUTRAL_ADJUSTMENTS,
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      disabled={object.locked}
      className={cn(
        "group/preset overflow-hidden rounded-xl border bg-card text-left transition-colors",
        "outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:opacity-45",
        isActive
          ? "border-primary ring-1 ring-primary"
          : "border-border hover:border-primary/40",
      )}
    >
      <span className="bg-checkerboard block aspect-square w-full">
        {/* eslint-disable-next-line @next/next/no-img-element --
            a locally generated data URL, and the rail ships in the storefront
            embed where next/image cannot follow. */}
        <img
          src={thumbnail}
          alt=""
          style={filter ? { filter } : undefined}
          className="size-full object-contain"
        />
      </span>

      <span
        className={cn(
          "block truncate px-2 py-1.5 text-[11px] font-semibold",
          isActive ? "text-primary" : "text-muted-foreground",
        )}
      >
        {preset.label}
      </span>
    </button>
  );
}
