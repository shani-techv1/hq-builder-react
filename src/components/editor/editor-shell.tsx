"use client";

import * as React from "react";

import { AccountMenu } from "@/components/account/account-menu";
import {
  EditorStateProvider,
  useEditorState,
} from "@/components/editor/editor-state";
import { DraftRecoveryDialog } from "@/components/editor/draft-recovery-dialog";
import { DesignFileMenu } from "@/components/editor/design-file-menu";
import { SheetCartActions } from "@/components/editor/sheet-cart-actions";
import { Workspace } from "@/components/editor/workspace";
import { EditorHeader } from "@/components/header/editor-header";
import { PanelContent } from "@/components/panels/panel-content";
import { PanelHeader } from "@/components/panels/panel-header";
import { SlidingPanel } from "@/components/panels/sliding-panel";
import { Sidebar } from "@/components/sidebar/sidebar";
import { toast } from "@/components/ui/toast";
import { usePanelController } from "@/hooks/use-panel-controller";
import { useSaveStatus } from "@/hooks/use-save-status";
import { getCommerceAdapter, getDesignSource } from "@/lib/commerce";
import { findNavItem, type PanelId } from "@/lib/navigation";
import { summarisePreflight } from "@/lib/preflight";
import type { SaveState } from "@/lib/workspace";

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
 * The header, with Save reporting whatever the sheet's checks found.
 *
 * Warned as the save starts rather than after it lands, because the warning is
 * about the artwork and not about whether the save worked — and it never
 * stands in the way of one: an overlap can be the design, and artwork under
 * 300 DPI can still be fine for the job.
 *
 * Its own component because the checks come from the design and the save comes
 * from the shell above the provider; this is where the two meet.
 */
function ShellHeader({
  designName,
  onDesignNameChange,
  saveStatus,
  onSave,
}: {
  designName: string;
  onDesignNameChange: (name: string) => void;
  saveStatus: SaveState;
  onSave: () => void;
}) {
  const { preflight } = useEditorState();

  const handleSave = () => {
    const summary = summarisePreflight(preflight);
    if (summary) {
      toast.warning(
        "Check this sheet before printing",
        `${summary}. Open Checks in the left rail to review.`,
      );
    }
    onSave();
  };

  return (
    <EditorHeader
      designName={designName}
      onDesignNameChange={onDesignNameChange}
      saveStatus={saveStatus}
      onSave={handleSave}
      actions={
        <>
          <DesignFileMenu />
          <SheetCartActions />
          <AccountMenu />
        </>
      }
    />
  );
}

/** The rail, badged with the number of warnings waiting in Checks. */
function ShellSidebar({
  activePanel,
  rememberedPanel,
  onSelect,
}: {
  activePanel: PanelId | null;
  rememberedPanel: PanelId | null;
  onSelect: (id: PanelId) => void;
}) {
  const { preflight } = useEditorState();

  return (
    <Sidebar
      activePanel={activePanel}
      rememberedPanel={rememberedPanel}
      badges={{ preflight: preflight.total }}
      onSelect={onSelect}
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

  /**
   * Save through the storefront when there is one, and fall back to the local
   * indicator when there isn't. Resolved per call rather than captured, because
   * the adapter is installed by the embed entry before React mounts and stays
   * null for the whole life of the standalone app.
   */
  const persist = React.useCallback(async () => {
    const adapter = getCommerceAdapter();
    const source = getDesignSource();
    if (!adapter || !source) return { ok: true as const };
    return adapter.saveDesign(source());
  }, []);

  /**
   * Resolved once, for the same reason `persist` is resolved per call: the
   * adapter is installed before React mounts and never changes afterwards.
   */
  const isEmbedded = getCommerceAdapter() !== null;

  const { status, markDirty, markSaved, save } = useSaveStatus(
    "saved",
    isEmbedded ? persist : undefined,
  );

  const handleDesignNameChange = (name: string) => {
    setDesignName(name);
    markDirty();
  };

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

  const displayedPanel = activePanel ?? rememberedPanel;
  const navItem = displayedPanel ? findNavItem(displayedPanel) : undefined;

  return (
    <div
      ref={rootRef}
      className="flex h-dvh w-full flex-col overflow-hidden bg-canvas"
    >
      {/* The provider wraps the header too, so the file menu can reach the
          design it is about to export. It renders no element of its own. */}
      {/* Standalone, the draft is the only place the sheet is kept, so the
          autosave behind it is what the indicator should follow. Embedded,
          "Saved" has to keep meaning the storefront has it — a record in this
          browser is not the shopper's design reaching the shop. */}
      <EditorStateProvider
        onDesignChange={markDirty}
        onDraftSaved={isEmbedded ? undefined : markSaved}
        designName={designName}
        onDesignNameChange={setDesignName}
      >
        <ShellHeader
          designName={designName}
          onDesignNameChange={handleDesignNameChange}
          saveStatus={status}
          onSave={save}
        />

        <DraftRecoveryGate />

        <div className="flex min-h-0 flex-1">
          <div className="h-full shrink-0">
            <ShellSidebar
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
                  onClose={() => {
                    setPanelFocus(null);
                    closePanel();
                  }}
                />
                <PanelContent
                  id={displayedPanel}
                  onOpenPanel={openPanel}
                  focus={activePanel ? panelFocus : null}
                />
              </>
            ) : null}
          </SlidingPanel>

          <main className="relative min-w-0 flex-1 overflow-hidden">
            <Workspace onOpenPanel={openPanel} onOpenPanelAt={openPanelAt} />
          </main>
        </div>
      </EditorStateProvider>
    </div>
  );
}
