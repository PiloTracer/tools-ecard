/**
 * Load monorepo root `.env` before Prisma/Jest (api-server/ has no local .env).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
