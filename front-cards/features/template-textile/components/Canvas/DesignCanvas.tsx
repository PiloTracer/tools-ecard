'use client';

import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useCanvasStore } from '../../stores/canvasStore';
import { useTemplateStore } from '../../stores/templateStore';
import type { TemplateElement, TextElement, ImageElement, QRElement, TableElement } from '../../types';

export function DesignCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [isReady, setIsReady] = useState(false);
  const addedElementIds = useRef<Set<string>>(new Set());

  const { width, height, zoom, showGrid, snapToGrid, gridSize, setSelectedElement } = useCanvasStore();
  const { elements, updateElement, removeElement } = useTemplateStore();

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
    });

    fabricCanvasRef.current = canvas;
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

    // Modification events
    canvas.on('object:modified', (e: any) => {
      const target = e.target;
      if (!target) return;

      const elementId = (target as any).elementId;
      if (!elementId) return;

      const element = elements.find(el => el.id === elementId);
      if (!element) return;

      const updates: Partial<TemplateElement> = {
        x: Math.round(target.left || element.x),
        y: Math.round(target.top || element.y),
        rotation: target.angle || element.rotation,
      };

      // Handle size updates for text (fontSize) vs others (width/height)
      if (element.type === 'text') {
        const newFontSize = Math.round(target.fontSize * (target.scaleY || 1));
        updates.fontSize = newFontSize;
      } else if (element.width !== undefined && element.height !== undefined) {
        updates.width = Math.round((target.width || element.width) * (target.scaleX || 1));
        updates.height = Math.round((target.height || element.height) * (target.scaleY || 1));
      }

      updateElement(elementId, updates);
    });

    // Keyboard delete
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          const elementId = (activeObject as any).elementId;
          if (elementId) {
            e.preventDefault();
            canvas.remove(activeObject);
            removeElement(elementId);
            addedElementIds.current.delete(elementId);
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

    // Find elements to add
    const elementsToAdd = elements.filter(el => !addedElementIds.current.has(el.id));

    // Find elements to remove
    const elementIdsToRemove: string[] = [];
    addedElementIds.current.forEach(id => {
      if (!elements.find(el => el.id === id)) {
        elementIdsToRemove.push(id);
      }
    });

    // Remove deleted elements
    if (elementIdsToRemove.length > 0) {
      const canvasObjects = canvas.getObjects();
      canvasObjects.forEach((obj: any) => {
        if (obj.elementId && elementIdsToRemove.includes(obj.elementId)) {
          canvas.remove(obj);
          addedElementIds.current.delete(obj.elementId);
        }
      });
    }

    // Add new elements
    elementsToAdd.forEach(element => {
      addElementToCanvas(canvas, element);
      addedElementIds.current.add(element.id);
    });

    if (elementsToAdd.length > 0 || elementIdsToRemove.length > 0) {
      canvas.renderAll();
    }
  }, [elements, isReady]);

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

  // Helper: Add element to canvas
  const addElementToCanvas = (canvas: fabric.Canvas, element: TemplateElement) => {
    let fabricObject: any = null;

    switch (element.type) {
      case 'text': {
        const textEl = element as TextElement;
        fabricObject = new fabric.IText(textEl.text || 'Text', {
          left: textEl.x,
          top: textEl.y,
          fontSize: textEl.fontSize,
          fontFamily: textEl.fontFamily,
          fill: textEl.color,
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
        break;
      }

      case 'image': {
        const imgEl = element as ImageElement;
        fabricObject = new fabric.Rect({
          left: imgEl.x,
          top: imgEl.y,
          width: imgEl.width,
          height: imgEl.height,
          fill: '#f0f0f0',
          stroke: '#ccc',
          strokeWidth: 1,
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
        break;
      }

      case 'qr': {
        const qrEl = element as QRElement;
        fabricObject = new fabric.Rect({
          left: qrEl.x,
          top: qrEl.y,
          width: qrEl.size,
          height: qrEl.size,
          fill: '#f0f0f0',
          stroke: '#333',
          strokeWidth: 1,
          angle: qrEl.rotation || 0,
          opacity: qrEl.opacity || 1,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockScalingX: false,
          lockScalingY: false,
          lockRotation: false,
        });
        break;
      }

      case 'table': {
        const tableEl = element as TableElement;
        const cells: any[] = [];

        for (let row = 0; row < tableEl.rows; row++) {
          for (let col = 0; col < tableEl.columns; col++) {
            const cell = new fabric.Rect({
              left: col * tableEl.cellWidth,
              top: row * tableEl.cellHeight,
              width: tableEl.cellWidth,
              height: tableEl.cellHeight,
              fill: 'transparent',
              stroke: tableEl.borderColor || '#ccc',
              strokeWidth: tableEl.borderWidth || 1,
            });
            cells.push(cell);
          }
        }

        fabricObject = new fabric.Group(cells, {
          left: tableEl.x,
          top: tableEl.y,
          angle: tableEl.rotation || 0,
          opacity: tableEl.opacity || 1,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockScalingX: false,
          lockScalingY: false,
          lockRotation: false,
        });
        break;
      }
    }

    if (fabricObject) {
      (fabricObject as any).elementId = element.id;
      canvas.add(fabricObject);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-100 p-8">
      <div className="shadow-lg">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
