import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { projectController } from './controllers/projectController';

export async function projectRoutes(app: FastifyInstance, opts: FastifyPluginOptions) {
  // GET /api/projects - Get all user projects
  app.get('/', {
    handler: projectController.getProjects
  });

  // POST /api/projects - Create new project
  app.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            pattern: '^[a-zA-Z0-9\\s\\-_]+$'
          }
        }
      }
    },
    handler: projectController.createProject
  });

  // GET /api/projects/selected - Get selected project
  app.get('/selected', {
    handler: projectController.getSelectedProject
  });

  // PUT /api/projects/selected - Update selected project
  app.put('/selected', {
    schema: {
      body: {
        type: 'object',
        required: ['projectId'],
        properties: {
          projectId: {
            type: 'string',
            format: 'uuid'
          }
        }
      }
    },
    handler: projectController.updateSelectedProject
  });

  // POST /api/projects/ensure-default - Ensure default project exists
  app.post('/ensure-default', {
    handler: projectController.ensureDefaultProject
  });
}