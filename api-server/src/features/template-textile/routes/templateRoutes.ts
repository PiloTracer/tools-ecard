/**
 * Template Routes
 * API endpoints for template management
 */

import { FastifyPluginAsync } from 'fastify';
import { templateController } from '../controllers/templateController';

const templateRoutes: FastifyPluginAsync = async (fastify) => {
  // Save or update a template
  fastify.post('/api/v1/template-textile', templateController.saveTemplate.bind(templateController));

  // List all templates for authenticated user
  fastify.get('/api/v1/template-textile', templateController.listTemplates.bind(templateController));

  // Load a specific template
  fastify.get('/api/v1/template-textile/:projectName/:templateName', templateController.loadTemplate.bind(templateController));

  // Get template versions
  fastify.get('/api/v1/template-textile/:projectName/:templateName/versions', templateController.getVersions.bind(templateController));

  // Delete a template
  fastify.delete('/api/v1/template-textile/:projectName/:templateName', templateController.deleteTemplate.bind(templateController));
};

export default templateRoutes;