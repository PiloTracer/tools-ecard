'use client';

import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import QRCode from 'qrcode';
import { useCanvasStore } from '../../stores/canvasStore';
import { useTemplateStore } from '../../stores/templateStore';
import type { TemplateElement, TextElement, ImageElement, QRElement, ShapeElement } from '../../types';
import { createMultiColorText, updateMultiColorText, shouldUseMultiColor } from '../../utils/multiColorText';

export function DesignCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const addedElementIds = useRef<Set<string>>(new Set());
  const fabricObjectsMap = useRef<Map<string, any>>(new Map()); // elementId -> fabric object
  const processingModification = useRef<Set<string>>(new Set()); // Track which elements are being processed
  const loadingImages = useRef<Set<string>>(new Set()); // Track which images are currently loading
  const lastModifiedFromCanvas = useRef<Map<string, number>>(new Map()); // elementId -> timestamp of last canvas modification

  // Panning state
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const panStartPoint = useRef<{ x: number; y: number } | null>(null);
  const viewportTransform = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const { zoom, showGrid, snapToGrid, gridSize, backgroundColor, setSelectedElement, setFabricCanvas, selectedElementId } = useCanvasStore();
  const { canvasWidth: width, canvasHeight: height, elements, updateElement, removeElement, duplicateElement, exportWidth, lastUndoRedoTimestamp } = useTemplateStore();
  const copiedElement = useRef<TemplateElement | null>(null);
  const lastKnownUndoRedoTimestamp = useRef<number>(0);

  // Handle drag over and drop for vCard fields
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    const vcardData = e.dataTransfer.getData('vcardField');
    if (vcardData) {
      try {
        const { fieldId, placeholder } = JSON.parse(vcardData);

        // Get the canvas container position
        const canvasContainer = e.currentTarget as HTMLElement;
        const rect = canvasContainer.getBoundingClientRect();

        // Calculate drop position relative to canvas
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top - 20) / zoom; // Apply -20px Y offset as per spec

        // Create text element with vCard field
        const textElement: TextElement = {
          id: crypto.randomUUID(),
          type: 'text',
          x: Math.max(0, Math.min(x, width - 100)),
          y: Math.max(0, Math.min(y, height - 50)),
          text: placeholder,
          fontSize: 16,
          fontFamily: 'Arial',
          color: '#000000',
          textAlign: 'left',
          rotation: 0,
          opacity: 1,
          locked: false,
          fieldId: fieldId,
        };

        useTemplateStore.getState().addElement(textElement);
      } catch (error) {
        console.error('Failed to handle vCard field drop:', error);
      }
    }
  };

  // 1) Initialize Fabric canvas - ONLY width/height in deps
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#ffffff',
      selection: true,
      selectionBorderColor: '#0066CC',
      selectionLineWidth: 2,
      selectionColor: 'rgba(0, 102, 204, 0.1)',
      selectionFullyContained: false,
    });

    fabricCanvasRef.current = canvas;
    setFabricCanvas(canvas);
    setIsReady(true);

    // Selection events
    canvas.on('selection:created', (e: any) => {
      const target = e.selected?.[0];
      if (target) {
        const elementId = (target as any).elementId;
        if (elementId) setSelectedElement(elementId);
      }
    });

    canvas.on('selection:updated', (e: any) => {
      const target = e.selected?.[0];
      if (target) {
        const elementId = (target as any).elementId;
        if (elementId) setSelectedElement(elementId);
      }
    });

    canvas.on('selection:cleared', () => {
      setSelectedElement(null);
    });

    // Text editing events
    canvas.on('text:changed', (e: any) => {
      const target = e.target;
      if (!target) return;

      const elementId = (target as any).elementId;
      if (!elementId) return;

      const currentElements = useTemplateStore.getState().elements;
      const element = currentElements.find(el => el.id === elementId);

      if (element && element.type === 'text') {
        // Update text content in store
        updateElement(elementId, { text: target.text });
      }
    });

    // Handle entering/exiting text editing mode
    canvas.on('text:editing:entered', (e: any) => {
      console.log('Text editing started');
    });

    canvas.on('text:editing:exited', (e: any) => {
      console.log('Text editing ended');
      const target = e.target;
      if (target) {
        canvas.renderAll();
      }
    });

    // Modification events
    canvas.on('object:modified', (e: any) => {
      const target = e.target;
      if (!target) return;

      const elementId = (target as any).elementId;
      if (!elementId) return;

      // Prevent double-processing of the same modification
      if (processingModification.current.has(elementId)) {
        console.log(`SKIP: Already processing modification for ${elementId}`);
        return;
      }

      processingModification.current.add(elementId);
      // Record the timestamp of this canvas modification
      lastModifiedFromCanvas.current.set(elementId, Date.now());
      console.log(`=== object:modified event for element ${elementId} ===`);
      console.log('Current scale:', { scaleX: target.scaleX, scaleY: target.scaleY, width: target.width, height: target.height });

      // Clear the flag after a short delay
      setTimeout(() => {
        processingModification.current.delete(elementId);
      }, 100);

      // Get fresh elements from store to avoid stale closure
      const currentElements = useTemplateStore.getState().elements;
      const element = currentElements.find(el => el.id === elementId);
      if (!element) return;

      const finalX = Math.round(target.left || element.x);
      const finalY = Math.round(target.top || element.y);

      const updates: Partial<TemplateElement> = {
        rotation: target.angle || element.rotation,
        x: finalX,
        y: finalY,
      };

      console.log(`[MODIFY] Element ${elementId} type=${element.type}, has width=${element.width !== undefined}, has height=${element.height !== undefined}`);

      // Handle size updates for text (fontSize) vs others (width/height)
      // Only update size if object was actually scaled (scaleX/scaleY changed from 1)
      if (element.type === 'text') {
        const scaleY = target.scaleY || 1;
        // Only update fontSize if text was scaled (not just moved)
        if (Math.abs(scaleY - 1) > 0.01) {
          const newFontSize = Math.round(target.fontSize * scaleY);
          (updates as Partial<TextElement>).fontSize = newFontSize;
          // Reset scale to 1 after applying to fontSize
          target.set({ scaleX: 1, scaleY: 1 });
        }
      } else if (element.type === 'qr' || (element.width !== undefined && element.height !== undefined)) {
        // For QR elements OR elements with width/height defined
        const scaleX = target.scaleX || 1;
        const scaleY = target.scaleY || 1;
        // Only update if object was scaled
        if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
          // Handle special cases for circles and ellipses
          if (element.type === 'shape') {
            const shapeEl = element as any;
            if (shapeEl.shapeType === 'circle') {
              // For circles, calculate width from radius
              // Fabric stores unscaled radius, so actual radius = radius * scale
              const currentRadius = target.radius || element.width / 2;
              const newRadius = Math.round(currentRadius * scaleX);
              updates.width = newRadius * 2;
              updates.height = newRadius * 2;
              console.log(`Circle scaled: radius ${currentRadius} -> ${newRadius}, width ${updates.width}`);
              // Update the Fabric object's radius immediately
              target.set({ radius: newRadius });
            } else if (shapeEl.shapeType === 'ellipse') {
              // For ellipses, calculate width/height from rx/ry
              const currentRx = target.rx || element.width / 2;
              const currentRy = target.ry || element.height / 2;
              const newRx = Math.round(currentRx * scaleX);
              const newRy = Math.round(currentRy * scaleY);
              updates.width = newRx * 2;
              updates.height = newRy * 2;
              console.log(`Ellipse scaled: rx ${currentRx} -> ${newRx}, ry ${currentRy} -> ${newRy}`);
              // Update the Fabric object's rx/ry immediately
              target.set({ rx: newRx, ry: newRy });
            } else {
              // Other shapes use width/height directly
              updates.width = Math.round((target.width || element.width) * scaleX);
              updates.height = Math.round((target.height || element.height) * scaleY);
            }
          } else {
            // Non-shape elements use width/height directly

            // For image elements, calculate the NEW display dimensions
            if (element.type === 'image') {
              // Only update if scale changed (user is actively resizing)
              if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
                // Simple: image stored at logical size with scale=1
                const newWidth = Math.round((target.width || element.width) * scaleX);
                const newHeight = Math.round((target.height || element.height) * scaleY);

                console.log('Image resize:', {
                  oldWidth: element.width,
                  oldHeight: element.height,
                  targetWidth: target.width,
                  targetHeight: target.height,
                  scaleX,
                  scaleY,
                  newWidth,
                  newHeight
                });

                updates.width = newWidth;
                updates.height = newHeight;

                // DON'T reset scale - it will be reset to 1 when image is recreated
              }
            } else if (element.type === 'qr') {
              // QR code elements: update size property along with width/height
              // Use size as fallback if width/height not defined (for backward compatibility)
              const qrElement = element as any;
              const currentWidth = element.width || qrElement.size;
              const currentHeight = element.height || qrElement.size;

              const newWidth = Math.round((target.width || currentWidth) * scaleX);
              const newHeight = Math.round((target.height || currentHeight) * scaleY);

              console.log('QR resize:', {
                oldSize: qrElement.size,
                oldWidth: element.width,
                oldHeight: element.height,
                currentWidth,
                currentHeight,
                targetWidth: target.width,
                targetHeight: target.height,
                scaleX,
                scaleY,
                newWidth,
                newHeight
              });

              updates.width = newWidth;
              updates.height = newHeight;
              (updates as any).size = newWidth; // QR codes are square, use width as size
              // Reset scale to 1 after applying to width/height
              target.set({ scaleX: 1, scaleY: 1 });
            } else {
              // Non-image, non-QR elements: apply scale to dimensions and reset scale
              const elementAny = element as any;
              const newWidth = Math.round((target.width || elementAny.width) * scaleX);
              const newHeight = Math.round((target.height || elementAny.height) * scaleY);

              updates.width = newWidth;
              updates.height = newHeight;
              // Reset scale to 1 after applying to width/height
              target.set({ scaleX: 1, scaleY: 1 });
            }
          }

          // Scale is already reset above for each element type
          target.setCoords();
          canvas.renderAll();
        }
      }

      console.log(`[MODIFY] Updating element ${elementId} with:`, updates);
      updateElement(elementId, updates);

      // Update the fabricObj in the map to ensure it has the latest radius/rx/ry
      const fabricObj = fabricObjectsMap.current.get(elementId);
      console.log(`target === fabricObj: ${target === fabricObj}`);
      if (fabricObj && fabricObj !== target) {
        console.log(`WARNING: fabricObj !== target, updating fabricObj separately`);
        if (element.type === 'shape') {
          const shapeEl = element as any;
          if (shapeEl.shapeType === 'circle' && updates.width) {
            fabricObj.set({ radius: updates.width / 2, scaleX: 1, scaleY: 1 });
            fabricObj.setCoords();
          } else if (shapeEl.shapeType === 'ellipse' && updates.width && updates.height) {
            fabricObj.set({ rx: updates.width / 2, ry: updates.height / 2, scaleX: 1, scaleY: 1 });
            fabricObj.setCoords();
          }
        }
      }
    });

    // Keyboard delete
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Check if user is editing an input field
        const target = e.target as HTMLElement;
        const isEditingInput = target.tagName === 'INPUT' ||
                              target.tagName === 'TEXTAREA' ||
                              target.getAttribute('contenteditable') === 'true';

        if (isEditingInput) {
          return; // Don't delete canvas object, let the input handle the key
        }

        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          const elementId = (activeObject as any).elementId;
          if (elementId) {
            e.preventDefault();

            canvas.remove(activeObject);
            removeElement(elementId);
            addedElementIds.current.delete(elementId);
            fabricObjectsMap.current.delete(elementId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.dispose();
      fabricCanvasRef.current = null;
      setIsReady(false);
    };
  }, [width, height]); // ONLY width and height

  // 2) Sync elements to canvas
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isReady) return;

    // Preserve the active object to prevent deselection during property updates
    const activeObject = canvas.getActiveObject();
    const activeElementId = activeObject ? (activeObject as any).elementId : null;

    // Find elements to add
    const elementsToAdd = elements.filter(el => !addedElementIds.current.has(el.id));

    // Find elements to remove
    const elementIdsToRemove: string[] = [];
    addedElementIds.current.forEach(id => {
      if (!elements.find(el => el.id === id)) {
        elementIdsToRemove.push(id);
      }
    });

    // Find images that need to be recreated (imageUrl changed)
    const imagesToRecreate: ImageElement[] = [];
    elements.forEach(element => {
      if (element.type === 'image' && addedElementIds.current.has(element.id)) {
        const imgEl = element as ImageElement;
        const existingFabricObj = fabricObjectsMap.current.get(element.id);

        // Skip if already loading to prevent infinite loops
        if (loadingImages.current.has(element.id)) {
          console.log('Image already loading, skipping:', element.id);
          return;
        }

        if (existingFabricObj && imgEl.imageUrl) {
          // Check if this is a placeholder (Rect) but now has an imageUrl - recreate as actual image
          // OR if dimensions changed significantly (more than 5px) - recreate to fit new size
          const currentWidth = (existingFabricObj.width || 0) * (existingFabricObj.scaleX || 1);
          const currentHeight = (existingFabricObj.height || 0) * (existingFabricObj.scaleY || 1);
          const widthDiff = Math.abs(currentWidth - imgEl.width);
          const heightDiff = Math.abs(currentHeight - imgEl.height);

          if (existingFabricObj.type === 'Rect' ||
              (existingFabricObj as any)._originalImageUrl !== imgEl.imageUrl ||
              widthDiff > 5 || heightDiff > 5) {
            console.log('Image needs recreation:', imgEl.id, { widthDiff, heightDiff, urlChanged: (existingFabricObj as any)._originalImageUrl !== imgEl.imageUrl });
            imagesToRecreate.push(imgEl);
          }
        }
      }
    });

    // Sync properties for existing elements (text content, colors, etc.)
    elements.forEach(element => {
      if (addedElementIds.current.has(element.id)) {
        const fabricObj = fabricObjectsMap.current.get(element.id);
        if (fabricObj) {
          // Update text properties
          if (element.type === 'text') {
            const textEl = element as TextElement;

            // Check if this is a multi-color text group
            if ((fabricObj as any).isMultiColorText) {
              // Update the multi-color group
              updateMultiColorText(fabricObj as fabric.Group, textEl);
            } else if (shouldUseMultiColor(textEl)) {
              // Need to replace single-color text with multi-color group
              canvas.remove(fabricObj);
              fabricObjectsMap.current.delete(element.id);
              addedElementIds.current.delete(element.id);

              const newMultiColorText = createMultiColorText(textEl);
              canvas.add(newMultiColorText);
              fabricObjectsMap.current.set(element.id, newMultiColorText);
              addedElementIds.current.add(element.id);
            } else {
              // Update standard single-color text
              if (fabricObj.text !== textEl.text) fabricObj.set({ text: textEl.text });
              if (fabricObj.fontSize !== textEl.fontSize) fabricObj.set({ fontSize: textEl.fontSize });
              if (fabricObj.fontFamily !== textEl.fontFamily) fabricObj.set({ fontFamily: textEl.fontFamily });

              // Handle color (prefer colors array if present, fall back to single color)
              const textColor = textEl.colors?.[0] || textEl.color || '#000000';
              if (fabricObj.fill !== textColor) fabricObj.set({ fill: textColor });

              if (fabricObj.textAlign !== textEl.textAlign) fabricObj.set({ textAlign: textEl.textAlign });
              if (fabricObj.fontWeight !== textEl.fontWeight) fabricObj.set({ fontWeight: textEl.fontWeight || 'normal' });
              if (fabricObj.fontStyle !== textEl.fontStyle) fabricObj.set({ fontStyle: textEl.fontStyle || 'normal' });
              if (fabricObj.underline !== textEl.underline) fabricObj.set({ underline: textEl.underline || false });
              if (fabricObj.stroke !== textEl.stroke) fabricObj.set({ stroke: textEl.stroke || '' });
              if (fabricObj.strokeWidth !== textEl.strokeWidth) fabricObj.set({ strokeWidth: textEl.strokeWidth || 0 });
            }
          }

          // Update width/height for elements that have these properties (image, QR, shape)
          if (element.width !== undefined && element.height !== undefined) {
            // Handle special cases for circles and ellipses
            if (element.type === 'shape') {
              const shapeEl = element as any;

              if (shapeEl.shapeType === 'circle') {
                // For circles, update radius based on width
                const currentRadius = fabricObj.radius * (fabricObj.scaleX || 1);
                const newRadius = element.width / 2;

                if (Math.abs(currentRadius - newRadius) > 0.5) {
                  console.log(`[SYNC] Circle radius mismatch: current=${currentRadius}, new=${newRadius}, updating...`);
                  fabricObj.set({
                    radius: newRadius,
                    scaleX: 1,
                    scaleY: 1
                  });
                  fabricObj.setCoords();
                }
              } else if (shapeEl.shapeType === 'ellipse') {
                // For ellipses, update rx and ry based on width and height
                const currentRx = fabricObj.rx * (fabricObj.scaleX || 1);
                const currentRy = fabricObj.ry * (fabricObj.scaleY || 1);
                const newRx = element.width / 2;
                const newRy = element.height / 2;

                if (Math.abs(currentRx - newRx) > 0.5 || Math.abs(currentRy - newRy) > 0.5) {
                  console.log(`[SYNC] Ellipse rx/ry mismatch: currentRx=${currentRx}, newRx=${newRx}, currentRy=${currentRy}, newRy=${newRy}`);
                  fabricObj.set({
                    rx: newRx,
                    ry: newRy,
                    scaleX: 1,
                    scaleY: 1
                  });
                  fabricObj.setCoords();
                }
              } else {
                // For other shapes (rectangle, line), use width/height
                const currentWidth = fabricObj.width * (fabricObj.scaleX || 1);
                const currentHeight = fabricObj.height * (fabricObj.scaleY || 1);

                if (Math.abs(currentWidth - element.width) > 0.5 || Math.abs(currentHeight - element.height) > 0.5) {
                  fabricObj.set({
                    width: element.width,
                    height: element.height,
                    scaleX: 1,
                    scaleY: 1
                  });
                  fabricObj.setCoords();
                }
              }
            } else if (element.type !== 'qr') {
              // For non-shape, non-QR elements (images), use width/height
              // QR elements are excluded because they manage their own scaling during regeneration
              const currentWidth = fabricObj.width * (fabricObj.scaleX || 1);
              const currentHeight = fabricObj.height * (fabricObj.scaleY || 1);

              if (Math.abs(currentWidth - element.width) > 0.5 || Math.abs(currentHeight - element.height) > 0.5) {
                fabricObj.set({
                  width: element.width,
                  height: element.height,
                  scaleX: 1,
                  scaleY: 1
                });
                fabricObj.setCoords();
              }
            }
          }

          // Update shape-specific properties
          if (element.type === 'shape') {
            const shapeEl = element as any;
            if (fabricObj.fill !== shapeEl.fill) fabricObj.set({ fill: shapeEl.fill });
            if (fabricObj.stroke !== shapeEl.stroke) fabricObj.set({ stroke: shapeEl.stroke });
            if (fabricObj.strokeWidth !== shapeEl.strokeWidth) fabricObj.set({ strokeWidth: shapeEl.strokeWidth });
          }

          // Update common properties
          if (fabricObj.opacity !== element.opacity) fabricObj.set({ opacity: element.opacity || 1 });
          if (fabricObj.angle !== element.rotation) fabricObj.set({ angle: element.rotation || 0 });

          // Position sync strategy: Canvas is the source of truth EXCEPT for undo/redo
          // Check if this is an undo/redo operation (timestamp changed recently)
          const isUndoRedo = lastUndoRedoTimestamp !== lastKnownUndoRedoTimestamp.current;

          if (isUndoRedo && !processingModification.current.has(element.id)) {
            // Undo/Redo: Force sync position from store to canvas
            const positionDiffX = Math.abs((fabricObj.left || 0) - element.x);
            const positionDiffY = Math.abs((fabricObj.top || 0) - element.y);

            if (positionDiffX > 0.1 || positionDiffY > 0.1) {
              console.log(`[UNDO/REDO] Syncing position for ${element.id}: canvas=(${fabricObj.left},${fabricObj.top}) store=(${element.x},${element.y})`);
              fabricObj.set({ left: element.x, top: element.y });
              fabricObj.setCoords();
            }
          }
          // Otherwise: DO NOT sync position - canvas is source of truth during normal operations

          // Update lock state - locked objects are selectable but not movable/resizable
          const isLocked = element.locked || false;
          const currentLockState = fabricObj.lockMovementX || false;
          if (currentLockState !== isLocked) {
            fabricObj.set({
              selectable: true, // Always selectable
              evented: true, // Always can receive events
              lockMovementX: isLocked,
              lockMovementY: isLocked,
              lockRotation: isLocked,
              lockScalingX: isLocked,
              lockScalingY: isLocked,
              hasControls: !isLocked, // No resize handles when locked
              hasBorders: true, // Always show selection border
            });
          }
        }
      }
    });

    // Remove deleted elements
    if (elementIdsToRemove.length > 0) {
      elementIdsToRemove.forEach(elementId => {
        const fabricObj = fabricObjectsMap.current.get(elementId);
        if (fabricObj) {
          canvas.remove(fabricObj);
          fabricObjectsMap.current.delete(elementId);
          addedElementIds.current.delete(elementId);
        }
      });
    }

    // Regenerate QR codes when data OR size changes
    elements.forEach(element => {
      if (element.type === 'qr') {
        const qrEl = element as QRElement;
        const fabricObj = fabricObjectsMap.current.get(element.id);

        if (fabricObj) {
          const currentQRData = (fabricObj as any)._qrData;
          const currentWidth = fabricObj.width * (fabricObj.scaleX || 1);
          const currentHeight = fabricObj.height * (fabricObj.scaleY || 1);

          // Get target size from element (with fallback to size property)
          const targetWidth = qrEl.width || qrEl.size;
          const targetHeight = qrEl.height || qrEl.size;

          const dataChanged = currentQRData !== qrEl.data;
          const sizeChanged = Math.abs(currentWidth - targetWidth) > 1 || Math.abs(currentHeight - targetHeight) > 1;

          if (dataChanged || sizeChanged) {
            // QR data or size changed, regenerate
            console.log('[QR] Regenerating QR for', element.id, 'dataChanged:', dataChanged, 'sizeChanged:', sizeChanged);

            // Mark as being modified to prevent position sync during regeneration
            processingModification.current.add(element.id);

            // Save current position and rotation from the Fabric object
            const currentLeft = fabricObj.left;
            const currentTop = fabricObj.top;
            const currentAngle = fabricObj.angle;
            const currentOpacity = fabricObj.opacity;

            // Use the target size from the element for regeneration
            QRCode.toDataURL(qrEl.data || 'https://example.com', {
              width: Math.round(targetWidth),
              margin: 1,
              color: {
                dark: qrEl.colorDark || '#000000',
                light: qrEl.colorLight || '#ffffff',
              },
              errorCorrectionLevel: 'M',
            })
              .then(qrDataUrl => {
                fabric.Image.fromURL(qrDataUrl).then(qrImage => {
                  // The QR image has its intrinsic dimensions from QRCode.toDataURL
                  // We need to scale it to match targetWidth/targetHeight
                  const scaleX = targetWidth / (qrImage.width || targetWidth);
                  const scaleY = targetHeight / (qrImage.height || targetHeight);

                  console.log('[QR] QR image dimensions:', qrImage.width, 'x', qrImage.height, 'scaling to', targetWidth, 'x', targetHeight, 'scale:', scaleX, scaleY);

                  // Use position from Fabric object, scale to target size
                  qrImage.set({
                    left: currentLeft,
                    top: currentTop,
                    scaleX: scaleX,
                    scaleY: scaleY,
                    angle: currentAngle,
                    opacity: currentOpacity,
                    selectable: true,
                    evented: true,
                    hasControls: true,
                    hasBorders: true,
                  });

                  (qrImage as any).elementId = element.id;
                  (qrImage as any)._qrData = qrEl.data;

                  // Replace old QR with new one
                  canvas.remove(fabricObj);
                  canvas.add(qrImage);
                  fabricObjectsMap.current.set(element.id, qrImage);
                  canvas.renderAll();
                  console.log('[QR] Regenerated QR code at position', currentLeft, currentTop, 'size', targetWidth, 'x', targetHeight);

                  // Clear the modification flag after a short delay
                  setTimeout(() => {
                    processingModification.current.delete(element.id);
                  }, 100);
                });
              })
              .catch(error => {
                console.error('[QR] Failed to regenerate QR code:', error);
                // Clear flag even on error
                processingModification.current.delete(element.id);
              });
          }
        }
      }
    });

    // Recreate images with changed imageUrl
    if (imagesToRecreate.length > 0) {
      imagesToRecreate.forEach(imgEl => {
        const oldFabricObj = fabricObjectsMap.current.get(imgEl.id);
        if (oldFabricObj) {
          console.log('Recreating image element:', imgEl.id);

          // Mark as loading to prevent infinite loops
          loadingImages.current.add(imgEl.id);

          // Preserve current position and transformations
          const currentX = oldFabricObj.left || imgEl.x;
          const currentY = oldFabricObj.top || imgEl.y;
          const currentAngle = oldFabricObj.angle || imgEl.rotation || 0;
          const currentOpacity = oldFabricObj.opacity || imgEl.opacity || 1;

          // Update element position if it moved
          if (currentX !== imgEl.x || currentY !== imgEl.y) {
            imgEl.x = currentX;
            imgEl.y = currentY;
          }
          if (currentAngle !== imgEl.rotation) {
            imgEl.rotation = currentAngle;
          }
          if (currentOpacity !== imgEl.opacity) {
            imgEl.opacity = currentOpacity;
          }

          // Load the new image first, THEN remove the old placeholder
          console.log('Loading new image:', imgEl.imageUrl.substring(0, 100) + '...');

          // Create an img element in the DOM temporarily to load the image
          const tempImg = document.createElement('img');

          tempImg.onload = () => {
            console.log('Temp image loaded successfully:', imgEl.imageUrl.substring(0, 100));
            console.log('Image dimensions:', { naturalWidth: tempImg.naturalWidth, naturalHeight: tempImg.naturalHeight, targetWidth: imgEl.width, targetHeight: imgEl.height });

            // SIMPLE: Render at LOGICAL size for editing
            // Store original for high-res export
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imgEl.width;
            tempCanvas.height = imgEl.height;
            const ctx = tempCanvas.getContext('2d');

            if (ctx) {
              // Draw at LOGICAL size
              ctx.drawImage(tempImg, 0, 0, imgEl.width, imgEl.height);

              console.log('Image drawn at logical size');

              // Create fabric image with scale = 1
              const fabricImg = new fabric.Image(tempCanvas, {
                left: imgEl.x,
                top: imgEl.y,
                angle: imgEl.rotation || 0,
                opacity: imgEl.opacity || 1,
                selectable: true,
                evented: true,
                hasControls: true,
                hasBorders: true,
                scaleX: 1,
                scaleY: 1,
              });

              (fabricImg as any).elementId = imgEl.id;
              (fabricImg as any)._originalImageUrl = imgEl.imageUrl; // Keep original for high-res export

              console.log('Created fabric image - fills box perfectly');

              console.log('Replacing placeholder with image from canvas');
              canvas.remove(oldFabricObj);
              canvas.add(fabricImg);
              fabricObjectsMap.current.set(imgEl.id, fabricImg);

              // Force scale to 1
              fabricImg.set({ scaleX: 1, scaleY: 1 });
              fabricImg.setCoords();

              canvas.setActiveObject(fabricImg);

              loadingImages.current.delete(imgEl.id);
              console.log('Image replacement complete - scale = 1');

              // Force z-order sync after image loads
              console.log('[IMAGE-LOAD] Image recreated, need to sync z-order');
              const currentElements = useTemplateStore.getState().elements;
              if (currentElements.length > 0) {
                useTemplateStore.setState({ elements: [...currentElements] });
              }
              canvas.renderAll();
            } else {
              console.error('Failed to get 2d context');
              loadingImages.current.delete(imgEl.id);
            }
          };

          tempImg.onerror = (error) => {
            console.error('Failed to load temp image:', error);
            loadingImages.current.delete(imgEl.id);
          };

          tempImg.src = imgEl.imageUrl;
        }
      });
    }

    // Add new elements
    elementsToAdd.forEach(element => {
      addElementToCanvas(canvas, element);
      addedElementIds.current.add(element.id);
    });

    // Always render to reflect property changes
    canvas.renderAll();

    // Update the known undo/redo timestamp after processing
    lastKnownUndoRedoTimestamp.current = lastUndoRedoTimestamp;

    // Restore the selection if it was lost during property updates
    if (activeElementId && !canvas.getActiveObject()) {
      const fabricObj = fabricObjectsMap.current.get(activeElementId);
      if (fabricObj) {
        canvas.setActiveObject(fabricObj);
        canvas.renderAll();
      }
    }
  }, [elements, isReady, lastUndoRedoTimestamp]);

  // 3) Handle zoom
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isReady) return;

    canvas.setZoom(zoom);
    canvas.renderAll();
  }, [zoom, isReady]);

  // 4) Handle grid
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isReady) return;

    // Remove existing grid
    const gridObjects = canvas.getObjects().filter((obj: any) => obj.isGrid);
    gridObjects.forEach(obj => canvas.remove(obj));

    if (showGrid) {
      // Draw vertical lines
      for (let i = 0; i <= width / gridSize; i++) {
        const line = new fabric.Line([i * gridSize, 0, i * gridSize, height], {
          stroke: '#e0e0e0',
          strokeWidth: 1,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        });
        (line as any).isGrid = true;
        canvas.add(line);
      }

      // Draw horizontal lines
      for (let i = 0; i <= height / gridSize; i++) {
        const line = new fabric.Line([0, i * gridSize, width, i * gridSize], {
          stroke: '#e0e0e0',
          strokeWidth: 1,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        });
        (line as any).isGrid = true;
        canvas.add(line);
      }

      // Send grid to back
      const allGrids = canvas.getObjects().filter((obj: any) => obj.isGrid);
      allGrids.forEach(grid => canvas.sendObjectToBack(grid));
    }

    canvas.renderAll();
  }, [showGrid, gridSize, width, height, isReady]);

  // 5) Handle snap to grid
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isReady) return;

    const handleSnap = (e: any) => {
      if (!e.target) return;
      e.target.set({
        left: Math.round((e.target.left || 0) / gridSize) * gridSize,
        top: Math.round((e.target.top || 0) / gridSize) * gridSize,
      });
    };

    if (snapToGrid) {
      canvas.on('object:moving', handleSnap);
    }

    return () => {
      canvas.off('object:moving', handleSnap);
    };
  }, [snapToGrid, gridSize, isReady]);

  // 6) Handle background color
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isReady) return;

    canvas.set('backgroundColor', backgroundColor);
    canvas.renderAll();
  }, [backgroundColor, isReady]);

  // 7) Sync element z-order (layering) from store to Fabric canvas
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isReady) return;

    // Get all objects and separate grid from elements
    const allObjects = canvas.getObjects();
    const gridObjects = allObjects.filter((obj: any) => obj.isGrid);
    const elementObjects = allObjects.filter((obj: any) => !obj.isGrid);

    let needsReorder = false;

    // Build a map of element IDs to their index in elements array (z-order)
    const elementOrderMap = new Map<string, number>();
    elements.forEach((el, index) => {
      elementOrderMap.set(el.id, index);
    });

    // Sort element objects by element order
    const sortedObjects = [...elementObjects].sort((a, b) => {
      const aId = (a as any).elementId;
      const bId = (b as any).elementId;
      const aOrder = elementOrderMap.get(aId) ?? 9999;
      const bOrder = elementOrderMap.get(bId) ?? 9999;
      return aOrder - bOrder;
    });

    // Check if order changed (only check element objects, not grid)
    for (let i = 0; i < elementObjects.length; i++) {
      if (elementObjects[i] !== sortedObjects[i]) {
        needsReorder = true;
        break;
      }
    }

    if (needsReorder) {
      console.log('[LAYERING] Reordering needed!');
      console.log('[LAYERING] Elements array order:', elements.map((el, i) => `${i}: ${el.type}-${el.id.substring(0, 8)}`));
      console.log('[LAYERING] Current canvas order:', elementObjects.map((obj: any, i) => `${i}: ${obj.type}-${obj.elementId?.substring(0, 8)}`));

      // Preserve background color
      const bgColor = canvas.backgroundColor;

      // Clear canvas
      canvas.clear();

      // Restore background color
      canvas.set('backgroundColor', bgColor);

      // Re-add grid objects first (at the back)
      gridObjects.forEach(obj => canvas.add(obj));

      // Then add sorted element objects
      sortedObjects.forEach(obj => canvas.add(obj));

      canvas.renderAll();
      console.log('[LAYERING] Synced fabric object order with elements array');
      console.log('[LAYERING] New canvas order:', canvas.getObjects().filter((obj: any) => !obj.isGrid).map((obj: any, i) => `${i}: ${obj.type}-${obj.elementId?.substring(0, 8)}`));
    }
  }, [elements, isReady]);

  // 8) Apply zoom to Fabric canvas
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isReady) return;

    // Apply zoom to the entire canvas
    canvas.setZoom(zoom);
    canvas.renderAll();

    console.log(`[ZOOM] Applied zoom: ${zoom}`);
  }, [zoom, isReady]);

  // 8.5) Spacebar panning functionality
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isReady) return;

    const handleSpaceKeyDown = (e: KeyboardEvent) => {
      // Check if space is pressed and not in an input field
      if (e.code === 'Space' && !isSpacePressed) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return; // Don't activate panning when typing
        }

        e.preventDefault(); // Prevent page scroll
        setIsSpacePressed(true);

        // Disable object selection while panning
        canvas.selection = false;
        canvas.defaultCursor = 'grab';
        canvas.hoverCursor = 'grab';

        // Deselect any active object
        canvas.discardActiveObject();
        canvas.renderAll();
      }
    };

    const handleSpaceKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(false);
        setIsPanning(false);
        panStartPoint.current = null;

        // Re-enable object selection
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        canvas.hoverCursor = 'move';
        canvas.renderAll();
      }
    };

    const handleMouseDown = (e: fabric.TEvent) => {
      if (isSpacePressed && e.e instanceof MouseEvent) {
        setIsPanning(true);
        panStartPoint.current = {
          x: e.e.clientX,
          y: e.e.clientY
        };
        canvas.defaultCursor = 'grabbing';
        canvas.hoverCursor = 'grabbing';
      }
    };

    const handleMouseMove = (e: fabric.TEvent) => {
      if (isPanning && panStartPoint.current && e.e instanceof MouseEvent) {
        const deltaX = e.e.clientX - panStartPoint.current.x;
        const deltaY = e.e.clientY - panStartPoint.current.y;

        // Update viewport transform
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] = viewportTransform.current.x + deltaX;
          vpt[5] = viewportTransform.current.y + deltaY;
          canvas.requestRenderAll();
        }
      }
    };

    const handleMouseUp = (e: fabric.TEvent) => {
      if (isPanning && panStartPoint.current) {
        setIsPanning(false);

        // Save the new viewport position
        const vpt = canvas.viewportTransform;
        if (vpt) {
          viewportTransform.current = {
            x: vpt[4],
            y: vpt[5]
          };
        }

        panStartPoint.current = null;

        if (isSpacePressed) {
          canvas.defaultCursor = 'grab';
          canvas.hoverCursor = 'grab';
        }
      }
    };

    // Add keyboard event listeners
    window.addEventListener('keydown', handleSpaceKeyDown);
    window.addEventListener('keyup', handleSpaceKeyUp);

    // Add Fabric.js mouse event listeners
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleSpaceKeyDown);
      window.removeEventListener('keyup', handleSpaceKeyUp);
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [isReady, isSpacePressed, isPanning]);

  // 9) Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.getAttribute('contenteditable') === 'true') {
        return;
      }

      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const activeObject = canvas.getActiveObject();

      // Delete/Backspace key - delete selected element
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        e.preventDefault(); // Prevent default browser behavior
        removeElement(selectedElementId);
        setSelectedElement(null);
      }

      // Escape - deselect
      if (e.key === 'Escape') {
        canvas.discardActiveObject();
        canvas.renderAll();
        setSelectedElement(null);
      }

      // Ctrl/Cmd + D - duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedElementId) {
        e.preventDefault();
        duplicateElement(selectedElementId);
      }

      // Ctrl/Cmd + Z - undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const { undo, canUndo } = useTemplateStore.getState();
        if (canUndo()) {
          undo();
        }
      }

      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z - redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        const { redo, canRedo } = useTemplateStore.getState();
        if (canRedo()) {
          redo();
        }
      }

      // Ctrl/Cmd + C - copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedElementId) {
        e.preventDefault();
        const element = elements.find(el => el.id === selectedElementId);
        if (element) {
          copiedElement.current = element;
        }
      }

      // Ctrl/Cmd + V - paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && copiedElement.current) {
        e.preventDefault();
        const duplicate = {
          ...copiedElement.current,
          id: crypto.randomUUID(),
          x: copiedElement.current.x + 20,
          y: copiedElement.current.y + 20,
        };
        useTemplateStore.getState().addElement(duplicate);
      }

      // Arrow keys - nudge element
      if (activeObject && selectedElementId) {
        const nudgeAmount = e.shiftKey ? 10 : 1;
        let moved = false;

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          activeObject.set({ left: (activeObject.left || 0) - nudgeAmount });
          moved = true;
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          activeObject.set({ left: (activeObject.left || 0) + nudgeAmount });
          moved = true;
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          activeObject.set({ top: (activeObject.top || 0) - nudgeAmount });
          moved = true;
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          activeObject.set({ top: (activeObject.top || 0) + nudgeAmount });
          moved = true;
        }

        if (moved) {
          activeObject.setCoords();
          canvas.renderAll();
          // Update element position in store
          updateElement(selectedElementId, {
            x: activeObject.left || 0,
            y: activeObject.top || 0
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, elements, isReady]);

  // Helper: Add element to canvas
  const addElementToCanvas = (canvas: fabric.Canvas, element: TemplateElement) => {
    let fabricObject: any = null;

    switch (element.type) {
      case 'text': {
        const textEl = element as TextElement;

        // Check if we should use multi-color rendering
        if (shouldUseMultiColor(textEl)) {
          fabricObject = createMultiColorText(textEl);
        } else {
          // Use standard single-color text
          fabricObject = new fabric.IText(textEl.text || 'Text', {
            left: textEl.x,
            top: textEl.y,
            fontSize: textEl.fontSize,
            fontFamily: textEl.fontFamily,
            fill: textEl.color || textEl.colors?.[0] || '#000000',
            fontWeight: textEl.fontWeight || 'normal',
            fontStyle: textEl.fontStyle || 'normal',
            underline: textEl.underline || false,
            stroke: textEl.stroke || '',
            strokeWidth: textEl.strokeWidth || 0,
            textAlign: textEl.textAlign || 'left',
            angle: textEl.rotation || 0,
            opacity: textEl.opacity || 1,
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
            lockScalingX: false,
            lockScalingY: false,
            lockRotation: false,
          });
        }
        break;
      }

      case 'image': {
        const imgEl = element as ImageElement;

        if (imgEl.imageUrl) {
          // Load actual image/SVG
          console.log('Loading image from URL:', imgEl.imageUrl.substring(0, 100) + '...');

          // Mark as loading
          loadingImages.current.add(element.id);

          // Create an img element in the DOM temporarily to load the image
          const tempImg = document.createElement('img');

          tempImg.onload = () => {
            // Create a canvas at the TARGET size to render high quality
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imgEl.width;
            tempCanvas.height = imgEl.height;
            const ctx = tempCanvas.getContext('2d');

            if (ctx) {
              // Draw the image scaled to fill the entire canvas
              ctx.drawImage(tempImg, 0, 0, imgEl.width, imgEl.height);

              // Create fabric image from the canvas (already at correct size, so scale = 1)
              const fabricImg = new fabric.Image(tempCanvas, {
                left: imgEl.x,
                top: imgEl.y,
                angle: imgEl.rotation || 0,
                opacity: imgEl.opacity || 1,
                selectable: true,
                evented: true,
                hasControls: true,
                hasBorders: true,
                scaleX: 1,
                scaleY: 1,
              });

              (fabricImg as any).elementId = element.id;
              (fabricImg as any)._originalImageUrl = imgEl.imageUrl;
              canvas.add(fabricImg);
              fabricObjectsMap.current.set(element.id, fabricImg);

              loadingImages.current.delete(element.id);

              // Force z-order sync after image loads to ensure correct layering
              console.log('[IMAGE-LOAD] Image loaded, need to sync z-order');
              // Trigger the elements dependency to force re-sync
              const currentElements = useTemplateStore.getState().elements;
              if (currentElements.length > 0) {
                // Force a re-render by updating the template store (no-op but triggers effects)
                useTemplateStore.setState({ elements: [...currentElements] });
              }
              canvas.renderAll();
            } else {
              console.error('Failed to get 2d context');
              loadingImages.current.delete(element.id);
            }
          };

          tempImg.onerror = (error) => {
            console.error('Failed to load image:', imgEl.imageUrl);
            console.error('Error details:', error);
            loadingImages.current.delete(element.id);
          };

          console.log('Loading image URL:', imgEl.imageUrl.substring(0, 150));
          tempImg.src = imgEl.imageUrl;

          // Return early - loading is async
          return;
        } else {
          // Placeholder when no image URL
          fabricObject = new fabric.Rect({
            left: imgEl.x,
            top: imgEl.y,
            width: imgEl.width,
            height: imgEl.height,
            fill: '#334155',
            stroke: '#64748b',
            strokeWidth: 2,
            angle: imgEl.rotation || 0,
            opacity: imgEl.opacity || 1,
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
            lockScalingX: false,
            lockScalingY: false,
            lockRotation: false,
          });
        }
        break;
      }

      case 'qr': {
        const qrEl = element as QRElement;

        // Use width/height if available, fallback to size for backward compatibility
        const qrWidth = qrEl.width || qrEl.size;
        const qrHeight = qrEl.height || qrEl.size;

        // Create a placeholder rectangle first (will be replaced with QR code)
        fabricObject = new fabric.Rect({
          left: qrEl.x,
          top: qrEl.y,
          width: qrWidth,
          height: qrHeight,
          fill: qrEl.colorLight || '#ffffff',
          stroke: '#94a3b8',
          strokeWidth: 1,
          angle: qrEl.rotation || 0,
          opacity: qrEl.opacity || 1,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
        });

        // Generate QR code asynchronously and replace placeholder
        const qrData = qrEl.data || 'https://example.com';

        QRCode.toDataURL(qrData, {
          width: qrWidth,
          margin: 1,
          color: {
            dark: qrEl.colorDark || '#000000',
            light: qrEl.colorLight || '#ffffff',
          },
          errorCorrectionLevel: 'M',
        })
          .then(qrDataUrl => {
            // Load QR code as image
            fabric.Image.fromURL(qrDataUrl).then(qrImage => {
              // Scale the image to match the desired qrWidth/qrHeight
              const scaleX = qrWidth / (qrImage.width || qrWidth);
              const scaleY = qrHeight / (qrImage.height || qrHeight);

              console.log('[QR] Initial QR image dimensions:', qrImage.width, 'x', qrImage.height, 'scaling to', qrWidth, 'x', qrHeight, 'scale:', scaleX, scaleY);

              qrImage.set({
                left: qrEl.x,
                top: qrEl.y,
                scaleX: scaleX,
                scaleY: scaleY,
                angle: qrEl.rotation || 0,
                opacity: qrEl.opacity || 1,
                selectable: true,
                evented: true,
                hasControls: true,
                hasBorders: true,
              });

              (qrImage as any).elementId = element.id;
              (qrImage as any)._qrData = qrData;

              // Replace placeholder with actual QR code
              const placeholder = fabricObjectsMap.current.get(element.id);
              if (placeholder && canvas) {
                canvas.remove(placeholder);
                canvas.add(qrImage);
                fabricObjectsMap.current.set(element.id, qrImage);
                canvas.renderAll();
                console.log('[QR] Generated QR code for element', element.id, 'at size', qrWidth, 'x', qrHeight);
              }
            });
          })
          .catch(error => {
            console.error('[QR] Failed to generate QR code:', error);
          });

        break;
      }

      case 'shape': {
        const shapeEl = element as ShapeElement;

        switch (shapeEl.shapeType) {
          case 'rectangle':
            fabricObject = new fabric.Rect({
              left: shapeEl.x,
              top: shapeEl.y,
              width: shapeEl.width,
              height: shapeEl.height,
              fill: shapeEl.fill || '#3b82f6',
              stroke: shapeEl.stroke || '#1e40af',
              strokeWidth: shapeEl.strokeWidth || 1,
              angle: shapeEl.rotation || 0,
              opacity: shapeEl.opacity || 1,
              selectable: true,
              evented: true,
              hasControls: true,
              hasBorders: true,
            });
            break;

          case 'circle':
            fabricObject = new fabric.Circle({
              left: shapeEl.x,
              top: shapeEl.y,
              radius: shapeEl.width / 2,
              fill: shapeEl.fill || '#3b82f6',
              stroke: shapeEl.stroke || '#1e40af',
              strokeWidth: shapeEl.strokeWidth || 1,
              angle: shapeEl.rotation || 0,
              opacity: shapeEl.opacity || 1,
              selectable: true,
              evented: true,
              hasControls: true,
              hasBorders: true,
            });
            break;

          case 'ellipse':
            fabricObject = new fabric.Ellipse({
              left: shapeEl.x,
              top: shapeEl.y,
              rx: shapeEl.width / 2,
              ry: shapeEl.height / 2,
              fill: shapeEl.fill || '#3b82f6',
              stroke: shapeEl.stroke || '#1e40af',
              strokeWidth: shapeEl.strokeWidth || 1,
              angle: shapeEl.rotation || 0,
              opacity: shapeEl.opacity || 1,
              selectable: true,
              evented: true,
              hasControls: true,
              hasBorders: true,
            });
            break;

          case 'line':
            fabricObject = new fabric.Line([shapeEl.x, shapeEl.y, shapeEl.x + shapeEl.width, shapeEl.y], {
              stroke: shapeEl.stroke || '#1e40af',
              strokeWidth: shapeEl.strokeWidth || 2,
              angle: shapeEl.rotation || 0,
              opacity: shapeEl.opacity || 1,
              selectable: true,
              evented: true,
              hasControls: true,
              hasBorders: true,
            });
            break;
        }
        break;
      }
    }

    if (fabricObject) {
      (fabricObject as any).elementId = element.id;

      // Store in map
      fabricObjectsMap.current.set(element.id, fabricObject);

      // Add to canvas
      canvas.add(fabricObject);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-700 p-8">
      <div
        ref={containerRef}
        className="shadow-2xl rounded-sm relative"
        style={{
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
          cursor: isSpacePressed ? (isPanning ? 'grabbing' : 'grab') : 'default'
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <canvas ref={canvasRef} />
        {/* Visual indicator when space is pressed */}
        {isSpacePressed && (
          <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg pointer-events-none">
            Panning Mode (Hold Space + Drag)
          </div>
        )}
      </div>
    </div>
  );
}
