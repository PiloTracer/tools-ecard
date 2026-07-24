import { appConfig } from '../config';

export type RedisConnectionOptions = {
  host: string;
  port: number;
  password?: string;
};

/** Shared Redis connection options for ioredis, Bull, and BullMQ. */
export function getRedisConnectionOptions(): RedisConnectionOptions {
  const options: RedisConnectionOptions = {
    host: appConfig.redis.host,
    port: appConfig.redis.port,
  };
  if (appConfig.redis.password) {
    options.password = appConfig.redis.password;
  }
  return options;
}
