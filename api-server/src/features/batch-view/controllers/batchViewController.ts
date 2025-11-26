/**
 * Batch View Controller
 * HTTP request handlers for batch viewing endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { batchViewService } from '../services/batchViewService';
import { BatchStatus } from '@prisma/client';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
  };
}

interface ListBatchesQuery {
  page?: string;
  pageSize?: string;
  status?: BatchStatus;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

interface GetBatchParams {
  batchId: string;
}

export class BatchViewController {
  /**
   * GET /api/batches
   * List batches for authenticated user
   */
  async listBatches(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const query = request.query as ListBatchesQuery;
      const page = query.page ? parseInt(query.page, 10) : 1;
      const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 20;

      // Validate pagination
      if (isNaN(page) || page < 1) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid page number',
        });
      }

      if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid page size (1-100)',
        });
      }

      const result = await batchViewService.listBatches(request.user.id, {
        page,
        pageSize,
        filters: {
          status: query.status,
          search: query.search,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
        },
      });

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error listing batches:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to list batches',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/batches/:batchId
   * Get single batch details
   */
  async getBatch(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const { batchId } = request.params as GetBatchParams;

      const batch = await batchViewService.getBatchById(batchId, request.user.id);

      return reply.send({
        success: true,
        data: batch,
      });
    } catch (error: any) {
      console.error('Error getting batch:', error);

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          error: 'Batch not found',
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Failed to get batch',
        message: error.message,
      });
    }
  }

  /**
   * DELETE /api/batches/:batchId
   * Delete batch and all associated records
   */
  async deleteBatch(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const { batchId } = request.params as GetBatchParams;

      const result = await batchViewService.deleteBatch(batchId, request.user.id);

      return reply.send({
        success: true,
        data: result,
        message: `Batch deleted successfully. ${result.deletedRecordsCount} records removed.`,
      });
    } catch (error: any) {
      console.error('Error deleting batch:', error);

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          error: 'Batch not found',
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Failed to delete batch',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/batches/stats
   * Get batch statistics for user
   */
  async getBatchStats(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const stats = await batchViewService.getBatchStats(request.user.id);

      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Error getting batch stats:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get batch statistics',
        message: error.message,
      });
    }
  }
}

// Export singleton instance
export const batchViewController = new BatchViewController();
