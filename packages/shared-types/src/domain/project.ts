/**
 * Project domain model
 * Represents a project container for organizing templates and batches
 */

export interface Project {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProjectSelection {
  userId: string;
  projectId: string;
  selectedAt: Date;
}

// Project creation input
export interface CreateProjectInput {
  name: string;
  userId: string;
}

// Project update input
export interface UpdateProjectInput {
  name?: string;
}