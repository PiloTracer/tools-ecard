/**
 * Font Management Routes
 * API endpoints for font operations
 */

import { FastifyPluginAsync } from 'fastify';
import { fontController } from '../controllers/fontController';
import { authMiddleware } from '../../../core/middleware/authMiddleware';

const fontRoutes: FastifyPluginAsync = async (fastify) => {
  // Public endpoint for font files (needed for @font-face CSS)
  // No authentication required
  fastify.get('/api/v1/fonts/:fontId/file', fontController.getFontFile.bind(fontController));

  // Protected endpoints (require authentication)
  fastify.addHook('preHandler', authMiddleware);

  // List fonts available to the user
  fastify.get('/api/v1/fonts', fontController.listFonts.bind(fontController));

  // Upload a custom font
  fastify.post('/api/v1/fonts', fontController.uploadFont.bind(fontController));

  // Delete a custom font
  fastify.delete('/api/v1/fonts/:fontId', fontController.deleteFont.bind(fontController));
};

export default fontRoutes;
