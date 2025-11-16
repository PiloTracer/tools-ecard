/**
 * Redis client
 * For caching and job queue
 */

import Redis from 'ioredis';
import { appConfig } from '../config';

export const redisClient = new Redis({
  host: appConfig.redis.host,
  port: appConfig.redis.port,
  maxRetriesPerRequest: null, // Required for BullMQ
});

redisClient.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redisClient.on('error', (error) => {
  console.error('❌ Redis connection error:', error);
});

export async function disconnectRedis(): Promise<void> {
  await redisClient.quit();
  console.log('Redis connection closed');
}
