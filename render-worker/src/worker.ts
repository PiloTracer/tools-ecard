/**
 * Render worker entry point
 */

import { Worker } from 'bullmq';
import { workerConfig } from './core/config';
import { processRenderCard } from './jobs/render-card';

const connection = {
  host: workerConfig.redis.host,
  port: workerConfig.redis.port,
};

async function start() {
  console.log('🚀 Starting render worker...');
  console.log(`📊 Environment: ${workerConfig.env}`);
  console.log(`⚙️  Concurrency: ${workerConfig.worker.concurrency}`);

  // Create worker
  const worker = new Worker(
    'card-rendering',
    async (job) => {
      try {
        await processRenderCard(job);
      } catch (error) {
        console.error(`❌ Job failed:`, error);
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
    console.log('✅ Worker ready and waiting for jobs');
  });

  worker.on('completed', (job) => {
    console.log(`✅ Job completed: ${job.id}`);
  });

  worker.on('failed', (job, error) => {
    console.error(`❌ Job failed: ${job?.id}`, error.message);
  });

  worker.on('error', (error) => {
    console.error('❌ Worker error:', error);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down worker...`);

    await worker.close();

    console.log('✅ Worker shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error('❌ Failed to start worker:', error);
  process.exit(1);
});
