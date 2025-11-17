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
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-sm text-gray-600">Loading projects...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-sm text-red-600">Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center space-x-3">
        <label htmlFor="project-selector" className="text-sm font-medium text-gray-700">
          Project:
        </label>

        {!isCreating ? (
          <select
            id="project-selector"
            value={selectedProjectId || ''}
            onChange={handleSelectProject}
            className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
                {project.isDefault && ' (default)'}
              </option>
            ))}
            <option value="create-new">+ Create New Project</option>
          </select>
        ) : (
          <div className="flex items-center space-x-2 flex-1 max-w-md">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject();
                if (e.key === 'Escape') handleCancelCreate();
              }}
              placeholder="Enter project name"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={handleCreateProject}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Create
            </button>
            <button
              onClick={handleCancelCreate}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {createError && (
        <p className="mt-2 text-sm text-red-600">{createError}</p>
      )}
    </div>
  );
}