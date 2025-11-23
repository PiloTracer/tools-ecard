import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { batchImportService } from './services/batchImportService';
import { BatchImportError } from './types';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
  };
}

const batchImportRoutes: FastifyPluginAsync = async (fastify) => {
  // Import a batch file (initiate processing)
  fastify.post<{
    Params: { id: string };
    Body: {
      mappings?: any[];
      options?: any;
    };
    Request: AuthenticatedRequest;
  }>('/:id/import', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchImportError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const { id: batchId } = request.params;
      const { mappings, options } = request.body;

      const result = await batchImportService.importBatch({
        batchId,
        mappings,
        options,
      });

      return reply.send({
        success: true,
        data: result,
        message: 'Batch import initiated (placeholder)',
      });
    } catch (error) {
      if (error instanceof BatchImportError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  });

  // Get import preview
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string };
    Request: AuthenticatedRequest;
  }>('/:id/preview', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchImportError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const { id: batchId } = request.params;
      const limit = parseInt(request.query.limit || '5', 10);

      const preview = await batchImportService.getImportPreview(batchId, limit);

      return reply.send({
        success: true,
        data: {
          batchId,
          records: preview,
          total: preview.length,
        },
        message: 'Preview generated (placeholder)',
      });
    } catch (error) {
      if (error instanceof BatchImportError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  });

  // Get field mapping suggestions
  fastify.get<{
    Params: { id: string };
    Request: AuthenticatedRequest;
  }>('/:id/mappings/suggest', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchImportError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const { id: batchId } = request.params;

      const suggestions = await batchImportService.getFieldMappingSuggestions(batchId);

      return reply.send({
        success: true,
        data: {
          batchId,
          suggestions,
        },
        message: 'Mapping suggestions generated (placeholder)',
      });
    } catch (error) {
      if (error instanceof BatchImportError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  });

  // Validate import data
  fastify.post<{
    Params: { id: string };
    Body: { records?: any[] };
    Request: AuthenticatedRequest;
  }>('/:id/validate', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchImportError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const { id: batchId } = request.params;
      const { records } = request.body;

      const errors = await batchImportService.validateRecords(records || []);

      return reply.send({
        success: true,
        data: {
          batchId,
          valid: errors.length === 0,
          errors,
        },
        message: 'Validation complete (placeholder)',
      });
    } catch (error) {
      if (error instanceof BatchImportError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  });

  // Get import status
  fastify.get<{
    Params: { id: string };
    Request: AuthenticatedRequest;
  }>('/:id/status', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchImportError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const { id: batchId } = request.params;

      return reply.send({
        success: true,
        data: {
          batchId,
          status: 'pending',
          progress: 0,
          recordsProcessed: 0,
          recordsImported: 0,
          recordsFailed: 0,
        },
        message: 'Import status retrieved (placeholder)',
      });
    } catch (error) {
      if (error instanceof BatchImportError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  });

  // Cancel import
  fastify.post<{
    Params: { id: string };
    Request: AuthenticatedRequest;
  }>('/:id/cancel', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchImportError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const { id: batchId } = request.params;

      return reply.send({
        success: true,
        data: {
          batchId,
          cancelled: true,
        },
        message: 'Import cancelled (placeholder)',
      });
    } catch (error) {
      if (error instanceof BatchImportError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  });
};

export { batchImportRoutes };