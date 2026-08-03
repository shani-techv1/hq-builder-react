"use client";

import { Lock, Trash2, Unlock } from "lucide-react";

import { InspectorCard } from "@/components/inspector/inspector-card";
import { InspectorSection } from "@/components/inspector/inspector-section";
import { PropertySlider } from "@/components/inspector/property-slider";
import { QuickActions } from "@/components/inspector/quick-actions";
import { SelectionSummary } from "@/components/inspector/selection-summary";
import type { CanvasInteraction } from "@/hooks/use-canvas-interaction";
import type { CanvasObject } from "@/lib/canvas-objects";

export interface MultiSelectionInspectorProps {
  objects: CanvasObject[];
  canvas: CanvasInteraction;
}

/**
 * The inspector for two or more selected objects.
 *
 * Shows only what a selection can share. Opacity is here because setting them
 * all to one value is meaningful; position and size are not, because there is
 * no single answer.
 */
export function MultiSelectionInspector({
  objects,
  canvas,
}: MultiSelectionInspectorProps) {
  const allLocked = objects.every((object) => object.locked);

  /* Only report a shared opacity when they genuinely share one. */
  const opacities = new Set(objects.map((object) => object.opacity));
  const sharedOpacity = opacities.size === 1 ? [...opacities][0] : 100;

  return (
    <>
      <InspectorCard>
        <SelectionSummary objects={objects} />
      </InspectorCard>

      <InspectorCard>
        <QuickActions
          columns={2}
          actions={[
            {
              id: "lock",
              label: allLocked ? "Unlock" : "Lock",
              icon: allLocked ? Unlock : Lock,
              onClick: canvas.toggleLockSelection,
            },
            {
              id: "delete",
              label: "Delete",
              icon: Trash2,
              tone: "danger",
              onClick: canvas.deleteSelection,
            },
          ]}
        />
      </InspectorCard>

      <InspectorSection
        id="multi-appearance"
        title="Appearance"
        summary={opacities.size === 1 ? `${sharedOpacity}%` : "Mixed"}
      >
        <PropertySlider
          label="Opacity"
          value={sharedOpacity}
          onChange={(opacity) => canvas.setSelectionOpacity(opacity)}
          disabled={allLocked}
          validation={
            opacities.size > 1
              ? {
                  tone: "info",
                  message: "Objects have different values — this sets them all.",
                }
              : undefined
          }
        />
      </InspectorSection>
    </>
  );
}
