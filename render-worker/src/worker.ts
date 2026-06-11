/**
 * Render worker entry point
 */

import { Worker } from 'bullmq';
import { workerConfig } from './core/config';
import { processRenderCard } from './jobs/render-card';
import { connectDatabase, disconnectDatabase } from './core/database';

const connection = {
  host: workerConfig.redis.host,
  port: workerConfig.redis.port,
};

async function start() {
  // Connect to database
  await connectDatabase();
  // Create worker
  const worker = new Worker(
    'card-rendering',
    async (job) => {
      try {
        await processRenderCard(job);
      } catch (error) {
        console.error('Render job failed:', error);
        throw error; // Let BullMQ handle retries
      }
    },
    {
      connection,
      concurrency: workerConfig.worker.concurrency,
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  );

  worker.on('ready', () => {
    console.log(
      `Render worker ready (env=${workerConfig.env}, concurrency=${workerConfig.worker.concurrency})`
    );
  });

  worker.on('failed', (job, error) => {
    console.error(`Render job failed: ${job?.id}`, error.message);
  });

  worker.on('error', (error) => {
    console.error('Render worker error:', error);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down render worker...`);
    await worker.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error('Failed to start render worker:', error);
  process.exit(1);
});
