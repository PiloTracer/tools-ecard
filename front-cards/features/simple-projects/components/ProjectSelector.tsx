'use client';

import { useState } from 'react';
import { useProjects } from '../hooks/useProjects';

export function ProjectSelector() {
  const {
    projects,
    selectedProjectId,
    loading,
    error,
    createProject,
    selectProject
  } = useProjects();

  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [createError, setCreateError] = useState('');

  const handleSelectProject = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = e.target.value;
    if (projectId === 'create-new') {
      setIsCreating(true);
    } else {
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
        <label className="text-sm font-medium text-gray-700 min-w-fit">
          Project:
        </label>
        <div className="flex items-center space-x-2 flex-1">
          <div className="h-10 w-48 bg-gray-100 animate-pulse rounded-lg"></div>
          <span className="text-sm text-gray-500">Loading projects...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-3 mb-6">
        <label className="text-sm font-medium text-gray-700 min-w-fit">
          Project:
        </label>
        <div className="flex items-center space-x-2 flex-1">
          <div className="px-4 py-2 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center space-x-3">
        <label htmlFor="project-selector" className="text-sm font-medium text-gray-700 min-w-fit">
          Project:
        </label>

        {!isCreating ? (
          <select
            id="project-selector"
            value={selectedProjectId || ''}
            onChange={handleSelectProject}
            disabled={projects.length === 0}
            className="flex-1 max-w-xs px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg shadow-sm
                     hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
                     transition-colors duration-150
                     [&>option]:text-gray-900 [&>option]:bg-white"
          >
            {projects.length === 0 && (
              <option value="" className="text-gray-900 bg-white">No projects available</option>
            )}
            {projects.map(project => (
              <option key={project.id} value={project.id} className="text-gray-900 bg-white">
                {project.name}{project.isDefault ? ' (default)' : ''}
              </option>
            ))}
            <option value="create-new" className="font-medium text-gray-900 bg-white">
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
              className="flex-1 px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg shadow-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       transition-colors duration-150"
              autoFocus
            />
            <button
              onClick={handleCreateProject}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                       transition-colors duration-150"
            >
              Create
            </button>
            <button
              onClick={handleCancelCreate}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg
                       hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                       transition-colors duration-150"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {createError && (
        <div className="mt-2 px-4 py-2 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {createError}
        </div>
      )}
    </div>
  );
}