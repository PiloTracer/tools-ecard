import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { batchImportService } from './services/batchImportService';
import { FieldMappingValidationError } from './services/fieldMapping';
import { BatchImportError } from './types';
import type { AuthenticatedUser } from '../../core/middleware/authMiddleware';

interface AuthenticatedRequest extends FastifyRequest {
  user?: AuthenticatedUser;
}

/** Map known domain errors onto HTTP responses (shared by all handlers below). */
function handleRouteError(error: unknown, reply: FastifyReply) {
  if (error instanceof BatchImportError) {
    return reply.code(error.statusCode).send({
      error: error.message,
      code: error.code,
    });
  }
  if (error instanceof FieldMappingValidationError) {
    return reply.code(400).send({
      error: error.message,
      code: 'INVALID_MAPPING',
    });
  }
  throw error;
}

const batchImportRoutes: FastifyPluginAsync = async (fastify) => {
  // Preview an uploaded file's columns BEFORE a batch exists (Pass 3): runs the
  // Python parser's --inspect mode and suggests a saved preset on signature match.
  fastify.post('/preview', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchImportError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      let fileName: string | null = null;
      let buffer: Buffer | null = null;
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          buffer = await part.toBuffer();
          fileName = part.filename;
        }
      }

      if (!buffer || !fileName) {
        throw new BatchImportError('No file provided', 'NO_FILE', 400);
      }

      const preview = await batchImportService.previewFile(
        request.user.id,
        fileName,
        buffer
      );

      return reply.send({ success: true, data: preview });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // List the caller's saved mapping presets (strictly per-user)
  fastify.get('/mappings/presets', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchImportError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const presets = await batchImportService.listPresets(request.user.id);
      return reply.send({ success: true, data: presets });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Save a mapping preset (signature computed server-side from source columns)
  fastify.post<{
    Body: { name?: string; mapping?: unknown };
  }>('/mappings/presets', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchImportError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      const { name, mapping } = request.body ?? {};
      const preset = await batchImportService.createPreset(
        request.user.id,
        name ?? '',
        mapping
      );
      return reply.code(201).send({ success: true, data: preset });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Delete one of the caller's presets
  fastify.delete<{
    Params: { id: string };
  }>('/mappings/presets/:id', async (request, reply) => {
    try {
      if (!request.user) {
        throw new BatchImportError(
          'Authentication required',
          'UNAUTHORIZED',
          401
        );
      }

      await batchImportService.deletePreset(request.user.id, request.params.id);
      return reply.code(204).send();
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

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
        message: `Batch import complete: ${result.recordsImported} imported, ${result.recordsFailed} failed`,
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