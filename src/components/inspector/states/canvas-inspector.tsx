"use client";

import { InspectorSection } from "@/components/inspector/inspector-section";
import { PropertyDropdown } from "@/components/inspector/property-dropdown";
import { PropertyToggle } from "@/components/inspector/property-toggle";
import type { WorkspaceSettings } from "@/components/editor/editor-state";
import {
  MEASUREMENT_UNITS,
  SHEET_SIZES,
  type MeasurementUnit,
} from "@/lib/workspace";

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
          options={SHEET_SIZES.map((size) => ({
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

      <InspectorSection id="canvas-guides" title="Guides">
        <PropertyToggle
          label="Background preview"
          value={settings.showBackground}
          onChange={settings.setShowBackground}
          tooltip="Show the sheet white instead of as transparent film."
        />
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
