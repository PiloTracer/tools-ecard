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
    <div className="flex items-center gap-4 border-b border-slate-800 bg-slate-800 px-4 py-3 shadow-md">
      {/* Zoom Controls */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-300">Zoom:</span>
        <button
          onClick={zoomOut}
          className="rounded bg-slate-700 border border-slate-600 px-3 py-1.5 text-base font-bold text-white hover:bg-slate-600 hover:border-slate-500 transition-colors"
          title="Zoom Out"
        >
          −
        </button>
        <span className="min-w-[60px] text-center text-sm font-semibold text-white">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="rounded bg-slate-700 border border-slate-600 px-3 py-1.5 text-base font-bold text-white hover:bg-slate-600 hover:border-slate-500 transition-colors"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={resetZoom}
          className="rounded bg-slate-700 border border-slate-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-600 hover:border-slate-500 transition-colors"
          title="Reset Zoom"
        >
          100%
        </button>
      </div>

      {/* Grid Controls */}
      <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
        <button
          onClick={toggleGrid}
          className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
            showGrid
              ? 'border-blue-400 bg-blue-600 text-white hover:bg-blue-500'
              : 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600 hover:border-slate-500'
          }`}
        >
          {showGrid ? 'Hide Grid' : 'Show Grid'}
        </button>
        <button
          onClick={toggleSnapToGrid}
          className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
            snapToGrid
              ? 'border-blue-400 bg-blue-600 text-white hover:bg-blue-500'
              : 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600 hover:border-slate-500'
          }`}
        >
          {snapToGrid ? 'Snap: On' : 'Snap: Off'}
        </button>
      </div>
    </div>
  );
}
