/**
 * Simple Projects Feature - Public Exports
 */

export { ProjectSelector } from './components/ProjectSelector';
export { ProjectSettings } from './components/ProjectSettings';
export { ProjectsProvider, useProjects } from './contexts/ProjectsContext';
export { projectService } from './services/projectService';
export type { Project, ProjectsResponse, CreateProjectRequest, UpdateSelectedProjectRequest, UpdateProjectRequest } from './types';