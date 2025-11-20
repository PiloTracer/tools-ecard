import { create } from 'zustand';
import type { Template, TemplateElement } from '../types';

interface TemplateState {
  // Current template
  currentTemplate: Template | null;

  // Elements (derived from currentTemplate but kept for convenience)
  elements: TemplateElement[];

  // Actions
  createTemplate: (name: string, width: number, height: number) => void;
  loadTemplate: (template: Template) => void;
  updateTemplateName: (name: string) => void;

  addElement: (element: TemplateElement) => void;
  updateElement: (id: string, updates: Partial<TemplateElement>) => void;
  removeElement: (id: string) => void;
  clearElements: () => void;
}

export const useTemplateStore = create<TemplateState>((set) => ({
  currentTemplate: null,
  elements: [],

  createTemplate: (name, width, height) => {
    const template: Template = {
      id: crypto.randomUUID(),
      name,
      width,
      height,
      elements: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set({ currentTemplate: template, elements: [] });
  },

  loadTemplate: (template) => {
    set({ currentTemplate: template, elements: template.elements });
  },

  updateTemplateName: (name) => set((state) => {
    if (!state.currentTemplate) return state;
    return {
      currentTemplate: {
        ...state.currentTemplate,
        name,
        updatedAt: new Date(),
      }
    };
  }),

  addElement: (element) => set((state) => {
    const newElements = [...state.elements, element];
    return {
      elements: newElements,
      currentTemplate: state.currentTemplate ? {
        ...state.currentTemplate,
        elements: newElements,
        updatedAt: new Date(),
      } : null
    };
  }),

  updateElement: (id, updates) => set((state) => {
    const newElements = state.elements.map(el =>
      el.id === id ? { ...el, ...updates } : el
    );
    return {
      elements: newElements,
      currentTemplate: state.currentTemplate ? {
        ...state.currentTemplate,
        elements: newElements,
        updatedAt: new Date(),
      } : null
    };
  }),

  removeElement: (id) => set((state) => {
    const newElements = state.elements.filter(el => el.id !== id);
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
}));
