"use client";

import { AnimatePresence } from "framer-motion";

import { AssetEmptyState } from "@/components/assets/asset-empty-state";
import { AssetGrid } from "@/components/assets/asset-grid";
import { AssetPreviewDrawer } from "@/components/assets/asset-preview-drawer";
import { AssetSearch } from "@/components/assets/asset-search";
import { UploadProgressCard } from "@/components/assets/upload-progress-card";
import { PanelBody } from "@/components/panels/panel-body";
import { UploadCard } from "@/components/uploads/upload-card";
import { useAssetLibrary } from "@/hooks/use-asset-library";

/**
 * Graphics — the asset library.
 *
 * Search stays pinned while the grid scrolls under it; the upload zone sits
 * between the two, collapsing to a button once there is artwork to look at.
 */
export function GraphicsPanel() {
  const library = useAssetLibrary();
  const { assets, visibleAssets, uploads, previewAsset, search } = library;

  const isLibraryEmpty = assets.length === 0 && uploads.length === 0;
  const hasNoResults = visibleAssets.length === 0 && uploads.length === 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
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
            onBrowse={library.startMockUpload}
          />

          <AnimatePresence initial={false}>
            {uploads.map((task) => (
              <UploadProgressCard key={task.id} task={task} />
            ))}
          </AnimatePresence>

          {hasNoResults ? (
            <AssetEmptyState
              variant={isLibraryEmpty ? "library" : "search"}
              onAction={
                isLibraryEmpty
                  ? library.startMockUpload
                  : () => library.setSearch("")
              }
            />
          ) : (
            <AssetGrid
              assets={visibleAssets}
              onOpen={library.openPreview}
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
            onRename={(name) => library.renameAsset(previewAsset.id, name)}
            onToggleFavorite={() => library.toggleFavorite(previewAsset.id)}
            onDelete={() => library.deleteAsset(previewAsset.id)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
