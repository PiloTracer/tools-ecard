/**
 * Load monorepo root env before Prisma/Jest.
 * Keys: see repo root **`.env.dev.example`** (dev) and **`.env.prd.example`** (prd). No `api-server/.env.example`.
 * Uses **`.env`**, or **`.env.dev`** if `.env` missing (same key set as `.env`).
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const rootEnv = path.join(repoRoot, '.env');
const rootEnvDev = path.join(repoRoot, '.env.dev');

if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else if (fs.existsSync(rootEnvDev)) {
  require('dotenv').config({ path: rootEnvDev });
}
