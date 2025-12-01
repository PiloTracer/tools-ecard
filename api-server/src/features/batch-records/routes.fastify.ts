/**
 * Batch Records Routes (Fastify)
 * API endpoints for viewing and editing batch records
 */

import { FastifyPluginAsync } from 'fastify';
import { batchRecordController } from './controllers/batchRecordController';

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
};

export default batchRecordRoutes;
