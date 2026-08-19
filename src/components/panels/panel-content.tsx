"use client";

import * as React from "react";

import { AutofillPanel } from "@/components/autofill/autofill-panel";
import { CanvaPanel } from "@/components/canva/canva-panel";
import { FiltersPanel } from "@/components/filters/filters-panel";
import { PositionPanel } from "@/components/position/position-panel";
import { InspectorContent } from "@/components/inspector/inspector-content";
import { LayersPanel } from "@/components/layers/layers-panel";
import { PreflightPanel } from "@/components/preflight/preflight-panel";
import { GraphicsPanel } from "@/components/uploads/graphics-panel";
import type { PanelId } from "@/lib/navigation";

/** What every panel body is handed, whether or not it uses it. */
export interface PanelBodyProps {
  /** Hand the user on to another panel — used after an import completes. */
  onOpenPanel: (id: PanelId) => void;
  /**
   * A row the panel should open scrolled to, when it was opened *for* that row
   * rather than in general. Ignored by panels that have no such rows.
   */
  focus?: string | null;
}

/**
 * Panel id → panel body. Keeping the mapping in one place means the rail, the
 * drawer and the panels themselves only ever agree through {@link PanelId}.
 */
const PANELS: Record<PanelId, React.ComponentType<PanelBodyProps>> = {
  graphics: GraphicsPanel,
  canva: CanvaPanel,
  autofill: AutofillPanel,
  layers: LayersPanel,
  preflight: PreflightPanel,
  // Opened from the selection's own menu rather than from the rail.
  position: PositionPanel,
  filters: FiltersPanel,
  // Brings its own header strip and scroll region rather than using PanelBody,
  // because its contents change with the selection and the strip is what says
  // which of its four states you are looking at.
  settings: InspectorContent,
};

export function PanelContent({
  id,
  onOpenPanel,
  focus,
}: PanelBodyProps & { id: PanelId }) {
  const Panel = PANELS[id];
  return <Panel onOpenPanel={onOpenPanel} focus={focus} />;
}
