/**
 * API Server entry point
 */

import { buildApp } from './app';
import { appConfig } from './core/config';
import { connectCassandra, disconnectCassandra } from './core/database/cassandra';
import { disconnectRedis } from './core/database/redis';
import { prisma } from './core/database/prisma';

async function start() {
  try {
    // Build Fastify app
    const app = await buildApp();

    // Connect to databases
    console.log('🔌 Connecting to databases...');

    // TODO [backend]: Uncomment when Prisma schema is ready
    // await prisma.$connect();
    // console.log('✅ Connected to PostgreSQL');

    await connectCassandra();

    // Start server
    await app.listen({
      port: appConfig.port,
      host: '0.0.0.0',
    });

    console.log(`🚀 API Server running on http://localhost:${appConfig.port}`);
    console.log(`📊 Environment: ${appConfig.env}`);
    console.log(`🏥 Health check: http://localhost:${appConfig.port}/health`);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received, shutting down gracefully...`);

      // Close server
      await app.close();

      // Close database connections
      // await prisma.$disconnect();
      await disconnectCassandra();
      await disconnectRedis();

      console.log('✅ Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
