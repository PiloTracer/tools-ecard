/**
 * @jest-environment jsdom
 */

import { ApiClient, DemoModeWriteBlockedError } from './api-client';
import { DEMO_ENABLED_KEY } from '@/features/demo/demoConstants';

describe('apiClient demo write block', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete (process.env as { NEXT_PUBLIC_DEMO_MODE?: string }).NEXT_PUBLIC_DEMO_MODE;
  });

  it('throws on post/put/patch/delete when demo enabled', async () => {
    window.localStorage.setItem(DEMO_ENABLED_KEY, '1');
    const client = new ApiClient('http://example.test');
    await expect(client.post('/api/v1/projects', { name: 'x' })).rejects.toBeInstanceOf(
      DemoModeWriteBlockedError
    );
    await expect(client.put('/api/v1/projects', {})).rejects.toBeInstanceOf(DemoModeWriteBlockedError);
    await expect(client.patch('/api/v1/projects', {})).rejects.toBeInstanceOf(
      DemoModeWriteBlockedError
    );
    await expect(client.delete('/api/v1/projects')).rejects.toBeInstanceOf(DemoModeWriteBlockedError);
  });

  it('does not throw assert path when demo is off (network may fail)', async () => {
    const client = new ApiClient('http://127.0.0.1:9');
    // Demo off → mutation proceeds to fetch (connection refused is fine; proves no Demo throw)
    await expect(client.post('/api/v1/projects', { name: 'x' })).rejects.not.toBeInstanceOf(
      DemoModeWriteBlockedError
    );
  });
});
