import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import * as fabric from 'fabric';
import type { CanvasState, Point, Rectangle } from '../types';

interface CanvasStore extends CanvasState {
  // Canvas reference
  canvasInstance: fabric.Canvas | null;

  // Actions
  setCanvasInstance: (canvas: fabric.Canvas | null) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setGridSize: (size: number) => void;
  setSelectedElementId: (id: string | null) => void;
  setDragging: (isDragging: boolean) => void;
  setPanning: (isPanning: boolean) => void;

  // Utility methods
  snapToGrid: (value: number) => number;
  getCanvasBounds: () => Rectangle;
  centerCanvas: () => void;
  exportCanvas: (format: 'png' | 'jpg' | 'svg') => Promise<Blob>;
}

export const useCanvasStore = create<CanvasStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      zoom: 1,
      showGrid: false,
      snapToGrid: false,
      gridSize: 10,
      selectedElementId: null,
      isDragging: false,
      isPanning: false,
      canvasInstance: null,

      // Actions
      setCanvasInstance: (canvas) => set({ canvasInstance: canvas }),

      setZoom: (zoom) => {
        const canvas = get().canvasInstance;
        if (canvas) {
          canvas.setZoom(zoom);
          canvas.renderAll();
        }
        set({ zoom });
      },

      zoomIn: () => {
        const currentZoom = get().zoom;
        const newZoom = Math.min(currentZoom + 0.1, 5);
        get().setZoom(newZoom);
      },

      zoomOut: () => {
        const currentZoom = get().zoom;
        const newZoom = Math.max(currentZoom - 0.1, 0.1);
        get().setZoom(newZoom);
      },

      resetZoom: () => {
        get().setZoom(1);
      },

      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

      toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

      setGridSize: (size) => set({ gridSize: size }),

      setSelectedElementId: (id) => set({ selectedElementId: id }),

      setDragging: (isDragging) => set({ isDragging }),

      setPanning: (isPanning) => set({ isPanning }),

      // Utility methods
      snapToGrid: (value) => {
        const state = get();
        if (!state.snapToGrid) return value;

        const gridSize = state.gridSize;
        return Math.round(value / gridSize) * gridSize;
      },

      getCanvasBounds: () => {
        const canvas = get().canvasInstance;
        if (!canvas) {
          return { x: 0, y: 0, width: 800, height: 600 };
        }

        return {
          x: 0,
          y: 0,
          width: canvas.getWidth(),
          height: canvas.getHeight()
        };
      },

      centerCanvas: () => {
        const canvas = get().canvasInstance;
        if (!canvas) return;

        // Reset viewport transform to center the canvas
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        get().setZoom(1);
      },

      exportCanvas: async (format) => {
        const canvas = get().canvasInstance;
        if (!canvas) {
          throw new Error('Canvas not initialized');
        }

        return new Promise((resolve, reject) => {
          const dataURL = canvas.toDataURL({
            format: format === 'svg' ? 'svg' : format,
            quality: 1,
            multiplier: 2 // Export at 2x resolution
          });

          // Convert data URL to Blob
          fetch(dataURL)
            .then((res) => res.blob())
            .then(resolve)
            .catch(reject);
        });
      }
    }),
    {
      name: 'canvas-store'
    }
  )
);