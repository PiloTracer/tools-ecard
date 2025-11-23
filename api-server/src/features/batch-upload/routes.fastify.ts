import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { MultipartFile } from '@fastify/multipart';
import { batchUploadService } from './services/batchUploadService';
import {
  uploadFileSchema,
  getBatchStatusSchema,
  listBatchesSchema,
  deleteBatchSchema,
} from './validators/batchValidators';
import { BatchUploadError } from './types';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
  };
}

const batchUploadRoutes: FastifyPluginAsync = async (fastify) => {
  // Upload a new batch file
  fastify.post<{
    Request: AuthenticatedRequest;
  }>('/upload', async (request, reply) => {
    try {
      // Check authentication
      if (!request.user) {
        throw new BatchUploadError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      // Get the uploaded file
      const data = await request.file();

      if (!data) {
        throw new BatchUploadError(
          'No file provided',
          'NO_FILE',
          400
        );
      }

      // Convert multipart file to Express-like format for compatibility
      const buffer = await data.toBuffer();
      const file = {
        fieldname: data.fieldname,
        originalname: data.filename,
        encoding: data.encoding,
        mimetype: data.mimetype,
        size: buffer.length,
        buffer: buffer,
      } as Express.Multer.File;

      // Validate file
      const validation = uploadFileSchema.safeParse({ file });

      if (!validation.success) {
        const errors = validation.error.errors.map((e) => e.message).join(', ');
        throw new BatchUploadError(errors, 'VALIDATION_ERROR', 400);
      }

      // Upload batch
      const result = await batchUploadService.uploadBatch({
        file,
        userId: request.user.id,
        userEmail: request.user.email,
      });

      return reply.code(201).send(result);
    } catch (error) {
      if (error instanceof BatchUploadError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  });

  // Get batch status
  fastify.get<{
    Params: { id: string };
    Request: AuthenticatedRequest;
  }>('/:id/status', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchUploadError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const validation = getBatchStatusSchema.safeParse({
        params: request.params,
      });

      if (!validation.success) {
        const errors = validation.error.errors.map((e) => e.message).join(', ');
        throw new BatchUploadError(errors, 'VALIDATION_ERROR', 400);
      }

      const result = await batchUploadService.getBatchStatus(
        request.user.id,
        request.params.id
      );

      return reply.send(result);
    } catch (error) {
      if (error instanceof BatchUploadError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  });

  // List user's batches
  fastify.get<{
    Querystring: {
      status?: string;
      page?: string;
      limit?: string;
    };
    Request: AuthenticatedRequest;
  }>('/', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchUploadError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const validation = listBatchesSchema.safeParse({
        query: request.query,
      });

      if (!validation.success) {
        const errors = validation.error.errors.map((e) => e.message).join(', ');
        throw new BatchUploadError(errors, 'VALIDATION_ERROR', 400);
      }

      const query = validation.data.query || {};
      const result = await batchUploadService.listUserBatches(
        request.user.id,
        query
      );

      return reply.send(result);
    } catch (error) {
      if (error instanceof BatchUploadError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  });

  // Delete a batch
  fastify.delete<{
    Params: { id: string };
    Request: AuthenticatedRequest;
  }>('/:id', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchUploadError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const validation = deleteBatchSchema.safeParse({
        params: request.params,
      });

      if (!validation.success) {
        const errors = validation.error.errors.map((e) => e.message).join(', ');
        throw new BatchUploadError(errors, 'VALIDATION_ERROR', 400);
      }

      await batchUploadService.deleteBatch(request.user.id, request.params.id);

      return reply.code(204).send();
    } catch (error) {
      if (error instanceof BatchUploadError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  });

  // Retry a failed batch
  fastify.post<{
    Params: { id: string };
    Request: AuthenticatedRequest;
  }>('/:id/retry', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchUploadError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const validation = getBatchStatusSchema.safeParse({
        params: request.params,
      });

      if (!validation.success) {
        const errors = validation.error.errors.map((e) => e.message).join(', ');
        throw new BatchUploadError(errors, 'VALIDATION_ERROR', 400);
      }

      const result = await batchUploadService.retryBatch(
        request.user.id,
        request.params.id
      );

      return reply.send(result);
    } catch (error) {
      if (error instanceof BatchUploadError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  });

  // Get batch statistics
  fastify.get<{
    Request: AuthenticatedRequest;
  }>('/stats', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchUploadError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const stats = await batchUploadService.getBatchStats(request.user.id);

      return reply.send(stats);
    } catch (error) {
      if (error instanceof BatchUploadError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  });

  // Get recent batches
  fastify.get<{
    Querystring: { limit?: string };
    Request: AuthenticatedRequest;
  }>('/recent', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchUploadError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const limit = parseInt(request.query.limit || '5', 10);
      const batches = await batchUploadService.getRecentBatches(
        request.user.id,
        limit
      );

      return reply.send(batches);
    } catch (error) {
      if (error instanceof BatchUploadError) {
        return reply.code(error.statusCode).send({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  });
};

export { batchUploadRoutes };