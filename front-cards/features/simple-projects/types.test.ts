import { describe, it, expect } from '@jest/globals';
import {
  Project,
  ProjectsResponse,
  CreateProjectRequest,
  UpdateSelectedProjectRequest,
  UpdateProjectRequest,
  SelectedProjectResponse,
} from './types';

describe('Simple Projects Types', () => {
  it('should create a valid Project', () => {
    const project: Project = {
      id: 'proj-123',
      name: 'Test Project',
      isDefault: false,
      workPhonePrefix: '2222',
      defaultCountryCode: '+(506)',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    expect(project.id).toBe('proj-123');
    expect(project.name).toBe('Test Project');
    expect(project.isDefault).toBe(false);
    expect(project.workPhonePrefix).toBe('2222');
    expect(project.defaultCountryCode).toBe('+(506)');
  });

  it('should create a Project with null fields', () => {
    const project: Project = {
      id: 'proj-456',
      name: 'Default Project',
      isDefault: true,
      workPhonePrefix: null,
      defaultCountryCode: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    expect(project.workPhonePrefix).toBeNull();
    expect(project.defaultCountryCode).toBeNull();
    expect(project.isDefault).toBe(true);
  });

  it('should create a valid ProjectsResponse', () => {
    const response: ProjectsResponse = {
      projects: [
        {
          id: 'proj-1',
          name: 'Project 1',
          isDefault: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
      selectedProjectId: 'proj-1',
    };

    expect(response.projects).toHaveLength(1);
    expect(response.selectedProjectId).toBe('proj-1');
  });

  it('should create a ProjectsResponse with null selectedProjectId', () => {
    const response: ProjectsResponse = {
      projects: [],
      selectedProjectId: null,
    };

    expect(response.selectedProjectId).toBeNull();
  });

  it('should create a valid CreateProjectRequest', () => {
    const request: CreateProjectRequest = {
      name: 'New Project',
    };

    expect(request.name).toBe('New Project');
  });

  it('should create a valid UpdateSelectedProjectRequest', () => {
    const request: UpdateSelectedProjectRequest = {
      projectId: 'proj-789',
    };

    expect(request.projectId).toBe('proj-789');
  });

  it('should create a valid UpdateProjectRequest with all fields', () => {
    const request: UpdateProjectRequest = {
      workPhonePrefix: '1234',
      defaultCountryCode: '+(1)',
    };

    expect(request.workPhonePrefix).toBe('1234');
    expect(request.defaultCountryCode).toBe('+(1)');
  });

  it('should create a valid UpdateProjectRequest with partial fields', () => {
    const request: UpdateProjectRequest = {
      workPhonePrefix: null,
    };

    expect(request.workPhonePrefix).toBeNull();
    expect(request.defaultCountryCode).toBeUndefined();
  });

  it('should create a valid SelectedProjectResponse', () => {
    const response: SelectedProjectResponse = {
      projectId: 'proj-123',
      project: {
        id: 'proj-123',
        name: 'Selected Project',
        isDefault: false,
      },
    };

    expect(response.projectId).toBe('proj-123');
    expect(response.project.name).toBe('Selected Project');
  });
});
