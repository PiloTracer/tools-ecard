import type { FastifyRequest, FastifyReply } from 'fastify';
import { projectService } from '../services/projectService';
import type { CreateProjectDto, UpdateSelectedProjectDto, UpdateProjectDto } from '../types';

// Extended Request type with user
interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

export const projectController = {
  /**
   * GET /api/projects
   * Get all projects for the authenticated user
   */
  async getProjects(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      // Use authenticated user's email as userId
      const userId = request.user?.email || 'guest@example.com';

      console.log('[getProjects] userId:', userId, 'user:', request.user);

      const result = await projectService.getUserProjects(userId);

      const response = {
        projects: result.projects.map(p => ({
          id: p.id,
          name: p.name,
          isDefault: p.isDefault,
          workPhonePrefix: p.workPhonePrefix,
          defaultCountryCode: p.defaultCountryCode,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString()
        })),
        selectedProjectId: result.selectedProjectId
      };

      console.log('[getProjects] Returning response:', JSON.stringify(response, null, 2));

      return reply.send(response);
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to fetch projects' });
    }
  },

  /**
   * POST /api/projects
   * Create a new project
   */
  async createProject(request: FastifyRequest<{ Body: CreateProjectDto }>, reply: FastifyReply) {
    try {
      // Use authenticated user's email as userId
      const userId = (request as AuthenticatedRequest).user?.email || 'guest@example.com';

      const data = request.body;
      const project = await projectService.createProject(userId, data);

      return reply.status(201).send({
        id: project.id,
        name: project.name,
        isDefault: project.isDefault,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString()
      });
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        return reply.status(409).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Failed to create project' });
    }
  },

  /**
   * GET /api/projects/selected
   * Get the currently selected project
   */
  async getSelectedProject(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.email || 'guest@example.com';

      const result = await projectService.getSelectedProject(userId);

      return reply.send({
        projectId: result.projectId,
        project: {
          id: result.project.id,
          name: result.project.name,
          isDefault: result.project.isDefault
        }
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to fetch selected project' });
    }
  },

  /**
   * PUT /api/projects/selected
   * Update the selected project
   */
  async updateSelectedProject(request: FastifyRequest<{ Body: UpdateSelectedProjectDto }>, reply: FastifyReply) {
    try {
      const userId = (request as AuthenticatedRequest).user?.email || 'guest@example.com';

      const data = request.body;
      const result = await projectService.updateSelectedProject(userId, data);

      return reply.send(result);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Failed to update selected project' });
    }
  },

  /**
   * POST /api/projects/ensure-default
   * Ensure user has a default project (called after authentication)
   */
  async ensureDefaultProject(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.email || 'guest@example.com';

      console.log('[ensureDefaultProject] Starting for userId:', userId, 'user:', request.user);

      const project = await projectService.ensureUserDefaultProject(userId);

      console.log('[ensureDefaultProject] Success:', project);

      return reply.send({
        id: project.id,
        name: project.name,
        isDefault: project.isDefault,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString()
      });
    } catch (error: any) {
      console.error('[ensureDefaultProject] Error:', error);
      return reply.status(500).send({ error: error.message || 'Failed to ensure default project' });
    }
  },

  /**
   * PATCH /api/projects/:id
   * Update project settings (phone prefixes)
   */
  async updateProject(request: FastifyRequest<{ Params: { id: string }; Body: UpdateProjectDto }>, reply: FastifyReply) {
    try {
      const userId = (request as AuthenticatedRequest).user?.email || 'guest@example.com';
      const projectId = request.params.id;
      const data = request.body;

      const project = await projectService.updateProject(userId, projectId, data);

      const response = {
        id: project.id,
        name: project.name,
        isDefault: project.isDefault,
        workPhonePrefix: project.workPhonePrefix,
        defaultCountryCode: project.defaultCountryCode,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString()
      };

      console.log('[updateProject] Updated project:', JSON.stringify(response, null, 2));

      return reply.send(response);
    } catch (error: any) {
      if (error.message?.includes('not found') || error.message?.includes('not authorized')) {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Failed to update project' });
    }
  }
};