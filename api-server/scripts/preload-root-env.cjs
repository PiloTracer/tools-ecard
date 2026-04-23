/**
 * Load monorepo root env before Prisma/Jest.
 * Templates live only at repo root (`.env.dev.example`); there is no `api-server/.env.example`.
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
