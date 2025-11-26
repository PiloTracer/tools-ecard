/**
 * Diagnostic Routes for Batch Parsing
 * Helps troubleshoot queue and worker issues
 */

import { FastifyPluginAsync } from 'fastify';
import { queueService } from '../../batch-upload/services/queueService';
import { batchParsingWorker } from '../services/workerService';

const diagnosticRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Get queue statistics
   * GET /api/diagnostics/queue-stats
   */
  fastify.get('/queue-stats', async (request, reply) => {
    try {
      const queueStats = await queueService.getQueueStats();
      const workerStats = await batchParsingWorker.getWorkerStats();

      return reply.send({
        success: true,
        data: {
          queue: queueStats,
          worker: workerStats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('Error getting queue stats:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get queue stats',
        message: error.message
      });
    }
  });

  /**
   * Get Redis connection status
   * GET /api/diagnostics/redis-status
   */
  fastify.get('/redis-status', async (request, reply) => {
    try {
      // Try to get queue stats which requires Redis connection
      await queueService.getQueueStats();

      return reply.send({
        success: true,
        data: {
          connected: true,
          host: process.env.REDIS_HOST || 'redis',
          port: parseInt(process.env.REDIS_PORT || '6379', 10)
        }
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        data: {
          connected: false,
          error: error.message
        }
      });
    }
  });
};

export default diagnosticRoutes;
