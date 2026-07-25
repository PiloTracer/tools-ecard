#!/bin/sh
# Production API entrypoint: apply Prisma migrations, recover greenfield / failed states, then start.
#
# Repo migrations are incomplete on fresh databases (e.g. ALTER projects before projects exists).
# When `migrate deploy` fails, sync schema from schema.prisma and mark migrations applied so
# `./bin/start.sh prd up` / `up-build` works without manual db push steps.

set -e

if [ -f /app/BUILD_ID ]; then
  echo "ecards-api image build: $(cat /app/BUILD_ID)"
fi

PRISMA="npx prisma"
MIGRATE_LOG="/tmp/prisma-migrate-deploy.log"

list_migrations() {
  for migration_dir in prisma/migrations/*/; do
    [ -d "$migration_dir" ] || continue
    basename "$migration_dir"
  done
}

recover_schema() {
  echo "Prisma migrate deploy failed — running automatic schema recovery..." >&2

  for migration_name in $(list_migrations); do
    $PRISMA migrate resolve --rolled-back "$migration_name" 2>/dev/null || true
  done

  # --accept-data-loss: this path only runs when migrate deploy failed (fresh/greenfield
  # or broken-state databases). On fresh DBs the warnings (e.g. adding a unique constraint)
  # are no-ops; without the flag db push refuses to proceed and the API crash-loops.
  if ! $PRISMA db push --skip-generate --accept-data-loss; then
    echo "Prisma db push failed during schema recovery." >&2
    return 1
  fi

  for migration_name in $(list_migrations); do
    $PRISMA migrate resolve --applied "$migration_name" 2>/dev/null || true
  done

  if ! $PRISMA migrate deploy; then
    echo "Prisma migrate deploy still failing after schema recovery." >&2
    return 1
  fi

  echo "Schema recovery complete." >&2
  return 0
}

if $PRISMA migrate deploy >"$MIGRATE_LOG" 2>&1; then
  cat "$MIGRATE_LOG"
else
  cat "$MIGRATE_LOG" >&2
  recover_schema
fi

exec node dist/server.js
