import { appConfig } from '../config';

export type RedisConnectionOptions = {
  host: string;
  port: number;
  password?: string;
};

function readRedisPassword(): string | undefined {
  const fromEnv = (process.env.REDIS_PASSWORD || '').trim();
  if (fromEnv) {
    return fromEnv;
  }
  return appConfig.redis.password;
}

/** Shared Redis connection options for ioredis, Bull, and BullMQ. */
export function getRedisConnectionOptions(): RedisConnectionOptions {
  const options: RedisConnectionOptions = {
    host: process.env.REDIS_HOST || appConfig.redis.host,
    port: parseInt(process.env.REDIS_PORT || String(appConfig.redis.port), 10),
  };
  const password = readRedisPassword();
  if (password) {
    options.password = password;
  }
  return options;
}

/** Bull (v3) queue redis block. */
export function getBullRedisOptions(): { redis: RedisConnectionOptions } {
  return { redis: getRedisConnectionOptions() };
}
