import { create } from 'zustand';
import type { Template, TemplateElement } from '../types';
import type { LengthUnit } from '../utils/lengthUnits';
import { useCanvasStore } from './canvasStore';
import { preloadTemplateFonts } from '../services/exportService';

interface TemplateState {
  // Current template
  currentTemplate: Template | null;

  // Current template metadata (for saved templates)
  currentProjectName: string | null;
  currentTemplateName: string | null;
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;

  // Elements (derived from currentTemplate but kept for convenience)
  elements: TemplateElement[];

  // Canvas settings
  canvasWidth: number;
  canvasHeight: number;
  exportWidth: number; // target export width in px
  /** Display unit for canvas W/H and export base width in the UI */
  canvasSizeUnit: LengthUnit;

  // History for undo/redo
  history: TemplateElement[][];
  historyIndex: number;
  maxHistory: number;
  lastUndoRedoTimestamp: number; // Timestamp of last undo/redo operation

  // Actions
  createTemplate: (name: string, width: number, height: number) => void;
  loadTemplate: (template: Template) => Promise<void>;
  updateTemplateName: (name: string) => void;
  updateBackgroundColor: (backgroundColor: string) => void;
  setCanvasDimensions: (width: number, height: number) => void;
  setExportWidth: (width: number) => void;
  setCanvasSizeUnit: (unit: LengthUnit) => void;
  updateTemplateId: (id: string) => void;
  setSaveMetadata: (projectName: string, templateName: string) => void;
  markAsSaved: () => void;
  markAsChanged: () => void;

