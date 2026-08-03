"use client";

import * as React from "react";

import { LayersPanel } from "@/components/layers/layers-panel";
import { GraphicsPanel } from "@/components/uploads/graphics-panel";
import type { PanelId } from "@/lib/navigation";

/**
 * Panel id → panel body. Keeping the mapping in one place means the rail, the
 * drawer and the panels themselves only ever agree through {@link PanelId}.
 */
const PANELS: Record<PanelId, React.ComponentType> = {
  graphics: GraphicsPanel,
  layers: LayersPanel,
};

export function PanelContent({ id }: { id: PanelId }) {
  const Panel = PANELS[id];
  return <Panel />;
}
