"use client";

import * as React from "react";

import {
  EditorStateProvider,
  useEditorState,
} from "@/components/editor/editor-state";
import { DraftRecoveryDialog } from "@/components/editor/draft-recovery-dialog";
import { DesignFileMenu } from "@/components/editor/design-file-menu";
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
 * The startup prompt.
 *
 * Its own component because it has to sit inside the provider to read the
 * recovery state, and the shell above it is what the provider wraps.
 */
function DraftRecoveryGate() {
  const { recovery } = useEditorState();

  return (
    <DraftRecoveryDialog
      open={recovery.status === "prompting"}
      draft={recovery.draft}
      onContinue={recovery.continueDraft}
      onStartNew={recovery.startNew}
    />
  );
}

/**
 * Composes the editor: the header across the top, then a single row of
 * columns — the rail, the open panel, the workspace, and the inspector.
 *
 * The panel is a column rather than a sheet over the workspace, so opening one
 * narrows the canvas instead of hiding it. It keeps rendering the remembered
 * menu while it animates closed; without that, `activePanel` dropping to
 * `null` would blank its contents a frame before it finished collapsing.
 */
export function EditorShell() {
  const {
    activePanel,
    rememberedPanel,
    selectPanel,
    openPanel,
    closePanel,
    rootRef,
    panelRef,
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
      {/* The provider wraps the header too, so the file menu can reach the
          design it is about to export. It renders no element of its own. */}
      <EditorStateProvider
        onDesignChange={markDirty}
        designName={designName}
        onDesignNameChange={setDesignName}
      >
        <EditorHeader
          designName={designName}
          onDesignNameChange={handleDesignNameChange}
          saveStatus={status}
          onSave={save}
          actions={<DesignFileMenu />}
        />

        <DraftRecoveryGate />

        <div className="flex min-h-0 flex-1">
          <div className="h-full shrink-0">
            <Sidebar
              activePanel={activePanel}
              rememberedPanel={rememberedPanel}
              onSelect={selectPanel}
            />
          </div>

          {/* Between the rail and the workspace, so opening it narrows the
              canvas rather than covering it. */}
          <SlidingPanel
            isOpen={activePanel !== null}
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
                <PanelContent id={displayedPanel} onOpenPanel={openPanel} />
              </>
            ) : null}
          </SlidingPanel>

          <main className="relative min-w-0 flex-1 overflow-hidden">
            <Workspace />
          </main>

          {/* Below this width the rail, the left panel and a 380px inspector
              can't coexist — the inspector is what gives way. */}
          <InspectorPanel className="hidden lg:flex" />
        </div>
      </EditorStateProvider>
    </div>
  );
}
