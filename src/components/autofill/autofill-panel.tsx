"use client";

import * as React from "react";
import { CopyPlus, Grip } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PrimaryButton } from "@/components/common/primary-button";
import { useEditorState } from "@/components/editor/editor-state";
import { PropertyDropdown } from "@/components/inspector/property-dropdown";
import { PropertyInput } from "@/components/inspector/property-input";
import { PropertyToggle } from "@/components/inspector/property-toggle";
import { ValidationBadge } from "@/components/inspector/validation-badge";
import { PanelBody } from "@/components/panels/panel-body";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AUTOFILL_DEFAULTS,
  AUTOFILL_DIRECTIONS,
  MAX_AUTOFILL_COPIES,
  clampCopies,
  planAutofill,
  type AutofillDirection,
} from "@/lib/autofill";
import { layerLabel } from "@/lib/canvas-objects";
import {
  SHEET_SAFE_MARGIN_IN,
  fromInches,
  toInches,
  type MeasurementUnit,
} from "@/lib/workspace";

const DIRECTION_OPTIONS = AUTOFILL_DIRECTIONS.map((direction) => ({
  value: direction.id,
  label: direction.label,
}));

/** The trim margin in whatever unit the editor is set to, e.g. `0.25 in`. */
const safeMarginLabel = (unit: MeasurementUnit) =>
  `${fromInches(SHEET_SAFE_MARGIN_IN, unit)} ${unit}`;

/**
 * Autofill — repeat the selection across the sheet.
 *
 * A gang sheet is the same artwork many times over, so the useful unit of work
 * here is a row of copies rather than one copy pressed repeatedly. The controls
 * describe the row: how many, which way, how far apart, and whether to stop at
 * the sheet's trim margin.
 *
 * The count is a request, not a promise — the panel says how many will really
 * fit before the button is pressed, because finding out afterwards means
 * undoing and guessing again.
 */
export function AutofillPanel() {
  const { canvas, settings } = useEditorState();
  const { selectedObjects } = canvas;
  const unit = settings.unit;

  /**
   * The count, or nothing at all.
   *
   * Empty is a state the field really has — clearing it to type a new number
   * leaves it blank for a keystroke, and snapping to a value while someone is
   * typing over it makes the field impossible to type into. It counts as none,
   * so the button is off until a number is in there.
   */
  const [count, setCount] = React.useState<number | "">(
    AUTOFILL_DEFAULTS.count,
  );
  const requestedCount = count === "" ? 0 : count;
  const [direction, setDirection] = React.useState<AutofillDirection>(
    AUTOFILL_DEFAULTS.direction,
  );
  const [gapInches, setGapInches] = React.useState(AUTOFILL_DEFAULTS.gapInches);
  const [keepInSafeZone, setKeepInSafeZone] = React.useState(
    AUTOFILL_DEFAULTS.keepInSafeZone,
  );

  const plan = planAutofill(selectedObjects, canvas.sheetSize, {
    count: requestedCount,
    direction,
    gapInches,
    keepInSafeZone,
  });

  if (!plan) {
    return (
      <PanelBody>
        <EmptyState
          icon={Grip}
          title="Nothing selected"
          description="Select artwork on the sheet, and Autofill will repeat it across the rest of the row."
        />
      </PanelBody>
    );
  }

  const requested = clampCopies(requestedCount);
  /* Named, not counted, while there is one thing to name: "Aurora logo" says
     which piece is about to be repeated in a way that "1 image" does not. */
  const subject =
    selectedObjects.length === 1
      ? layerLabel(selectedObjects[0])
      : `${selectedObjects.length} objects`;
  const directionLabel =
    AUTOFILL_DIRECTIONS.find((entry) => entry.id === direction)?.label ??
    direction;
  const boundary = keepInSafeZone
    ? `the ${safeMarginLabel(unit)} safe zone`
    : "the sheet";

  const handleDuplicate = () => {
    if (plan.fits === 0) return;
    canvas.autofillSelection(plan.fits, plan.step);
  };

  return (
    <TooltipProvider delay={300}>
      <PanelBody className="space-y-4">
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Repeating{" "}
          <span className="font-semibold text-foreground">{subject}</span>{" "}
          {directionLabel.toLowerCase()} across the sheet.
        </p>

        <div className="space-y-3 rounded-card border border-border bg-card p-3">
          {/* Clears to nothing rather than to a number, and reaches zero if
              someone types one — either way the button switches off, and the
              field stays typeable. */}
          <PropertyInput
            label="Number of copies"
            value={count}
            onChange={setCount}
            onEmpty={() => setCount("")}
            min={0}
            max={MAX_AUTOFILL_COPIES}
            step={1}
          />

          <PropertyDropdown
            label="Direction"
            value={direction}
            onChange={(next) => setDirection(next as AutofillDirection)}
            options={DIRECTION_OPTIONS}
          />

          <PropertyInput
            label="Gap between copies"
            value={fromInches(gapInches, unit)}
            onChange={(next) => setGapInches(toInches(next, unit))}
            unit={unit}
            min={0}
            step={unit === "mm" ? 1 : 0.1}
          />

          <PropertyToggle
            label="Keep in safe zone"
            value={keepInSafeZone}
            onChange={setKeepInSafeZone}
            tooltip={`Copies stop ${safeMarginLabel(
              unit,
            )} from the sheet's edge, so trimming cannot clip them. Off, they may run to the edge itself.`}
          />
        </div>

        {requested === 0 ? (
          /* Asking for none is not a problem to warn about — it is the field
             waiting for a number, so it says what to do rather than what is
             wrong. */
          <ValidationBadge
            tone="info"
            label="No copies yet"
            detail={`Type how many copies to add, up to ${MAX_AUTOFILL_COPIES}.`}
          />
        ) : plan.fits === 0 ? (
          <ValidationBadge
            tone="warning"
            label={`No room ${directionLabel.toLowerCase()}`}
            detail={`The next copy would fall outside ${boundary}. Move the artwork, close the gap, or fill the other way.`}
          />
        ) : plan.fits < requested ? (
          /* A warning rather than a note: the button is about to do something
             other than what the field above it says, and finding that out
             afterwards means undoing and counting again. */
          <ValidationBadge
            tone="warning"
            label={`Only ${plan.fits} of ${requested} will fit`}
            detail={`The rest would fall outside ${boundary}. Duplicate places ${
              plan.fits === 1 ? "the one that fits" : `the ${plan.fits} that fit`
            } — close the gap or fill the other way for more.`}
          />
        ) : (
          <ValidationBadge
            tone="ok"
            label={`${requested} ${requested === 1 ? "copy fits" : "copies fit"}`}
            detail={`Placed ${directionLabel.toLowerCase()}, inside ${boundary}.`}
          />
        )}

        <PrimaryButton
          icon={CopyPlus}
          onClick={handleDuplicate}
          disabled={plan.fits === 0}
        >
          Duplicate
        </PrimaryButton>
      </PanelBody>
    </TooltipProvider>
  );
}
