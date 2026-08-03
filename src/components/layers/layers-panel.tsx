"use client";

import { Layers } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { useEditorState } from "@/components/editor/editor-state";
import { LayerList } from "@/components/layers/layer-list";
import { PanelBody } from "@/components/panels/panel-body";

/**
 * Layers — every object on the sheet, in stacking order.
 *
 * Reads and writes the editor's shared canvas state directly, so selection,
 * lock, visibility and order are the same values the canvas and the inspector
 * use. There is no local copy of the list.
 */
export function LayersPanel() {
  const { canvas } = useEditorState();
  const { objects, selectedIds } = canvas;

  /**
   * Duplicating from a row acts on that row, not on whatever happens to be
   * selected — so the row is selected first and the existing selection-based
   * duplicate runs against it.
   */
  const duplicateLayer = (id: string) => {
    canvas.selectObject(id);
    canvas.duplicateSelection();
  };

  if (objects.length === 0) {
    return (
      <PanelBody>
        <EmptyState
          icon={Layers}
          title="No layers yet"
          description="Upload artwork to begin."
        />
      </PanelBody>
    );
  }

  return (
    <PanelBody className="space-y-3">
      <LayerList
        objects={objects}
        selectedIds={selectedIds}
        onReorder={canvas.setObjectOrder}
        onSelect={canvas.selectObject}
        onRename={(id, name) => canvas.patchObject(id, { name })}
        onToggleHidden={(id) => {
          const object = objects.find((item) => item.id === id);
          if (object) canvas.setObjectHidden(id, !object.hidden);
        }}
        onToggleLocked={(id) => {
          const object = objects.find((item) => item.id === id);
          if (object) canvas.patchObject(id, { locked: !object.locked });
        }}
        onDuplicate={duplicateLayer}
        onDelete={canvas.deleteObject}
        onBringToFront={(id) => canvas.moveObjectToEdge(id, "front")}
        onSendToBack={(id) => canvas.moveObjectToEdge(id, "back")}
      />
    </PanelBody>
  );
}
