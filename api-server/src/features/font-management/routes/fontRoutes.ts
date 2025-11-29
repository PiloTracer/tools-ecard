/**
 * Font Management Routes
 * API endpoints for font operations
 */

import { FastifyPluginAsync } from 'fastify';
import { fontController } from '../controllers/fontController';
import { authMiddleware } from '../../../core/middleware/authMiddleware';

const fontRoutes: FastifyPluginAsync = async (fastify) => {
  // Font file endpoint with optional authentication
  // Public for @font-face CSS, but auth-aware for user fonts
  fastify.get('/api/v1/fonts/:fontId/file', {
    preHandler: authMiddleware, // Optional auth - populates request.user if token exists
  }, fontController.getFontFile.bind(fontController));

  // List fonts - public endpoint (returns global fonts for unauthenticated users)
  // Authentication is optional - authenticated users see their custom fonts too
  fastify.get('/api/v1/fonts', {
    preHandler: authMiddleware, // Optional auth - populates request.user if token exists
  }, fontController.listFonts.bind(fontController));

  // Protected endpoints (require authentication)
  fastify.addHook('preHandler', authMiddleware);

  // Upload a custom font
  fastify.post('/api/v1/fonts', fontController.uploadFont.bind(fontController));

  // Delete a custom font
  fastify.delete('/api/v1/fonts/:fontId', fontController.deleteFont.bind(fontController));
};

export default fontRoutes;
