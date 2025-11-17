/**
 * Fastify application setup
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import { appConfig } from './core/config';
import { errorHandler } from './core/middleware/errorHandler';
import { authMiddleware } from './core/middleware/authMiddleware';

// Feature routes
import { projectRoutes } from './features/simple-projects/routes';
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
        console.warn(`CORS: Unexpected origin ${origin}`);
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
