import { create } from 'zustand';
import type { Canvas } from 'fabric';

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

  // Selection
  selectedElementId: string | null;

  // Fabric canvas reference
  fabricCanvas: Canvas | null;

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
  setFabricCanvas: (canvas: Canvas | null) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  // Initial state
  width: 800,
  height: 600,
  zoom: 1,
  showGrid: true,
  snapToGrid: false,
  gridSize: 10,
  backgroundColor: '#ffffff',
  selectedElementId: null,
  fabricCanvas: null,

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

  setSelectedElement: (selectedElementId) => set({ selectedElementId }),

  setFabricCanvas: (fabricCanvas) => set({ fabricCanvas }),
}));
