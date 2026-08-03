"use client";

import * as React from "react";

import { EditorStateProvider } from "@/components/editor/editor-state";
import { Workspace } from "@/components/editor/workspace";
import { EditorHeader } from "@/components/header/editor-header";
import { InspectorPanel } from "@/components/inspector/inspector-panel";
import { PanelContent } from "@/components/panels/panel-content";
import { PanelHeader } from "@/components/panels/panel-header";
import { SlidingPanel } from "@/components/panels/sliding-panel";
import { Sidebar } from "@/components/sidebar/sidebar";
import { usePanelController } from "@/hooks/use-panel-controller";
import { useSaveStatus } from "@/hooks/use-save-status";
import { findNavItem } from "@/lib/navigation";

const DEFAULT_DESIGN_NAME = "Untitled gang sheet";

/**
 * Composes the editor: the header across the top, the fixed rail beneath it,
 * the drawer that slides out from behind the rail, and the workspace it covers.
 *
 * The drawer keeps rendering the remembered menu while it animates closed —
 * without that, `activePanel` dropping to `null` would blank the panel's
 * contents a frame before it finished sliding away.
 */
export function EditorShell() {
  const {
    activePanel,
    rememberedPanel,
    selectPanel,
    closePanel,
    rootRef,
    panelRef,
    sidebarRef,
  } = usePanelController();

  const [designName, setDesignName] = React.useState(DEFAULT_DESIGN_NAME);
  const { status, markDirty, save } = useSaveStatus();

  const handleDesignNameChange = (name: string) => {
    setDesignName(name);
    markDirty();
  };

  const displayedPanel = activePanel ?? rememberedPanel;
  const navItem = displayedPanel ? findNavItem(displayedPanel) : undefined;

  return (
    <div
      ref={rootRef}
      className="flex h-dvh w-full flex-col overflow-hidden bg-canvas"
    >
      <EditorHeader
        designName={designName}
        onDesignNameChange={handleDesignNameChange}
        saveStatus={status}
        onSave={save}
      />

      <EditorStateProvider onDesignChange={markDirty}>
        <div className="flex min-h-0 flex-1">
          <div ref={sidebarRef} className="h-full shrink-0">
            <Sidebar
              activePanel={activePanel}
              rememberedPanel={rememberedPanel}
              onSelect={selectPanel}
            />
          </div>

          <main className="relative min-w-0 flex-1 overflow-hidden">
            <Workspace />

            <SlidingPanel
              isOpen={activePanel !== null}
              onClose={closePanel}
              label={navItem?.title ?? "Panel"}
              panelRef={panelRef}
              contentKey={displayedPanel ?? "none"}
            >
              {displayedPanel && navItem ? (
                <>
                  <PanelHeader
                    title={navItem.title}
                    description={navItem.description}
                    onClose={closePanel}
                  />
                  <PanelContent id={displayedPanel} />
                </>
              ) : null}
            </SlidingPanel>
          </main>

          {/* Below this width the rail, the left panel and a 380px inspector
              can't coexist — the inspector is what gives way. */}
          <InspectorPanel className="hidden lg:flex" />
        </div>
      </EditorStateProvider>
    </div>
  );
}
