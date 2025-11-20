'use client';

import { useCanvasStore } from '../../stores/canvasStore';
import { useTemplateStore } from '../../stores/templateStore';

export function CanvasControls() {
  const {
    zoom,
    showGrid,
    snapToGrid,
    backgroundColor,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleGrid,
    toggleSnapToGrid,
    setBackgroundColor,
    fabricCanvas
  } = useCanvasStore();

  const { currentTemplate, undo, redo, canUndo, canRedo } = useTemplateStore();

  const handleExportPNG = () => {
    if (!fabricCanvas) return;
    const dataURL = fabricCanvas.toDataURL({ format: 'png', quality: 1 });
    const link = document.createElement('a');
    link.download = `${currentTemplate?.name || 'template'}.png`;
    link.href = dataURL;
    link.click();
  };

  const handleExportSVG = () => {
    if (!fabricCanvas) return;
    const svg = fabricCanvas.toSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${currentTemplate?.name || 'template'}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (!currentTemplate) return;
    const json = JSON.stringify(currentTemplate, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${currentTemplate.name || 'template'}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

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

      {/* Undo/Redo Controls */}
      <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
        <button
          onClick={undo}
          disabled={!canUndo()}
          className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
            canUndo()
              ? 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600 hover:border-slate-500'
              : 'border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
          title="Undo (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo()}
          className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
            canRedo()
              ? 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600 hover:border-slate-500'
              : 'border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
          title="Redo (Ctrl+Y)"
        >
          ↷ Redo
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

      {/* Background Color */}
      <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
        <span className="text-sm font-medium text-slate-300">Background:</span>
        <input
          type="color"
          value={backgroundColor}
          onChange={(e) => setBackgroundColor(e.target.value)}
          className="h-8 w-16 rounded border border-slate-600 cursor-pointer"
          title="Canvas Background Color"
        />
      </div>

      {/* Export Controls */}
      <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
        <span className="text-sm font-medium text-slate-300">Export:</span>
        <button
          onClick={handleExportPNG}
          className="rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600 hover:border-slate-500 transition-colors"
          title="Export as PNG"
        >
          PNG
        </button>
        <button
          onClick={handleExportSVG}
          className="rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600 hover:border-slate-500 transition-colors"
          title="Export as SVG"
        >
          SVG
        </button>
        <button
          onClick={handleExportJSON}
          className="rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600 hover:border-slate-500 transition-colors"
          title="Export as JSON"
        >
          JSON
        </button>
      </div>
    </div>
  );
}
