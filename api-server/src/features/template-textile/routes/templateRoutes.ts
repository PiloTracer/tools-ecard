/**
 * Template Routes
 * API endpoints for template management with multi-mode storage
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { templateController } from '../controllers/templateController';
import { resourceProxyController } from '../controllers/resourceProxyController';
import { requireAuth } from '../../../core/middleware/authMiddleware';
import { requireAppRole } from '../../../core/middleware/requireAppRole';
import { prisma } from '../../../core/prisma/client';

/**
 * Pass 5 — global templates: creating/updating a global (body.global === true)
 * requires an authoritative appsuper/appglobal role check (validate-token).
 * Regular saves pass through untouched.
 */
async function gateGlobalSave(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if ((request.body as any)?.global === true) {
    await requireAppRole(request, reply);
  }
}

/**
 * Deleting a global template (isPublic) requires the same elevated role.
 * Owner-scoped deletes of private templates keep the existing behavior.
 */
async function gateGlobalDelete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as any;
  if (!id) return;
  try {
    const template = await prisma.templateMetadata.findUnique({
      where: { id },
      select: { isPublic: true }
    });
    if (template?.isPublic) {
      await requireAppRole(request, reply);
    }
  } catch {
    // Lookup failed — fall through; the service layer re-enforces ownership
    // and the global immutability flag before deleting.
  }
}

const templateRoutes: FastifyPluginAsync = async (fastify) => {
  // Resource proxy (public read access) - NO AUTH
  fastify.get('/api/v1/template-textile/resource/:bucket/*', resourceProxyController.getResource.bind(resourceProxyController));

  // Apply strict auth middleware to other routes
  fastify.addHook('preHandler', requireAuth);

  // Save or update a template (global saves are role-gated)
  fastify.post(
    '/api/v1/template-textile',
    { preHandler: gateGlobalSave },
    templateController.saveTemplate.bind(templateController)
  );

  // List all templates for authenticated user (includes global templates)
  fastify.get('/api/v1/template-textile', templateController.listTemplates.bind(templateController));

  // Load a specific template by ID (globals load regardless of owner)
  fastify.get('/api/v1/template-textile/:id', templateController.loadTemplate.bind(templateController));

  // Delete a template by ID (global deletes are role-gated)
  fastify.delete(
    '/api/v1/template-textile/:id',
    { preHandler: gateGlobalDelete },
    templateController.deleteTemplate.bind(templateController)
  );

  // Get current storage mode
  fastify.get('/api/v1/template-textile/mode', templateController.getStorageMode.bind(templateController));

  // Upload resources for deduplication
  fastify.post('/api/v1/template-textile/resources', templateController.uploadResources.bind(templateController));
};

export default templateRoutes;
