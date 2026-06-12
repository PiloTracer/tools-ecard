import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Core Config', () => {
  const originalEnv: Record<string, string | undefined> = {};

  const envVars = [
    'NODE_ENV', 'PORT', 'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB',
    'POSTGRES_USER', 'POSTGRES_PASSWORD', 'CASSANDRA_HOSTS', 'CASSANDRA_DC',
    'CASSANDRA_KEYSPACE', 'REDIS_HOST', 'REDIS_PORT', 'SEAWEEDFS_ENDPOINT',
    'SEAWEEDFS_ACCESS_KEY', 'SEAWEEDFS_SECRET_KEY', 'SEAWEEDFS_BUCKET',
    'LLM_ENABLED', 'LLM_PRIMARY_PROVIDER', 'LLM_FALLBACK_PROVIDER',
    'LLM_CREDIT_COST', 'LLM_RETRY_ATTEMPTS', 'LLM_TIMEOUT_MS',
    'OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_MAX_TOKENS', 'OPENAI_TEMPERATURE',
    'ANTHROPIC_API_KEY_CUSTOM', 'ANTHROPIC_MODEL', 'ANTHROPIC_MAX_TOKENS', 'ANTHROPIC_TEMPERATURE',
    'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'DEEPSEEK_MAX_TOKENS', 'DEEPSEEK_TEMPERATURE',
    'EXTERNAL_LLM_API', 'EXTERNAL_AUTH_URL', 'EXTERNAL_SUBSCRIPTION_WS', 'EXTERNAL_USER_API',
    'API_PUBLIC_ENDPOINT', 'NEXT_PUBLIC_API_URL', 'RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX_REQUESTS',
  ];

  beforeEach(() => {
    // Save original values
    envVars.forEach(v => {
      originalEnv[v] = process.env[v];
    });
  });

  afterEach(() => {
    // Restore original values
    envVars.forEach(v => {
      if (originalEnv[v] === undefined) {
        delete process.env[v];
      } else {
        process.env[v] = originalEnv[v];
      }
    });
    jest.resetModules();
  });

  it('should load default config when env vars are set to defaults', () => {
    jest.resetModules();
    envVars.forEach(v => delete process.env[v]);
    process.env.NODE_ENV = 'development';
    process.env.PORT = '4000';
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_DB = 'ecards_db';
    process.env.POSTGRES_USER = 'ecards_user';
    process.env.POSTGRES_PASSWORD = '';
    process.env.CASSANDRA_HOSTS = 'localhost';
    process.env.CASSANDRA_DC = 'dc1';
    process.env.CASSANDRA_KEYSPACE = 'ecards_canonical';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';

    const { appConfig } = require('../../src/core/config');

    expect(appConfig.env).toBe('development');
    expect(appConfig.port).toBe(4000);
    expect(appConfig.postgres.host).toBe('localhost');
    expect(appConfig.postgres.port).toBe(5432);
    expect(appConfig.postgres.database).toBe('ecards_db');
    expect(appConfig.postgres.user).toBe('ecards_user');
    expect(appConfig.postgres.password).toBe('');
  });

  it('should load custom config from environment variables', () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '5000';
    process.env.POSTGRES_HOST = 'db.example.com';
    process.env.POSTGRES_PORT = '5433';
    process.env.POSTGRES_DB = 'my_db';
    process.env.POSTGRES_USER = 'my_user';
    process.env.POSTGRES_PASSWORD = 'secret123';
    process.env.CASSANDRA_HOSTS = 'c1.example.com,c2.example.com';
    process.env.CASSANDRA_DC = 'dc2';
    process.env.CASSANDRA_KEYSPACE = 'my_keyspace';
    process.env.REDIS_HOST = 'redis.example.com';
    process.env.REDIS_PORT = '6380';
    process.env.SEAWEEDFS_ENDPOINT = 'https://storage.example.com';
    process.env.SEAWEEDFS_ACCESS_KEY = 'access_key';
    process.env.SEAWEEDFS_SECRET_KEY = 'secret_key';
    process.env.SEAWEEDFS_BUCKET = 'my_bucket';
    process.env.LLM_ENABLED = 'true';
    process.env.LLM_PRIMARY_PROVIDER = 'anthropic';
    process.env.LLM_FALLBACK_PROVIDER = 'deepseek';
    process.env.LLM_CREDIT_COST = '2';
    process.env.LLM_RETRY_ATTEMPTS = '3';
    process.env.LLM_TIMEOUT_MS = '15000';
    process.env.OPENAI_API_KEY = 'sk-openai';
    process.env.OPENAI_MODEL = 'gpt-4o';
    process.env.OPENAI_MAX_TOKENS = '1000';
    process.env.OPENAI_TEMPERATURE = '0.5';
    process.env.ANTHROPIC_API_KEY_CUSTOM = 'sk-anthropic';
    process.env.ANTHROPIC_MODEL = 'claude-3-opus';
    process.env.ANTHROPIC_MAX_TOKENS = '2000';
    process.env.ANTHROPIC_TEMPERATURE = '0.7';
    process.env.DEEPSEEK_API_KEY = 'sk-deepseek';
    process.env.DEEPSEEK_MODEL = 'deepseek-coder';
    process.env.DEEPSEEK_MAX_TOKENS = '1500';
    process.env.DEEPSEEK_TEMPERATURE = '0.2';
    process.env.EXTERNAL_LLM_API = 'https://llm.example.com';
    process.env.EXTERNAL_AUTH_URL = 'https://auth.example.com';
    process.env.EXTERNAL_SUBSCRIPTION_WS = 'wss://ws.example.com';
    process.env.EXTERNAL_USER_API = 'https://user.example.com';
    process.env.API_PUBLIC_ENDPOINT = 'https://api.example.com';
    process.env.RATE_LIMIT_WINDOW_MS = '120000';
    process.env.RATE_LIMIT_MAX_REQUESTS = '200';

    const { appConfig } = require('../../src/core/config');

    expect(appConfig.env).toBe('production');
    expect(appConfig.port).toBe(5000);
    expect(appConfig.postgres.host).toBe('db.example.com');
    expect(appConfig.postgres.port).toBe(5433);
    expect(appConfig.postgres.database).toBe('my_db');
    expect(appConfig.postgres.user).toBe('my_user');
    expect(appConfig.postgres.password).toBe('secret123');
    expect(appConfig.cassandra.contactPoints).toEqual(['c1.example.com', 'c2.example.com']);
    expect(appConfig.cassandra.localDataCenter).toBe('dc2');
    expect(appConfig.cassandra.keyspace).toBe('my_keyspace');
    expect(appConfig.redis.host).toBe('redis.example.com');
    expect(appConfig.redis.port).toBe(6380);
    expect(appConfig.seaweedfs.endpoint).toBe('https://storage.example.com');
    expect(appConfig.seaweedfs.accessKey).toBe('access_key');
    expect(appConfig.seaweedfs.secretKey).toBe('secret_key');
    expect(appConfig.seaweedfs.bucket).toBe('my_bucket');
    expect(appConfig.llm.enabled).toBe(true);
    expect(appConfig.llm.primaryProvider).toBe('anthropic');
    expect(appConfig.llm.fallbackProvider).toBe('deepseek');
    expect(appConfig.llm.creditCostPerCall).toBe(2);
    expect(appConfig.llm.retryAttempts).toBe(3);
    expect(appConfig.llm.timeout).toBe(15000);
    expect(appConfig.llm.openai.apiKey).toBe('sk-openai');
    expect(appConfig.llm.openai.model).toBe('gpt-4o');
    expect(appConfig.llm.openai.maxTokens).toBe(1000);
    expect(appConfig.llm.openai.temperature).toBe(0.5);
    expect(appConfig.llm.anthropic.apiKey).toBe('sk-anthropic');
    expect(appConfig.llm.anthropic.model).toBe('claude-3-opus');
    expect(appConfig.llm.anthropic.maxTokens).toBe(2000);
    expect(appConfig.llm.anthropic.temperature).toBe(0.7);
    expect(appConfig.llm.deepseek.apiKey).toBe('sk-deepseek');
    expect(appConfig.llm.deepseek.model).toBe('deepseek-coder');
    expect(appConfig.llm.deepseek.maxTokens).toBe(1500);
    expect(appConfig.llm.deepseek.temperature).toBe(0.2);
    expect(appConfig.llm.external.apiUrl).toBe('https://llm.example.com');
    expect(appConfig.external.authUrl).toBe('https://auth.example.com');
    expect(appConfig.external.subscriptionWs).toBe('wss://ws.example.com');
    expect(appConfig.external.userApi).toBe('https://user.example.com');
    expect(appConfig.publicApi.baseUrl).toBe('https://api.example.com');
    expect(appConfig.rateLimit.windowMs).toBe(120000);
    expect(appConfig.rateLimit.maxRequests).toBe(200);
  });

  it('should parse comma-separated cassandra hosts', () => {
    process.env.CASSANDRA_HOSTS = 'host1,host2,host3';
    const { appConfig } = require('../../src/core/config');
    expect(appConfig.cassandra.contactPoints).toEqual(['host1', 'host2', 'host3']);
  });

  it('should use default cassandra host when CASSANDRA_HOSTS is set to localhost', () => {
    jest.resetModules();
    delete process.env.CASSANDRA_HOSTS;
    process.env.CASSANDRA_HOSTS = 'localhost';
    const { appConfig } = require('../../src/core/config');
    expect(appConfig.cassandra.contactPoints).toEqual(['localhost']);
  });

  it('should strip trailing slashes from public API base URL', () => {
    process.env.API_PUBLIC_ENDPOINT = 'https://api.example.com/';
    const { appConfig } = require('../../src/core/config');
    expect(appConfig.publicApi.baseUrl).toBe('https://api.example.com');
  });

  it('should fallback to NEXT_PUBLIC_API_URL for publicApi baseUrl', () => {
    delete process.env.API_PUBLIC_ENDPOINT;
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:7400';
    const { appConfig } = require('../../src/core/config');
    expect(appConfig.publicApi.baseUrl).toBe('http://localhost:7400');
  });
});
