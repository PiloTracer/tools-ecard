import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Template, TemplateElement, TemplateConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface TemplateStore {
  // State
  template: Template | null;
  elements: TemplateElement[];
  selectedElementId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;

  // Template actions
  setTemplate: (template: Template) => void;
  updateTemplate: (updates: Partial<Template>) => void;
  createTemplate: (template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>) => void;
  clearTemplate: () => void;

  // Element actions
  addElement: (element: TemplateElement) => void;
  updateElement: (element: TemplateElement) => void;
  removeElement: (elementId: string) => void;
  selectElement: (elementId: string | null) => void;
  duplicateElement: (elementId: string) => void;
  reorderElement: (elementId: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;

  // Persistence actions
  saveTemplate: (projectId: string) => Promise<void>;
  loadTemplate: (templateId: string) => Promise<void>;

  // Utility actions
  setDirty: (isDirty: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTemplateStore = create<TemplateStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      template: null,
      elements: [],
      selectedElementId: null,
      isDirty: false,
      isSaving: false,
      isLoading: false,
      error: null,

      // Template actions
      setTemplate: (template) => set({
        template,
        isDirty: false,
        error: null
      }),

      updateTemplate: (updates) => set((state) => ({
        template: state.template ? { ...state.template, ...updates } : null,
        isDirty: true
      })),

      createTemplate: (templateData) => {
        const newTemplate: Template = {
          ...templateData,
          id: uuidv4(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        set({
          template: newTemplate,
          elements: [],
          isDirty: true
        });
      },

      clearTemplate: () => set({
        template: null,
        elements: [],
        selectedElementId: null,
        isDirty: false,
        error: null
      }),

      // Element actions
      addElement: (element) => set((state) => ({
        elements: [...state.elements, element],
        selectedElementId: element.id,
        isDirty: true
      })),

      updateElement: (element) => set((state) => ({
        elements: state.elements.map((el) =>
          el.id === element.id ? element : el
        ),
        isDirty: true
      })),

      removeElement: (elementId) => set((state) => ({
        elements: state.elements.filter((el) => el.id !== elementId),
        selectedElementId: state.selectedElementId === elementId ? null : state.selectedElementId,
        isDirty: true
      })),

      selectElement: (elementId) => set({
        selectedElementId: elementId
      }),

      duplicateElement: (elementId) => {
        const state = get();
        const element = state.elements.find((el) => el.id === elementId);
        if (element) {
          const newElement = {
            ...element,
            id: uuidv4(),
            name: `${element.name} (Copy)`,
            x: element.x + 20,
            y: element.y + 20
          };
          state.addElement(newElement);
        }
      },

      reorderElement: (elementId, direction) => {
        const state = get();
        const elements = [...state.elements];
        const index = elements.findIndex((el) => el.id === elementId);

        if (index === -1) return;

        const element = elements[index];
        elements.splice(index, 1);

        switch (direction) {
          case 'up':
            if (index > 0) {
              elements.splice(index - 1, 0, element);
            } else {
              elements.push(element);
            }
            break;
          case 'down':
            if (index < elements.length) {
              elements.splice(index + 1, 0, element);
            } else {
              elements.unshift(element);
            }
            break;
          case 'top':
            elements.unshift(element);
            break;
          case 'bottom':
            elements.push(element);
            break;
        }

        // Update z-index based on new order
        elements.forEach((el, idx) => {
          el.zIndex = idx;
        });

        set({
          elements,
          isDirty: true
        });
      },

      // Persistence actions
      saveTemplate: async (projectId) => {
        set({ isSaving: true, error: null });

        try {
          const state = get();
          const { template, elements } = state;

          if (!template) {
            throw new Error('No template to save');
          }

          // MOCK: Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 1000));

          console.log('Saving template:', { template, elements, projectId });

          // TODO: Implement actual API call
          // const response = await templateService.saveTemplate({
          //   ...template,
          //   projectId,
          //   elements
          // });

          set({
            isSaving: false,
            isDirty: false,
            error: null
          });
        } catch (error) {
          set({
            isSaving: false,
            error: error instanceof Error ? error.message : 'Failed to save template'
          });
        }
      },

      loadTemplate: async (templateId) => {
        set({ isLoading: true, error: null });

        try {
          // MOCK: Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 500));

          // TODO: Implement actual API call
          // const { template, config } = await templateService.getTemplate(templateId);

          // MOCK data
          const mockTemplate: Template = {
            id: templateId,
            userId: 'user-123',
            projectId: 'project-123',
            name: 'Sample Template',
            type: 'vcard',
            status: 'draft',
            width: 800,
            height: 600,
            exportFormat: 'png',
            exportDpi: 300,
            brandColors: {},
            createdAt: new Date(),
            updatedAt: new Date()
          };

          const mockElements: TemplateElement[] = [];

          set({
            template: mockTemplate,
            elements: mockElements,
            isLoading: false,
            isDirty: false,
            error: null
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load template'
          });
        }
      },

      // Utility actions
      setDirty: (isDirty) => set({ isDirty }),

      setError: (error) => set({ error })
    }),
    {
      name: 'template-store'
    }
  )
);