import { projectRepository } from '../repositories/projectRepository';
import type { Project, ProjectWithSelection, CreateProjectDto, UpdateSelectedProjectDto } from '../types';

export const projectService = {
  /**
   * Get all projects for a user with selection status
   */
  async getUserProjects(userId: string): Promise<{
    projects: ProjectWithSelection[];
    selectedProjectId: string | null;
  }> {
    // Get all user projects
    const projects = await projectRepository.findByUserId(userId);

    // Get selected project
    const selection = await projectRepository.getSelectedProject(userId);

    // If no selection exists, ensure default project and select it
    let selectedProjectId = selection?.projectId || null;

    if (!selectedProjectId && projects.length > 0) {
      const defaultProject = projects.find(p => p.isDefault) || projects[0];
      await projectRepository.updateSelectedProject(userId, defaultProject.id);
      selectedProjectId = defaultProject.id;
    }

    // Map projects with selection status
    const projectsWithSelection: ProjectWithSelection[] = projects.map(project => ({
      ...project,
      isSelected: project.id === selectedProjectId
    }));

    return {
      projects: projectsWithSelection,
      selectedProjectId
    };
  },

  /**
   * Create a new project for a user
   */
  async createProject(userId: string, data: CreateProjectDto): Promise<Project> {
    // Check if project name already exists
    const exists = await projectRepository.existsByName(userId, data.name);
    if (exists) {
      throw new Error(`Project with name "${data.name}" already exists`);
    }

    // Create the project
    const project = await projectRepository.create(userId, data.name);

    // If this is the user's first non-default project, select it
    const userProjects = await projectRepository.findByUserId(userId);
    if (userProjects.length === 2) { // One default + this new one
      await projectRepository.updateSelectedProject(userId, project.id);
    }

    return project;
  },

  /**
   * Get the currently selected project
   */
  async getSelectedProject(userId: string): Promise<{
    projectId: string;
    project: Project;
  }> {
    const selection = await projectRepository.getSelectedProject(userId);

    if (!selection) {
      // No selection, ensure default project exists and select it
      const defaultProject = await projectRepository.ensureDefaultProject(userId);
      await projectRepository.updateSelectedProject(userId, defaultProject.id);

      return {
        projectId: defaultProject.id,
        project: defaultProject
      };
    }

    // Get the selected project details
    const project = await projectRepository.findById(selection.projectId, userId);

    if (!project) {
      // Selected project doesn't exist, fall back to default
      const defaultProject = await projectRepository.ensureDefaultProject(userId);
      await projectRepository.updateSelectedProject(userId, defaultProject.id);

      return {
        projectId: defaultProject.id,
        project: defaultProject
      };
    }

    return {
      projectId: project.id,
      project
    };
  },

  /**
   * Update the selected project
   */
  async updateSelectedProject(userId: string, data: UpdateSelectedProjectDto): Promise<{
    success: boolean;
    projectId: string;
  }> {
    // Verify the project exists and belongs to the user
    const project = await projectRepository.findById(data.projectId, userId);

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Update the selection
    await projectRepository.updateSelectedProject(userId, data.projectId);

    return {
      success: true,
      projectId: data.projectId
    };
  },

  /**
   * Ensure user has a default project (called after authentication)
   */
  async ensureUserDefaultProject(userId: string): Promise<Project> {
    const defaultProject = await projectRepository.ensureDefaultProject(userId);

    // Ensure it's selected if no selection exists
    const selection = await projectRepository.getSelectedProject(userId);
    if (!selection) {
      await projectRepository.updateSelectedProject(userId, defaultProject.id);
    }

    return defaultProject;
  }
};