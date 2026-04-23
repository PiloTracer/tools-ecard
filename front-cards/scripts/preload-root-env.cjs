/**
 * Load monorepo root env into `process.env` before Next.js starts.
 * Canonical key list: repo root **`.env.dev.example`** (dev) and **`.env.prd.example`** (prd). Runtime: **`.env`** / **`.env.prd`** only.
 * Optional: **`.env.dev`** if **`.env`** is absent — same keys as `.env`, not a separate template.
 * No per-app files (`front-cards/.env.local`). Docker `env_file` usually sets vars; this only fills gaps. Does not overwrite non-empty keys.
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
