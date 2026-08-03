"use client";

import * as React from "react";

import {
  useCanvasInteraction,
  type CanvasInteraction,
} from "@/hooks/use-canvas-interaction";
import { DEFAULT_ZOOM, type MeasurementUnit } from "@/lib/workspace";
import type { CanvasObject } from "@/lib/canvas-objects";

/**
 * Everything about the sheet that isn't an object on it.
 *
 * Shared rather than local to the workspace because two surfaces now drive the
 * same switches — the toolbar above the canvas and the inspector's canvas
 * settings — and a toggle that disagreed with itself would be worse than
 * either one alone.
 */
export interface WorkspaceSettings {
  sheetSize: string;
  setSheetSize: (value: string) => void;
  zoom: number;
  setZoom: (value: number) => void;
  showBackground: boolean;
  setShowBackground: (value: boolean) => void;
  showGrid: boolean;
  setShowGrid: (value: boolean) => void;
  snapEnabled: boolean;
  setSnapEnabled: (value: boolean) => void;
  unit: MeasurementUnit;
  setUnit: (value: MeasurementUnit) => void;
}

export interface EditorState {
  canvas: CanvasInteraction;
  settings: WorkspaceSettings;
}

const EditorStateContext = React.createContext<EditorState | null>(null);

export interface EditorStateProviderProps {
  /** Called whenever something happens that should count against the save. */
  onDesignChange?: () => void;
  children: React.ReactNode;
}

/**
 * Owns the canvas selection and the sheet settings for the whole editor.
 *
 * Mutations are wrapped once here so every surface that changes the design
 * marks it unsaved, rather than each call site remembering to.
 */
export function EditorStateProvider({
  onDesignChange,
  children,
}: EditorStateProviderProps) {
  const base = useCanvasInteraction();

  const [zoom, setZoom] = React.useState(DEFAULT_ZOOM);
  const [showBackground, setShowBackground] = React.useState(true);
  const [showGrid, setShowGrid] = React.useState(false);
  const [snapEnabled, setSnapEnabled] = React.useState(true);
  const [unit, setUnit] = React.useState<MeasurementUnit>("in");

  const notify = onDesignChange;

  const canvas: CanvasInteraction = {
    ...base,
    addMockArtwork: () => {
      base.addMockArtwork();
      notify?.();
    },
    duplicateSelection: () => {
      base.duplicateSelection();
      notify?.();
    },
    deleteSelection: () => {
      base.deleteSelection();
      notify?.();
    },
    rotateSelection: (degrees: number) => {
      base.rotateSelection(degrees);
      notify?.();
    },
    toggleLockSelection: () => {
      base.toggleLockSelection();
      notify?.();
    },
    setSelectionOpacity: (opacity: number) => {
      base.setSelectionOpacity(opacity);
      notify?.();
    },
    patchSelection: (patch: Partial<CanvasObject>) => {
      base.patchSelection(patch);
      notify?.();
    },
    patchObject: (id: string, patch: Partial<CanvasObject>) => {
      base.patchObject(id, patch);
      notify?.();
    },
    patchObjects: (updates) => {
      base.patchObjects(updates);
      notify?.();
    },
    setObjectHidden: (id: string, hidden: boolean) => {
      base.setObjectHidden(id, hidden);
      notify?.();
    },
    deleteObject: (id: string) => {
      base.deleteObject(id);
      notify?.();
    },
    setObjectOrder: (ids: string[]) => {
      base.setObjectOrder(ids);
      notify?.();
    },
    moveObjectToEdge: (id: string, edge: "front" | "back") => {
      base.moveObjectToEdge(id, edge);
      notify?.();
    },
    setSheetSize: (value: string) => {
      base.setSheetSize(value);
      notify?.();
    },
    // Stepping through history changes the design as much as any edit does.
    undo: () => {
      base.undo();
      notify?.();
    },
    redo: () => {
      base.redo();
      notify?.();
    },
  };

  const settings: WorkspaceSettings = {
    // Backed by the document reducer rather than local state, so resizing the
    // sheet lands on the undo stack with everything else. The shape the
    // toolbar and inspector consume is unchanged.
    sheetSize: canvas.sheetSize,
    setSheetSize: canvas.setSheetSize,
    zoom,
    setZoom,
    showBackground,
    setShowBackground,
    showGrid,
    setShowGrid,
    snapEnabled,
    setSnapEnabled,
    unit,
    setUnit,
  };

  return (
    <EditorStateContext.Provider value={{ canvas, settings }}>
      {children}
    </EditorStateContext.Provider>
  );
}

export function useEditorState(): EditorState {
  const context = React.useContext(EditorStateContext);
  if (!context) {
    throw new Error("useEditorState must be used inside an EditorStateProvider");
  }
  return context;
}
