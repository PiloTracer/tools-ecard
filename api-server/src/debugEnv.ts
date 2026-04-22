/**
 * Runs before other imports in server.ts.
 * `follow-redirects` (used by axios) logs entire request options when DEBUG matches it — floods Docker logs.
 */
const NOISY = ['-follow-redirects', '-axios'];

if (process.env.DEBUG && process.env.DEBUG.trim() !== '') {
  let d = process.env.DEBUG.trim();
  for (const tag of NOISY) {
    if (!d.includes(tag)) {
      d += `,${tag}`;
    }
  }
  process.env.DEBUG = d;
}
