'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useTemplateStore } from '../../stores/templateStore';
import { useCanvasStore } from '../../stores/canvasStore';
import type { TemplateElement, TextElement, ImageElement, QRElement } from '../../types';

// Canvas component for template designer
export interface DesignCanvasProps {
  width: number;
  height: number;
  onElementSelect?: (element: any) => void;
  onElementUpdate?: (element: any) => void;
}

export const DesignCanvas: React.FC<DesignCanvasProps> = ({
  width,
  height,
  onElementSelect,
  onElementUpdate
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const addedElementIds = useRef<Set<string>>(new Set());

  const { elements, addElement, updateElement, selectElement } = useTemplateStore();
  const {
    setCanvasInstance,
    showGrid,
    snapToGrid,
    gridSize,
    zoom,
    snapToGridValue: snapToGridFn
  } = useCanvasStore();

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Fabric canvas
    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
      selectionBorderColor: '#0066CC',
      selectionLineWidth: 2,
      renderOnAddRemove: false,
      interactive: true,
      defaultCursor: 'default',
      hoverCursor: 'move'
    });

    // Set up event handlers
    fabricCanvas.on('selection:created', (e: any) => {
      if (onElementSelect && e.selected?.[0]) {
        const target = e.selected[0];
        const elementId = (target as any).elementId;
        if (elementId) {
          selectElement(elementId);
        }
        onElementSelect(target);
      }
    });

    fabricCanvas.on('selection:updated', (e: any) => {
      if (onElementSelect && e.selected?.[0]) {
        const target = e.selected[0];
        const elementId = (target as any).elementId;
        if (elementId) {
          selectElement(elementId);
        }
        onElementSelect(target);
      }
    });

    fabricCanvas.on('selection:cleared', () => {
      selectElement(null);
      if (onElementSelect) {
        onElementSelect(null);
      }
    });

    fabricCanvas.on('object:modified', (e) => {
      if (!e.target) return;

      const elementId = (e.target as any).elementId;
      if (!elementId) return;

      // Update element in store WITHOUT triggering re-sync
      const element = elements.find(el => el.id === elementId);
      if (element) {
        const updatedElement: any = {
          ...element,
          x: Math.round(e.target.left || element.x),
          y: Math.round(e.target.top || element.y),
          rotation: e.target.angle || element.rotation
        };

        // Text elements: calculate fontSize from current rendered size
        if (element.type === 'text') {
          const textObj = e.target as any;
          const newFontSize = Math.round(textObj.fontSize * (textObj.scaleY || 1));
          updatedElement.fontSize = newFontSize;
        } else {
          // Other elements: calculate width/height from scale
          const newWidth = e.target.width ? Math.round(e.target.width * (e.target.scaleX || 1)) : element.width;
          const newHeight = e.target.height ? Math.round(e.target.height * (e.target.scaleY || 1)) : element.height;
          updatedElement.width = newWidth;
          updatedElement.height = newHeight;
        }

        updateElement(updatedElement);
      }

      if (onElementUpdate) {
        onElementUpdate(e.target);
      }
    });

    // Handle snapping to grid (will be set up separately)
    // Grid snapping event handler is added/removed via separate effect

    setCanvasInstance(fabricCanvas);
    setIsReady(true);

    // Handle keyboard events for delete
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete or Backspace key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject && (activeObject as any).elementId) {
          e.preventDefault(); // Prevent browser back navigation on Backspace
          const elementId = (activeObject as any).elementId;

          // Remove from canvas immediately
          fabricCanvas.remove(activeObject);
          fabricCanvas.requestRenderAll();

          // Remove from store (which will keep it in sync)
          const element = elements.find(el => el.id === elementId);
          if (element) {
            // Call parent's remove element function if available
            const { removeElement } = useTemplateStore.getState();
            removeElement(elementId);
          }
        }
      }
    };

    // Add keyboard listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      setCanvasInstance(null);
      fabricCanvas.dispose();
    };
  }, [width, height]);

  // Update grid visibility
  useEffect(() => {
    const canvas = useCanvasStore.getState().canvasInstance;
    if (!canvas || !isReady) return;

    if (showGrid) {
      drawGrid(canvas, gridSize);
    } else {
      removeGrid(canvas);
    }
    // Don't clear objects, just update grid
    canvas.requestRenderAll();
  }, [showGrid, gridSize, isReady]);

  // Update zoom
  useEffect(() => {
    const canvas = useCanvasStore.getState().canvasInstance;
    if (!canvas || !isReady) return;

    canvas.setZoom(zoom);
    canvas.requestRenderAll();
  }, [zoom, isReady]);

  // Handle snap to grid
  useEffect(() => {
    const canvas = useCanvasStore.getState().canvasInstance;
    if (!canvas || !isReady) return;

    const handleSnap = (e: any) => {
      if (!e.target) return;
      e.target.set({
        left: Math.round((e.target.left || 0) / gridSize) * gridSize,
        top: Math.round((e.target.top || 0) / gridSize) * gridSize
      });
    };

    if (snapToGrid) {
      canvas.on('object:moving', handleSnap);
    }

    return () => {
      canvas.off('object:moving', handleSnap);
    };
  }, [snapToGrid, gridSize, isReady]);

  // Sync elements - ONLY add new or remove deleted, NEVER touch existing
  useEffect(() => {
    const canvas = useCanvasStore.getState().canvasInstance;
    if (!canvas || !isReady) return;

    const storeElementIds = new Set(elements.map(el => el.id));

    // Check if there are any IDs to remove
    const idsToRemove: string[] = [];
    addedElementIds.current.forEach(id => {
      if (!storeElementIds.has(id)) {
        idsToRemove.push(id);
      }
    });

    // Check if there are any new IDs to add
    const newElements = elements.filter(el => !addedElementIds.current.has(el.id));

    // Early return if nothing to do
    if (idsToRemove.length === 0 && newElements.length === 0) {
      return;
    }

    // Remove deleted elements
    if (idsToRemove.length > 0) {
      const canvasObjects = canvas.getObjects();
      canvasObjects.forEach((obj: any) => {
        if (obj.elementId && idsToRemove.includes(obj.elementId)) {
          canvas.remove(obj);
          addedElementIds.current.delete(obj.elementId);
        }
      });
    }

    // Add new elements
    newElements.forEach((element) => {
      addElementToCanvas(canvas, element);
      addedElementIds.current.add(element.id);
    });

    // Only render if we actually changed something
    if (idsToRemove.length > 0 || newElements.length > 0) {
      canvas.renderAll();
    }
  }, [elements, isReady]);

  // Helper function to draw grid
  const drawGrid = (canvas: fabric.Canvas, gridSize: number) => {
    removeGrid(canvas);

    const width = canvas.getWidth();
    const height = canvas.getHeight();

    // Draw vertical lines
    for (let i = 0; i < width / gridSize; i++) {
      const line = new fabric.Line([i * gridSize, 0, i * gridSize, height], {
        stroke: '#e0e0e0',
        strokeWidth: 1,
        selectable: false,
        evented: false
      });
      (line as any).isGrid = true;
      canvas.add(line);
    }

    // Draw horizontal lines
    for (let i = 0; i < height / gridSize; i++) {
      const line = new fabric.Line([0, i * gridSize, width, i * gridSize], {
        stroke: '#e0e0e0',
        strokeWidth: 1,
        selectable: false,
        evented: false
      });
      (line as any).isGrid = true;
      canvas.add(line);
    }

    canvas.sendToBack(...canvas.getObjects().filter((obj: any) => obj.isGrid));
  };

  // Helper function to remove grid
  const removeGrid = (canvas: fabric.Canvas) => {
    const gridObjects = canvas.getObjects().filter((obj: any) => obj.isGrid);
    gridObjects.forEach((obj) => canvas.remove(obj));
  };

  // Helper function to add element to canvas
  const addElementToCanvas = (canvas: fabric.Canvas, element: TemplateElement) => {
    let fabricObject: any = null;

    switch (element.type) {
      case 'text':
        const textElement = element as TextElement;
        // Try different text class names depending on what's available
        const TextClass = (fabric as any).IText || (fabric as any).Textbox || (fabric as any).Text;

        if (!TextClass) {
          console.error('No text class found in fabric!', Object.keys(fabric));
          break;
        }

        fabricObject = new TextClass(textElement.content || 'Text', {
          left: textElement.x || 50,
          top: textElement.y || 50,
          fontSize: textElement.fontSize || 16,
          fontFamily: textElement.fontFamily || 'Arial',
          fill: textElement.color || '#000000',
          textAlign: textElement.textAlign || 'left',
          angle: textElement.rotation || 0,
          opacity: textElement.opacity !== undefined ? textElement.opacity : 1,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockScalingX: false,
          lockScalingY: false,
          lockScalingFlip: true,
          lockRotation: false,
          lockMovementX: false,
          lockMovementY: false
        });
        break;

      case 'image':
        const imageElement = element as ImageElement;
        // For now, create a placeholder rectangle for images
        fabricObject = new fabric.Rect({
          left: imageElement.x,
          top: imageElement.y,
          width: imageElement.width || 100,
          height: imageElement.height || 100,
          fill: '#f0f0f0',
          stroke: '#ccc',
          strokeWidth: 1,
          angle: imageElement.rotation || 0,
          opacity: imageElement.opacity !== undefined ? imageElement.opacity : 1,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockScalingX: false,
          lockScalingY: false,
          lockScalingFlip: true,
          lockRotation: false,
          lockMovementX: false,
          lockMovementY: false
        });

        // Load actual image asynchronously
        if (imageElement.assetUrl && fabric.Image && fabric.Image.fromURL) {
          fabric.Image.fromURL(imageElement.assetUrl, (img: any) => {
            img.set({
              left: imageElement.x,
              top: imageElement.y,
              scaleX: (imageElement.width || 100) / (img.width || 1),
              scaleY: (imageElement.height || 100) / (img.height || 1),
              angle: imageElement.rotation || 0,
              opacity: imageElement.opacity !== undefined ? imageElement.opacity : 1,
              selectable: true,
              evented: true,
              hasControls: true,
              hasBorders: true,
              lockScalingX: false,
              lockScalingY: false,
              lockScalingFlip: true,
              lockRotation: false,
              lockMovementX: false,
              lockMovementY: false
            });
            (img as any).elementId = imageElement.id;
            canvas.remove(fabricObject!);
            canvas.add(img);
            canvas.renderAll();
          });
        }
        break;

      case 'qr':
        const qrElement = element as QRElement;
        // QR code placeholder
        fabricObject = new fabric.Rect({
          left: qrElement.x,
          top: qrElement.y,
          width: qrElement.size,
          height: qrElement.size,
          fill: '#f0f0f0',
          stroke: '#333',
          strokeWidth: 1,
          angle: qrElement.rotation || 0,
          opacity: qrElement.opacity !== undefined ? qrElement.opacity : 1,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockScalingX: false,
          lockScalingY: false,
          lockScalingFlip: true,
          lockRotation: false,
          lockMovementX: false,
          lockMovementY: false
        });
        break;

      case 'table':
        // Table placeholder - group of rectangles
        const group: any[] = [];
        const tableElement = element as any;

        for (let row = 0; row < tableElement.rows; row++) {
          for (let col = 0; col < tableElement.columns; col++) {
            const cell = new fabric.Rect({
              left: col * tableElement.cellWidth,
              top: row * tableElement.cellHeight,
              width: tableElement.cellWidth,
              height: tableElement.cellHeight,
              fill: tableElement.backgroundColor || 'transparent',
              stroke: tableElement.borderColor || '#ccc',
              strokeWidth: tableElement.borderWidth || 1
            });
            group.push(cell);
          }
        }

        fabricObject = new fabric.Group(group, {
          left: tableElement.x,
          top: tableElement.y,
          angle: tableElement.rotation || 0,
          opacity: tableElement.opacity !== undefined ? tableElement.opacity : 1,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockScalingX: false,
          lockScalingY: false,
          lockScalingFlip: true,
          lockRotation: false,
          lockMovementX: false,
          lockMovementY: false
        });
        break;
    }

    if (fabricObject) {
      // Store element ID on fabric object
      (fabricObject as any).elementId = element.id;

      // Override for locked elements
      if (element.locked) {
        fabricObject.set({
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false
        });
      }

      canvas.add(fabricObject);
      canvas.requestRenderAll();
    }
  };

  return (
    <div className="canvas-container relative inline-block border-2 border-gray-300 rounded-lg shadow-lg bg-white">
      <canvas ref={canvasRef} />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
          <div className="text-gray-500">Initializing canvas...</div>
        </div>
      )}
    </div>
  );
};