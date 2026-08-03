"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Lock,
  Trash2,
  Unlock,
} from "lucide-react";

import { InspectorCard } from "@/components/inspector/inspector-card";
import { InspectorSection } from "@/components/inspector/inspector-section";
import { IconButtonRow } from "@/components/inspector/icon-button-row";
import { PropertyDropdown } from "@/components/inspector/property-dropdown";
import { PropertyInput } from "@/components/inspector/property-input";
import { PropertyRow } from "@/components/inspector/property-row";
import { PropertySlider } from "@/components/inspector/property-slider";
import { QuickActions } from "@/components/inspector/quick-actions";
import { SwatchPicker } from "@/components/inspector/swatch-picker";
import { ValidationBadge } from "@/components/inspector/validation-badge";
import { PrimaryButton } from "@/components/common/primary-button";
import type { WorkspaceSettings } from "@/components/editor/editor-state";
import { hasReadableContrast, readableTextColour } from "@/lib/contrast";
import { SHEET_BACKGROUNDS } from "@/lib/workspace";

/** Name the colour if it's one of ours, otherwise say the hex. */
const backgroundName = (value: string) =>
  SHEET_BACKGROUNDS.find((colour) => colour.value === value)?.label.toLowerCase() ??
  value;
import type { CanvasInteraction } from "@/hooks/use-canvas-interaction";
import {
  DEFAULT_TYPOGRAPHY,
  MIN_FONT_SIZE,
  type CanvasObject,
  type CanvasTypography,
} from "@/lib/canvas-objects";
import {
  FONT_FAMILY_OPTIONS,
  TEXT_SWATCHES,
  fontWeightOptions,
} from "@/lib/inspector";
import { findFontFamily, nearestWeight } from "@/lib/fonts";
import { cn } from "@/lib/utils";

export interface TextInspectorProps {
  object: CanvasObject;
  canvas: CanvasInteraction;
  /** Needed for the sheet's preview colour, which the fill is judged against. */
  settings: WorkspaceSettings;
}

/**
 * The inspector for a selected text object.
 *
 * Content first, then the type controls in the order a designer sets them —
 * family, weight, size — with the fine adjustments below. Every control here
 * renders on the sheet.
 */
