'use client';

import * as fabric from 'fabric';
import { Fragment, useState, useEffect, useRef } from 'react';
import { useProjects } from '@/features/simple-projects';
import { useCanvasStore } from '../../stores/canvasStore';
import { useTemplateStore } from '../../stores/templateStore';
import { SaveTemplateModal } from '../SaveModal/SaveTemplateModal';
import { OpenTemplateModal } from '../OpenModal/OpenTemplateModal';
import { TemplateStatus } from '../TemplateStatus/TemplateStatus';
import { OffscreenExportButton } from '../OffscreenExport/OffscreenExportButton';
import { ElementsLayerManagerModal } from './ElementsLayerManagerModal';
import { templateService } from '../../services/templateService';
import { templatePackageService } from '../../services/templatePackageService';
import type { Template, ImageElement } from '../../types';
import type { LengthUnit } from '../../utils/lengthUnits';
import { readPersistedTemplateGeometry } from '../../utils/fabricTemplateGeometry';

/**
 * Merges live store dimensions/units into the template object so saves and ZIP exports
 * always include canvas size, export base width, and display unit.
 */
function templateSnapshotForPersistence(
  base: Template,
  canvasW: number,
  canvasH: number,
  exportW: number,
  unit: LengthUnit,
  nameOverride?: string | null
): Template {
  const ar = canvasW / canvasH;
  const exportH = Math.max(1, Math.round(exportW / ar));
  const name =
    nameOverride != null && String(nameOverride).trim() !== ''
      ? String(nameOverride).trim()
      : base.name;
  return {
    ...base,
    name,
    width: canvasW,
    height: canvasH,
    canvasWidth: canvasW,
    canvasHeight: canvasH,
    exportWidth: exportW,
    exportHeight: exportH,
    canvasSizeUnit: unit,
    exportBaseWidthUnit: unit,
    updatedAt: new Date(),
  };
}

/**
 * Overwrite element x/y/rotation from the live Fabric canvas before persist.
 * The store is not always updated (e.g. focus/blur, race with object:modified, or desync);
 * without this, save/reopen can show text and shapes in old positions.
 */
