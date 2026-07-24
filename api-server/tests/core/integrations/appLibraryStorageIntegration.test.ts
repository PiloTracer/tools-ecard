import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

describe('App library storage integration startup policy', () => {
  const envKeys = [
    'NODE_ENV',
    'DEMO_MODE',
    'TOOLS_DASHBOARD_ORIGIN',
    'APP_LIBRARY_STORAGE_INTEGRATION_KEY',
    'APP_LIBRARY_STORAGE_INTEGRATION_OPTIONAL',
  ] as const;

  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    envKeys.forEach((key) => {
      original[key] = process.env[key];
    });
    jest.resetModules();
  });

  afterEach(() => {
    envKeys.forEach((key) => {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    });
    jest.resetModules();
  });

  function loadPolicy() {
    const {
      isAppLibraryStorageIntegrationRequiredAtStartup,
    } = require('../../../src/core/integrations/appLibraryStorageIntegration');
    return isAppLibraryStorageIntegrationRequiredAtStartup as () => boolean;
  }

  it('does not require integration when disabled', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TOOLS_DASHBOARD_ORIGIN;
    delete process.env.APP_LIBRARY_STORAGE_INTEGRATION_KEY;
    expect(loadPolicy()()).toBe(false);
  });

  it('does not require integration in non-production', () => {
    process.env.NODE_ENV = 'development';
    process.env.TOOLS_DASHBOARD_ORIGIN = 'https://tools.example.com';
    process.env.APP_LIBRARY_STORAGE_INTEGRATION_KEY = 'secret';
    expect(loadPolicy()()).toBe(false);
  });

  it('does not require integration in production when DEMO_MODE is on', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'true';
    process.env.TOOLS_DASHBOARD_ORIGIN = 'https://tools.example.com';
    process.env.APP_LIBRARY_STORAGE_INTEGRATION_KEY = 'secret';
    expect(loadPolicy()()).toBe(false);
  });

  it('does not require integration when explicitly optional', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'false';
    process.env.APP_LIBRARY_STORAGE_INTEGRATION_OPTIONAL = 'true';
    process.env.TOOLS_DASHBOARD_ORIGIN = 'https://tools.example.com';
    process.env.APP_LIBRARY_STORAGE_INTEGRATION_KEY = 'secret';
    expect(loadPolicy()()).toBe(false);
  });

  it('requires integration in strict production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'false';
    process.env.APP_LIBRARY_STORAGE_INTEGRATION_OPTIONAL = 'false';
    process.env.TOOLS_DASHBOARD_ORIGIN = 'https://tools.example.com';
    process.env.APP_LIBRARY_STORAGE_INTEGRATION_KEY = 'secret';
    expect(loadPolicy()()).toBe(true);
  });
});
