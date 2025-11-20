'use client';

import * as fabric from 'fabric';
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

  const { currentTemplate, canvasWidth, canvasHeight, exportWidth, undo, redo, canUndo, canRedo } = useTemplateStore();

  const handleExportPNG = async () => {
    if (!fabricCanvas) return;

    const scaleFactor = exportWidth / canvasWidth;
    console.log(`Exporting PNG: canvas ${canvasWidth}x${canvasHeight}, export width ${exportWidth}, multiplier ${scaleFactor}`);

    // Save current viewport transform (zoom and pan)
    const originalViewport = fabricCanvas.viewportTransform ? [...fabricCanvas.viewportTransform] : [1, 0, 0, 1, 0, 0];
    const originalZoom = fabricCanvas.getZoom();

    // Reset viewport to capture entire canvas at 1:1 scale
    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    fabricCanvas.setZoom(1);

    // Temporarily remove grid lines
    const gridObjects = fabricCanvas.getObjects().filter((obj: any) => obj.isGrid || obj.excludeFromExport);
    gridObjects.forEach(obj => fabricCanvas.remove(obj));

    // Replace image objects with high-res versions (SVG width × 4)
    const imageReplacements: Array<{ original: any, highRes: any, index: number }> = [];
    const allObjects = fabricCanvas.getObjects();

    for (let i = 0; i < allObjects.length; i++) {
      const obj = allObjects[i];
      const originalImageUrl = (obj as any)._originalImageUrl;

      if (originalImageUrl) {
        // This is an image object with original SVG/PNG/JPG
        await new Promise<void>((resolve) => {
          const tempImg = document.createElement('img');

          tempImg.onload = () => {
            // Get SVG natural dimensions
            const svgNaturalWidth = tempImg.naturalWidth || tempImg.width;
            const svgNaturalHeight = tempImg.naturalHeight || tempImg.height;

            // Render at SVG width × 4
            const renderWidth = Math.round(svgNaturalWidth * 4);
            const renderHeight = Math.round(svgNaturalHeight * 4);

            // Calculate what scale to apply to fit in current box
            const currentWidth = (obj.width || 100) * (obj.scaleX || 1);
            const currentHeight = (obj.height || 100) * (obj.scaleY || 1);
            const scaleToFit = currentWidth / renderWidth;

            console.log(`High-res image: SVG ${svgNaturalWidth}x${svgNaturalHeight}, render ${renderWidth}x${renderHeight}, fit scale ${scaleToFit}`);

            // Create high-res canvas
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = renderWidth;
            tempCanvas.height = renderHeight;
            const ctx = tempCanvas.getContext('2d');

            if (ctx) {
              ctx.drawImage(tempImg, 0, 0, renderWidth, renderHeight);

              // Create high-res fabric image, scaled down to fit current box
              const highResImg = new (fabric as any).Image(tempCanvas, {
                left: obj.left,
                top: obj.top,
                angle: obj.angle,
                opacity: obj.opacity,
                scaleX: scaleToFit,
                scaleY: scaleToFit,
              });

              imageReplacements.push({ original: obj, highRes: highResImg, index: i });
              fabricCanvas.remove(obj);
              fabricCanvas.add(highResImg);
            }
            resolve();
          };

          tempImg.onerror = () => resolve();
          tempImg.src = originalImageUrl;
        });
      }
    }

    fabricCanvas.renderAll();

    const dataURL = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: scaleFactor,
      enableRetinaScaling: false,
    });

    // Restore original images
    imageReplacements.forEach(({ original, highRes }) => {
      fabricCanvas.remove(highRes);
      fabricCanvas.add(original);
    });

    // Add grid lines back
    gridObjects.forEach(obj => fabricCanvas.add(obj));
    gridObjects.forEach(obj => fabricCanvas.sendObjectToBack(obj));

    // Restore original viewport transform (zoom and pan)
    fabricCanvas.setViewportTransform(originalViewport);
    fabricCanvas.setZoom(originalZoom);
    fabricCanvas.renderAll();

    const link = document.createElement('a');
    link.download = `${currentTemplate?.name || 'template'}.png`;
    link.href = dataURL;
    link.click();
  };

  const handleExportJPG = async () => {
    if (!fabricCanvas) return;

    const scaleFactor = exportWidth / canvasWidth;
    console.log(`Exporting JPG: canvas ${canvasWidth}x${canvasHeight}, export width ${exportWidth}, multiplier ${scaleFactor}`);

    // Save current viewport transform (zoom and pan)
    const originalViewport = fabricCanvas.viewportTransform ? [...fabricCanvas.viewportTransform] : [1, 0, 0, 1, 0, 0];
    const originalZoom = fabricCanvas.getZoom();

    // Reset viewport to capture entire canvas at 1:1 scale
    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    fabricCanvas.setZoom(1);

    // Temporarily remove grid lines
    const gridObjects = fabricCanvas.getObjects().filter((obj: any) => obj.isGrid || obj.excludeFromExport);
    gridObjects.forEach(obj => fabricCanvas.remove(obj));

    // Replace image objects with high-res versions (SVG width × 4)
    const imageReplacements: Array<{ original: any, highRes: any, index: number }> = [];
    const allObjects = fabricCanvas.getObjects();

    for (let i = 0; i < allObjects.length; i++) {
      const obj = allObjects[i];
      const originalImageUrl = (obj as any)._originalImageUrl;

      if (originalImageUrl) {
        await new Promise<void>((resolve) => {
          const tempImg = document.createElement('img');

          tempImg.onload = () => {
            // Get SVG natural dimensions
            const svgNaturalWidth = tempImg.naturalWidth || tempImg.width;
            const svgNaturalHeight = tempImg.naturalHeight || tempImg.height;

            // Render at SVG width × 4
            const renderWidth = Math.round(svgNaturalWidth * 4);
            const renderHeight = Math.round(svgNaturalHeight * 4);

            // Calculate what scale to apply to fit in current box
            const currentWidth = (obj.width || 100) * (obj.scaleX || 1);
            const currentHeight = (obj.height || 100) * (obj.scaleY || 1);
            const scaleToFit = currentWidth / renderWidth;

            console.log(`High-res image: SVG ${svgNaturalWidth}x${svgNaturalHeight}, render ${renderWidth}x${renderHeight}, fit scale ${scaleToFit}`);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = renderWidth;
            tempCanvas.height = renderHeight;
            const ctx = tempCanvas.getContext('2d');

            if (ctx) {
              ctx.drawImage(tempImg, 0, 0, renderWidth, renderHeight);

              const highResImg = new (fabric as any).Image(tempCanvas, {
                left: obj.left,
                top: obj.top,
                angle: obj.angle,
                opacity: obj.opacity,
                scaleX: scaleToFit,
                scaleY: scaleToFit,
              });

              imageReplacements.push({ original: obj, highRes: highResImg, index: i });
              fabricCanvas.remove(obj);
              fabricCanvas.add(highResImg);
            }
            resolve();
          };

          tempImg.onerror = () => resolve();
          tempImg.src = originalImageUrl;
        });
      }
    }

    fabricCanvas.renderAll();

    const dataURL = fabricCanvas.toDataURL({
      format: 'jpeg',
      quality: 0.95,
      multiplier: scaleFactor,
      enableRetinaScaling: false,
    });

    // Restore original images
    imageReplacements.forEach(({ original, highRes }) => {
      fabricCanvas.remove(highRes);
      fabricCanvas.add(original);
    });

    // Add grid lines back
    gridObjects.forEach(obj => fabricCanvas.add(obj));
    gridObjects.forEach(obj => fabricCanvas.sendObjectToBack(obj));

    // Restore original viewport transform (zoom and pan)
    fabricCanvas.setViewportTransform(originalViewport);
    fabricCanvas.setZoom(originalZoom);
    fabricCanvas.renderAll();

    const link = document.createElement('a');
    link.download = `${currentTemplate?.name || 'template'}.jpg`;
    link.href = dataURL;
    link.click();
  };

  const handleExportSVG = () => {
    if (!fabricCanvas) return;

    const scaleFactor = exportWidth / canvasWidth;
    const exportHeight = Math.round(canvasHeight * scaleFactor);

    console.log(`Exporting SVG: canvas ${canvasWidth}x${canvasHeight}, export ${exportWidth}x${exportHeight}, multiplier ${scaleFactor}`);

    // Save current viewport transform (zoom and pan)
    const originalViewport = fabricCanvas.viewportTransform ? [...fabricCanvas.viewportTransform] : [1, 0, 0, 1, 0, 0];
    const originalZoom = fabricCanvas.getZoom();

    // Reset viewport to capture entire canvas at 1:1 scale
    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    fabricCanvas.setZoom(1);

    // Temporarily remove grid lines
    const gridObjects = fabricCanvas.getObjects().filter((obj: any) => obj.isGrid || obj.excludeFromExport);
    gridObjects.forEach(obj => fabricCanvas.remove(obj));

    // Get SVG with proper dimensions and viewBox
    let svg = fabricCanvas.toSVG();

    // Add grid lines back
    gridObjects.forEach(obj => fabricCanvas.add(obj));
    gridObjects.forEach(obj => fabricCanvas.sendObjectToBack(obj));

    // Restore original viewport transform (zoom and pan)
    fabricCanvas.setViewportTransform(originalViewport);
    fabricCanvas.setZoom(originalZoom);
    fabricCanvas.renderAll();

    // Replace the svg tag to add proper dimensions and viewBox
    svg = svg.replace(
      /<svg([^>]*)>/,
      `<svg width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}"$1>`
    );

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
          onClick={handleExportJPG}
          className="rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600 hover:border-slate-500 transition-colors"
          title="Export as JPG"
        >
          JPG
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
