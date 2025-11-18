/**
 * Project Service - API Client
 */

import type {
  Project,
  ProjectsResponse,
  CreateProjectRequest,
  UpdateSelectedProjectRequest,
  SelectedProjectResponse
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7400';

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
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: errorText || 'Request failed' };
      }
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
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
    return this.fetchWithAuth(`${API_BASE_URL}/api/v1/projects`);
  }

  /**
   * Create a new project
   */
  async createProject(data: CreateProjectRequest): Promise<Project> {
    return this.fetchWithAuth(`${API_BASE_URL}/api/v1/projects`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get the currently selected project
   */
  async getSelectedProject(): Promise<SelectedProjectResponse> {
    return this.fetchWithAuth(`${API_BASE_URL}/api/v1/projects/selected`);
  }

  /**
   * Update the selected project
   */
  async updateSelectedProject(data: UpdateSelectedProjectRequest): Promise<{ success: boolean; projectId: string }> {
    return this.fetchWithAuth(`${API_BASE_URL}/api/v1/projects/selected`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Ensure default project exists (called after login)
   */
  async ensureDefaultProject(): Promise<Project> {
    return this.fetchWithAuth(`${API_BASE_URL}/api/v1/projects/ensure-default`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }
}

export const projectService = new ProjectService();