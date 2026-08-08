"use client";

import * as React from "react";

import { CanvaPanel } from "@/components/canva/canva-panel";
import { InspectorContent } from "@/components/inspector/inspector-content";
import { LayersPanel } from "@/components/layers/layers-panel";
import { GraphicsPanel } from "@/components/uploads/graphics-panel";
import type { PanelId } from "@/lib/navigation";

/** What every panel body is handed, whether or not it uses it. */
export interface PanelBodyProps {
  /** Hand the user on to another panel — used after an import completes. */
  onOpenPanel: (id: PanelId) => void;
}

/**
 * Panel id → panel body. Keeping the mapping in one place means the rail, the
 * drawer and the panels themselves only ever agree through {@link PanelId}.
 */
const PANELS: Record<PanelId, React.ComponentType<PanelBodyProps>> = {
  graphics: GraphicsPanel,
  canva: CanvaPanel,
  layers: LayersPanel,
  // Brings its own header strip and scroll region rather than using PanelBody,
  // because its contents change with the selection and the strip is what says
  // which of its four states you are looking at.
  settings: InspectorContent,
};

export function PanelContent({ id, onOpenPanel }: PanelBodyProps & { id: PanelId }) {
  const Panel = PANELS[id];
  return <Panel onOpenPanel={onOpenPanel} />;
}
