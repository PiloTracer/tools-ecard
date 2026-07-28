/**
 * Stable per-user namespace for demo browser persistence.
 * Uses the OAuth user id from Tools Dashboard userinfo (User.id).
 */

import type { User } from '@/shared/types/auth';

export function sanitizeDemoStorageUserId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'unknown';
  return encodeURIComponent(trimmed).replace(/%/g, '_');
}

/** Resolve the storage namespace from an authenticated OAuth user. */
export function resolveDemoStorageUserId(
  user: Pick<User, 'id' | 'email'> | null | undefined
): string | null {
  if (!user) return null;
  const raw = user.id?.trim() || user.email?.trim();
  if (!raw) return null;
  return sanitizeDemoStorageUserId(raw);
}

export function demoUserStoragePrefix(userId: string): string {
  return `ecards:demo:u:${userId}:`;
}

export function demoUserIdbName(userId: string): string {
  return `ecards-demo-u-${userId}`;
}
