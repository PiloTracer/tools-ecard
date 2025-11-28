'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { projectService } from '../services/projectService';
import type { Project, ProjectsResponse, UpdateProjectRequest } from '../types';

const SELECTED_PROJECT_KEY = 'ecards_selected_project';

interface ProjectsContextType {
  projects: Project[];
  selectedProjectId: string | null;
  selectedProject: Project | undefined;
  loading: boolean;
  error: string | null;
  createProject: (name: string) => Promise<Project | null>;
  selectProject: (projectId: string) => Promise<void>;
  updateProject: (projectId: string, data: UpdateProjectRequest) => Promise<Project | null>;
  reloadProjects: () => Promise<void>;
  ensureDefaultProject: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync selected project with localStorage
  useEffect(() => {
    console.log('[ProjectsContext] selectedProjectId changed to:', selectedProjectId);
    if (selectedProjectId) {
      localStorage.setItem(SELECTED_PROJECT_KEY, selectedProjectId);
    }
  }, [selectedProjectId]);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await projectService.getProjects();
      setProjects(response.projects);

      const storedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);

      if (storedProjectId && response.projects.find(p => p.id === storedProjectId)) {
        setSelectedProjectId(storedProjectId);
        if (response.selectedProjectId !== storedProjectId) {
          await projectService.updateSelectedProject({ projectId: storedProjectId });
        }
      } else if (response.selectedProjectId) {
        setSelectedProjectId(response.selectedProjectId);
      } else if (response.projects.length > 0) {
        const defaultProject = response.projects.find(p => p.isDefault) || response.projects[0];
        setSelectedProjectId(defaultProject.id);
        await projectService.updateSelectedProject({ projectId: defaultProject.id });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = useCallback(async (name: string): Promise<Project | null> => {
    try {
      setError(null);
      const newProject = await projectService.createProject({ name });
      setProjects(prev => [...prev, newProject]);
      setSelectedProjectId(newProject.id);
      await projectService.updateSelectedProject({ projectId: newProject.id });
      return newProject;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      return null;
    }
  }, []);

  const selectProject = useCallback(async (projectId: string) => {
    console.log('[ProjectsContext.selectProject] CALLED with:', projectId);
    try {
      setError(null);
      console.log('[ProjectsContext.selectProject] Setting state to:', projectId);
      setSelectedProjectId(projectId);
      await projectService.updateSelectedProject({ projectId });
      console.log('[ProjectsContext.selectProject] Complete');
    } catch (err) {
      console.error('[ProjectsContext.selectProject] ERROR:', err);
      setError(err instanceof Error ? err.message : 'Failed to select project');
      const storedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);
      if (storedProjectId) {
        setSelectedProjectId(storedProjectId);
      }
    }
  }, []);

  const updateProject = useCallback(async (projectId: string, data: UpdateProjectRequest): Promise<Project | null> => {
    try {
      setError(null);
      const updatedProject = await projectService.updateProject(projectId, data);
      setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
      return updatedProject;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project');
      return null;
    }
  }, []);

  const ensureDefaultProject = useCallback(async () => {
    try {
      await projectService.ensureDefaultProject();
      await loadProjects();
    } catch (err) {
      console.error('Failed to ensure default project:', err);
    }
  }, [loadProjects]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <ProjectsContext.Provider value={{
      projects,
      selectedProjectId,
      selectedProject,
      loading,
      error,
      createProject,
      selectProject,
      updateProject,
      reloadProjects: loadProjects,
      ensureDefaultProject
    }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used within ProjectsProvider');
  }
  return context;
}
