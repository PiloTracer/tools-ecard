'use client';

import * as fabric from 'fabric';
import { useState, useEffect } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useTemplateStore } from '../../stores/templateStore';
import { SaveTemplateModal } from '../SaveModal/SaveTemplateModal';
import { OpenTemplateModal } from '../OpenModal/OpenTemplateModal';
import { TemplateStatus } from '../TemplateStatus/TemplateStatus';
import { templateService } from '../../services/templateService';
import type { Template, ImageElement } from '../../types';

/**
 * Rasterize all images in a template to PNG format
 * This prevents SVG corruption issues when saving/loading templates
 */
async function rasterizeImages(template: Template, canvas: fabric.Canvas | null): Promise<Template> {
  if (!canvas) {
    console.warn('[RASTERIZE] No canvas available for rasterization, using original template');
    return template;
  }

  console.log('[RASTERIZE] Starting image rasterization...');
  console.log('[RASTERIZE] Template has', template.elements.length, 'elements');

  // Clone the template to avoid modifying the original
  const processedTemplate: Template = JSON.parse(JSON.stringify(template));

  // Find all Fabric.js objects
  const fabricObjects = canvas.getObjects();
  console.log('[RASTERIZE] Canvas has', fabricObjects.length, 'fabric objects');

  // Process each image element
  for (let i = 0; i < processedTemplate.elements.length; i++) {
    const element = processedTemplate.elements[i];

    if (element.type === 'image') {
      const imageElement = element as ImageElement;
      console.log(`[RASTERIZE] Processing image element ${element.id}, current URL:`, imageElement.imageUrl?.substring(0, 100));

      // Find the corresponding Fabric.js object
      const fabricObj = fabricObjects.find((obj: any) => obj.elementId === element.id);
      console.log(`[RASTERIZE] Found fabric object for ${element.id}:`, fabricObj?.type);

      if (fabricObj && (fabricObj.type === 'image' || fabricObj.type === 'Image')) {
        try {
          // Export the Fabric.js image as PNG data URL
          const fabricImage = fabricObj as fabric.Image;
          const pngDataUrl = fabricImage.toDataURL({
            format: 'png',
            quality: 1.0,
            multiplier: 1 // Use the current canvas resolution
          });

          console.log(`[RASTERIZE] Converted image ${element.id} to PNG (${pngDataUrl.length} bytes)`);
          console.log(`[RASTERIZE] PNG preview:`, pngDataUrl.substring(0, 100));

          // Replace the imageUrl with the rasterized PNG
          imageElement.imageUrl = pngDataUrl;
        } catch (error) {
          console.error(`[RASTERIZE] Failed to rasterize image ${element.id}:`, error);
          // Keep the original imageUrl if rasterization fails
        }
      } else {
        console.warn(`[RASTERIZE] No fabric Image object found for element ${element.id}`);
      }
    }
  }

  console.log('[RASTERIZE] Rasterization complete');
  return processedTemplate;
}

export function CanvasControls() {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  const {
    currentTemplate,
    currentProjectName,
    currentTemplateName,
    hasUnsavedChanges,
    canvasWidth,
    canvasHeight,
    exportWidth,
    undo,
    redo,
    canUndo,
    canRedo,
    setSaveMetadata,
    markAsSaved,
    loadTemplate
  } = useTemplateStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S for saving
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();

        if (currentTemplate) {
          if (currentTemplateName && hasUnsavedChanges) {
            // Quick save with existing name
            handleSaveTemplate(currentTemplateName, currentProjectName || 'default');
          } else if (!currentTemplateName) {
            // Open save modal for new templates
            setShowSaveModal(true);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTemplate, currentTemplateName, currentProjectName, hasUnsavedChanges]);

  const handleSaveTemplate = async (templateName: string, projectName: string) => {
    if (!currentTemplate) {
      throw new Error('No template to save');
    }

    setIsSaving(true);

    try {
      // Rasterize all images before saving to avoid SVG corruption
      const processedTemplate = await rasterizeImages(currentTemplate, fabricCanvas);

      // Save the template (resource extraction happens inside saveTemplate)
      const metadata = await templateService.saveTemplate({
        name: templateName,
        templateData: processedTemplate,
      });

      // Update store with saved metadata
      setSaveMetadata(projectName, templateName);
      markAsSaved();

      // Close the modal
      setShowSaveModal(false);

      // Show success message (could use a toast here)
      console.log('Template saved successfully:', metadata);
    } catch (error) {
      console.error('Error saving template:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenTemplate = async (templateId: string) => {
    try {
      // Load template from service
      const loadedTemplate = await templateService.loadTemplate(templateId);

      // Clear current canvas
      if (fabricCanvas) {
        fabricCanvas.clear();
        fabricCanvas.backgroundColor = loadedTemplate.data.backgroundColor || '#ffffff';
      }

      // Load template into store (this will trigger canvas re-render)
      loadTemplate(loadedTemplate.data);

      // Update save metadata
      setSaveMetadata(
        'Default Project',
        loadedTemplate.name
      );
      markAsSaved();

      console.log('Template opened successfully:', loadedTemplate.name);
    } catch (error) {
      console.error('Error opening template:', error);
      throw error;
    }
  };

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
            const renderWidth = Math.round(svgNaturalWidth * 5);
            const renderHeight = Math.round(svgNaturalHeight * 5);

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
            const renderWidth = Math.round(svgNaturalWidth * 5);
            const renderHeight = Math.round(svgNaturalHeight * 5);

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
    <>
      {/* Save Modal */}
      <SaveTemplateModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveTemplate}
        currentTemplateName={currentTemplateName || ''}
        currentProjectName={currentProjectName || 'default'}
      />

      {/* Open Modal */}
      <OpenTemplateModal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        onOpen={handleOpenTemplate}
      />

      {/* Template Status Bar */}
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-2">
        <TemplateStatus />
        <div className="flex items-center gap-2">
          {/* Save Button */}
          <button
            onClick={() => setShowSaveModal(true)}
            disabled={!currentTemplate || isSaving}
            className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
              hasUnsavedChanges
                ? 'border-amber-500 bg-amber-600 text-white hover:bg-amber-700'
                : 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={hasUnsavedChanges ? 'Save Template (Unsaved Changes)' : 'Save Template'}
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
                </svg>
                Save
              </>
            )}
          </button>

          {/* Open Button */}
          <button
            onClick={() => setShowOpenModal(true)}
            className="flex items-center gap-2 rounded border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
            title="Open Template"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            Open
          </button>

          {/* Quick Save (Ctrl+S) */}
          {currentTemplateName && (
            <button
              onClick={() => handleSaveTemplate(currentTemplateName, currentProjectName || 'default')}
              disabled={!hasUnsavedChanges || isSaving}
              className="text-xs text-slate-500 hover:text-slate-400 disabled:opacity-50"
              title="Quick Save (Ctrl+S)"
            >
              Ctrl+S
            </button>
          )}
        </div>
      </div>

      {/* Main Controls Bar */}
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
    </>
  );
}
