/**
 * Redis client
 * For caching and job queue
 */

import Redis from 'ioredis';
import { getRedisConnectionOptions } from './redisConnection';

export const redisClient = new Redis({
  ...getRedisConnectionOptions(),
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
