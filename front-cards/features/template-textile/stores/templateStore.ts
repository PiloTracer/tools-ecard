import { create } from 'zustand';
import type { Template, TemplateElement } from '../types';

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
  exportWidth: number; // Target width for export (canvas scales to this)

  // History for undo/redo
  history: TemplateElement[][];
  historyIndex: number;
  maxHistory: number;
  lastUndoRedoTimestamp: number; // Timestamp of last undo/redo operation

  // Actions
  createTemplate: (name: string, width: number, height: number) => void;
  loadTemplate: (template: Template) => void;
  updateTemplateName: (name: string) => void;
  updateBackgroundColor: (backgroundColor: string) => void;
  setCanvasDimensions: (width: number, height: number) => void;
  setExportWidth: (width: number) => void;
  setSaveMetadata: (projectName: string, templateName: string) => void;
  markAsSaved: () => void;
  markAsChanged: () => void;

  addElement: (element: TemplateElement) => void;
  updateElement: (id: string, updates: Partial<TemplateElement>) => void;
  removeElement: (id: string) => void;
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
      backgroundColor: '#ffffff', // Default white background
      elements: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set({
      currentTemplate: template,
      elements: [],
      canvasWidth: width,
      canvasHeight: height,
      history: [[]],
      historyIndex: 0,
    });
  },

  loadTemplate: (template) => {
    set({
      currentTemplate: template,
      elements: template.elements,
      canvasWidth: template.width,
      canvasHeight: template.height,
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
      }
    };
  }),

  setExportWidth: (exportWidth) => set({ exportWidth }),

  updateTemplateName: (name) => set((state) => {
    if (!state.currentTemplate) return state;
    return {
      currentTemplate: {
        ...state.currentTemplate,
        name,
        updatedAt: new Date(),
      },
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
