'use client';

import { useState } from 'react';
import { useProjects } from '../contexts/ProjectsContext';
import { ProjectsIssueAlert } from './ProjectsIssueAlert';
import { useTranslation } from '@/features/i18n';

export function ProjectSelector() {
  const {
    projects,
    selectedProjectId,
    loading,
    error,
    createProject,
    selectProject
  } = useProjects();
  const { t } = useTranslation();

  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [createError, setCreateError] = useState('');

  const handleSelectProject = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = e.target.value;
    console.log('[ProjectSelector.handleSelectProject] User selected projectId:', projectId);
    if (projectId === 'create-new') {
      setIsCreating(true);
    } else {
      console.log('[ProjectSelector.handleSelectProject] Calling selectProject with:', projectId);
      selectProject(projectId);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setCreateError('Project name is required');
      return;
    }

    if (!/^[a-zA-Z0-9\s\-_]+$/.test(newProjectName)) {
      setCreateError('Project name can only contain letters, numbers, spaces, hyphens, and underscores');
      return;
    }

    const result = await createProject(newProjectName.trim());
    if (result) {
      setNewProjectName('');
      setIsCreating(false);
      setCreateError('');
    } else {
      setCreateError('Failed to create project. Name might already exist.');
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewProjectName('');
    setCreateError('');
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-3 mb-6">
        <label className="text-sm font-medium text-text-primary min-w-fit">
          {t('settings.project')}:
        </label>
        <div className="flex items-center space-x-2 flex-1">
          <div className="h-10 w-48 bg-surface-inset animate-pulse rounded-lg"></div>
          <span className="text-sm text-text-secondary">Loading projects...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6 space-y-2">
        <p className="text-sm font-medium text-text-primary">Workspace (project)</p>
        <ProjectsIssueAlert alert={error} variant="inline" />
        <p className="text-xs text-text-muted">The same summary appears in the amber bar at the top of the page.</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center space-x-3">
        <label htmlFor="project-selector" className="text-sm font-medium text-text-primary min-w-fit">
          {t('settings.project')}:
        </label>

        {!isCreating ? (
          <select
            id="project-selector"
            value={selectedProjectId || ''}
            onChange={handleSelectProject}
            disabled={projects.length === 0}
            className="flex-1 max-w-xs px-4 py-2.5 text-sm text-text-primary bg-surface-inset border border-border-default rounded-lg shadow-sm
                     hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
                     disabled:bg-surface-inset disabled:text-text-muted disabled:cursor-not-allowed
                     transition-colors duration-150
                     [&>option]:text-text-primary [&>option]:bg-surface-overlay"
          >
            {projects.length === 0 && (
              <option value="" className="text-text-primary bg-surface-overlay">No projects available</option>
            )}
            {projects.map(project => (
              <option key={project.id} value={project.id} className="text-text-primary bg-surface-overlay">
                {project.name}{project.isDefault ? ' (default)' : ''}
              </option>
            ))}
            <option value="create-new" className="font-medium text-text-primary bg-surface-overlay">
              + Create New Project
            </option>
          </select>
        ) : (
          <div className="flex items-center space-x-2 flex-1 max-w-lg">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject();
                if (e.key === 'Escape') handleCancelCreate();
              }}
              placeholder="Enter project name"
              className="flex-1 px-4 py-2.5 text-sm text-text-primary bg-surface-inset border border-border-default rounded-lg shadow-sm
                       focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
                       transition-colors duration-150"
              autoFocus
            />
            <button
              onClick={handleCreateProject}
              className="px-5 py-2.5 bg-accent text-white text-sm font-medium rounded-lg
                       hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
                       transition-colors duration-150"
            >
              Create
            </button>
            <button
              onClick={handleCancelCreate}
              className="px-5 py-2.5 bg-surface-inset text-text-secondary text-sm font-medium rounded-lg
                       hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-border-strong focus:ring-offset-2
                       transition-colors duration-150"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {createError && (
        <div className="mt-2 px-4 py-2 bg-error-subtle text-status-error text-sm rounded-lg border border-border-subtle">
          {createError}
        </div>
      )}
    </div>
  );
}