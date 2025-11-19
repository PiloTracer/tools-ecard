import type { TemplateResource } from '../types';
import { v4 as uuidv4 } from 'uuid';

// MOCK: Resource service with mock data
// TODO: Replace with actual API calls when backend is ready

const MOCK_RESOURCES: TemplateResource[] = [
  {
    id: 'res-1',
    userId: 'user-123',
    projectId: 'project-123',
    type: 'background',
    name: 'Blue Gradient Background',
    url: '/mock/backgrounds/blue-gradient.jpg',
    thumbnailUrl: '/mock/backgrounds/blue-gradient-thumb.jpg',
    mimeType: 'image/jpeg',
    size: 1024000,
    metadata: {
      width: 1920,
      height: 1080,
      tags: ['gradient', 'blue', 'professional']
    },
    createdAt: new Date('2024-01-01')
  },
  {
    id: 'res-2',
    userId: 'user-123',
    projectId: 'project-123',
    type: 'icon',
    name: 'Phone Icon',
    url: '/mock/icons/phone.svg',
    thumbnailUrl: '/mock/icons/phone-thumb.svg',
    mimeType: 'image/svg+xml',
    size: 2048,
    metadata: {
      width: 24,
      height: 24,
      tags: ['contact', 'phone', 'communication']
    },
    createdAt: new Date('2024-01-02')
  },
  {
    id: 'res-3',
    userId: 'user-123',
    projectId: 'project-123',
    type: 'icon',
    name: 'Email Icon',
    url: '/mock/icons/email.svg',
    thumbnailUrl: '/mock/icons/email-thumb.svg',
    mimeType: 'image/svg+xml',
    size: 2048,
    metadata: {
      width: 24,
      height: 24,
      tags: ['contact', 'email', 'communication']
    },
    createdAt: new Date('2024-01-02')
  }
];

export const resourceService = {
  async listResources(
    projectId: string,
    type?: TemplateResource['type']
  ): Promise<TemplateResource[]> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // MOCK: Filter resources
    let resources = MOCK_RESOURCES.filter(r => r.projectId === projectId);
    if (type) {
      resources = resources.filter(r => r.type === type);
    }

    return resources;
  },

  async uploadResource(
    file: File,
    type: TemplateResource['type'],
    projectId: string
  ): Promise<TemplateResource> {
    // MOCK: Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // MOCK: Create resource from file
    const resource: TemplateResource = {
      id: uuidv4(),
      userId: 'user-123',
      projectId,
      type,
      name: file.name,
      url: URL.createObjectURL(file), // MOCK: Use object URL
      thumbnailUrl: URL.createObjectURL(file),
      mimeType: file.type,
      size: file.size,
      metadata: {
        uploadedAt: new Date().toISOString()
      },
      createdAt: new Date()
    };

    // MOCK: Add to resources
    MOCK_RESOURCES.push(resource);
    return resource;
  },

  async deleteResource(resourceId: string): Promise<void> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // MOCK: Remove resource
    const index = MOCK_RESOURCES.findIndex(r => r.id === resourceId);
    if (index !== -1) {
      MOCK_RESOURCES.splice(index, 1);
    }
  },

  async generateThumbnail(resourceUrl: string): Promise<string> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // MOCK: Return same URL as thumbnail
    return resourceUrl;
  },

  async getResourceUrl(resourceId: string): Promise<string> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const resource = MOCK_RESOURCES.find(r => r.id === resourceId);
    if (!resource) {
      throw new Error('Resource not found');
    }

    return resource.url;
  },

  async getPresignedUploadUrl(
    type: TemplateResource['type'],
    fileName: string
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // MOCK: Return fake presigned URL
    return {
      uploadUrl: `https://mock-upload.example.com/${type}/${fileName}`,
      publicUrl: `https://mock-cdn.example.com/${type}/${fileName}`
    };
  },

  async searchResources(
    projectId: string,
    query: string,
    type?: TemplateResource['type']
  ): Promise<TemplateResource[]> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // MOCK: Search resources
    let resources = MOCK_RESOURCES.filter(r => r.projectId === projectId);

    if (type) {
      resources = resources.filter(r => r.type === type);
    }

    const lowercaseQuery = query.toLowerCase();
    resources = resources.filter(r =>
      r.name.toLowerCase().includes(lowercaseQuery) ||
      r.metadata?.tags?.some((tag: string) =>
        tag.toLowerCase().includes(lowercaseQuery)
      )
    );

    return resources;
  },

  async bulkDelete(resourceIds: string[]): Promise<void> {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // MOCK: Remove multiple resources
    for (const id of resourceIds) {
      const index = MOCK_RESOURCES.findIndex(r => r.id === id);
      if (index !== -1) {
        MOCK_RESOURCES.splice(index, 1);
      }
    }
  }
};