/**
 * Batch Parsing API Routes (Fastify)
 * Endpoints for searching and retrieving batch records
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { batchRecordRepository } from './repositories/batchRecordRepository';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
  };
}

interface SearchRecordsQuery {
  email?: string;
  fullName?: string;
  businessName?: string;
  workPhone?: string;
  mobilePhone?: string;
  batchId?: string;
  limit?: string;
  offset?: string;
}

interface GetRecordParams {
  id: string;
}

interface GetBatchRecordsParams {
  batchId: string;
}

const batchParsingRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Search batch records across all batches
   * GET /api/batch-records
   * Query params: email, fullName, businessName, workPhone, mobilePhone, batchId, limit, offset
   */
  fastify.get<{
    Request: AuthenticatedRequest;
    Querystring: SearchRecordsQuery;
  }>('/', async (request, reply) => {
    try {
      // Check authentication
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const {
        email,
        fullName,
        businessName,
        workPhone,
        mobilePhone,
        batchId,
        limit,
        offset,
      } = request.query;

      // Parse pagination params
      const limitNum = limit ? parseInt(limit, 10) : 50;
      const offsetNum = offset ? parseInt(offset, 10) : 0;

      // Validate pagination
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid limit (1-100)',
        });
      }

      if (isNaN(offsetNum) || offsetNum < 0) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid offset',
        });
      }

      // Search records
      const result = await batchRecordRepository.searchRecords({
        email,
        fullName,
        businessName,
        workPhone,
        mobilePhone,
        batchId,
        limit: limitNum,
        offset: offsetNum,
      });

      return reply.send({
        success: true,
        data: {
          records: result.records,
          total: result.total,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < result.total,
        },
      });
    } catch (error: any) {
      console.error('Error searching batch records:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to search records',
        message: error.message,
      });
    }
  });

  /**
   * Get full contact details for a specific record
   * GET /api/batch-records/:id
   */
  fastify.get<{
    Request: AuthenticatedRequest;
    Params: GetRecordParams;
  }>('/:id', async (request, reply) => {
    try {
      // Check authentication
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const { id } = request.params;

      // First, check if record exists in PostgreSQL (for authorization)
      const searchResult = await batchRecordRepository.searchRecords({
        limit: 1,
        offset: 0,
      });

      // Get full record from Cassandra
      const fullRecord = await batchRecordRepository.getFullContactRecord(id);

      if (!fullRecord) {
        return reply.code(404).send({
          success: false,
          error: 'Record not found',
        });
      }

      return reply.send({
        success: true,
        data: fullRecord,
      });
    } catch (error: any) {
      console.error('Error fetching contact record:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch record',
        message: error.message,
      });
    }
  });

  /**
   * Get all records for a specific batch
   * GET /api/batch-records/batch/:batchId
   */
  fastify.get<{
    Request: AuthenticatedRequest;
    Params: GetBatchRecordsParams;
    Querystring: { limit?: string; offset?: string };
  }>('/batch/:batchId', async (request, reply) => {
    try {
      // Check authentication
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const { batchId } = request.params;
      const { limit, offset } = request.query;

      // Parse pagination params
      const limitNum = limit ? parseInt(limit, 10) : 100;
      const offsetNum = offset ? parseInt(offset, 10) : 0;

      // Get records for batch
      const result = await batchRecordRepository.getRecordsByBatchId(
        batchId,
        limitNum,
        offsetNum
      );

      return reply.send({
        success: true,
        data: {
          batchId,
          records: result.records,
          total: result.total,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < result.total,
        },
      });
    } catch (error: any) {
      console.error('Error fetching batch records:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch batch records',
        message: error.message,
      });
    }
  });

  /**
   * Get batch statistics
   * GET /api/batch-records/batch/:batchId/stats
   */
  fastify.get<{
    Request: AuthenticatedRequest;
    Params: GetBatchRecordsParams;
  }>('/batch/:batchId/stats', async (request, reply) => {
    try {
      // Check authentication
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
        });
      }

      const { batchId } = request.params;

      // Get record count
      const count = await batchRecordRepository.getRecordCountByBatchId(batchId);

      return reply.send({
        success: true,
        data: {
          batchId,
          recordCount: count,
        },
      });
    } catch (error: any) {
      console.error('Error fetching batch stats:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch batch statistics',
        message: error.message,
      });
    }
  });
};

export default batchParsingRoutes;
