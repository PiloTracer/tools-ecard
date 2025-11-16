/**
 * Global error handler middleware
 */

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log error
  console.error('Error:', {
    method: request.method,
    url: request.url,
    error: error.message,
    stack: error.stack,
  });

  // Send error response
  reply.status(error.statusCode || 500).send({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
    },
  });
}
