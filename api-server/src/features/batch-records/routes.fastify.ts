/**
 * Batch Records Routes (Fastify)
 * API endpoints for viewing and editing batch records
 */

import { FastifyPluginAsync } from 'fastify';
import { Queue } from 'bullmq';
import { batchRecordController } from './controllers/batchRecordController';

const RENDER_QUEUE_NAME = 'card-rendering';

let renderQueue: Queue | null = null;

function getRenderQueue(): Queue {
  if (!renderQueue) {
    renderQueue = new Queue(RENDER_QUEUE_NAME, {
      connection: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    });
  }
  return renderQueue;
}

const batchRecordRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/batches/:batchId/records
   * Get all records for a batch
   */
  fastify.get('/', batchRecordController.getRecordsForBatch.bind(batchRecordController));

  /**
   * GET /api/batches/:batchId/records/:recordId
   * Get single record details
   */
  fastify.get('/:recordId', batchRecordController.getRecord.bind(batchRecordController));

  /**
   * PUT /api/batches/:batchId/records/:recordId
   * Update record
   */
  fastify.put('/:recordId', batchRecordController.updateRecord.bind(batchRecordController));

  /**
   * DELETE /api/batches/:batchId/records/:recordId
   * Delete record
   */
  fastify.delete('/:recordId', batchRecordController.deleteRecord.bind(batchRecordController));

  /**
   * GET /api/batches/:batchId/records/:recordId/render-status
   * Get render job progress for a record
   */
  fastify.get('/:recordId/render-status', async (request, reply) => {
    const { recordId } = request.params as { recordId: string };

    try {
      const queue = getRenderQueue();
      // BullMQ jobs can be found by ID — use recordId as jobId
      const job = await queue.getJob(recordId);

      if (!job) {
        return reply.send({
          success: true,
          data: {
            recordId,
            status: 'not_found',
            progress: 0,
            message: 'No render job found for this record',
          },
        });
      }

      const state = await job.getState();

      return reply.send({
        success: true,
        data: {
          recordId,
          jobId: job.id,
          status: state,
          progress: job.progress,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: 'Failed to get render status',
        message: error.message,
      });
    }
  });
};

export default batchRecordRoutes;
