/**
 * Demo mode detection — env force or localStorage flag
 */

import { DEMO_ENABLED_KEY, truthyEnv } from './demoConstants';

export function isEnvDemoMode(): boolean {
  return truthyEnv(process.env.NEXT_PUBLIC_DEMO_MODE);
}

export function isDemoMode(): boolean {
  if (isEnvDemoMode()) return true;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DEMO_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function enterDemoMode(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_ENABLED_KEY, '1');
}

export function exitDemoMode(): void {
  if (typeof window === 'undefined') return;
  if (isEnvDemoMode()) {
    // Env-forced Demo cannot fully exit until env is changed
    return;
  }
  window.localStorage.removeItem(DEMO_ENABLED_KEY);
}

export function canExitDemoMode(): boolean {
  return !isEnvDemoMode();
}
