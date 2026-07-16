/**
 * Demo mode write guard — when DEMO_MODE is enabled, reject mutating API calls.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { createLogger } from '../utils/logger';

const log = createLogger('DemoModeGuard');

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isDemoModeEnabled(): boolean {
  const v = (process.env.DEMO_MODE || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

let loggedStartup = false;

export function logDemoModeStartupOnce(): void {
  if (loggedStartup) return;
  loggedStartup = true;
  if (isDemoModeEnabled()) {
    log.warn('DEMO_MODE enabled — mutating /api requests will be rejected with demo_mode_readonly');
  }
}

/**
 * Fastify preHandler: block writes under DEMO_MODE (allow /health).
 */
export async function demoModeGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!isDemoModeEnabled()) return;
  if (!MUTATING.has(request.method)) return;

  const url = request.url.split('?')[0];
  if (url === '/health' || url.startsWith('/health/')) return;

  // Allow only non-mutating; everything mutating under /api is blocked
  if (!url.startsWith('/api')) return;

  return reply.code(403).send({
    error: 'Demo mode rejects server writes',
    code: 'demo_mode_readonly',
  });
}
