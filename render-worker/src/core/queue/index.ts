/**
 * BullMQ queue setup
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { workerConfig } from '../config';

const connection = {
  host: workerConfig.redis.host,
  port: workerConfig.redis.port,
};

// Render job queue
export const renderQueue = new Queue('card-rendering', { connection });

console.log('✅ Queue initialized');
