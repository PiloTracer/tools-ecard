/**
 * Project Service - API Client
 */

import type {
  Project,
  ProjectsResponse,
  CreateProjectRequest,
  UpdateSelectedProjectRequest,
  UpdateProjectRequest,
  SelectedProjectResponse
} from '../types';

import { getApiBaseUrl } from '@/shared/lib/api-base-url';

class ProjectService {
  private async fetchWithAuth(url: string, options?: RequestInit) {
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string> || {}),
    };

    // Only set Content-Type if there's a body
    if (options?.body) {
      headers['Content-Type'] = 'application/json';
    }

    console.log('[ProjectService] Request:', {
      url,
      method: options?.method || 'GET',
      headers,
      body: options?.body
    });

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for auth
    });

    console.log('[ProjectService] Response:', {
      url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ProjectService] Error response:', errorText);
      let parsed: { error?: string } = {};
      if (errorText.trim()) {
        try {
          parsed = JSON.parse(errorText) as { error?: string };
        } catch {
          parsed = { error: errorText };
        }
      }
      const statusPart = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
      const msg = parsed.error?.trim() || errorText.trim() || statusPart;
      throw new Error(msg);
    }

    const responseText = await response.text();
    console.log('[ProjectService] Success response:', responseText);

    try {
      return JSON.parse(responseText);
    } catch (e) {
      console.error('[ProjectService] Failed to parse response:', e);
      throw new Error('Invalid JSON response from server');
    }
  }

  /**
   * Get all projects for the current user
   */
  async getProjects(): Promise<ProjectsResponse> {
    const response = await this.fetchWithAuth(`${getApiBaseUrl()}/api/v1/projects`);
    console.log('[ProjectService.getProjects] Response with phone fields:', response);
    return response;
  }

  /**
   * Create a new project
   */
  async createProject(data: CreateProjectRequest): Promise<Project> {
    return this.fetchWithAuth(`${getApiBaseUrl()}/api/v1/projects`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get the currently selected project
   */
  async getSelectedProject(): Promise<SelectedProjectResponse> {
    return this.fetchWithAuth(`${getApiBaseUrl()}/api/v1/projects/selected`);
  }

  /**
   * Update the selected project
   */
  async updateSelectedProject(data: UpdateSelectedProjectRequest): Promise<{ success: boolean; projectId: string }> {
    return this.fetchWithAuth(`${getApiBaseUrl()}/api/v1/projects/selected`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Ensure default project exists (called after login)
   */
  async ensureDefaultProject(): Promise<Project> {
    return this.fetchWithAuth(`${getApiBaseUrl()}/api/v1/projects/ensure-default`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  /**
   * Update project settings (phone prefixes)
   */
  async updateProject(projectId: string, data: UpdateProjectRequest): Promise<Project> {
    return this.fetchWithAuth(`${getApiBaseUrl()}/api/v1/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
}

export const projectService = new ProjectService();