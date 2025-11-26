/**
 * Batch View Routes (Fastify)
 * API endpoints for viewing and managing batches
 */

import { FastifyPluginAsync } from 'fastify';
import { batchViewController } from './controllers/batchViewController';

const batchViewRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/batches/stats
   * Get batch statistics for authenticated user
   */
  fastify.get('/stats', batchViewController.getBatchStats.bind(batchViewController));

  /**
   * GET /api/batches
   * List batches with pagination and filters
   */
  fastify.get('/', batchViewController.listBatches.bind(batchViewController));

  /**
   * GET /api/batches/:batchId
   * Get single batch details
   */
  fastify.get('/:batchId', batchViewController.getBatch.bind(batchViewController));

  /**
   * DELETE /api/batches/:batchId
   * Delete batch and all associated records
   */
  fastify.delete('/:batchId', batchViewController.deleteBatch.bind(batchViewController));
};

export default batchViewRoutes;
