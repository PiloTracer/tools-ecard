/**
 * Worker configuration
 */

import { config } from 'dotenv';

config();

export const workerConfig = {
  env: process.env.NODE_ENV || 'development',

  // PostgreSQL
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'ecards_db',
    user: process.env.POSTGRES_USER || 'ecards_user',
    password: process.env.POSTGRES_PASSWORD || '',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  // SeaweedFS (Remote)
  seaweedfs: {
    endpoint: process.env.SEAWEEDFS_ENDPOINT || '',
    accessKey: process.env.SEAWEEDFS_ACCESS_KEY || '',
    secretKey: process.env.SEAWEEDFS_SECRET_KEY || '',
    bucket: process.env.SEAWEEDFS_BUCKET || 'templates',
  },

  // Worker
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '4', 10),
    maxAttempts: parseInt(process.env.WORKER_MAX_ATTEMPTS || '3', 10),
    timeout: parseInt(process.env.WORKER_TIMEOUT || '60000', 10),
    renderEngine: process.env.RENDER_ENGINE || 'canvas',
  },
};
