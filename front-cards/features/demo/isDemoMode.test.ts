/**
 * @jest-environment jsdom
 */

import { DEMO_ENABLED_KEY } from './demoConstants';
import { enterDemoMode, exitDemoMode, isDemoMode } from './isDemoMode';
import { demoStore, newDemoId } from './demoStore';

describe('demo isDemoMode + store', () => {
  beforeEach(() => {
    window.localStorage.clear();
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

  it('projects round-trip in localStorage', () => {
    const id = newDemoId('proj');
    demoStore.setProjects([{ id, name: 'A' }]);
    expect(demoStore.getProjects<{ id: string; name: string }>()).toEqual([{ id, name: 'A' }]);
  });
});
