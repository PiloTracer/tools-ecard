/**
 * Load monorepo root env into `process.env` before Next.js starts.
 * - No `front-cards/.env.local` — use repo root **`.env`** (preferred local dev) or **`.env.dev`** if `.env` is absent.
 * - In Docker, `env_file` on `ecards-frontend` usually sets variables already; this file only fills gaps.
 * - Does not overwrite keys already set (non-empty).
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const rootEnv = path.join(repoRoot, '.env');
const rootEnvDev = path.join(repoRoot, '.env.dev');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || key.startsWith('#')) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

if (fs.existsSync(rootEnv)) {
  parseEnvFile(rootEnv);
} else if (fs.existsSync(rootEnvDev)) {
  parseEnvFile(rootEnvDev);
}
