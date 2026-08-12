import type { User } from '@/shared/types/auth';

/** Normalize Tools Dashboard OAuth userinfo into the app User shape. */
export function normalizeOAuthUser(data: unknown): User | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (record.authenticated === false) return null;

  const id = String(record.id ?? record.sub ?? '').trim();
  const email = String(record.email ?? '').trim();
  if (!id && !email) return null;

  const username = String(
    record.username ?? ((email ? email.split('@')[0] : '') || 'user')
  ).trim();
  const displayName = String(
    record.display_name ?? record.displayName ?? record.name ?? username ?? email
  ).trim();

  return {
    id: id || email,
    username,
    email: email || id,
    display_name: displayName || username || email,
    roles: Array.isArray(record.roles)
      ? record.roles.filter((r): r is string => typeof r === 'string')
      : undefined,
    avatar_url:
      typeof record.avatar_url === 'string'
        ? record.avatar_url
        : typeof record.avatarUrl === 'string'
          ? record.avatarUrl
          : undefined,
    subscription: record.subscription as User['subscription'],
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
}