export function TextInspector({
  object,
  canvas,
  settings,
}: TextInspectorProps) {
  const type = object.typography ?? DEFAULT_TYPOGRAPHY;
  const locked = object.locked;
  const weights = fontWeightOptions(type.fontFamily);

  const fill = object.accent ?? "#1f2937";

  /*
   * Only meaningful while a background is being previewed.
   *
   * With the preview off the sheet is clear film and the garment is unknown,
   * so there is nothing to judge the fill against — warning then would be
   * inventing a background the user never chose.
   */
  const background = settings.showBackground ? settings.backgroundColor : null;
  const isHardToRead =
    background !== null && !hasReadableContrast(fill, background);

  /**
   * Only the property that changed is sent. The reducer merges it, and history
   * reads the key to tell a font change from a size change — sending the whole
   * typography object would fold every type edit into one undo step.
   */
  const setType = (patch: Partial<CanvasTypography>) =>
    canvas.patchSelection({ typography: patch });

  /**
   * Switching family carries the weight across to the nearest one the new face
   * actually ships — a display font has no extrabold, and leaving the old
   * value would ask the browser to fake one.
   *
   * Both properties travel in one patch, so changing the font stays one undo
   * step rather than a font change with a weight change hidden behind it.
   */
  const setFontFamily = (fontFamily: string) =>
    setType({
      fontFamily,
      fontWeight: nearestWeight(findFontFamily(fontFamily), type.fontWeight),
    });

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

      <InspectorSection id="text-content" title="Text">
        <textarea
          value={object.text ?? ""}
          onChange={(event) => canvas.patchSelection({ text: event.target.value })}
          disabled={locked}
          rows={2}
          aria-label="Text content"
          className={cn(
            "w-full resize-none rounded-lg border border-border bg-card px-2.5 py-2",
            "text-[12.5px] font-medium text-foreground outline-none transition-colors",
            "focus-visible:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/25",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        />
      </InspectorSection>

      <InspectorSection
        id="text-font"
        title="Font"
        summary={`${type.fontSize}px`}
      >
        <PropertyDropdown
          label="Family"
          layout="stack"
          value={type.fontFamily}
          onChange={setFontFamily}
          options={FONT_FAMILY_OPTIONS}
          disabled={locked}
        />
        <PropertyDropdown
          label="Weight"
          value={String(type.fontWeight)}
          onChange={(weight) => setType({ fontWeight: Number(weight) })}
          options={weights}
          // A face with one weight has nothing to choose between.
          disabled={locked || weights.length < 2}
          tooltip={
            weights.length < 2
              ? `${findFontFamily(type.fontFamily).label} ships a single weight.`
              : undefined
          }
        />
        {/* No box adjustment: text is measured from its font, and the canvas
            reports the size it turned out to be. */}
        <PropertyInput
          label="Size"
          value={type.fontSize}
          onChange={(fontSize) => setType({ fontSize })}
          unit="px"
          min={MIN_FONT_SIZE}
          max={400}
          disabled={locked}
        />

        <PropertyRow label="Alignment" disabled={locked}>
          <IconButtonRow
            fill={false}
            choices={[
              {
                id: "left",
                label: "Align left",
                icon: AlignLeft,
                active: type.align === "left",
                onClick: () => setType({ align: "left" }),
              },
              {
                id: "center",
                label: "Align centre",
                icon: AlignCenter,
                active: type.align === "center",
                onClick: () => setType({ align: "center" }),
              },
              {
                id: "right",
                label: "Align right",
                icon: AlignRight,
                active: type.align === "right",
                onClick: () => setType({ align: "right" }),
              },
            ]}
          />
        </PropertyRow>
      </InspectorSection>

      <InspectorSection
        id="text-transform"
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

        <PropertySlider
          label="Opacity"
          value={object.opacity}
          onChange={canvas.setSelectionOpacity}
          disabled={locked}
        />
      </InspectorSection>

      <InspectorSection id="text-spacing" title="Spacing" defaultOpen={false}>
        <PropertySlider
          label="Letter spacing"
          value={type.letterSpacing}
          onChange={(letterSpacing) => setType({ letterSpacing })}
          min={-10}
          max={40}
          unit="px"
          disabled={locked}
        />
        <PropertySlider
          label="Line height"
          value={Math.round(type.lineHeight * 100)}
          onChange={(value) => setType({ lineHeight: value / 100 })}
          min={80}
          max={300}
          disabled={locked}
        />
      </InspectorSection>

      <InspectorSection
        id="text-colour"
        title="Colour"
        summary={object.accent ?? "#1f2937"}
      >
        <PropertyRow label="Fill" layout="stack" disabled={locked}>
          <SwatchPicker
            swatches={TEXT_SWATCHES.map((colour) => ({
              value: colour,
              label: colour,
            }))}
            value={fill}
            onChange={(accent) => canvas.patchSelection({ accent })}
            disabled={locked}
          />
        </PropertyRow>

        {/* Flagged rather than corrected. The background is a preview of the
            garment, and quietly recolouring artwork because someone looked at
            it on black would be editing the design behind their back — so the
            warning explains, and the fix is one deliberate click. */}
        {isHardToRead ? (
          <div className="space-y-2">
            <ValidationBadge
              tone="warning"
              label="Hard to read on this background"
              detail={`This text is ${fill} on ${backgroundName(background)}. It will be difficult to see once printed.`}
            />
            <PrimaryButton
              variant="outline"
              size="md"
              disabled={locked}
              onClick={() =>
                canvas.patchSelection({ accent: readableTextColour(background) })
              }
            >
              Switch to a readable colour
            </PrimaryButton>
          </div>
        ) : null}
      </InspectorSection>
    </>
  );
}
