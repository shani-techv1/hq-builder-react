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
  closePanel: () => void;
  /** Attach to the element wrapping the whole editor. */
  rootRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the sliding panel. */
  panelRef: React.RefObject<HTMLElement | null>;
  /** Attach to the left rail. */
  sidebarRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Owns which panel is open, and the three ways a panel gets dismissed:
 * pressing Escape, clicking outside it, and clicking its own menu again.
 *
 * Outside-click is scoped to `rootRef` on purpose. Popups (selects, tooltips)
 * portal to `document.body`, outside the editor shell — testing containment
 * against the shell means a click on an open dropdown is ignored here rather
 * than tearing the panel down from under it.
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
  const sidebarRef = React.useRef<HTMLDivElement | null>(null);

  const selectPanel = React.useCallback((id: PanelId) => {
    rememberPanel(id);
    setActivePanel((current) => (current === id ? null : id));
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

  /* Clicking anywhere in the editor that isn't the panel or the rail closes it. */
  React.useEffect(() => {
    if (!activePanel) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      if (sidebarRef.current?.contains(target)) return;
      closePanel();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [activePanel, closePanel]);

  return {
    activePanel,
    rememberedPanel,
    selectPanel,
    closePanel,
    rootRef,
    panelRef,
    sidebarRef,
  };
}
