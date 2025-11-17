/**
 * Project API contracts
 * Request and response types for project-related endpoints
 */

import { Project } from '../domain/project';

// GET /api/projects
export interface GetProjectsResponse {
  projects: Array<{
    id: string;
    name: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  selectedProjectId: string | null;
}

// POST /api/projects
export interface CreateProjectRequest {
  name: string;
}

export interface CreateProjectResponse {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// GET /api/projects/selected
export interface GetSelectedProjectResponse {
  projectId: string;
  project: {
    id: string;
    name: string;
    isDefault: boolean;
  };
}

// PUT /api/projects/selected
export interface UpdateSelectedProjectRequest {
  projectId: string;
}

export interface UpdateSelectedProjectResponse {
  success: boolean;
  projectId: string;
}

// DELETE /api/projects/:id (optional, for future use)
export interface DeleteProjectResponse {
  success: boolean;
  message: string;
}