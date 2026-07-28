/**
 * Limits API — exposes resolved per-user caps to the frontend.
 */

import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../../core/middleware/authMiddleware';

const limitsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/batch-records', async (request, reply) => {
    const user = request.user!;
    return reply.send({
      success: true,
      data: {
        limit: user.batchRecordLimit,
        unlimited: user.batchRecordLimitUnlimited,
      },
    });
  });
};

export default limitsRoutes;
