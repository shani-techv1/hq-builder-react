"use client";

import * as React from "react";
import { AnimatePresence } from "framer-motion";

import { AssetEmptyState } from "@/components/assets/asset-empty-state";
import { AssetGrid } from "@/components/assets/asset-grid";
import { AssetPreviewDrawer } from "@/components/assets/asset-preview-drawer";
import { AssetSearch } from "@/components/assets/asset-search";
import { UploadProgressCard } from "@/components/assets/upload-progress-card";
import { UploadRejections } from "@/components/assets/upload-rejections";
import { PanelBody } from "@/components/panels/panel-body";
import { UploadCard } from "@/components/uploads/upload-card";
import { useEditorState } from "@/components/editor/editor-state";
import { useFilePicker } from "@/hooks/use-file-picker";

/**
 * Graphics — the asset library.
 *
 * Search stays pinned while the grid scrolls under it; the upload zone sits
 * between the two, collapsing to a button once there is artwork to look at.
 *
 * The library itself belongs to the editor rather than to this panel — the
 * panel unmounts every time it is closed, and artwork placed on the sheet has
 * to outlive that.
 */
export function GraphicsPanel() {
  const { library, placeAsset, placeAssetById } = useEditorState();
  const { assets, visibleAssets, uploads, rejections, previewAsset, search } =
    library;

  const handleFiles = React.useCallback(
    (files: File[]) => {
      // Uploaded from the panel, so the artwork lands in the library and waits
      // to be placed — unlike a drop on the sheet, which means "put it there".
      void library.uploadFiles(files);
    },
    [library],
  );

  const picker = useFilePicker(handleFiles);

  const isLibraryEmpty = assets.length === 0 && uploads.length === 0;
  const hasNoResults = visibleAssets.length === 0 && uploads.length === 0;

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
          <UploadCard
            variant={isLibraryEmpty ? "full" : "compact"}
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

          {hasNoResults ? (
            <AssetEmptyState
              variant={isLibraryEmpty ? "library" : "search"}
              onAction={
                isLibraryEmpty ? picker.open : () => library.setSearch("")
              }
            />
          ) : (
            <AssetGrid
              assets={visibleAssets}
              onOpen={library.openPreview}
              onPlace={placeAssetById}
              onRename={library.renameAsset}
              onDuplicate={library.duplicateAsset}
              onToggleFavorite={library.toggleFavorite}
              onDelete={library.deleteAsset}
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
            onDelete={() => library.deleteAsset(previewAsset.id)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
