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
   * POST /api/batches/:batchId/records/:recordId/render-retry
   * Re-queue a failed (or missing) render job for one record.
   */
  fastify.post<{
    Params: { batchId: string; recordId: string };
    Body: { templateId?: string; width?: number; height?: number };
  }>('/:recordId/render-retry', async (request, reply) => {
    const { batchId, recordId } = request.params;
    const { templateId, width, height } = request.body ?? {};

    if (!templateId || typeof templateId !== 'string' || !templateId.trim()) {
      return reply.code(400).send({
        success: false,
        error: 'templateId is required in the request body',
      });
    }

    try {
      const queue = getRenderQueue();
      const existing = await queue.getJob(recordId);

      if (existing) {
        const state = await existing.getState();
        if (state === 'active' || state === 'waiting' || state === 'delayed') {
          return reply.code(409).send({
            success: false,
            error: 'Render job already in progress for this record',
          });
        }
        await existing.remove();
      }

      const job = await queue.add(
        'render-card',
        {
          templateId: templateId.trim(),
          recordId,
          batchId,
          width,
          height,
        },
        {
          jobId: recordId,
          removeOnComplete: 100,
          removeOnFail: 50,
        }
      );

      return reply.send({
        success: true,
        data: {
          recordId,
          jobId: job.id,
          status: 'queued',
        },
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: 'Failed to queue render retry',
        message: error.message,
      });
    }
  });

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
      const jobData = job.data as { storageUrl?: string; storageKey?: string };

      return reply.send({
        success: true,
        data: {
          recordId,
          jobId: job.id,
          status: state,
          progress: job.progress,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason,
          storageUrl: jobData.storageUrl ?? null,
          storageKey: jobData.storageKey ?? null,
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
