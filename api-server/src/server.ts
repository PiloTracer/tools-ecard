/**
 * API Server entry point
 */

import './debugEnv';

import { buildApp } from './app';
import { appConfig } from './core/config';
import { connectCassandra, disconnectCassandra } from './core/database/cassandra';
import { disconnectRedis } from './core/database/redis';
import { prisma } from './core/database/prisma';
import { initializeDatabase } from './core/database/init';
import { initCassandraSchema } from './core/cassandra/init';
import { batchParsingWorker } from './features/batch-parsing';
import { loadGoogleFonts } from './features/font-management/startup/loadGoogleFonts';
import { createLogger, serializeError } from './core/utils/logger';
import {
  ensureAppLibraryStorageIntegrationReady,
  isAppLibraryStorageIntegrationEnabled,
} from './core/storage';

const log = createLogger('Server');

async function start() {
  try {
    // Load Tools Dashboard storage metadata before routes/plugins run (public URL resolution uses cache).
    if (isAppLibraryStorageIntegrationEnabled()) {
      log.info('Loading Tools Dashboard app-library storage integration');
      try {
        await ensureAppLibraryStorageIntegrationReady();
      } catch (error) {
        if (appConfig.env === 'production') {
          throw error;
        }
        log.warn(
          { err: serializeError(error) },
          'App library storage integration unavailable at startup; continuing without dashboard public URLs (development only). Fix TOOLS_DASHBOARD_ORIGIN / key or clear APP_LIBRARY_STORAGE_INTEGRATION_KEY, then restart api-server.',
        );
      }
    }

    // Build Fastify app
    const app = await buildApp();

    // Initialize database (runs migrations and creates tables if needed)
    log.info('Initializing database');
    await initializeDatabase();

    // Connect to databases
    log.info('Connecting to databases');

    // Connect to PostgreSQL via Prisma (already connected in initializeDatabase)
    log.info('Connected to PostgreSQL');

    // Initialize Cassandra schema (auto-creates if not exists)
    await initCassandraSchema();

    await connectCassandra();

    // Start batch parsing worker
    log.info('Starting batch parsing worker');
    await batchParsingWorker.start();

    // Start server
    await app.listen({
      port: appConfig.port,
      host: '0.0.0.0',
    });

    log.info({
      port: appConfig.port,
      env: appConfig.env,
      healthCheck: `http://localhost:${appConfig.port}/health`
    }, 'API Server started');

    // Load Google Fonts in background (don't block startup)
    loadGoogleFonts().catch(err => {
      log.error({ error: err }, 'Failed to load Google Fonts');
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      log.info({ signal }, 'Shutdown signal received, shutting down gracefully');

      // Stop batch parsing worker
      await batchParsingWorker.stop();

      // Close server
      await app.close();

      // Close database connections
      await prisma.$disconnect();
      await disconnectCassandra();
      await disconnectRedis();

      log.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    log.error({ err: serializeError(error) }, 'Failed to start server');
    process.exit(1);
  }
}

start();
