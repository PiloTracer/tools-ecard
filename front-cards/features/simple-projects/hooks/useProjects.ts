/**
 * useProjects Hook - Project management logic
 */

import { useState, useEffect, useCallback } from 'react';
import { projectService } from '../services/projectService';
import type { Project, ProjectsResponse } from '../types';

const SELECTED_PROJECT_KEY = 'ecards_selected_project';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Sync selected project with localStorage
  useEffect(() => {
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

      // Check localStorage for previously selected project
      const storedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);

      if (storedProjectId && response.projects.find(p => p.id === storedProjectId)) {
        // Use stored selection if valid
        setSelectedProjectId(storedProjectId);
        // Update backend if different
        if (response.selectedProjectId !== storedProjectId) {
          await projectService.updateSelectedProject({ projectId: storedProjectId });
        }
      } else if (response.selectedProjectId) {
        // Use backend selection
        setSelectedProjectId(response.selectedProjectId);
      } else if (response.projects.length > 0) {
        // Default to first project (should be default project)
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

  const createProject = useCallback(async (name: string): Promise<Project | null> => {
    try {
      setError(null);
      const newProject = await projectService.createProject({ name });

      // Add to local state
      setProjects(prev => [...prev, newProject]);

      // Auto-select new project
      setSelectedProjectId(newProject.id);
      await projectService.updateSelectedProject({ projectId: newProject.id });

      return newProject;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      return null;
    }
  }, []);

  const selectProject = useCallback(async (projectId: string) => {
    try {
      setError(null);

      // Update local state immediately for responsiveness
      setSelectedProjectId(projectId);

      // Sync with backend
      await projectService.updateSelectedProject({ projectId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select project');
      // Revert on error
      const storedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);
      if (storedProjectId) {
        setSelectedProjectId(storedProjectId);
      }
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

  return {
    projects,
    selectedProjectId,
    selectedProject: projects.find(p => p.id === selectedProjectId),
    loading,
    error,
    createProject,
    selectProject,
    reloadProjects: loadProjects,
    ensureDefaultProject
  };
}