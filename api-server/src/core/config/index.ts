/**
 * Application configuration
 * Loads and validates environment variables
 */

import { config } from 'dotenv';

config();

export const appConfig = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),

  // PostgreSQL
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'ecards_db',
    user: process.env.POSTGRES_USER || 'ecards_user',
    password: process.env.POSTGRES_PASSWORD || '',
  },

  // Cassandra
  cassandra: {
    contactPoints: (process.env.CASSANDRA_HOSTS || 'localhost').split(','),
    localDataCenter: process.env.CASSANDRA_DC || 'dc1',
    keyspace: process.env.CASSANDRA_KEYSPACE || 'ecards_canonical',
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
    bucket: process.env.SEAWEEDFS_BUCKET || '',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret',
    expiry: process.env.JWT_EXPIRY || '7d',
  },

  // LLM Configuration (Name Parsing)
  llm: {
    enabled: process.env.LLM_ENABLED === 'true',
    primaryProvider: (process.env.LLM_PRIMARY_PROVIDER || 'openai') as 'openai' | 'anthropic' | 'deepseek' | 'external',
    fallbackProvider: (process.env.LLM_FALLBACK_PROVIDER || 'none') as 'openai' | 'anthropic' | 'deepseek' | 'external' | 'none',
    creditCostPerCall: parseInt(process.env.LLM_CREDIT_COST || '1', 10),
    retryAttempts: parseInt(process.env.LLM_RETRY_ATTEMPTS || '2', 10),
    timeout: parseInt(process.env.LLM_TIMEOUT_MS || '10000', 10),

    // OpenAI Configuration
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500', 10),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
    },

    // Anthropic Configuration
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY_CUSTOM || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '500', 10),
      temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.3'),
    },

    // DeepSeek Configuration
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      maxTokens: parseInt(process.env.DEEPSEEK_MAX_TOKENS || '500', 10),
      temperature: parseFloat(process.env.DEEPSEEK_TEMPERATURE || '0.3'),
    },

    // External LLM Service (Backward Compatibility)
    external: {
      apiUrl: process.env.EXTERNAL_LLM_API || '',
    },
  },

  // External Services
  external: {
    authUrl: process.env.EXTERNAL_AUTH_URL || '',
    subscriptionWs: process.env.EXTERNAL_SUBSCRIPTION_WS || '',
    userApi: process.env.EXTERNAL_USER_API || '',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
};
