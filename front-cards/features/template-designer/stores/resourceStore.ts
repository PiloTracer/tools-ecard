import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { TemplateResource } from '../types';

interface ResourceStore {
  // State
  resources: TemplateResource[];
  selectedResourceId: string | null;
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  filter: {
    type?: TemplateResource['type'];
    searchQuery?: string;
  };

  // Actions
  loadResources: (projectId: string) => Promise<void>;
  uploadResource: (
    file: File,
    type: TemplateResource['type'],
    projectId: string
  ) => Promise<TemplateResource>;
  deleteResource: (resourceId: string) => Promise<void>;
  selectResource: (resourceId: string | null) => void;
  setFilter: (filter: ResourceStore['filter']) => void;
  clearFilter: () => void;

  // Computed
  getFilteredResources: () => TemplateResource[];
  getResourceById: (id: string) => TemplateResource | undefined;
}

export const useResourceStore = create<ResourceStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      resources: [],
      selectedResourceId: null,
      isLoading: false,
      isUploading: false,
      error: null,
      filter: {},

      // Actions
      loadResources: async (projectId) => {
        set({ isLoading: true, error: null });

        try {
          // MOCK: Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 500));

          // TODO: Implement actual API call
          // const resources = await resourceService.listResources(projectId);

          // MOCK data
          const mockResources: TemplateResource[] = [
            {
              id: 'res-1',
              userId: 'user-123',
              projectId,
              type: 'background',
              name: 'Blue Background',
              url: '/mock/bg-blue.jpg',
              thumbnailUrl: '/mock/bg-blue-thumb.jpg',
              mimeType: 'image/jpeg',
              size: 1024000,
              metadata: { width: 1920, height: 1080 },
              createdAt: new Date()
            },
            {
              id: 'res-2',
              userId: 'user-123',
              projectId,
              type: 'icon',
              name: 'Phone Icon',
              url: '/mock/icon-phone.svg',
              thumbnailUrl: '/mock/icon-phone-thumb.svg',
              mimeType: 'image/svg+xml',
              size: 2048,
              metadata: { width: 24, height: 24 },
              createdAt: new Date()
            },
            {
              id: 'res-3',
              userId: 'user-123',
              projectId,
              type: 'font',
              name: 'Custom Font',
              url: '/mock/font-custom.woff2',
              mimeType: 'font/woff2',
              size: 45056,
              metadata: { fontFamily: 'CustomFont' },
              createdAt: new Date()
            }
          ];

          set({
            resources: mockResources,
            isLoading: false,
            error: null
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load resources'
          });
        }
      },

      uploadResource: async (file, type, projectId) => {
        set({ isUploading: true, error: null });

        try {
          // MOCK: Simulate file upload
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // TODO: Implement actual upload
          // const resource = await resourceService.uploadResource(file, type, projectId);

          // MOCK response
          const mockResource: TemplateResource = {
            id: `res-${Date.now()}`,
            userId: 'user-123',
            projectId,
            type,
            name: file.name,
            url: URL.createObjectURL(file),
            thumbnailUrl: URL.createObjectURL(file),
            mimeType: file.type,
            size: file.size,
            metadata: {},
            createdAt: new Date()
          };

          set((state) => ({
            resources: [...state.resources, mockResource],
            isUploading: false,
            error: null
          }));

          return mockResource;
        } catch (error) {
          set({
            isUploading: false,
            error: error instanceof Error ? error.message : 'Failed to upload resource'
          });
          throw error;
        }
      },

      deleteResource: async (resourceId) => {
        try {
          // MOCK: Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 500));

          // TODO: Implement actual delete
          // await resourceService.deleteResource(resourceId);

          set((state) => ({
            resources: state.resources.filter((r) => r.id !== resourceId),
            selectedResourceId:
              state.selectedResourceId === resourceId ? null : state.selectedResourceId
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete resource'
          });
          throw error;
        }
      },

      selectResource: (resourceId) => set({ selectedResourceId: resourceId }),

      setFilter: (filter) => set({ filter }),

      clearFilter: () => set({ filter: {} }),

      // Computed
      getFilteredResources: () => {
        const state = get();
        let filtered = [...state.resources];

        // Filter by type
        if (state.filter.type) {
          filtered = filtered.filter((r) => r.type === state.filter.type);
        }

        // Filter by search query
        if (state.filter.searchQuery) {
          const query = state.filter.searchQuery.toLowerCase();
          filtered = filtered.filter((r) =>
            r.name.toLowerCase().includes(query)
          );
        }

        // Sort by creation date (newest first)
        filtered.sort((a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime()
        );

        return filtered;
      },

      getResourceById: (id) => {
        return get().resources.find((r) => r.id === id);
      }
    }),
    {
      name: 'resource-store'
    }
  )
);