import { prisma } from '@/core/database/prisma';
import type { Project, UserProjectSelection } from '../types';

export const projectRepository = {
  /**
   * Find all projects for a user
   */
  async findByUserId(userId: string): Promise<Project[]> {
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' }
      ]
    });
    return projects;
  },

  /**
   * Find a specific project by ID
   */
  async findById(projectId: string, userId: string): Promise<Project | null> {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId
      }
    });
    return project;
  },

  /**
   * Create a new project
   */
  async create(userId: string, name: string): Promise<Project> {
    // Ensure the user exists first
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@example.com`,
        name: 'User'
      }
    });

    const project = await prisma.project.create({
      data: {
        userId,
        name,
        isDefault: false
      }
    });
    return project;
  },

  /**
   * Check if a project name already exists for a user
   */
  async existsByName(userId: string, name: string): Promise<boolean> {
    const count = await prisma.project.count({
      where: {
        userId,
        name
      }
    });
    return count > 0;
  },

  /**
   * Get the user's selected project
   */
  async getSelectedProject(userId: string): Promise<UserProjectSelection | null> {
    const selection = await prisma.userProjectSelection.findUnique({
      where: { userId }
    });
    return selection;
  },

  /**
   * Update the user's selected project
   */
  async updateSelectedProject(userId: string, projectId: string): Promise<UserProjectSelection> {
    const selection = await prisma.userProjectSelection.upsert({
      where: { userId },
      update: {
        projectId,
        selectedAt: new Date()
      },
      create: {
        userId,
        projectId
      }
    });
    return selection;
  },

  /**
   * Get or create default project for user
   */
  async ensureDefaultProject(userId: string): Promise<Project> {
    // First, ensure the user exists in the database
    // Use findUnique and create separately to avoid upsert constraint issues
    let user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      try {
        user = await prisma.user.create({
          data: {
            id: userId,
            email: `${userId}@example.com`, // Mock email for now
            name: 'User'
          }
        });
      } catch (error) {
        // If user was created by another request in the meantime, fetch it
        user = await prisma.user.findUnique({
          where: { id: userId }
        });
        if (!user) {
          throw error; // Re-throw if still not found
        }
      }
    }

    // Check for existing default project
    let defaultProject = await prisma.project.findFirst({
      where: {
        userId,
        isDefault: true
      }
    });

    // Create if not exists
    if (!defaultProject) {
      try {
        defaultProject = await prisma.project.create({
          data: {
            userId,
            name: 'default',
            isDefault: true
          }
        });
      } catch (error: any) {
        // If creation failed due to unique constraint (race condition), fetch it
        if (error.code === 'P2002') {
          defaultProject = await prisma.project.findFirst({
            where: {
              userId,
              OR: [
                { isDefault: true },
                { name: 'default' }
              ]
            }
          });

          // If found but not marked as default, update it
          if (defaultProject && !defaultProject.isDefault) {
            defaultProject = await prisma.project.update({
              where: { id: defaultProject.id },
              data: { isDefault: true }
            });
          }

          if (!defaultProject) {
            throw error; // Re-throw if still not found
          }
        } else {
          throw error;
        }
      }
    }

    return defaultProject;
  }
};