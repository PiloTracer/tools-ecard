/**
 * Simple Projects Feature - Type Definitions
 */

export interface Project {
  id: string;
  name: string;
  isDefault: boolean;
  workPhonePrefix?: string | null;
  defaultCountryCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectsResponse {
  projects: Project[];
  selectedProjectId: string | null;
}

export interface CreateProjectRequest {
  name: string;
}

export interface UpdateSelectedProjectRequest {
  projectId: string;
}

export interface UpdateProjectRequest {
  workPhonePrefix?: string | null;
  defaultCountryCode?: string | null;
}

export interface SelectedProjectResponse {
  projectId: string;
  project: {
    id: string;
    name: string;
    isDefault: boolean;
  };
}