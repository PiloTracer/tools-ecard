/**
 * Simple Projects Feature - Type Definitions
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

export interface CreateProjectDto {
  name: string;
}

export interface UpdateSelectedProjectDto {
  projectId: string;
}

export interface ProjectWithSelection extends Project {
  isSelected: boolean;
}