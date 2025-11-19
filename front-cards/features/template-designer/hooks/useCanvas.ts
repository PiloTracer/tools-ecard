import { useRef, useEffect, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { useCanvasStore } from '../stores/canvasStore';
import type { TemplateElement } from '../types';

export function useCanvas(width: number, height: number) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [isReady, setIsReady] = useState(false);

  const {
    setCanvasInstance,
    zoom,
    showGrid,
    snapToGrid,
    gridSize
  } = useCanvasStore();

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
      selectionBorderColor: '#0066CC',
      selectionLineWidth: 2
    });

    setCanvas(fabricCanvas);
    setCanvasInstance(fabricCanvas);
    setIsReady(true);

    return () => {
      setCanvasInstance(null);
      fabricCanvas.dispose();
      setIsReady(false);
    };
  }, [width, height, setCanvasInstance]);

  // Add element to canvas
  const addToCanvas = useCallback((element: TemplateElement) => {
    if (!canvas) return;

    // Implementation would depend on element type
    // This is a simplified version
    if (element.type === 'text') {
      const text = new fabric.IText(element.content || 'Text', {
        left: element.x,
        top: element.y,
        fontSize: element.fontSize || 16,
        fontFamily: element.fontFamily || 'Arial',
        fill: element.color || '#000000'
      });
      (text as any).elementId = element.id;
      canvas.add(text);
    }

    canvas.renderAll();
  }, [canvas]);

  // Remove element from canvas
  const removeFromCanvas = useCallback((elementId: string) => {
    if (!canvas) return;

    const objects = canvas.getObjects();
    const object = objects.find((obj: any) => obj.elementId === elementId);
    if (object) {
      canvas.remove(object);
      canvas.renderAll();
    }
  }, [canvas]);

  // Update element on canvas
  const updateOnCanvas = useCallback((element: TemplateElement) => {
    if (!canvas) return;

    removeFromCanvas(element.id);
    addToCanvas(element);
  }, [canvas, addToCanvas, removeFromCanvas]);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    canvas.renderAll();
  }, [canvas]);

  // Export canvas as image
  const exportCanvas = useCallback(async (format: 'png' | 'jpg' | 'svg' = 'png'): Promise<Blob | null> => {
    if (!canvas) return null;

    const dataURL = canvas.toDataURL({
      format: format === 'svg' ? 'svg' : format,
      quality: 1,
      multiplier: 2
    });

    // Convert data URL to Blob
    const response = await fetch(dataURL);
    return response.blob();
  }, [canvas]);

  // Get selected object
  const getSelectedObject = useCallback(() => {
    if (!canvas) return null;
    return canvas.getActiveObject();
  }, [canvas]);

  // Set selection
  const setSelection = useCallback((elementId: string | null) => {
    if (!canvas) return;

    if (elementId) {
      const objects = canvas.getObjects();
      const object = objects.find((obj: any) => obj.elementId === elementId);
      if (object) {
        canvas.setActiveObject(object);
        canvas.renderAll();
      }
    } else {
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  }, [canvas]);

  return {
    canvasRef,
    canvas,
    isReady,
    addToCanvas,
    removeFromCanvas,
    updateOnCanvas,
    clearCanvas,
    exportCanvas,
    getSelectedObject,
    setSelection
  };
}