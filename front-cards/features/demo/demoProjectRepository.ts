/**
 * Demo project repository — localStorage only
 */

import type {
  Project,
  ProjectsResponse,
  CreateProjectRequest,
  UpdateSelectedProjectRequest,
  UpdateProjectRequest,
  SelectedProjectResponse,
} from '@/features/simple-projects/types';
import { demoStore, newDemoId } from './demoStore';

function ensureSeed(): Project[] {
  let projects = demoStore.getProjects<Project>();
  if (projects.length === 0) {
    const now = new Date().toISOString();
    projects = [
      {
        id: newDemoId('proj'),
        name: 'Demo Project',
        isDefault: true,
        workPhonePrefix: null,
        defaultCountryCode: null,
        createdAt: now,
        updatedAt: now,
      },
    ];
    demoStore.setProjects(projects);
    demoStore.setSelectedProjectId(projects[0].id);
  }
  if (!demoStore.getSelectedProjectId() && projects[0]) {
    demoStore.setSelectedProjectId(projects[0].id);
  }
  return projects;
}

export const demoProjectRepository = {
  async getProjects(): Promise<ProjectsResponse> {
    const projects = ensureSeed();
    return {
      projects,
      selectedProjectId: demoStore.getSelectedProjectId(),
    };
  },

  async createProject(data: CreateProjectRequest): Promise<Project> {
    const projects = ensureSeed();
    const now = new Date().toISOString();
    const project: Project = {
      id: newDemoId('proj'),
      name: data.name,
      isDefault: false,
      workPhonePrefix: null,
      defaultCountryCode: null,
      createdAt: now,
      updatedAt: now,
    };
    projects.push(project);
    demoStore.setProjects(projects);
    return project;
  },

  async getSelectedProject(): Promise<SelectedProjectResponse> {
    const projects = ensureSeed();
    const id = demoStore.getSelectedProjectId() || projects[0].id;
    const project = projects.find((p) => p.id === id) || projects[0];
    return {
      projectId: project.id,
      project: {
        id: project.id,
        name: project.name,
        isDefault: project.isDefault,
      },
    };
  },

  async updateSelectedProject(
    data: UpdateSelectedProjectRequest
  ): Promise<{ success: boolean; projectId: string }> {
    demoStore.setSelectedProjectId(data.projectId);
    return { success: true, projectId: data.projectId };
  },

  async ensureDefaultProject(): Promise<Project> {
    const projects = ensureSeed();
    return projects[0];
  },

  async updateProject(projectId: string, data: UpdateProjectRequest): Promise<Project> {
    const projects = ensureSeed();
    const idx = projects.findIndex((p) => p.id === projectId);
    if (idx < 0) throw new Error('Demo project not found');
    const updated: Project = {
      ...projects[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    projects[idx] = updated;
    demoStore.setProjects(projects);
    return updated;
  },
};
