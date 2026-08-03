"use client";

import * as React from "react";

import { CanvaPanel } from "@/components/canva/canva-panel";
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
};

export function PanelContent({ id, onOpenPanel }: PanelBodyProps & { id: PanelId }) {
  const Panel = PANELS[id];
  return <Panel onOpenPanel={onOpenPanel} />;
}
