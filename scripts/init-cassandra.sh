#!/bin/bash
#
# Initialize Cassandra keyspace (dev stack) — uses compose service "cassandra" and root .env project name.
# Run once after the stack is up, if you need a manual keyspace step (compose db-init may already apply scripts).
#
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
[ -f "$ENV_FILE" ] || ENV_FILE="$REPO_ROOT/.env.dev"
[ -f "$ENV_FILE" ] || { echo "Missing $REPO_ROOT/.env or .env.dev" >&2; exit 1; }

PROJ_NAME=""
if grep -qE '^[[:space:]]*COMPOSE_PROJECT_NAME=' "$ENV_FILE" 2>/dev/null; then
  PROJ_NAME=$(grep -E '^[[:space:]]*COMPOSE_PROJECT_NAME=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | sed "s/^['\"]//;s/['\"]$//" | xargs)
fi
[ -n "$PROJ_NAME" ] || { echo "COMPOSE_PROJECT_NAME missing in $ENV_FILE" >&2; exit 1; }

cd "$REPO_ROOT"
COMPOSE=(docker compose -p "$PROJ_NAME" -f docker-compose.dev.yml --env-file "$ENV_FILE")

echo "🔄 Initializing Cassandra keyspace (project=$PROJ_NAME)..."
echo "⏳ Waiting for Cassandra to be ready..."
until "${COMPOSE[@]}" exec -T cassandra cqlsh -e "DESCRIBE KEYSPACES" > /dev/null 2>&1; do
  echo "   Cassandra is starting up - waiting..."
  sleep 3
done

echo "✅ Cassandra is ready!"
echo "📝 Running 01-create-keyspace (if not already from db-init)..."
"${COMPOSE[@]}" exec -T cassandra cqlsh -f /docker-entrypoint-initdb.d/01-create-keyspace.cql
echo "✅ Done. Keyspace ecards_canonical should exist."
