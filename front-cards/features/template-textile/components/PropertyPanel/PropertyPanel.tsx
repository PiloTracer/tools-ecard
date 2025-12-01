'use client';

import { useCanvasStore } from '../../stores/canvasStore';
import { useTemplateStore } from '../../stores/templateStore';
import { TextProperties } from './TextProperties';
import { ImageProperties } from './ImageProperties';
import { QRProperties } from './QRProperties';
import { ShapeProperties } from './ShapeProperties';
import { isTextElement, isImageElement, isQRElement, isShapeElement } from '../../types';
import { generateVCardFromElements } from '../../services/vcardGenerator';

export function PropertyPanel() {
  const { selectedElementId, fabricCanvas } = useCanvasStore();
  const { elements, removeElement, updateElement, duplicateElement, bringToFront, sendToBack, bringForward, sendBackward, canvasWidth, canvasHeight } = useTemplateStore();

  const selectedElement = elements.find(el => el.id === selectedElementId);

  const handleDelete = () => {
    if (selectedElementId) {
      removeElement(selectedElementId);
    }
  };

  const handleDuplicate = () => {
    if (selectedElementId) {
      duplicateElement(selectedElementId);
    }
  };

  const handleGenerateQRs = () => {
    // Collect all text elements that have a fieldId (vCard fields)
    const fieldElements = elements.filter(el =>
      el.type === 'text' && (el as any).fieldId
    );

    if (fieldElements.length === 0) {
      alert('No vCard fields found. Please add some fields to the canvas first.');
      return;
    }

    // Generate vCard using the service
    const vCardData = generateVCardFromElements(elements);

    console.log('[QR Generation] Generated vCard:', vCardData);

    // Update all QR elements with the vCard data
    const qrElements = elements.filter(el => el.type === 'qr');

    if (qrElements.length === 0) {
      alert('No QR code elements found on the canvas.');
      return;
    }

    qrElements.forEach(qrEl => {
      updateElement(qrEl.id, {
        data: vCardData,
        qrType: 'vcard'
      });
    });

    console.log(`[QR Generation] Updated ${qrElements.length} QR code(s) with vCard data`);
  };

  const handleReset = () => {
    if (!selectedElementId || !fabricCanvas || !selectedElement) return;

    const fabricObj = fabricCanvas.getObjects().find((obj: any) => obj.elementId === selectedElementId);
    if (!fabricObj) return;

    // Get original values or use current as fallback
    const origX = selectedElement.originalX ?? selectedElement.x;
    const origY = selectedElement.originalY ?? selectedElement.y;
    const origWidth = selectedElement.originalWidth ?? selectedElement.width;
    const origHeight = selectedElement.originalHeight ?? selectedElement.height;

    const updates: any = {
      x: origX,
      y: origY,
    };

    if (origWidth !== undefined) updates.width = origWidth;
    if (origHeight !== undefined) updates.height = origHeight;

    console.log('[Reset] Resetting to original:', {
      origX, origY, origWidth, origHeight
    });

    // Update the store
    updateElement(selectedElementId, updates);

    // Update position in Fabric immediately
    fabricObj.set({
      left: origX,
      top: origY
    });

    // For width/height, only update directly for non-QR/non-Image elements
    if (selectedElement.type !== 'qr' && selectedElement.type !== 'image') {
      if (origWidth !== undefined) {
        fabricObj.set({ width: origWidth, scaleX: 1 });
      }
      if (origHeight !== undefined) {
        fabricObj.set({ height: origHeight, scaleY: 1 });
      }
    }

    fabricObj.setCoords();
    fabricCanvas.renderAll();
  };

  const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'cover' | 'contain') => {
    if (!selectedElementId || !fabricCanvas || !selectedElement) return;

    const fabricObj = fabricCanvas.getObjects().find((obj: any) => obj.elementId === selectedElementId);
    if (!fabricObj) return;

    // Get CURRENT BOX dimensions
    const currentBoxWidth = selectedElement.width ?? 100;
    const currentBoxHeight = selectedElement.height ?? 100;

    // For alignment, use current box dimensions
    let objWidth = currentBoxWidth;
    let objHeight = currentBoxHeight;

    let newX = selectedElement.x;
    let newY = selectedElement.y;
    let newWidth = currentBoxWidth;
    let newHeight = currentBoxHeight;

    switch (type) {
      case 'left':
        newX = 0;
        break;
      case 'center':
        newX = (canvasWidth - objWidth) / 2;
        break;
      case 'right':
        newX = canvasWidth - objWidth;
        break;
      case 'top':
        newY = 0;
        break;
      case 'middle':
        newY = (canvasHeight - objHeight) / 2;
        break;
      case 'bottom':
        newY = canvasHeight - objHeight;
        break;
      case 'cover':
        // Stretch BOX to fill entire canvas
        newX = 0;
        newY = 0;
        newWidth = canvasWidth;
        newHeight = canvasHeight;
        break;
      case 'contain':
        // Fit box within canvas maintaining CURRENT box aspect ratio
        // Simply scale the box to fit, keeping its current proportions INTACT
        const currentBoxAspectRatio = currentBoxWidth / currentBoxHeight;
        const canvasAspectRatio = canvasWidth / canvasHeight;

        console.log('[Contain] Scaling box to fit canvas:', {
          elementType: selectedElement.type,
          currentBoxWidth,
          currentBoxHeight,
          currentBoxAspectRatio,
          canvasWidth,
          canvasHeight,
          canvasAspectRatio,
          willFitTo: currentBoxAspectRatio > canvasAspectRatio ? 'WIDTH' : 'HEIGHT'
        });

        if (currentBoxAspectRatio > canvasAspectRatio) {
          // Box is WIDER than canvas → fit to canvas WIDTH
          newWidth = canvasWidth;
          newHeight = canvasWidth / currentBoxAspectRatio;
        } else {
          // Box is TALLER than canvas → fit to canvas HEIGHT
          newHeight = canvasHeight;
          newWidth = canvasHeight * currentBoxAspectRatio;
        }

        // Center the box
        newX = (canvasWidth - newWidth) / 2;
        newY = (canvasHeight - newHeight) / 2;
        break;
    }

    const updates: any = { x: newX, y: newY };
    if (newWidth !== selectedElement.width) updates.width = newWidth;
    if (newHeight !== selectedElement.height) updates.height = newHeight;

    console.log(`Align ${type}:`, {
      oldX: selectedElement.x,
      oldY: selectedElement.y,
      newX,
      newY,
      objWidth,
      objHeight,
      canvasWidth,
      canvasHeight,
      updates
    });

    // Update the store
    updateElement(selectedElementId, updates);

    // IMPORTANT: Also update the Fabric.js object directly for position
    // Since we changed the position sync strategy, we need to update the canvas immediately
    fabricObj.set({
      left: newX,
      top: newY
    });

    // For images, update scale to match new dimensions
    if (selectedElement.type === 'image' && (newWidth !== undefined || newHeight !== undefined)) {
      const targetWidth = newWidth !== undefined ? newWidth : selectedElement.width;
      const targetHeight = newHeight !== undefined ? newHeight : selectedElement.height;

      const newScaleX = targetWidth / (fabricObj.width || targetWidth);
      const newScaleY = targetHeight / (fabricObj.height || targetHeight);

      console.log(`[COVER/CONTAIN] Updating image scale:`, {
        targetWidth,
        targetHeight,
        fabricWidth: fabricObj.width,
        fabricHeight: fabricObj.height,
        newScaleX,
        newScaleY
      });

      fabricObj.set({
        scaleX: newScaleX,
        scaleY: newScaleY
      });
      fabricObj.setCoords();
      fabricCanvas.renderAll();
    }

    // For width/height changes:
    // - QR codes: Don't update Fabric directly, let the QR regeneration logic handle it
    // - Other elements (text, shapes): Update Fabric directly
    if (selectedElement.type !== 'qr' && selectedElement.type !== 'image') {
      if (newWidth !== undefined && newWidth !== selectedElement.width) {
        fabricObj.set({
          width: newWidth,
          scaleX: 1
        });
      }
      if (newHeight !== undefined && newHeight !== selectedElement.height) {
        fabricObj.set({
          height: newHeight,
          scaleY: 1
        });
      }
    }
    // For QR and Image, the size change in the store will trigger regeneration/recreation

    fabricObj.setCoords();
    fabricCanvas.renderAll();
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-gray-200 bg-gradient-to-r from-white to-slate-50 p-4">
        <h2 className="text-lg font-bold text-slate-800">Properties</h2>
        <p className="text-xs text-slate-500 mt-0.5">Element settings</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!selectedElement ? (
          <div className="space-y-4">
            <div className="text-center text-sm text-gray-500 mt-8">
              Select an element to view its properties
            </div>

            {/* Show Generate QRs button if there are QR elements */}
            {elements.some(el => el.type === 'qr') && (
              <div className="mt-8">
                <button
                  onClick={handleGenerateQRs}
                  className="w-full rounded-lg border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100 px-4 py-3 text-sm font-semibold text-amber-800 hover:from-amber-100 hover:to-amber-200 hover:border-amber-400 transition-all shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Generate QRs
                  </div>
                  <div className="text-xs text-amber-700 mt-1 opacity-75">
                    Create vCard from field elements
                  </div>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Element Type Badge */}
            <div className="flex items-center justify-between">
              <div className="rounded bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 capitalize">
                {selectedElement.type}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDuplicate}
                  className="rounded bg-blue-50 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-100"
                >
                  Duplicate
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded bg-red-50 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Lock Toggle */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-semibold text-gray-700">Lock</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={selectedElement.locked || false}
                    onChange={(e) => updateElement(selectedElementId!, { locked: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`w-11 h-6 rounded-full transition ${selectedElement.locked ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform ${selectedElement.locked ? 'translate-x-5' : ''}`}></div>
                  </div>
                </div>
              </label>
              <p className="text-xs text-gray-500 mt-1">Prevent moving and resizing</p>
            </div>

            {/* No-output */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-semibold text-gray-700">No-output</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={selectedElement.excludeFromExport || false}
                    onChange={(e) => updateElement(selectedElementId!, { excludeFromExport: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`w-11 h-6 rounded-full transition ${selectedElement.excludeFromExport ? 'bg-orange-600' : 'bg-gray-300'}`}>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform ${selectedElement.excludeFromExport ? 'translate-x-5' : ''}`}></div>
                  </div>
                </div>
              </label>
              <p className="text-xs text-gray-500 mt-1">Exclude from exports</p>
            </div>

            {/* Position */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Position</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">X</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.x)}
                    onChange={(e) => {
                      const newX = parseFloat(e.target.value) || 0;
                      updateElement(selectedElementId!, { x: newX });

                      // Update Fabric.js object immediately
                      if (fabricCanvas) {
                        const fabricObj = fabricCanvas.getObjects().find((obj: any) => obj.elementId === selectedElementId);
                        if (fabricObj) {
                          fabricObj.set({ left: newX });
                          fabricObj.setCoords();
                          fabricCanvas.renderAll();
                        }
                      }
                    }}
                    disabled={selectedElement.locked}
                    className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 font-medium disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Y</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.y)}
                    onChange={(e) => {
                      const newY = parseFloat(e.target.value) || 0;
                      updateElement(selectedElementId!, { y: newY });

                      // Update Fabric.js object immediately
                      if (fabricCanvas) {
                        const fabricObj = fabricCanvas.getObjects().find((obj: any) => obj.elementId === selectedElementId);
                        if (fabricObj) {
                          fabricObj.set({ top: newY });
                          fabricObj.setCoords();
                          fabricCanvas.renderAll();
                        }
                      }
                    }}
                    disabled={selectedElement.locked}
                    className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 font-medium disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Size */}
            {(selectedElement.width !== undefined || selectedElement.height !== undefined) && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Size</h3>
                <div className="grid grid-cols-2 gap-3">
                  {selectedElement.width !== undefined && (
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Width</label>
                      <input
                        type="number"
                        value={Math.round(selectedElement.width)}
                        onChange={(e) => {
                          const newWidth = parseFloat(e.target.value) || 1;

                          // Update Fabric.js object immediately
                          if (fabricCanvas) {
                            const fabricObj = fabricCanvas.getObjects().find((obj: any) => obj.elementId === selectedElementId);
                            if (fabricObj) {
                              if (selectedElement.type === 'image') {
                                // For images, calculate new scale to match the width
                                const newScaleX = newWidth / (fabricObj.width || newWidth);
                                const newScaleY = fabricObj.scaleY || 1; // Keep Y scale
                                fabricObj.set({ scaleX: newScaleX });
                                fabricObj.setCoords();
                                fabricCanvas.renderAll();
                                // Update store with both width and scale
                                updateElement(selectedElementId!, { width: newWidth, scaleX: newScaleX });
                              } else if (selectedElement.type === 'shape') {
                                const shapeEl = selectedElement as any;
                                if (shapeEl.shapeType === 'circle') {
                                  // For circles, update radius
                                  const newRadius = newWidth / 2;
                                  fabricObj.set({ radius: newRadius, scaleX: 1, scaleY: 1 });
                                  fabricObj.setCoords();
                                  fabricCanvas.renderAll();
                                  updateElement(selectedElementId!, { width: newWidth, height: newWidth });
                                } else if (shapeEl.shapeType === 'ellipse') {
                                  // For ellipses, update rx
                                  const newRx = newWidth / 2;
                                  const currentRy = fabricObj.ry * (fabricObj.scaleY || 1);
                                  fabricObj.set({ rx: newRx, scaleX: 1, scaleY: 1 });
                                  fabricObj.setCoords();
                                  fabricCanvas.renderAll();
                                  updateElement(selectedElementId!, { width: newWidth });
                                } else {
                                  // Other shapes
                                  fabricObj.set({ width: newWidth, scaleX: 1 });
                                  fabricObj.setCoords();
                                  fabricCanvas.renderAll();
                                  updateElement(selectedElementId!, { width: newWidth });
                                }
                              } else {
                                // For other elements, set width directly
                                fabricObj.set({ width: newWidth, scaleX: 1 });
                                fabricObj.setCoords();
                                fabricCanvas.renderAll();
                                updateElement(selectedElementId!, { width: newWidth });
                              }
                            }
                          }
                        }}
                        disabled={selectedElement.locked}
                        className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 font-medium disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                      />
                    </div>
                  )}
                  {selectedElement.height !== undefined && (
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Height</label>
                      <input
                        type="number"
                        value={Math.round(selectedElement.height)}
                        onChange={(e) => {
                          const newHeight = parseFloat(e.target.value) || 1;

                          // Update Fabric.js object immediately
                          if (fabricCanvas) {
                            const fabricObj = fabricCanvas.getObjects().find((obj: any) => obj.elementId === selectedElementId);
                            if (fabricObj) {
                              if (selectedElement.type === 'image') {
                                // For images, calculate new scale to match the height
                                const newScaleX = fabricObj.scaleX || 1; // Keep X scale
                                const newScaleY = newHeight / (fabricObj.height || newHeight);
                                fabricObj.set({ scaleY: newScaleY });
                                fabricObj.setCoords();
                                fabricCanvas.renderAll();
                                // Update store with both height and scale
                                updateElement(selectedElementId!, { height: newHeight, scaleY: newScaleY });
                              } else if (selectedElement.type === 'shape') {
                                const shapeEl = selectedElement as any;
                                if (shapeEl.shapeType === 'circle') {
                                  // For circles, height affects radius
                                  const newRadius = newHeight / 2;
                                  fabricObj.set({ radius: newRadius, scaleX: 1, scaleY: 1 });
                                  fabricObj.setCoords();
                                  fabricCanvas.renderAll();
                                  updateElement(selectedElementId!, { width: newHeight, height: newHeight });
                                } else if (shapeEl.shapeType === 'ellipse') {
                                  // For ellipses, update ry
                                  const newRy = newHeight / 2;
                                  const currentRx = fabricObj.rx * (fabricObj.scaleX || 1);
                                  fabricObj.set({ ry: newRy, scaleX: 1, scaleY: 1 });
                                  fabricObj.setCoords();
                                  fabricCanvas.renderAll();
                                  updateElement(selectedElementId!, { height: newHeight });
                                } else {
                                  // Other shapes
                                  fabricObj.set({ height: newHeight, scaleY: 1 });
                                  fabricObj.setCoords();
                                  fabricCanvas.renderAll();
                                  updateElement(selectedElementId!, { height: newHeight });
                                }
                              } else {
                                // For other elements, set height directly
                                fabricObj.set({ height: newHeight, scaleY: 1 });
                                fabricObj.setCoords();
                                fabricCanvas.renderAll();
                                updateElement(selectedElementId!, { height: newHeight });
                              }
                            }
                          }
                        }}
                        disabled={selectedElement.locked}
                        className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 font-medium disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rotation */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Rotation</h3>
              <div className="relative">
                <input
                  type="number"
                  value={Math.round(selectedElement.rotation || 0)}
                  onChange={(e) => {
                    const newRotation = parseFloat(e.target.value) || 0;
                    updateElement(selectedElementId!, { rotation: newRotation });

                    // Update Fabric.js object immediately
                    if (fabricCanvas) {
                      const fabricObj = fabricCanvas.getObjects().find((obj: any) => obj.elementId === selectedElementId);
                      if (fabricObj) {
                        fabricObj.set({ angle: newRotation });
                        fabricObj.setCoords();
                        fabricCanvas.renderAll();
                      }
                    }
                  }}
                  disabled={selectedElement.locked}
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 font-medium disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">°</span>
              </div>
            </div>

            {/* Layering */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Layering</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => bringToFront(selectedElementId!)}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-gray-50 font-medium"
                >
                  To Front
                </button>
                <button
                  onClick={() => sendToBack(selectedElementId!)}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-gray-50 font-medium"
                >
                  To Back
                </button>
                <button
                  onClick={() => bringForward(selectedElementId!)}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-gray-50 font-medium"
                >
                  Forward
                </button>
                <button
                  onClick={() => sendBackward(selectedElementId!)}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-gray-50 font-medium"
                >
                  Backward
                </button>
              </div>
            </div>

            {/* Alignment */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Align</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleAlign('left')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Left
                  </button>
                  <button
                    onClick={() => handleAlign('center')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Center
                  </button>
                  <button
                    onClick={() => handleAlign('right')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Right
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleAlign('top')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Top
                  </button>
                  <button
                    onClick={() => handleAlign('middle')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Middle
                  </button>
                  <button
                    onClick={() => handleAlign('bottom')}
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-800 hover:bg-gray-50 font-medium"
                  >
                    Bottom
                  </button>
                </div>
              </div>

              {/* Coverage */}
              <div className="mt-4">
                <h4 className="mb-2 text-xs font-semibold text-gray-600 uppercase">Coverage</h4>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleAlign('cover')}
                    className="rounded border border-purple-300 bg-purple-50 px-2 py-1.5 text-xs text-purple-800 hover:bg-purple-100 font-medium"
                  >
                    Cover
                  </button>
                  <button
                    onClick={() => handleAlign('contain')}
                    className="rounded border border-purple-300 bg-purple-50 px-2 py-1.5 text-xs text-purple-800 hover:bg-purple-100 font-medium"
                  >
                    Contain
                  </button>
                  <button
                    onClick={handleReset}
                    className="rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 hover:bg-slate-100 font-medium"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Element-specific properties */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Properties</h3>
              {isTextElement(selectedElement) && <TextProperties element={selectedElement} />}
              {isImageElement(selectedElement) && <ImageProperties element={selectedElement} />}
              {isQRElement(selectedElement) && <QRProperties element={selectedElement} />}
              {isShapeElement(selectedElement) && <ShapeProperties element={selectedElement} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
