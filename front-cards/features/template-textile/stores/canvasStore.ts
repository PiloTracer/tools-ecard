import { create } from 'zustand';
import type { Canvas } from 'fabric';
import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../constants/canvasDefaults';

interface CanvasState {
  // Canvas dimensions
  width: number;
  height: number;

  // Zoom and grid
  zoom: number;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  backgroundColor: string;

  /**
   * All selected element IDs (in box/shift order). Empty when nothing is selected.
   * The first entry is the "primary" item for the property panel.
   */
  selectedElementIds: string[];

  // Fabric canvas reference
  fabricCanvas: Canvas | null;

  /** Ids to drop from DesignCanvas internal maps so the next sync re-adds Fabric objects (heals desync). */
  pendingCanvasRebindIds: string[] | null;
  canvasRebindNonce: number;

  /**
   * Incremented when a full template document is loaded into the store (`loadTemplate`).
   * DesignCanvas must drop `addedElementIds` / `fabricObjectsMap` and re-add from JSON — otherwise
   * reopening the same template reuses stale Fabric instances (ids match) and geometry never refreshes.
   */
  templateFabricBindingEpoch: number;

  // Actions
  setDimensions: (width: number, height: number) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  setGridSize: (size: number) => void;
  setBackgroundColor: (color: string) => void;
  setSelectedElement: (id: string | null) => void;
  setSelectedElements: (ids: string[]) => void;
  setFabricCanvas: (canvas: Canvas | null) => void;
  requestCanvasRebindForElementIds: (ids: string[]) => void;
  clearPendingCanvasRebind: () => void;
  bumpTemplateFabricBindingEpoch: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  // Initial state
  width: DEFAULT_CANVAS_WIDTH,
  height: DEFAULT_CANVAS_HEIGHT,
  zoom: 1,
  showGrid: true,
  snapToGrid: false,
  gridSize: 10,
  backgroundColor: '#ffffff',
  selectedElementIds: [],
  fabricCanvas: null,
  pendingCanvasRebindIds: null,
  canvasRebindNonce: 0,
  templateFabricBindingEpoch: 0,

  // Actions
  setDimensions: (width, height) => set({ width, height }),

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),

  zoomIn: () => set((state) => ({
    zoom: Math.min(5, state.zoom + 0.1)
  })),

  zoomOut: () => set((state) => ({
    zoom: Math.max(0.1, state.zoom - 0.1)
  })),

  resetZoom: () => set({ zoom: 1 }),

  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

  setGridSize: (gridSize) => set({ gridSize }),

  setBackgroundColor: (backgroundColor) => set({ backgroundColor }),

  setSelectedElement: (id) => set({ selectedElementIds: id ? [id] : [] }),
  setSelectedElements: (ids) => set({ selectedElementIds: ids }),

  setFabricCanvas: (fabricCanvas) => set({ fabricCanvas }),

  requestCanvasRebindForElementIds: (ids) =>
    set((s) => ({
      pendingCanvasRebindIds: ids.length ? [...ids] : null,
      canvasRebindNonce: s.canvasRebindNonce + 1,
    })),

  clearPendingCanvasRebind: () => set({ pendingCanvasRebindIds: null }),

  bumpTemplateFabricBindingEpoch: () =>
    set((s) => ({ templateFabricBindingEpoch: s.templateFabricBindingEpoch + 1 })),
}));
