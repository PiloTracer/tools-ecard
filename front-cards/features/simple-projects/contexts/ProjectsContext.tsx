'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { ProjectsIssueAlert } from '../components/ProjectsIssueAlert';
import { projectService } from '../services/projectService';
import { projectsErrorDisplayFromCaught } from '../services/projectsApiUserError';
import type { Project, UpdateProjectRequest } from '../types';
import type { ProjectsErrorDisplay } from '../types/errors';

const SELECTED_PROJECT_KEY = 'ecards_selected_project';

interface ProjectsContextType {
  projects: Project[];
  selectedProjectId: string | null;
  selectedProject: Project | undefined;
  loading: boolean;
  /** Structured message for banners and selectors (null when there is nothing to surface). */
  error: ProjectsErrorDisplay | null;
  createProject: (name: string) => Promise<Project | null>;
  selectProject: (projectId: string) => Promise<void>;
  updateProject: (projectId: string, data: UpdateProjectRequest) => Promise<Project | null>;
  reloadProjects: () => Promise<boolean>;
  /** Ensures backend default workspace exists; refreshes project list on success. */
  ensureDefaultProject: () => Promise<boolean>;
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

function ProjectsConnectivityRibbon() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) {
    return null;
  }
  const { error, loading } = ctx;

  if (loading || !error) {
    return null;
  }

  return (
    <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50 shadow-sm" aria-live="polite">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <ProjectsIssueAlert alert={error} variant="ribbon" />
      </div>
    </div>
  );
}

export type ProjectsProviderProps = {
  children: ReactNode;
  /**
   * Auth user id from the parent (e.g. `user?.id`). Keeps this feature free of `@/features/auth`.
   * `undefined` / `null`: no session — clears in-memory project state (logout / signed-out shell).
   */
  sessionUserId: string | undefined | null;
};

export function ProjectsProvider({ children, sessionUserId }: ProjectsProviderProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ProjectsErrorDisplay | null>(null);
  const prevSessionUserIdRef = useRef<string | undefined>(undefined);

  // Sync selected project with localStorage
  useEffect(() => {
    console.log('[ProjectsContext] selectedProjectId changed to:', selectedProjectId);
    if (selectedProjectId) {
      localStorage.setItem(SELECTED_PROJECT_KEY, selectedProjectId);
    }
  }, [selectedProjectId]);

  const loadProjects = useCallback(async (): Promise<boolean> => {
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
      return true;
    } catch (err) {
      setError(projectsErrorDisplayFromCaught(err));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Load when the signed-in user identity changes, including re-login after logout with the same account.
  useEffect(() => {
    if (sessionUserId === undefined || sessionUserId === null) {
      prevSessionUserIdRef.current = undefined;
      setLoading(false);
      setError(null);
      setProjects([]);
      setSelectedProjectId(null);
      return;
    }

    if (prevSessionUserIdRef.current !== sessionUserId) {
      setError(null);
      setProjects([]);
      setSelectedProjectId(null);
      void loadProjects();
    }
    prevSessionUserIdRef.current = sessionUserId;
  }, [sessionUserId, loadProjects]);

  const createProject = useCallback(async (name: string): Promise<Project | null> => {
    try {
      setError(null);
      const newProject = await projectService.createProject({ name });
      setProjects(prev => [...prev, newProject]);
      setSelectedProjectId(newProject.id);
      await projectService.updateSelectedProject({ projectId: newProject.id });
      return newProject;
    } catch (err) {
      setError(projectsErrorDisplayFromCaught(err));
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
      setError(projectsErrorDisplayFromCaught(err));
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
      setError(projectsErrorDisplayFromCaught(err));
      return null;
    }
  }, []);

  const ensureDefaultProject = useCallback(async (): Promise<boolean> => {
    try {
      await projectService.ensureDefaultProject();
      return await loadProjects();
    } catch (err) {
      console.error('Failed to ensure default project:', err);
      setError(projectsErrorDisplayFromCaught(err));
      return false;
    }
  }, [loadProjects]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        selectedProjectId,
        selectedProject,
        loading,
        error,
        createProject,
        selectProject,
        updateProject,
        reloadProjects: loadProjects,
        ensureDefaultProject,
      }}
    >
      <ProjectsConnectivityRibbon />
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
