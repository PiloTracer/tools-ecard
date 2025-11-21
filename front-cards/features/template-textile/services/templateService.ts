/**
 * Template Service
 * Handles API communication for template saving and loading
 */

import type { Template, TemplateElement } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7400';

export interface SaveTemplateRequest {
  templateName: string;
  projectName: string;
  template: Template;
  resources?: TemplateResource[];
}

export interface TemplateResource {
  id: string;
  type: 'image' | 'font' | 'svg' | 'other';
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
}

export interface TemplateMetadata {
  id: string;
  name: string;
  projectName: string;
  userId: string;
  version: number;
  width: number;
  height: number;
  elementCount: number;
  createdAt: string;
  updatedAt: string;
}

class TemplateService {
  /**
   * Save a template to the backend
   */
  async saveTemplate(request: SaveTemplateRequest): Promise<TemplateMetadata> {
    const response = await fetch(`${API_BASE_URL}/api/v1/template-textile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // TODO: Add authentication headers
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save template');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Load a template from the backend
   */
  async loadTemplate(projectName: string, templateName: string, version?: number): Promise<{
    metadata: TemplateMetadata;
    template: Template;
    resources?: TemplateResource[];
  }> {
    const url = new URL(`${API_BASE_URL}/api/v1/template-textile/${projectName}/${templateName}`);
    if (version) {
      url.searchParams.set('version', version.toString());
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        // TODO: Add authentication headers
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load template');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * List all templates for the current user
   */
  async listTemplates(page: number = 1, pageSize: number = 20): Promise<{
    templates: TemplateMetadata[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const url = new URL(`${API_BASE_URL}/api/v1/template-textile`);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('pageSize', pageSize.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        // TODO: Add authentication headers
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list templates');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(projectName: string, templateName: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/template-textile/${projectName}/${templateName}`, {
      method: 'DELETE',
      headers: {
        // TODO: Add authentication headers
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete template');
    }
  }

  /**
   * Extract resources from template elements
   * This identifies images and other external resources that need to be saved
   */
  extractResources(elements: TemplateElement[]): TemplateResource[] {
    const resources: TemplateResource[] = [];

    for (const element of elements) {
      if (element.type === 'image' && 'imageUrl' in element) {
        // Check if it's a data URL or external URL
        if (element.imageUrl.startsWith('data:')) {
          // Extract data URL as resource
          const mimeMatch = element.imageUrl.match(/^data:([^;]+);/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

          resources.push({
            id: element.id,
            type: 'image',
            name: `image-${element.id}`,
            url: element.imageUrl,
            mimeType,
          });
        } else if (!element.imageUrl.startsWith('http')) {
          // Local asset, should be saved
          resources.push({
            id: element.id,
            type: 'image',
            name: `image-${element.id}`,
            url: element.imageUrl,
          });
        }
      }
    }

    return resources;
  }
}

export const templateService = new TemplateService();