"use client";

import { InspectorSection } from "@/components/inspector/inspector-section";
import { PropertyDropdown } from "@/components/inspector/property-dropdown";
import { PropertyRow } from "@/components/inspector/property-row";
import { PropertyToggle } from "@/components/inspector/property-toggle";
import { SwatchPicker } from "@/components/inspector/swatch-picker";
import type { WorkspaceSettings } from "@/components/editor/editor-state";
import {
  MEASUREMENT_UNITS,
  SHEET_BACKGROUNDS,
  getSheetSizes,
  type MeasurementUnit,
} from "@/lib/workspace";

/** The collapsed section reads as the state it is actually in. */
function backgroundLabel(settings: WorkspaceSettings): string {
  if (!settings.showBackground) return "Transparent";
  return (
    SHEET_BACKGROUNDS.find(
      (colour) => colour.value === settings.backgroundColor,
    )?.label ?? settings.backgroundColor
  );
}

/**
 * The inspector with nothing selected: the sheet's own settings.
 *
 * The same switches as the canvas toolbar, reading from the same state — the
 * toolbar is the quick path and this is the labelled one.
 */
export function CanvasInspector({ settings }: { settings: WorkspaceSettings }) {
  return (
    <>
      <InspectorSection id="canvas-sheet" title="Sheet">
        <PropertyDropdown
          label="Sheet size"
          value={settings.sheetSize}
          onChange={settings.setSheetSize}
          options={getSheetSizes().map((size) => ({
            value: size.id,
            label: size.label,
            detail: size.description,
          }))}
        />
        <PropertyDropdown
          label="Units"
          value={settings.unit}
          onChange={(value) => settings.setUnit(value as MeasurementUnit)}
          options={MEASUREMENT_UNITS.map((unit) => ({
            value: unit.id,
            label: unit.label,
          }))}
        />
      </InspectorSection>

      <InspectorSection
        id="canvas-background"
        title="Background"
        summary={backgroundLabel(settings)}
      >
        <PropertyToggle
          label="Background preview"
          value={settings.showBackground}
          onChange={settings.setShowBackground}
          tooltip="Preview the artwork on a colour instead of as transparent film."
        />

        {/* The sheet prints on clear film, so this is the garment, not the
            design. Disabled rather than hidden while the preview is off —
            hiding it would make the toggle look like it removed a feature. */}
        <PropertyRow label="Colour" layout="stack" disabled={!settings.showBackground}>
          <SwatchPicker
            swatches={SHEET_BACKGROUNDS}
            value={settings.backgroundColor}
            onChange={settings.setBackgroundColor}
            disabled={!settings.showBackground}
          />
        </PropertyRow>
      </InspectorSection>

      <InspectorSection id="canvas-guides" title="Guides">
        <PropertyToggle
          label="Grid"
          value={settings.showGrid}
          onChange={settings.setShowGrid}
        />
        <PropertyToggle
          label="Snap to guides"
          value={settings.snapEnabled}
          onChange={settings.setSnapEnabled}
        />
      </InspectorSection>
    </>
  );
}
