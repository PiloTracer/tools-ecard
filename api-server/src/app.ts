/**
 * Fastify application setup
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { appConfig } from './core/config';
import { errorHandler } from './core/middleware/errorHandler';
import { authMiddleware } from './core/middleware/authMiddleware';
import { createLogger } from './core/utils/logger';

const log = createLogger('App');

// Feature routes
import { projectRoutes } from './features/simple-projects/routes';
import { s3Routes, initializeS3Feature } from './features/s3-bucket';
import { templateRoutes } from './features/template-textile';
import { batchUploadRoutes as batchUploadRoutesFastify } from './features/batch-upload/routes.fastify';
import batchParsingRoutes from './features/batch-parsing/routes.fastify';
import diagnosticRoutes from './features/batch-parsing/routes/diagnostics.fastify';
import batchRecordRoutes from './features/batch-records/routes.fastify';
import fontRoutes from './features/font-management/routes/fontRoutes';
// import { templateRoutes } from './features/templates/routes';
// import { batchRoutes } from './features/batches/routes';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: appConfig.env === 'development' ? 'info' : 'warn',
    },
  });

  // Register plugins
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests from the frontend development server
      const allowedOrigins = [
        'http://localhost:7300',
        'http://localhost:3000',
        'http://127.0.0.1:7300',
        'http://127.0.0.1:3000',
      ];

      // In development, allow the origin if it's in our allowed list
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else if (appConfig.env === 'development') {
        // In development, be more permissive but log unexpected origins
        log.warn({ origin }, 'CORS: Unexpected origin');
        cb(null, true);
      } else {
        // In production, be strict
        cb(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow cookies and credentials
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  });

  await app.register(cookie);
  await app.register(websocket);

  // Register multipart support for file uploads
  await app.register(multipart, {
    limits: {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 100,     // Max field value size in bytes
      fields: 10,         // Max number of non-file fields
      fileSize: 104857600, // Max file size (100MB)
      files: 1,           // Max number of file fields
      headerPairs: 2000   // Max number of header key-value pairs
    }
  });

  // Register auth middleware globally
  app.addHook('preHandler', authMiddleware);

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: appConfig.env,
    };
  });

  // API v1 routes
  app.get('/api/v1', async () => {
    return {
      message: 'E-Cards API v1',
      version: '1.0.0',
    };
  });

  // Register feature routes
  app.register(projectRoutes, { prefix: '/api/v1/projects' });

  // Register S3 routes (already prefixed in route definitions)
  await app.register(s3Routes);

  // Initialize S3 buckets on startup
  await initializeS3Feature();

  // Register template-textile routes (already prefixed in route definitions)
  await app.register(templateRoutes);

  // Register batch-upload routes (includes list, upload, status, delete, stats)
  await app.register(batchUploadRoutesFastify, { prefix: '/api/batches' });

  // Register batch-parsing routes (record search and retrieval)
  await app.register(batchParsingRoutes, { prefix: '/api/batch-records' });

  // Register batch-records routes (view and edit records for a batch)
  app.register(async (fastify) => {
    fastify.register(batchRecordRoutes, { prefix: '/:batchId/records' });
  }, { prefix: '/api/batches' });

  // Register diagnostic routes (queue/worker monitoring)
  await app.register(diagnosticRoutes, { prefix: '/api/diagnostics' });

  // Register font-management routes (already prefixed in route definitions)
  await app.register(fontRoutes);

  // app.register(templateRoutes, { prefix: '/api/v1/templates' });
  // app.register(batchRoutes, { prefix: '/api/v1/batches' });

  // MOCK: Example route
  app.get('/api/v1/mock', async () => {
    // MOCK: Simulate delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      success: true,
      data: {
        message: 'This is a mock endpoint',
        features: [
          'templates',
          'batches',
          'rendering',
        ],
      },
    };
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  return app;
}
