"use client";

import * as React from "react";

import { AccountMenu } from "@/components/account/account-menu";
import {
  EditorStateProvider,
  useEditorState,
} from "@/components/editor/editor-state";
import { DraftRecoveryDialog } from "@/components/editor/draft-recovery-dialog";
import { DesignFileMenu } from "@/components/editor/design-file-menu";
import { SaveDesignButtons } from "@/components/editor/save-design-buttons";
import { SavedDesignsMenu } from "@/components/editor/saved-designs-menu";
import { SheetCartActions } from "@/components/editor/sheet-cart-actions";
import { Workspace } from "@/components/editor/workspace";
import { EditorHeader } from "@/components/header/editor-header";
import { BottomSheet } from "@/components/panels/bottom-sheet";
import { PanelContent } from "@/components/panels/panel-content";
import { PanelHeader } from "@/components/panels/panel-header";
import { SlidingPanel } from "@/components/panels/sliding-panel";
import { Sidebar, type SidebarProps } from "@/components/sidebar/sidebar";
import { useCompactLayout } from "@/hooks/use-compact-layout";
import { usePanelController } from "@/hooks/use-panel-controller";
import {
  SavedDesignsProvider,
  useSavedDesigns,
} from "@/hooks/use-saved-designs";
import { DEFAULT_DESIGN_NAME } from "@/lib/design-document";
import { findNavItem } from "@/lib/navigation";
import type { SaveState } from "@/lib/workspace";

/**
 * The saved-design prompt: at startup, and on signing in to an account that
 * kept a design for this product.
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
      reason={recovery.reason}
      onContinue={recovery.continueDraft}
      onDiscard={recovery.discardDraft}
    />
  );
}

/**
 * The header, with the save indicator following My designs.
 *
 * "Saved" means the saved design on screen holds exactly what is on the
 * sheet. Work that was never saved there reads as unsaved — even with a draft
 * in this browser, because a draft is not somewhere the design can be opened
 * again from. An empty sheet has nothing to save, so it reads as saved.
 *
 * Its own component because both halves come from inside the providers, and
 * the shell sits above them.
 */
function ShellHeader({
  designName,
  onDesignNameChange,
}: {
  designName: string;
  onDesignNameChange: (name: string) => void;
}) {
  const { matchesSavedDesign } = useEditorState();
  const saved = useSavedDesigns();

  const saveStatus: SaveState =
    saved.busy?.kind === "save"
      ? "saving"
      : saved.hasWork && !matchesSavedDesign
        ? "unsaved"
        : "saved";

  return (
    <EditorHeader
      designName={designName}
      onDesignNameChange={onDesignNameChange}
      saveStatus={saveStatus}
      actions={
        <>
          {/* On a phone, My designs, export and import move to the toolbar's
              More menu and leave this bar to the cart. */}
          <span className="hidden md:contents">
            <SavedDesignsMenu />
            <DesignFileMenu />
          </span>
          <SheetCartActions />
          <AccountMenu />
          <SaveDesignButtons />
        </>
      }
    />
  );
}

/** The rail or tab bar, badged with the number of warnings waiting in Checks. */
function ShellSidebar(props: Omit<SidebarProps, "badges">) {
  const { preflight } = useEditorState();

  return <Sidebar {...props} badges={{ preflight: preflight.total }} />;
}

/**
 * Composes the editor: the header across the top, then a single row of
 * columns — the rail, the open panel, the workspace, and the inspector.
 *
 * The panel is a column rather than a sheet over the workspace, so opening one
 * narrows the canvas instead of hiding it. It keeps rendering the remembered
 * menu while it animates closed; without that, `activePanel` dropping to
 * `null` would blank its contents a frame before it finished collapsing.
 *
 * On a phone the same pieces are stacked instead: the workspace, the open
 * panel as a sheet beneath it, and the rail turned into a tab bar along the
 * bottom edge, where a thumb reaches it. The panel still takes its space from
 * the canvas rather than covering it — here from the canvas's height.
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

  const compact = useCompactLayout();

  const [designName, setDesignName] = React.useState(DEFAULT_DESIGN_NAME);

  /**
   * A row the next panel opening should land on.
   *
   * Set when a panel is opened *for* something specific — the selection
   * toolbar's opacity button — and cleared as soon as it closes, so opening
   * Settings from the rail afterwards starts at the top as usual.
   */
  const [panelFocus, setPanelFocus] = React.useState<string | null>(null);

  const openPanelAt = React.useCallback(
    (id: Parameters<typeof openPanel>[0], focus: string) => {
      setPanelFocus(focus);
      openPanel(id);
    },
    [openPanel],
  );

  const dismissPanel = () => {
    setPanelFocus(null);
    closePanel();
  };

  const displayedPanel = activePanel ?? rememberedPanel;
  const navItem = displayedPanel ? findNavItem(displayedPanel) : undefined;

  /* One body, rendered into whichever drawer this screen gets. */
  const panelBody =
    displayedPanel && navItem ? (
      <>
        <PanelHeader
          title={navItem.title}
          description={navItem.description}
          onClose={dismissPanel}
        />
        <PanelContent
          id={displayedPanel}
          onOpenPanel={openPanel}
          focus={activePanel ? panelFocus : null}
        />
      </>
    ) : null;

  return (
    <div
      ref={rootRef}
      // Side insets keep a landscape phone's notch off the editor; the
      // storefront page opts into drawing under it with `viewport-fit=cover`.
      className="flex h-dvh w-full flex-col overflow-hidden bg-canvas pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      {/* The provider wraps the header too, so the file menu can reach the
          design it is about to export. It renders no element of its own. */}
      <EditorStateProvider
        designName={designName}
        onDesignNameChange={setDesignName}
        // A desktop panel sits beside the sheet, so the artwork is already in
        // view; a phone's covers the part of the sheet it was placed on.
        onAssetPlaced={compact ? dismissPanel : undefined}
      >
        <SavedDesignsProvider>
          <ShellHeader
            designName={designName}
            onDesignNameChange={setDesignName}
          />

          <DraftRecoveryGate />

          <div className="flex min-h-0 flex-1">
            <div className="hidden h-full shrink-0 md:block">
              <ShellSidebar
                activePanel={activePanel}
                rememberedPanel={rememberedPanel}
                onSelect={selectPanel}
              />
            </div>

            {/* Between the rail and the workspace, so opening it narrows the
                canvas rather than covering it. */}
            {compact ? null : (
              <SlidingPanel
                isOpen={activePanel !== null}
                label={navItem?.title ?? "Panel"}
                panelRef={panelRef}
                contentKey={displayedPanel ?? "none"}
              >
                {panelBody}
              </SlidingPanel>
            )}

            <main className="relative min-w-0 flex-1 overflow-hidden">
              <Workspace onOpenPanel={openPanel} onOpenPanelAt={openPanelAt} />
            </main>
          </div>

          {/* Between the workspace and the tab bar, so opening it shortens the
              canvas rather than covering it. */}
          {compact ? (
            <BottomSheet
              isOpen={activePanel !== null}
              label={navItem?.title ?? "Panel"}
              panelRef={panelRef}
              contentKey={displayedPanel ?? "none"}
              onDismiss={dismissPanel}
            >
              {panelBody}
            </BottomSheet>
          ) : null}

          <ShellSidebar
            orientation="horizontal"
            activePanel={activePanel}
            rememberedPanel={rememberedPanel}
            onSelect={selectPanel}
            className="md:hidden"
          />
        </SavedDesignsProvider>
      </EditorStateProvider>
    </div>
  );
}
