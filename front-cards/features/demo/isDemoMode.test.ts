/**
 * @jest-environment jsdom
 */

import { DEMO_ENABLED_KEY } from './demoConstants';
import { enterDemoMode, exitDemoMode, isDemoMode } from './isDemoMode';
import { demoStore, newDemoId } from './demoStore';
import { resolveDemoStorageUserId } from './demoStorageUserId';

describe('demo isDemoMode + per-user store', () => {
  const userA = { id: 'oauth-user-alice', email: 'alice@example.com' };
  const userB = { id: 'oauth-user-bob', email: 'bob@example.com' };

  beforeEach(() => {
    window.localStorage.clear();
    demoStore.setActiveUserId(null);
    delete (process.env as { NEXT_PUBLIC_DEMO_MODE?: string }).NEXT_PUBLIC_DEMO_MODE;
  });

  it('enterDemoMode sets localStorage flag', () => {
    expect(isDemoMode()).toBe(false);
    enterDemoMode();
    expect(window.localStorage.getItem(DEMO_ENABLED_KEY)).toBe('1');
    expect(isDemoMode()).toBe(true);
  });

  it('exitDemoMode clears flag when not env-forced', () => {
    enterDemoMode();
    exitDemoMode();
    expect(isDemoMode()).toBe(false);
  });

  it('isolates projects per OAuth user namespace', () => {
    enterDemoMode();
    const idA = newDemoId('proj');
    demoStore.setActiveUserId(resolveDemoStorageUserId(userA));
    demoStore.setProjects([{ id: idA, name: 'Alice Project' }]);

    const idB = newDemoId('proj');
    demoStore.setActiveUserId(resolveDemoStorageUserId(userB));
    expect(demoStore.getProjects<{ id: string; name: string }>()).toEqual([]);

    demoStore.setProjects([{ id: idB, name: 'Bob Project' }]);

    demoStore.setActiveUserId(resolveDemoStorageUserId(userA));
    expect(demoStore.getProjects<{ id: string; name: string }>()).toEqual([
      { id: idA, name: 'Alice Project' },
    ]);
  });
});
