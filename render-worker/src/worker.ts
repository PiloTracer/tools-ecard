/**
 * Render worker entry point
 */

import { writeFile } from 'node:fs/promises';
import { Worker } from 'bullmq';
import { workerConfig } from './core/config';
import { processRenderCard } from './jobs/render-card';
import { connectDatabase, disconnectDatabase } from './core/database';

const connection = {
  host: workerConfig.redis.host,
  port: workerConfig.redis.port,
  ...(workerConfig.redis.password && { password: workerConfig.redis.password }),
};

// Touched only while the queue connection answers PING, so the container healthcheck
// fails on a wedged Redis link instead of just "the node process still exists".
const HEARTBEAT_FILE = process.env.WORKER_HEARTBEAT_FILE || '/tmp/render-worker-heartbeat';
const HEARTBEAT_INTERVAL_MS = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS || 15000);

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

  // BullMQ types its shared connection as IRedisClient, which omits the ioredis
  // command surface; PING is the cheapest way to prove the link is still alive.
  type PingableClient = { ping: () => Promise<unknown> };

  const writeHeartbeat = async () => {
    try {
      const client = (await worker.client) as unknown as PingableClient;
      await client.ping();
      await writeFile(HEARTBEAT_FILE, `${Date.now()}\n`);
    } catch (error) {
      console.error('Render worker heartbeat failed:', error);
    }
  };

  await writeHeartbeat();
  const heartbeat = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down render worker...`);
    clearInterval(heartbeat);
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
