"use client";

import * as React from "react";

import type { PanelId } from "@/lib/navigation";
import {
  getRememberedPanel,
  getServerRememberedPanel,
  rememberPanel,
  subscribeToRememberedPanel,
} from "@/lib/remembered-panel";

export interface PanelController {
  /** Panel currently open, or `null`. Only ever one at a time. */
  activePanel: PanelId | null;
  /** Last panel opened — survives closing, and a reload. */
  rememberedPanel: PanelId | null;
  /** Open a panel, or close it when it is already the open one. */
  selectPanel: (id: PanelId) => void;
  /** Open a panel, never closing one — for handing off between panels. */
  openPanel: (id: PanelId) => void;
  closePanel: () => void;
  /** Attach to the element wrapping the whole editor. */
  rootRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the sliding panel. */
  panelRef: React.RefObject<HTMLElement | null>;
}

/**
 * Owns which panel is open, and the ways one gets dismissed: pressing Escape,
 * and clicking its own menu in the rail again.
 *
 * The Escape handler is scoped to `rootRef` on purpose. Popups (selects,
 * tooltips) portal to `document.body`, outside the editor shell — testing
 * containment against the shell means a keypress belonging to an open dropdown
 * is left alone rather than tearing the panel down from under it.
 */
export function usePanelController(): PanelController {
  const [activePanel, setActivePanel] = React.useState<PanelId | null>(null);
  const rememberedPanel = React.useSyncExternalStore(
    subscribeToRememberedPanel,
    getRememberedPanel,
    getServerRememberedPanel,
  );

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLElement | null>(null);

  const selectPanel = React.useCallback((id: PanelId) => {
    rememberPanel(id);
    setActivePanel((current) => (current === id ? null : id));
  }, []);

  /**
   * Unconditionally open. `selectPanel` toggles, which is right for the rail
   * and wrong for a panel handing the user on to another one — landing back
   * on a closed drawer would lose the thing they were being shown.
   */
  const openPanel = React.useCallback((id: PanelId) => {
    rememberPanel(id);
    setActivePanel(id);
  }, []);

  const closePanel = React.useCallback(() => setActivePanel(null), []);

  /* Escape closes the panel. */
  React.useEffect(() => {
    if (!activePanel) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // The canvas claims Escape in the capture phase when it has a selection
      // to clear, and signals that by calling preventDefault.
      if (event.defaultPrevented) return;
      // A portalled popup owns Escape while it holds focus — let it close first.
      const focused = document.activeElement;
      if (focused && rootRef.current && !rootRef.current.contains(focused)) {
        return;
      }
      closePanel();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activePanel, closePanel]);

  /*
   * There is deliberately no close-on-outside-click.
   *
   * That gesture belongs to a panel that covers the work: clicking away means
   * "give me back what you are hiding". This panel takes its own column and
   * hides nothing, so the same click would instead close it every time the
   * user touched the canvas — including on the way to placing artwork they had
   * just opened the panel to find. It closes from the rail, its own button, or
   * Escape.
   */

  return {
    activePanel,
    rememberedPanel,
    selectPanel,
    openPanel,
    closePanel,
    rootRef,
    panelRef,
  };
}
