import { create } from 'zustand';

interface CanvasState {
  // Canvas dimensions
  width: number;
  height: number;

  // Zoom and grid
  zoom: number;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;

  // Selection
  selectedElementId: string | null;

  // Actions
  setDimensions: (width: number, height: number) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  setGridSize: (size: number) => void;
  setSelectedElement: (id: string | null) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  // Initial state
  width: 800,
  height: 600,
  zoom: 1,
  showGrid: true,
  snapToGrid: false,
  gridSize: 10,
  selectedElementId: null,

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

  setSelectedElement: (selectedElementId) => set({ selectedElementId }),
}));
