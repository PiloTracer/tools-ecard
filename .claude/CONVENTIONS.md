# Engineering conventions — tools-ecards

Concise rules that complement **`.cursorrules`**, **`FEATURE_STANDARD.md`**, and per-feature READMEs under **`.claude/features/`**.

## 1. Repository layout

- **Apps:** `front-cards/` (Next.js), `api-server/` (Fastify + Prisma), `render-worker/` (workers).
- **DB scripts:** `db/init-postgres/`, `db/init-cassandra/`.
- **Feature code:** Prefer `src/features/{feature}/` in each app; avoid new cross-feature imports — share via `core/`, `shared/`, or `packages/shared-types` as the codebase already does.

## 2. TypeScript

- `strict` mode; avoid `any` at API boundaries. Prefer Zod (or existing validators) for request validation.
- Match existing import style (path aliases) per subproject.

## 3. Logging (api-server / render-worker)

- Use the project logger (`Pino` / `createLogger` pattern in `api-server`); do not add `console.log` in production paths.
- No secrets, tokens, or PII in log objects.

## 4. Databases

- **PostgreSQL:** Prisma is the source of truth for the relational schema; migrations are normal Prisma flows (`api-server/prisma/`).
- **Cassandra:** Schema in `db/init-cassandra/*.cql`; changes require coordinated init script updates and awareness of Cassandra 5 constraints (e.g. materialized views / MV usage per project history in `.claude/fixes/`).

## 5. API and auth

- Treat **api-server** as the internal E-Cards API; **external** auth/OAuth services are integrated as clients, not reimplemented here.
- Preserve cookie / OAuth / PKCE flows when touching `front-cards` BFF or auth routes — see feature docs: `.claude/features/` (e.g. auto-auth).

## 6. Testing and verification

- `api-server`: `npm test` (Jest) from `api-server/`; align with `package.json` scripts.
- `front-cards`: use scripts in `front-cards/package.json` (see **DOCS_TECH_STACK.md**).
- After non-trivial changes, run the narrowest test/build that covers the change; state what you did not run.

## 7. Docker

- Default dev stack: `docker compose -f docker-compose.dev.yml`. Container names: **DOCS_TECH_STACK.md** / compose file.

## 8. Documentation

- New or changed behavior: update the relevant **`.claude/features/{feature}/README.md` or `feature.yaml`**, and **`.claude/FEATURES_INDEX.md`** if the public feature list changes.