function mergeLiveCanvasGeometryIntoTemplate(
  template: Template,
  canvas: fabric.Canvas | null
): Template {
  if (!canvas) {
    return template;
  }

  const live = new Map<string, { x: number; y: number; rotation: number }>();

  for (const obj of canvas.getObjects()) {
    const elementId = (obj as { elementId?: string }).elementId;
    if (!elementId) continue;

    const fo = obj as fabric.FabricObject;
    const g = readPersistedTemplateGeometry(fo);
    live.set(elementId, { x: g.x, y: g.y, rotation: g.rotation });
  }

  if (live.size === 0) {
    return template;
  }

  return {
    ...template,
    elements: template.elements.map((el) => {
      const pos = live.get(el.id);
      if (!pos) return el;
      return {
        ...el,
        x: pos.x,
        y: pos.y,
        rotation: pos.rotation,
      };
    }),
  };
}

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
        // Try to rasterize, but fall back to original URL if it fails (e.g., CORS taint)
        try {
          const fabricImage = fabricObj as fabric.Image;

          // Check if the image element is already a safe data URL
          if (imageElement.imageUrl && imageElement.imageUrl.startsWith('data:image/png;base64,')) {
            console.log(`[RASTERIZE] Image ${element.id} is already a PNG data URL, skipping`);
          } else {
            // Calculate multiplier to get FULL RESOLUTION (inverse of scale)
            const scaleX = fabricImage.scaleX || 1;
            const scaleY = fabricImage.scaleY || 1;
            const multiplier = 1 / Math.min(scaleX, scaleY);

            console.log(`[RASTERIZE] Image ${element.id} scale: ${scaleX}x${scaleY}, multiplier: ${multiplier}`);

            const pngDataUrl = fabricImage.toDataURL({
              format: 'png',
              quality: 1.0,
              multiplier: multiplier // Use inverse of scale to get full resolution
            });

            console.log(`[RASTERIZE] Converted image ${element.id} to PNG (${pngDataUrl.length} bytes)`);
            console.log(`[RASTERIZE] PNG preview:`, pngDataUrl.substring(0, 100));

            // Replace the imageUrl with the rasterized PNG
            imageElement.imageUrl = pngDataUrl;
          }
        } catch (error) {
          // Canvas is tainted (loaded from cross-origin URL), keep the original URL
          console.error(`[RASTERIZE] Cannot rasterize ${element.id} (CORS taint):`, error);
          console.log(`[RASTERIZE] Original URL type:`, imageElement.imageUrl?.substring(0, 50));
          console.log(`[RASTERIZE] Fabric object element:`, (fabricObj as any)._element);
          console.log(`[RASTERIZE] This image will cause export errors!`);
          // imageElement.imageUrl stays unchanged - THIS WILL CAUSE EXPORT ERRORS
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
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showElementsLayerModal, setShowElementsLayerModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // File input ref for importing templates
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { selectedProject } = useProjects();

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
    canvasSizeUnit,
    elements,
    updateElement,
    updateBackgroundColor,
    undo,
    redo,
    canUndo,
    canRedo,
    setSaveMetadata,
    markAsSaved,
    loadTemplate,
    createTemplate
  } = useTemplateStore();

  const projectNameForSave = currentProjectName || selectedProject?.name || 'default';

  // Sync background color from template to canvas store on template load
  useEffect(() => {
    if (currentTemplate?.backgroundColor) {
      setBackgroundColor(currentTemplate.backgroundColor);
    }
  }, [currentTemplate?.id]); // Only run when template changes (by ID)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S for saving
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();

        if (currentTemplate) {
          if (currentTemplateName && hasUnsavedChanges) {
            // Quick save with existing name
            handleSaveTemplate(currentTemplateName, projectNameForSave);
          } else if (!currentTemplateName) {
            // Open save modal for new templates
            setShowSaveModal(true);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTemplate, currentTemplateName, hasUnsavedChanges, projectNameForSave]);

  const handleSaveTemplate = async (templateName: string, projectName: string) => {
    if (!currentTemplate) {
      throw new Error('No template to save');
    }

    setIsSaving(true);

    try {
      let toPersist = templateSnapshotForPersistence(
        currentTemplate,
        canvasWidth,
        canvasHeight,
        exportWidth,
        canvasSizeUnit,
        templateName
      );
      toPersist = mergeLiveCanvasGeometryIntoTemplate(toPersist, fabricCanvas);
      // Rasterize all images before saving to avoid SVG corruption
      const processedTemplate = await rasterizeImages(toPersist, fabricCanvas);

      // Save the template (resource extraction happens inside saveTemplate)
      const metadata = await templateService.saveTemplate({
        name: templateName,
        templateData: processedTemplate,
      });

      // Store may still hold stale x/y/rotation; align so same-session edit matches what was saved
      const syncGeom = useTemplateStore.getState();
      for (const el of processedTemplate.elements) {
        const prev = syncGeom.elements.find((e) => e.id === el.id);
        if (
          prev &&
          (prev.x !== el.x ||
            prev.y !== el.y ||
            (prev.rotation ?? 0) !== (el.rotation ?? 0))
        ) {
          syncGeom.updateElement(el.id, {
            x: el.x,
            y: el.y,
            rotation: el.rotation,
          });
        }
      }

      // CRITICAL: Update currentTemplate.id with the server's DB UUID.
      // The server generates its own id (uuidv4) on save, which differs from
      // the client-generated id (crypto.randomUUID). Without this update,
      // delete and other operations that reference currentTemplate.id would
      // send the wrong ID and fail with "Template not found".
      useTemplateStore.getState().updateTemplateId(metadata.id);

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

      // CRITICAL: Override the template data's id with the database UUID.
      // The server generates its own id when saving (uuidv4), which differs from
      // the client-generated id (crypto.randomUUID) stored inside the S3 template data.
      // Without this fix, currentTemplate.id would be the client UUID, causing
      // delete and other operations to fail with "Template not found" since the
      // server looks up by the database UUID.
      loadedTemplate.data.id = loadedTemplate.id;

      // Clear current canvas
      if (fabricCanvas) {
        fabricCanvas.clear();
        fabricCanvas.backgroundColor = '#ffffff';
      }

      // Load template into store (this will trigger canvas re-render)
      // CRITICAL: Await font preloading before rendering
      await loadTemplate(loadedTemplate.data);

      // Update save metadata (use dashboard-selected project when available)
      setSaveMetadata(
        selectedProject?.name ?? 'Default Project',
        loadedTemplate.name
      );
      markAsSaved();

      console.log('Template opened successfully:', loadedTemplate.name);
    } catch (error) {
      console.error('Error opening template:', error);
      throw error;
    }
  };

  const handleCloseTemplate = () => {
    // If there are unsaved changes, show confirmation modal
    if (hasUnsavedChanges) {
      setShowCloseConfirmModal(true);
    } else {
      // No unsaved changes, close immediately
      executeCloseTemplate();
    }
  };

  const executeCloseTemplate = () => {
    // Clear the canvas
    if (fabricCanvas) {
      fabricCanvas.clear();
      fabricCanvas.backgroundColor = '#ffffff';
    }

    // Create a new empty template
    const { setDimensions } = useCanvasStore.getState();
    createTemplate('Untitled Template', 800, 600);
    setDimensions(800, 600);

    // Point metadata at a fresh untitled design under the current dashboard project
    setSaveMetadata(
      selectedProject?.name ?? 'Default Project',
      'Untitled Template'
    );

    // Close the confirmation modal if open
    setShowCloseConfirmModal(false);

    console.log('Template closed, new template created');
  };

  const handleDeleteTemplate = () => {
    // Always show confirmation modal before deleting
    setShowDeleteConfirmModal(true);
  };

  const executeDeleteTemplate = async () => {
    const templateId = currentTemplate?.id;
    if (!templateId) {
      setShowDeleteConfirmModal(false);
      return;
    }

    setIsDeleting(true);

    try {
      // Call the delete API — removes from server + local cache
      await templateService.deleteTemplate(templateId);

      // Close the current template (same as executeCloseTemplate)
      if (fabricCanvas) {
        fabricCanvas.clear();
        fabricCanvas.backgroundColor = '#ffffff';
      }

      const { setDimensions } = useCanvasStore.getState();
      createTemplate('Untitled Template', 800, 600);
      setDimensions(800, 600);

      setSaveMetadata(
        selectedProject?.name ?? 'Default Project',
        'Untitled Template'
      );

      console.log(`Template ${templateId} deleted successfully`);
    } catch (error) {
      console.error('Failed to delete template:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirmModal(false);
    }
  };

  const handleExportPNG = async () => {
    if (!fabricCanvas) return;

    // Auto-generate QR codes before export (if QR elements exist)
    const qrElements = elements.filter(el => el.type === 'qr');
    if (qrElements.length > 0) {
      console.log('[Export PNG] Auto-generating vCard for QR codes...');

      // Import dynamically to avoid circular dependency issues
      const { generateVCardFromElements } = await import('../../services/vcardGenerator');
      const vCardData = generateVCardFromElements(elements);

      console.log('[Export PNG] Generated vCard:', vCardData.substring(0, 100) + '...');

      // Update all QR elements with the vCard data
      qrElements.forEach(qrEl => {
        updateElement(qrEl.id, {
          data: vCardData,
          qrType: 'vcard'
        });
      });

      console.log(`[Export PNG] Updated ${qrElements.length} QR code(s) with vCard data`);

      // Wait for canvas to re-render with updated QR codes
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const scaleFactor = exportWidth / canvasWidth;
    console.log(`Exporting PNG: canvas ${canvasWidth}x${canvasHeight}, export width ${exportWidth}, multiplier ${scaleFactor}`);

    // Save current viewport transform (zoom and pan)
    const originalViewport = (fabricCanvas.viewportTransform ? [...fabricCanvas.viewportTransform] : [1, 0, 0, 1, 0, 0]) as [number, number, number, number, number, number];
    const originalZoom = fabricCanvas.getZoom();

    // Reset viewport to capture entire canvas at 1:1 scale
    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    fabricCanvas.setZoom(1);

    // Temporarily remove grid lines and objects marked for exclusion
    const gridObjects = fabricCanvas.getObjects().filter((obj: any) => obj.isGrid || obj.excludeFromExport);
    console.log('[EXPORT PNG] Total objects before removal:', fabricCanvas.getObjects().length);
    console.log('[EXPORT PNG] Objects to exclude:', gridObjects.length);
    gridObjects.forEach(obj => {
      console.log('[EXPORT PNG] Excluding:', (obj as any).elementId, 'excludeFromExport:', (obj as any).excludeFromExport, 'isGrid:', (obj as any).isGrid, 'type:', obj.type);
      fabricCanvas.remove(obj);
    });
    console.log('[EXPORT PNG] Objects after removal:', fabricCanvas.getObjects().length);

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

            // Render at SVG width × 5 for high quality
            const renderWidth = Math.round(svgNaturalWidth * 5);
            const renderHeight = Math.round(svgNaturalHeight * 5);

            // Calculate what scale to apply to match current display dimensions
            // IMPORTANT: Use separate scaleX/scaleY to preserve distortion/stretching
            const currentDisplayWidth = (obj.width || 100) * (obj.scaleX || 1);
            const currentDisplayHeight = (obj.height || 100) * (obj.scaleY || 1);
            const scaleToFitX = currentDisplayWidth / renderWidth;
            const scaleToFitY = currentDisplayHeight / renderHeight;

            console.log(`High-res image: SVG ${svgNaturalWidth}x${svgNaturalHeight}, render ${renderWidth}x${renderHeight}, scale ${scaleToFitX}x${scaleToFitY}`);

            // Create high-res canvas
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = renderWidth;
            tempCanvas.height = renderHeight;
            const ctx = tempCanvas.getContext('2d');

            if (ctx) {
              try {
                ctx.drawImage(tempImg, 0, 0, renderWidth, renderHeight);

                // Test if canvas is tainted by trying to read it
                tempCanvas.toDataURL();

                // Create high-res fabric image with SEPARATE scaleX/scaleY to preserve distortion
                const highResImg = new (fabric as any).Image(tempCanvas, {
                  left: obj.left,
                  top: obj.top,
                  angle: obj.angle,
                  opacity: obj.opacity,
                  scaleX: scaleToFitX,
                  scaleY: scaleToFitY,
                });

                imageReplacements.push({ original: obj, highRes: highResImg, index: i });
                fabricCanvas.remove(obj);
                fabricCanvas.add(highResImg);
              } catch (err) {
                console.warn('[EXPORT PNG] Cannot create high-res version (CORS), using original:', err);
                // Don't replace this image - just use the original fabric object
              }
            }
            resolve();
          };

          tempImg.onerror = () => resolve();
          tempImg.src = originalImageUrl;
        });
      }
    }

    fabricCanvas.renderAll();

    let dataURL: string;
    try {
      dataURL = fabricCanvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: scaleFactor,
        enableRetinaScaling: false,
      });
    } catch (error) {
      console.error('[EXPORT PNG] Canvas is tainted:', error);

      // Log all objects to see which one might be causing the taint
      console.log('[EXPORT PNG] Current objects on canvas:');
      fabricCanvas.getObjects().forEach((obj: any) => {
        console.log('  -', obj.type, 'elementId:', obj.elementId, '_originalImageUrl:', obj._originalImageUrl?.substring(0, 50));
      });

      alert('Cannot export: Canvas contains cross-origin images. This is a bug - data URL images should not cause CORS issues. Check console for details.');

      // Restore everything before returning
      imageReplacements.forEach(({ original, highRes }) => {
        fabricCanvas.remove(highRes);
        fabricCanvas.add(original);
      });
      gridObjects.forEach(obj => fabricCanvas.add(obj));
      gridObjects.forEach(obj => fabricCanvas.sendObjectToBack(obj));
      fabricCanvas.setViewportTransform(originalViewport);
      fabricCanvas.setZoom(originalZoom);
      fabricCanvas.renderAll();
      return;
    }

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

    // Auto-generate QR codes before export (if QR elements exist)
    const qrElements = elements.filter(el => el.type === 'qr');
    if (qrElements.length > 0) {
      console.log('[Export JPG] Auto-generating vCard for QR codes...');

      // Import dynamically to avoid circular dependency issues
      const { generateVCardFromElements } = await import('../../services/vcardGenerator');
      const vCardData = generateVCardFromElements(elements);

      console.log('[Export JPG] Generated vCard:', vCardData.substring(0, 100) + '...');

      // Update all QR elements with the vCard data
      qrElements.forEach(qrEl => {
        updateElement(qrEl.id, {
          data: vCardData,
          qrType: 'vcard'
        });
      });

      console.log(`[Export JPG] Updated ${qrElements.length} QR code(s) with vCard data`);

      // Wait for canvas to re-render with updated QR codes
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const scaleFactor = exportWidth / canvasWidth;
    console.log(`Exporting JPG: canvas ${canvasWidth}x${canvasHeight}, export width ${exportWidth}, multiplier ${scaleFactor}`);

    // Save current viewport transform (zoom and pan)
    const originalViewport = (fabricCanvas.viewportTransform ? [...fabricCanvas.viewportTransform] : [1, 0, 0, 1, 0, 0]) as [number, number, number, number, number, number];
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

            // Render at SVG width × 5 for high quality
            const renderWidth = Math.round(svgNaturalWidth * 5);
            const renderHeight = Math.round(svgNaturalHeight * 5);

            // Calculate what scale to apply to match current display dimensions
            // IMPORTANT: Use separate scaleX/scaleY to preserve distortion/stretching
            const currentDisplayWidth = (obj.width || 100) * (obj.scaleX || 1);
            const currentDisplayHeight = (obj.height || 100) * (obj.scaleY || 1);
            const scaleToFitX = currentDisplayWidth / renderWidth;
            const scaleToFitY = currentDisplayHeight / renderHeight;

            console.log(`High-res image: SVG ${svgNaturalWidth}x${svgNaturalHeight}, render ${renderWidth}x${renderHeight}, scale ${scaleToFitX}x${scaleToFitY}`);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = renderWidth;
            tempCanvas.height = renderHeight;
            const ctx = tempCanvas.getContext('2d');

            if (ctx) {
              try {
                ctx.drawImage(tempImg, 0, 0, renderWidth, renderHeight);

                // Test if canvas is tainted by trying to read it
                tempCanvas.toDataURL();

                // Create high-res fabric image with SEPARATE scaleX/scaleY to preserve distortion
                const highResImg = new (fabric as any).Image(tempCanvas, {
                  left: obj.left,
                  top: obj.top,
                  angle: obj.angle,
                  opacity: obj.opacity,
                  scaleX: scaleToFitX,
                  scaleY: scaleToFitY,
                });

                imageReplacements.push({ original: obj, highRes: highResImg, index: i });
                fabricCanvas.remove(obj);
                fabricCanvas.add(highResImg);
              } catch (err) {
                console.warn('[EXPORT JPG] Cannot create high-res version (CORS), using original:', err);
                // Don't replace this image - just use the original fabric object
              }
            }
            resolve();
          };

          tempImg.onerror = () => resolve();
          tempImg.src = originalImageUrl;
        });
      }
    }

    fabricCanvas.renderAll();

    let dataURL: string;
    try {
      dataURL = fabricCanvas.toDataURL({
        format: 'jpeg',
        quality: 0.95,
        multiplier: scaleFactor,
        enableRetinaScaling: false,
      });
    } catch (error) {
      console.error('[EXPORT JPG] Canvas is tainted, trying without CORS-sensitive images:', error);
      alert('Cannot export: Canvas contains cross-origin images. Please re-import your images or save and reload the template to rasterize them.');

      // Restore everything before returning
      imageReplacements.forEach(({ original, highRes }) => {
        fabricCanvas.remove(highRes);
        fabricCanvas.add(original);
      });
      gridObjects.forEach(obj => fabricCanvas.add(obj));
      gridObjects.forEach(obj => fabricCanvas.sendObjectToBack(obj));
      fabricCanvas.setViewportTransform(originalViewport);
      fabricCanvas.setZoom(originalZoom);
      fabricCanvas.renderAll();
      return;
    }

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
    const originalViewport = (fabricCanvas.viewportTransform ? [...fabricCanvas.viewportTransform] : [1, 0, 0, 1, 0, 0]) as [number, number, number, number, number, number];
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

  const handleExportJSON = async () => {
    if (!currentTemplate) return;

    try {
      console.log('[Export] Starting complete package export...');

      const displayName =
        (currentTemplateName && currentTemplateName.trim() !== '' ? currentTemplateName : null) ||
        (currentTemplate.name && currentTemplate.name.trim() !== '' ? currentTemplate.name : null) ||
        'template';

      let toPackage = templateSnapshotForPersistence(
        currentTemplate,
        canvasWidth,
        canvasHeight,
        exportWidth,
        canvasSizeUnit,
        displayName
      );
      toPackage = mergeLiveCanvasGeometryIntoTemplate(toPackage, fabricCanvas);

      // Export as complete ZIP package with all resources
      const zipBlob = await templatePackageService.exportPackage(toPackage);

      // Download ZIP file
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      const safeFileStem = displayName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'template';
      link.download = `${safeFileStem}.zip`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      console.log('[Export] Package downloaded successfully');
    } catch (error) {
      console.error('[Export] Failed to export package:', error);
      alert(`Failed to export template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  /**
   * Import template from JSON or ZIP file
   * Handles both legacy JSON format and new ZIP package format
   */
  const handleImportJSON = async (file: File) => {
    try {
      console.log('[Import] Starting template import from file:', file.name);

      let newTemplate: Template;

      // Check file type
      if (file.name.endsWith('.zip')) {
        // New ZIP package format - includes all resources
        console.log('[Import] Detected ZIP package format');
        newTemplate = await templatePackageService.importPackage(file);
      } else {
        // Legacy JSON format - JSON only, no resources
        console.log('[Import] Detected legacy JSON format');
        const text = await file.text();
        const importedData = JSON.parse(text);

        console.log('[Import] Parsed JSON data:', importedData);

        // Validate required fields
        if (!importedData.name || !importedData.width || !importedData.height || !Array.isArray(importedData.elements)) {
          throw new Error('Invalid template file: missing required fields (name, width, height, or elements)');
        }

        // Convert date strings back to Date objects if they exist
        const createdAt = importedData.createdAt ? new Date(importedData.createdAt) : new Date();
        const updatedAt = new Date(); // Always set to current time on import

        // Generate new ID and timestamps for the imported template
        newTemplate = {
          ...importedData,
          id: crypto.randomUUID(),
          createdAt,
          updatedAt,
        };
      }

      console.log('[Import] Created new template with ID:', newTemplate.id);

      // Check that all fonts used by text elements are available on the server.
      // Fonts are stored as fontFamily strings only (not embedded in JSON),
      // so they must be loaded from the server at render time.
      if (newTemplate.elements) {
        const usedFonts = new Set<string>();
        for (const el of newTemplate.elements) {
          if (el.type === 'text' && (el as any).fontFamily) {
            usedFonts.add((el as any).fontFamily);
          }
        }
        if (usedFonts.size > 0) {
          // Pre-populate font cache before rendering
          const { fontService } = await import('../../services/fontService');
          const available = await fontService.listFonts('all');
          const availableFamilies = new Set(available.map(f => f.fontFamily));
          const missing = [...usedFonts].filter(f => !availableFamilies.has(f));
          if (missing.length > 0) {
            console.warn(`[Import] Fonts not found on server, will use fallback: ${missing.join(', ')}`);
          }
        }
      }

      // Clear current canvas
      if (fabricCanvas) {
        fabricCanvas.clear();
        fabricCanvas.backgroundColor = newTemplate.backgroundColor || '#ffffff';
        console.log('[Import] Cleared canvas and set background color:', newTemplate.backgroundColor);
      }

      // Load template into store (this will trigger canvas re-render)
      // IMPORTANT: await is required — loadTemplate preloads fonts and images
      // before rendering. Without await, fonts would load asynchronously and
      // the canvas would render with fallback fonts first, then flash when
      // fonts arrive (FOUT — Flash of Unstyled Text).
      await loadTemplate(newTemplate);

      // Update save metadata
      setSaveMetadata(selectedProject?.name ?? 'Default Project', newTemplate.name);

      // Persist immediately so the import survives across sessions without a
      // separate manual Save. Previously, import only updated the in-memory
      // Zustand store and called markAsSaved() to suppress the "unsaved
      // changes" prompt — closing the tab (or navigating away) before an
      // explicit Save silently discarded the imported design in both Demo
      // and Normal mode. Deliberately persist `newTemplate` as parsed
      // (already fully resolved: ZIP images are embedded data URLs, legacy
      // JSON keeps its original references) rather than reusing
      // handleSaveTemplate's live-canvas snapshot, which reads canvasWidth/
      // exportWidth/currentTemplate from this render's (stale) closure and
      // would not yet reflect the just-imported template.
      try {
        const metadata = await templateService.saveTemplate({
          name: newTemplate.name,
          templateData: newTemplate,
        });
        useTemplateStore.getState().updateTemplateId(metadata.id);
        markAsSaved();
        console.log('[Import] Template imported and saved successfully:', newTemplate.name);
        alert(`Template "${newTemplate.name}" imported successfully!`);
      } catch (persistError) {
        console.error('[Import] Imported template could not be auto-saved:', persistError);
        alert(
          `Template "${newTemplate.name}" was imported but could not be saved automatically ` +
            `(${persistError instanceof Error ? persistError.message : 'unknown error'}). ` +
            `It is only in this editor session — use Save before closing this tab.`
        );
      }
    } catch (error) {
      console.error('[Import] Failed to import template:', error);

      // Provide user-friendly error messages
      let errorMessage = 'Unknown error';
      if (error instanceof SyntaxError) {
        errorMessage = 'Invalid JSON format';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      alert(`Failed to import template: ${errorMessage}`);
    }
  };

  return (
    <Fragment>
      {/* Hidden File Input for Template Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.zip"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            await handleImportJSON(file);
            // Reset input to allow importing the same file again
            e.target.value = '';
          }
        }}
      />

      {/* Save Modal */}
      <SaveTemplateModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveTemplate}
        currentTemplateName={currentTemplateName || ''}
        currentProjectName={projectNameForSave}
      />

      {/* Open Modal */}
      <OpenTemplateModal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        onOpen={handleOpenTemplate}
      />

      {/* Close Confirmation Modal */}
      {showCloseConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Unsaved Changes</h3>
                <p className="text-sm text-gray-600">You have unsaved changes</p>
              </div>
            </div>

            <p className="mb-6 text-sm text-gray-700">
              Are you sure you want to close this template? All unsaved changes will be lost.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCloseConfirmModal(false)}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={executeCloseTemplate}
                className="rounded border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Close Without Saving
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Template</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>

            <p className="mb-6 text-sm text-gray-700">
              Are you sure you want to delete <strong>{currentTemplateName || 'this template'}</strong>?
              It will be permanently removed from the server and will no longer appear in the Open dialog.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                disabled={isDeleting}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteTemplate}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project / file row + scrollable view & export bar */}
      <div className="border-b border-slate-800 bg-slate-900/95 px-2 py-1.5 sm:px-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 max-w-full sm:max-w-[min(100%,24rem)]">
              <TemplateStatus compact />
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          {/* Save Button */}
          <button
            onClick={() => setShowSaveModal(true)}
            disabled={!currentTemplate || isSaving}
            className={`inline-flex min-h-[2rem] items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium transition-colors sm:px-2.5 sm:py-1.5 sm:text-sm ${
              hasUnsavedChanges
                ? 'border-amber-500 bg-amber-600 text-white hover:bg-amber-700'
                : 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600'
            } disabled:cursor-not-allowed disabled:opacity-50`}
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
                <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
                </svg>
                Save
              </>
            )}
          </button>

          {/* Open Button */}
          <button
            onClick={() => setShowOpenModal(true)}
            className="inline-flex min-h-[2rem] items-center gap-1.5 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-600 sm:px-2.5 sm:py-1.5 sm:text-sm"
            title="Open Template"
          >
            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            Open
          </button>

          {/* Import Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-[2rem] items-center gap-1.5 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-600 sm:px-2.5 sm:py-1.5 sm:text-sm"
            title="Import Template from File"
          >
            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Import
          </button>

          {/* Close Button */}
          <button
            onClick={handleCloseTemplate}
            className="inline-flex min-h-[2rem] items-center gap-1.5 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 transition-colors hover:border-red-500 hover:bg-slate-600 hover:text-red-300 sm:px-2.5 sm:py-1.5 sm:text-sm"
            title="Close Template"
          >
            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </button>

          {/* Delete Button */}
          {currentTemplate && (
            <button
              onClick={handleDeleteTemplate}
              disabled={isDeleting}
              className="inline-flex min-h-[2rem] items-center gap-1.5 rounded border border-red-800 bg-red-900/50 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:border-red-600 hover:bg-red-800 hover:text-red-200 sm:px-2.5 sm:py-1.5 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50"
              title="Delete current template permanently"
            >
              {isDeleting ? (
                <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}

          {/* Batch Export Button */}
          {currentTemplate && currentTemplateName && (
            <OffscreenExportButton
              template={currentTemplate}
              templateName={currentTemplateName}
              className="inline-flex min-h-[2rem] items-center gap-1.5 rounded border border-blue-600 bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 sm:px-2.5 sm:py-1.5 sm:text-sm"
              buttonLabel="Batch Export"
            />
          )}

          {/* Quick Save (Ctrl+S) */}
          {currentTemplateName && (
            <button
              onClick={() => handleSaveTemplate(currentTemplateName, projectNameForSave)}
              disabled={!hasUnsavedChanges || isSaving}
              className="hidden min-h-[2rem] min-w-0 text-xs text-slate-500 hover:text-slate-400 disabled:opacity-50 sm:inline"
              title="Quick Save (Ctrl+S)"
            >
              Ctrl+S
            </button>
          )}

            </div>
          </div>

          <div className="w-full min-w-0 border-t border-slate-800/90 pt-1.5 sm:border-0 sm:pt-0">
            <p className="mb-1 text-xs text-slate-500 sm:hidden">View and export</p>
            <div className="overflow-x-auto overflow-y-visible pb-0.5">
              <div
                className="inline-flex w-max min-w-0 max-w-none flex-nowrap items-center gap-1.5 sm:gap-2"
                role="group"
                aria-label="View and export"
              >
            <div className="inline-flex min-w-0 shrink-0 items-center gap-1.5">
              <span className="shrink-0 text-xs text-slate-400">Zoom</span>
              <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                <button
                  onClick={zoomOut}
                  className="min-h-8 min-w-8 rounded border border-slate-600 bg-slate-800 text-sm font-bold text-white transition-colors hover:border-slate-500 hover:bg-slate-700 sm:px-1.5"
                  type="button"
                  title="Zoom out"
                >
                  −
                </button>
                <span className="min-w-[2.5rem] text-center text-xs font-semibold text-white sm:text-sm">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  className="min-h-8 min-w-8 rounded border border-slate-600 bg-slate-800 text-sm font-bold text-white transition-colors hover:border-slate-500 hover:bg-slate-700 sm:px-1.5"
                  type="button"
                  title="Zoom in"
                >
                  +
                </button>
                <button
                  onClick={resetZoom}
                  className="min-h-8 rounded border border-slate-600 bg-slate-800 px-1.5 text-xs font-medium text-white transition-colors hover:border-slate-500 hover:bg-slate-700 sm:px-2"
                  type="button"
                  title="Reset zoom to 100%"
                >
                  1:1
                </button>
              </div>
            </div>

        <div
          className="hidden h-5 w-px self-center bg-slate-600 sm:mx-0.5 sm:block"
          aria-hidden
        >
        </div>

        {/* Undo/Redo */}
        <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
        <button
          onClick={undo}
          disabled={!canUndo()}
          type="button"
          className={`min-h-8 rounded border px-1.5 py-0.5 text-xs font-medium transition-colors sm:px-2 sm:py-1 ${
            canUndo()
              ? 'border-slate-600 bg-slate-800 text-slate-200 hover:border-slate-500 hover:bg-slate-700'
              : 'cursor-not-allowed border-slate-700 bg-slate-900 text-slate-500'
          }`}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          onClick={redo}
          disabled={!canRedo()}
          type="button"
          className={`min-h-8 rounded border px-1.5 py-0.5 text-xs font-medium transition-colors sm:px-2 sm:py-1 ${
            canRedo()
              ? 'border-slate-600 bg-slate-800 text-slate-200 hover:border-slate-500 hover:bg-slate-700'
              : 'cursor-not-allowed border-slate-700 bg-slate-900 text-slate-500'
          }`}
          title="Redo (Ctrl+Y)"
        >
          ↷
        </button>
        </div>

        <div
          className="hidden h-5 w-px self-center bg-slate-600 sm:mx-0.5 sm:block"
          aria-hidden
        >
        </div>

        <button
          type="button"
          onClick={() => setShowElementsLayerModal(true)}
          className="min-h-8 shrink-0 rounded border border-slate-500 bg-slate-800 px-2 text-xs font-medium text-slate-100 hover:border-slate-400 hover:bg-slate-700"
          title="View all elements: find hidden or off-canvas items and remove them"
        >
          Elements
        </button>

        <div
          className="hidden h-5 w-px self-center bg-slate-600 sm:mx-0.5 sm:block"
          aria-hidden
        >
        </div>

        {/* Grid + snap */}
        <div className="inline-flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="shrink-0 text-xs text-slate-500" title="Pixel grid on the canvas">
            Grid
          </span>
          <button
            onClick={toggleGrid}
            type="button"
            className={`min-h-8 min-w-[2.5rem] shrink-0 rounded border px-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:min-w-[2.75rem] sm:px-2 ${
              showGrid
                ? 'border-blue-400 bg-blue-600 text-white hover:bg-blue-500'
                : 'border-slate-600 bg-slate-800 text-slate-200 hover:border-slate-500 hover:bg-slate-700'
            }`}
            title={showGrid ? 'Hide grid' : 'Show grid'}
          >
            {showGrid ? 'On' : 'Off'}
          </button>
          <span className="shrink-0 text-slate-600" aria-hidden>
            |
          </span>
          <span className="shrink-0 text-xs text-slate-500" title="Move objects to grid">
            Snap
          </span>
          <button
            onClick={toggleSnapToGrid}
            type="button"
            className={`min-h-8 min-w-[2.5rem] shrink-0 rounded border px-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:min-w-[2.75rem] sm:px-2 ${
              snapToGrid
                ? 'border-blue-400 bg-blue-600 text-white hover:bg-blue-500'
                : 'border-slate-600 bg-slate-800 text-slate-200 hover:border-slate-500 hover:bg-slate-700'
            }`}
            title={snapToGrid ? 'Pixel snap on' : 'Pixel snap off'}
          >
            {snapToGrid ? 'On' : 'Off'}
          </button>
        </div>

        <div
          className="hidden h-5 w-px self-center bg-slate-600 sm:mx-0.5 sm:block"
          aria-hidden
        >
        </div>

        {/* Background */}
        <div className="flex min-w-0 items-center gap-1.5 sm:pl-0">
        <span className="text-xs text-slate-500 sm:text-slate-300">BG</span>
        <input
          type="color"
          value={backgroundColor}
          onChange={(e) => {
            const newColor = e.target.value;
            setBackgroundColor(newColor);
            updateBackgroundColor(newColor);
          }}
          className="h-7 w-10 cursor-pointer rounded border border-slate-600"
          title="Canvas background"
        />
        </div>

        <div
          className="hidden h-5 w-px self-center bg-slate-600 sm:mx-0.5 sm:block"
          aria-hidden
        >
        </div>

        {/* Quick export + download (keep on one line) */}
        <div className="inline-flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <span className="shrink-0 pr-0.5 text-xs text-slate-500 sm:text-slate-300">Export</span>
        <button
          onClick={handleExportPNG}
          type="button"
          className="min-h-8 shrink-0 rounded border border-slate-600 bg-slate-800 px-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-700"
          title="Export as PNG"
        >
          PNG
        </button>
        <button
          onClick={handleExportJPG}
          type="button"
          className="min-h-8 shrink-0 rounded border border-slate-600 bg-slate-800 px-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-700"
          title="Export as JPG"
        >
          JPG
        </button>
        <button
          onClick={handleExportSVG}
          type="button"
          className="min-h-8 shrink-0 rounded border border-slate-600 bg-slate-800 px-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-700"
          title="Export as SVG"
        >
          SVG
        </button>
        <button
          onClick={handleExportJSON}
          type="button"
          className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded border border-green-600 bg-green-600 px-2 text-xs font-medium text-white transition-colors hover:bg-green-700"
          title="Download template package (ZIP)"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="sm:hidden">ZIP</span>
          <span className="hidden sm:inline">Download</span>
        </button>
        </div>
        </div>
        </div>
        </div>
        </div>
      </div>

      <ElementsLayerManagerModal
        open={showElementsLayerModal}
        onClose={() => setShowElementsLayerModal(false)}
      />
    </Fragment>
  );
}
