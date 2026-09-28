"use client";

import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";

import { AccountDialog } from "@/components/account/account-dialog";
import { AssetEmptyState } from "@/components/assets/asset-empty-state";
import { AssetGrid } from "@/components/assets/asset-grid";
import { AssetPreviewDrawer } from "@/components/assets/asset-preview-drawer";
import { AssetSearch } from "@/components/assets/asset-search";
import { UploadProgressCard } from "@/components/assets/upload-progress-card";
import { UploadRejections } from "@/components/assets/upload-rejections";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PanelBody } from "@/components/panels/panel-body";
import { AccountLibraryNotice } from "@/components/uploads/account-library-notice";
import { UploadCard } from "@/components/uploads/upload-card";
import { useEditorState } from "@/components/editor/editor-state";
import { useFilePicker } from "@/hooks/use-file-picker";
import type { Asset } from "@/lib/assets";

/**
 * Graphics — the asset library.
 *
 * Search stays pinned while the grid scrolls under it; the upload zone sits
 * between the two, collapsing to a button once there is artwork to look at.
 * Above it, the account: signed in, every upload is kept there and comes back
 * on the next visit; signed out, this is where the panel offers the sign-in.
 *
 * The library itself belongs to the editor rather than to this panel — the
 * panel unmounts every time it is closed, and artwork placed on the sheet has
 * to outlive that.
 */
export function GraphicsPanel() {
  const { library, placeAsset, placeAssetById } = useEditorState();
  const { assets, visibleAssets, uploads, rejections, previewAsset, search, account } =
    library;

  const [signingIn, setSigningIn] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Asset | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  const handleFiles = React.useCallback(
    (files: File[]) => {
      // Uploaded from the panel, so the artwork lands in the library and waits
      // to be placed — unlike a drop on the sheet, which means "put it there".
      void library.uploadFiles(files, { trim: true });
    },
    [library],
  );

  const picker = useFilePicker(handleFiles);

  const askToDelete = (id: string) => {
    const asset = assets.find((entry) => entry.id === id);
    if (asset) setDeleting(asset);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletePending(true);
    // A failure has its own toast, and the graphic is still there to try again.
    await library.deleteAsset(deleting.id);
    setDeletePending(false);
    setDeleting(null);
  };

  const isLibraryEmpty = assets.length === 0 && uploads.length === 0;
  const hasNoResults = visibleAssets.length === 0 && uploads.length === 0;
  // An empty library that is about to fill up isn't empty yet.
  const awaitingAccount = account.loading && isLibraryEmpty;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <input {...picker.inputProps} />

      <PanelBody className="space-y-0 px-0 py-0">
        <div className="sticky top-0 z-20 border-b border-border bg-card/95 px-5 pb-3 pt-4 backdrop-blur-md">
          <AssetSearch
            value={search}
            onChange={library.setSearch}
            resultCount={visibleAssets.length}
          />
        </div>

        <div className="space-y-4 px-5 py-4">
          <AccountLibraryNotice
            account={account}
            onSignIn={() => setSigningIn(true)}
          />

          <UploadCard
            variant={isLibraryEmpty && !awaitingAccount ? "full" : "compact"}
            onFiles={handleFiles}
          />

          <AnimatePresence initial={false}>
            {rejections.length > 0 ? (
              <UploadRejections
                key="rejections"
                rejections={rejections}
                onDismiss={library.dismissRejections}
              />
            ) : null}

            {uploads.map((task) => (
              <UploadProgressCard key={task.id} task={task} />
            ))}
          </AnimatePresence>

          {awaitingAccount ? null : hasNoResults ? (
            <AssetEmptyState
              variant={isLibraryEmpty ? "library" : "search"}
              onAction={
                isLibraryEmpty ? picker.open : () => library.setSearch("")
              }
            />
          ) : (
            <AssetGrid
              assets={visibleAssets}
              busyIds={library.downloading}
              onOpen={library.openPreview}
              onPlace={placeAssetById}
              onRename={library.renameAsset}
              onDuplicate={library.duplicateAsset}
              onToggleFavorite={library.toggleFavorite}
              onDelete={askToDelete}
            />
          )}
        </div>
      </PanelBody>

      <AnimatePresence>
        {previewAsset ? (
          <AssetPreviewDrawer
            key={previewAsset.id}
            asset={previewAsset}
            assets={assets}
            onClose={library.closePreview}
            onOpenAsset={library.openPreview}
            onPlace={() => placeAsset(previewAsset)}
            onRename={(name) => library.renameAsset(previewAsset.id, name)}
            onToggleFavorite={() => library.toggleFavorite(previewAsset.id)}
            onDelete={() => askToDelete(previewAsset.id)}
          />
        ) : null}
      </AnimatePresence>

      <ConfirmDialog
        open={deleting !== null}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        icon={Trash2}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description={
          deleting?.accountAsset
            ? "It’s removed from your graphics on every device. Artwork already on the sheet stays."
            : "It’s removed from your graphics. Artwork already on the sheet stays."
        }
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending={deletePending}
        destructive
      />
      <AccountDialog open={signingIn} onOpenChange={setSigningIn} />
    </div>
  );
}
