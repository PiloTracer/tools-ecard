/**
 * Batch Record Controller
 * HTTP request handlers for batch record endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { batchRecordService } from '../services/batchRecordService';
import { RecordUpdateInput } from '../validators/recordValidator';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
  };
}

interface GetRecordsQuery {
  page?: string;
  pageSize?: string;
  search?: string;
}

interface GetRecordParams {
  batchId: string;
  recordId?: string;
}

export class BatchRecordController {
  /**
   * GET /api/batches/:batchId/records
   * Get all records for a batch
   */
  async getRecordsForBatch(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const { batchId } = request.params as GetRecordParams;
      const query = request.query as GetRecordsQuery;

      const page = query.page ? parseInt(query.page, 10) : 1;
      const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 50;

      // Validate pagination
      if (isNaN(page) || page < 1) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid page number',
        });
      }

      if (isNaN(pageSize) || pageSize < 1 || pageSize > 500) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid page size (1-500)',
        });
      }

      const result = await batchRecordService.getRecordsForBatch(batchId, request.user.id, {
        page,
        pageSize,
        search: query.search,
      });

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error getting records for batch:', error);

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.code(404).send({
          success: false,
          error: 'Batch not found or access denied',
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Failed to get batch records',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/batches/:batchId/records/:recordId
   * Get single record details
   */
  async getRecord(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const { recordId } = request.params as GetRecordParams;

      const record = await batchRecordService.getRecordById(recordId!, request.user.id);

      return reply.send({
        success: true,
        data: record,
      });
    } catch (error: any) {
      console.error('Error getting record:', error);

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.code(404).send({
          success: false,
          error: 'Record not found or access denied',
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Failed to get record',
        message: error.message,
      });
    }
  }

  /**
   * PUT /api/batches/:batchId/records/:recordId
   * Update record
   */
  async updateRecord(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const { recordId } = request.params as GetRecordParams;
      const updates = request.body as RecordUpdateInput;

      const updatedRecord = await batchRecordService.updateRecord(
        recordId!,
        updates,
        request.user.id
      );

      return reply.send({
        success: true,
        data: updatedRecord,
        message: 'Record updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating record:', error);

      if (error.message.includes('not found') || error.message.includes('Unauthorized')) {
        return reply.code(404).send({
          success: false,
          error: 'Record not found or access denied',
        });
      }

      if (error.message.includes('Validation failed')) {
        return reply.code(400).send({
          success: false,
          error: 'Validation failed',
          message: error.message,
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Failed to update record',
        message: error.message,
      });
    }
  }

  /**
   * DELETE /api/batches/:batchId/records/:recordId
   * Delete record
   */
  async deleteRecord(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const { recordId } = request.params as GetRecordParams;

      await batchRecordService.deleteRecord(recordId!, request.user.id);

      return reply.send({
        success: true,
        message: 'Record deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting record:', error);

      if (error.message.includes('not found') || error.message.includes('Unauthorized')) {
        return reply.code(404).send({
          success: false,
          error: 'Record not found or access denied',
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Failed to delete record',
        message: error.message,
      });
    }
  }
}

// Export singleton instance
export const batchRecordController = new BatchRecordController();
