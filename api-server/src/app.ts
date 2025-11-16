/**
 * Fastify application setup
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { appConfig } from './core/config';
import { errorHandler } from './core/middleware/errorHandler';

// MOCK: Feature routes (will be implemented)
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
    origin: true, // TODO [backend]: Configure CORS properly for production
  });

  await app.register(websocket);

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

  // TODO [backend]: Register feature routes
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