  addElement: (element: TemplateElement) => void;
  updateElement: (id: string, updates: Partial<TemplateElement>) => void;
  removeElement: (id: string) => void;
  removeElements: (ids: string[]) => void;
  duplicateElement: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  clearElements: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const pushHistory = (state: TemplateState, newElements: TemplateElement[]) => {
  // Trim history to current index
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  // Add new state
  newHistory.push(JSON.parse(JSON.stringify(newElements)));
  // Limit history size
  if (newHistory.length > state.maxHistory) {
    newHistory.shift();
    return { history: newHistory, historyIndex: newHistory.length - 1 };
  }
  return { history: newHistory, historyIndex: newHistory.length - 1 };
};

export const useTemplateStore = create<TemplateState>((set, get) => ({
  currentTemplate: null,
  currentProjectName: null,
  currentTemplateName: null,
  lastSavedAt: null,
  hasUnsavedChanges: false,
  elements: [],
  canvasWidth: 800,
  canvasHeight: 600,
  exportWidth: 1920, // Default export width
  canvasSizeUnit: 'px',
  history: [[]],
  historyIndex: 0,
  maxHistory: 50,
  lastUndoRedoTimestamp: 0,

  createTemplate: (name, width, height) => {
    const template: Template = {
      id: crypto.randomUUID(),
      name,
      width,
      height,
      exportWidth: 1920,
      canvasSizeUnit: 'px',
      backgroundColor: '#ffffff', // Default white background
      elements: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set({
      currentTemplate: template,
      currentTemplateName: name, // so toolbar shows the same label as the document name before first save
      elements: [],
      canvasWidth: width,
      canvasHeight: height,
      exportWidth: 1920,
      canvasSizeUnit: 'px',
      history: [[]],
      historyIndex: 0,
    });
  },

  loadTemplate: async (template) => {
    // Preload fonts before Fabric renders text (see preloadTemplateFonts).
    await preloadTemplateFonts(template.elements);

    // Force DesignCanvas to drop Fabric↔store maps and re-add every element from JSON.
    // Same element IDs across open/save would otherwise skip `addElementToCanvas` and keep stale geometry.
    useCanvasStore.getState().bumpTemplateFabricBindingEpoch();

    set({
      currentTemplate: template,
      currentTemplateName: template.name,
      elements: template.elements,
      canvasWidth: template.width,
      canvasHeight: template.height,
      exportWidth: template.exportWidth ?? 1920,
      canvasSizeUnit: template.canvasSizeUnit ?? template.exportBaseWidthUnit ?? 'px',
      history: [JSON.parse(JSON.stringify(template.elements))],
      historyIndex: 0,
    });
  },

  setCanvasDimensions: (width, height) => set((state) => {
    if (!state.currentTemplate) return state;
    return {
      canvasWidth: width,
      canvasHeight: height,
      currentTemplate: {
        ...state.currentTemplate,
        width,
        height,
        updatedAt: new Date(),
      },
      hasUnsavedChanges: true,
    };
  }),

  setExportWidth: (exportWidth) => set((state) => {
    if (!state.currentTemplate) {
      return { exportWidth };
    }
    return {
      exportWidth,
      hasUnsavedChanges: true,
      currentTemplate: {
        ...state.currentTemplate,
        exportWidth,
        updatedAt: new Date(),
      },
    };
  }),

  setCanvasSizeUnit: (unit) => set((state) => {
    if (!state.currentTemplate) {
      return { canvasSizeUnit: unit };
    }
    return {
      canvasSizeUnit: unit,
      hasUnsavedChanges: true,
      currentTemplate: {
        ...state.currentTemplate,
        canvasSizeUnit: unit,
        exportBaseWidthUnit: unit,
        updatedAt: new Date(),
      },
    };
  }),

  updateTemplateName: (name) => set((state) => {
    if (!state.currentTemplate) return state;
    return {
      currentTemplate: {
        ...state.currentTemplate,
        name,
        updatedAt: new Date(),
      },
      currentTemplateName: name,
      hasUnsavedChanges: true
    };
  }),

  updateBackgroundColor: (backgroundColor) => set((state) => {
    if (!state.currentTemplate) return state;
    return {
      currentTemplate: {
        ...state.currentTemplate,
        backgroundColor,
        updatedAt: new Date(),
      },
      hasUnsavedChanges: true
    };
  }),

  updateTemplateId: (id) => set((state) => {
    if (!state.currentTemplate) return state;
    return {
      currentTemplate: { ...state.currentTemplate, id },
    };
  }),

  setSaveMetadata: (projectName, templateName) => set({
    currentProjectName: projectName,
    currentTemplateName: templateName,
  }),

  markAsSaved: () => set({
    lastSavedAt: new Date(),
    hasUnsavedChanges: false,
  }),

  markAsChanged: () => set({
    hasUnsavedChanges: true,
  }),

  addElement: (element) => set((state) => {
    const newElements = [...state.elements, element];
    const historyUpdate = pushHistory(state, newElements);
    return {
      elements: newElements,
      ...historyUpdate,
      currentTemplate: state.currentTemplate ? {
        ...state.currentTemplate,
        elements: newElements,
        updatedAt: new Date(),
      } : null,
      hasUnsavedChanges: true
    };
  }),

  updateElement: (id, updates) => set((state) => {
    const newElements = state.elements.map(el =>
      el.id === id ? { ...el, ...updates } as TemplateElement : el
    );
    const historyUpdate = pushHistory(state, newElements);
    return {
      elements: newElements,
      ...historyUpdate,
      currentTemplate: state.currentTemplate ? {
        ...state.currentTemplate,
        elements: newElements,
        updatedAt: new Date(),
      } : null,
      hasUnsavedChanges: true
    };
  }),

  removeElement: (id) => set((state) => {
    const newElements = state.elements.filter(el => el.id !== id);
    const historyUpdate = pushHistory(state, newElements);
    return {
      elements: newElements,
      ...historyUpdate,
      currentTemplate: state.currentTemplate ? {
        ...state.currentTemplate,
        elements: newElements,
        updatedAt: new Date(),
      } : null,
      hasUnsavedChanges: true
    };
  }),

  removeElements: (ids) => set((state) => {
    if (!ids.length) return state;
    const idSet = new Set(ids);
    const newElements = state.elements.filter(el => !idSet.has(el.id));
    const historyUpdate = pushHistory(state, newElements);
    return {
      elements: newElements,
      ...historyUpdate,
      currentTemplate: state.currentTemplate ? {
        ...state.currentTemplate,
        elements: newElements,
        updatedAt: new Date(),
      } : null,
      hasUnsavedChanges: true
    };
  }),

  duplicateElement: (id) => set((state) => {
    const element = state.elements.find(el => el.id === id);
    if (!element) return state;

    // Create a duplicate with new ID and offset position
    const duplicate = {
      ...element,
      id: crypto.randomUUID(),
      x: element.x + 20,
      y: element.y + 20,
    };

    const newElements = [...state.elements, duplicate];
    return {
      elements: newElements,
      currentTemplate: state.currentTemplate ? {
        ...state.currentTemplate,
        elements: newElements,
        updatedAt: new Date(),
      } : null
    };
  }),

  bringToFront: (id) => set((state) => {
    const element = state.elements.find(el => el.id === id);
    if (!element) return state;

    const newElements = [...state.elements.filter(el => el.id !== id), element];
    return {
      elements: newElements,
      currentTemplate: state.currentTemplate ? {
        ...state.currentTemplate,
        elements: newElements,
        updatedAt: new Date(),
      } : null
    };
  }),

  sendToBack: (id) => set((state) => {
    const element = state.elements.find(el => el.id === id);
    if (!element) return state;

    const newElements = [element, ...state.elements.filter(el => el.id !== id)];
    return {
      elements: newElements,
      currentTemplate: state.currentTemplate ? {
        ...state.currentTemplate,
        elements: newElements,
        updatedAt: new Date(),
      } : null
    };
  }),

  bringForward: (id) => set((state) => {
    const index = state.elements.findIndex(el => el.id === id);
    if (index === -1 || index === state.elements.length - 1) return state;

    const newElements = [...state.elements];
    [newElements[index], newElements[index + 1]] = [newElements[index + 1], newElements[index]];

    return {
      elements: newElements,
      currentTemplate: state.currentTemplate ? {
        ...state.currentTemplate,
        elements: newElements,
        updatedAt: new Date(),
      } : null
    };
  }),

  sendBackward: (id) => set((state) => {
    const index = state.elements.findIndex(el => el.id === id);
    if (index === -1 || index === 0) return state;

    const newElements = [...state.elements];
    [newElements[index], newElements[index - 1]] = [newElements[index - 1], newElements[index]];

    return {
      elements: newElements,
      currentTemplate: state.currentTemplate ? {
        ...state.currentTemplate,
        elements: newElements,
        updatedAt: new Date(),
      } : null
    };
  }),

  clearElements: () => set((state) => ({
    elements: [],
    currentTemplate: state.currentTemplate ? {
      ...state.currentTemplate,
      elements: [],
      updatedAt: new Date(),
    } : null
  })),

  undo: () => set((state) => {
    if (state.historyIndex <= 0) return state;

    const newIndex = state.historyIndex - 1;
    const elements = JSON.parse(JSON.stringify(state.history[newIndex]));

    return {
      elements,
      historyIndex: newIndex,
      lastUndoRedoTimestamp: Date.now(),
      currentTemplate: state.currentTemplate ? {
        ...state.currentTemplate,
        elements,
        updatedAt: new Date(),
      } : null
    };
  }),

  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return state;

    const newIndex = state.historyIndex + 1;
    const elements = JSON.parse(JSON.stringify(state.history[newIndex]));

    return {
      elements,
      historyIndex: newIndex,
      lastUndoRedoTimestamp: Date.now(),
      currentTemplate: state.currentTemplate ? {
        ...state.currentTemplate,
        elements,
        updatedAt: new Date(),
      } : null
    };
  }),

  canUndo: () => {
    const state = get();
    return state.historyIndex > 0;
  },

  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  },
}));
