/**
 * Simple Projects Feature - Public Exports
 */

export { ProjectSelector } from './components/ProjectSelector';
export { ProjectSettings } from './components/ProjectSettings';
export { ProjectsIssueAlert } from './components/ProjectsIssueAlert';
export { ProjectsProvider, useProjects } from './contexts/ProjectsContext';
export type { ProjectsProviderProps } from './contexts/ProjectsContext';
export { projectService } from './services/projectService';
export { ProjectsApiUserError } from './services/projectsApiUserError';
export type { Project, ProjectsResponse, CreateProjectRequest, UpdateSelectedProjectRequest, UpdateProjectRequest } from './types';
export type { ProjectsErrorDisplay } from './types/errors';
