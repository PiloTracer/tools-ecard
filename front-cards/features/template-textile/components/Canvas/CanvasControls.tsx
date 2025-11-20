'use client';

import { useCanvasStore } from '../../stores/canvasStore';

export function CanvasControls() {
  const {
    zoom,
    showGrid,
    snapToGrid,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleGrid,
    toggleSnapToGrid
  } = useCanvasStore();

  return (
    <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-2">
      {/* Zoom Controls */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Zoom:</span>
        <button
          onClick={zoomOut}
          className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
          title="Zoom Out"
        >
          −
        </button>
        <span className="min-w-[60px] text-center text-sm font-medium">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={resetZoom}
          className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
          title="Reset Zoom"
        >
          100%
        </button>
      </div>

      {/* Grid Controls */}
      <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
        <button
          onClick={toggleGrid}
          className={`rounded border px-3 py-1 text-sm ${
            showGrid
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {showGrid ? 'Hide Grid' : 'Show Grid'}
        </button>
        <button
          onClick={toggleSnapToGrid}
          className={`rounded border px-3 py-1 text-sm ${
            snapToGrid
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {snapToGrid ? 'Snap: On' : 'Snap: Off'}
        </button>
      </div>
    </div>
  );
}
