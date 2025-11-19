import { useState, useCallback } from 'react';
import type { TemplateElement } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function useElements(initialElements: TemplateElement[] = []) {
  const [elements, setElements] = useState<TemplateElement[]>(initialElements);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const addElement = useCallback((element: Omit<TemplateElement, 'id'>) => {
    const newElement = {
      ...element,
      id: uuidv4()
    } as TemplateElement;

    setElements(prev => [...prev, newElement]);
    setSelectedElementId(newElement.id);
    return newElement;
  }, []);

  const updateElement = useCallback((id: string, updates: Partial<TemplateElement>) => {
    setElements(prev =>
      prev.map(el => el.id === id ? { ...el, ...updates } : el)
    );
  }, []);

  const removeElement = useCallback((id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  }, [selectedElementId]);

  const duplicateElement = useCallback((id: string) => {
    const element = elements.find(el => el.id === id);
    if (!element) return null;

    const newElement = {
      ...element,
      id: uuidv4(),
      name: `${element.name} (Copy)`,
      x: element.x + 20,
      y: element.y + 20
    };

    setElements(prev => [...prev, newElement]);
    setSelectedElementId(newElement.id);
    return newElement;
  }, [elements]);

  const moveElement = useCallback((id: string, deltaX: number, deltaY: number) => {
    setElements(prev =>
      prev.map(el =>
        el.id === id
          ? { ...el, x: el.x + deltaX, y: el.y + deltaY }
          : el
      )
    );
  }, []);

  const resizeElement = useCallback((
    id: string,
    width?: number,
    height?: number
  ) => {
    setElements(prev =>
      prev.map(el => {
        if (el.id !== id) return el;

        const updates: Partial<TemplateElement> = {};
        if (width !== undefined) updates.width = width;
        if (height !== undefined) updates.height = height;

        return { ...el, ...updates };
      })
    );
  }, []);

  const rotateElement = useCallback((id: string, angle: number) => {
    setElements(prev =>
      prev.map(el =>
        el.id === id ? { ...el, rotation: angle } : el
      )
    );
  }, []);

  const reorderElements = useCallback((fromIndex: number, toIndex: number) => {
    setElements(prev => {
      const newElements = [...prev];
      const [removed] = newElements.splice(fromIndex, 1);
      newElements.splice(toIndex, 0, removed);

      // Update z-index based on new order
      return newElements.map((el, index) => ({
        ...el,
        zIndex: index
      }));
    });
  }, []);

  const bringToFront = useCallback((id: string) => {
    const index = elements.findIndex(el => el.id === id);
    if (index !== -1 && index < elements.length - 1) {
      reorderElements(index, elements.length - 1);
    }
  }, [elements, reorderElements]);

  const sendToBack = useCallback((id: string) => {
    const index = elements.findIndex(el => el.id === id);
    if (index > 0) {
      reorderElements(index, 0);
    }
  }, [elements, reorderElements]);

  const selectElement = useCallback((id: string | null) => {
    setSelectedElementId(id);
  }, []);

  const getSelectedElement = useCallback(() => {
    if (!selectedElementId) return null;
    return elements.find(el => el.id === selectedElementId) || null;
  }, [elements, selectedElementId]);

  const clearSelection = useCallback(() => {
    setSelectedElementId(null);
  }, []);

  const clearElements = useCallback(() => {
    setElements([]);
    setSelectedElementId(null);
  }, []);

  return {
    elements,
    selectedElementId,
    selectedElement: getSelectedElement(),
    addElement,
    updateElement,
    removeElement,
    duplicateElement,
    moveElement,
    resizeElement,
    rotateElement,
    reorderElements,
    bringToFront,
    sendToBack,
    selectElement,
    clearSelection,
    clearElements
  };
}