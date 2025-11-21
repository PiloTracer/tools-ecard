/**
 * Template Routes
 * API endpoints for template management with multi-mode storage
 */

import { FastifyPluginAsync } from 'fastify';
import { templateController } from '../controllers/templateController';
import { authMiddleware } from '../../../core/middleware/authMiddleware';

const templateRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply auth middleware to all routes
  fastify.addHook('preHandler', authMiddleware);

  // Save or update a template
  fastify.post('/api/v1/template-textile', templateController.saveTemplate.bind(templateController));

  // List all templates for authenticated user
  fastify.get('/api/v1/template-textile', templateController.listTemplates.bind(templateController));

  // Load a specific template by ID
  fastify.get('/api/v1/template-textile/:id', templateController.loadTemplate.bind(templateController));

  // Delete a template by ID
  fastify.delete('/api/v1/template-textile/:id', templateController.deleteTemplate.bind(templateController));

  // Get current storage mode
  fastify.get('/api/v1/template-textile/mode', templateController.getStorageMode.bind(templateController));

  // Upload resources for deduplication
  fastify.post('/api/v1/template-textile/resources', templateController.uploadResources.bind(templateController));
};

export default templateRoutes;