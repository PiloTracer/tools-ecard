/**
 * Canonical base URL for the E-Cards API (browser + server).
 * Align with monorepo root `NEXT_PUBLIC_API_URL` / `DOCS_TECH_STACK.md` (dev default published port 7400).
 */
export function getApiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  return 'http://localhost:7400';
}
