#!/bin/bash
# Initialize Cassandra schema for E-Cards (dev stack)
#
# Uses docker compose with COMPOSE_PROJECT_NAME and TD_* from root .env — no hardcoded container names.
# Prereq: dev stack up (e.g. ./bin/start.sh dev up)

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$REPO_ROOT/.env"
[ -f "$ENV_FILE" ] || ENV_FILE="$REPO_ROOT/.env.dev"
[ -f "$ENV_FILE" ] || { echo "Missing $REPO_ROOT/.env (or .env.dev). Copy .env.dev.example to .env." >&2; exit 1; }

PROJ_NAME=""
if grep -qE '^[[:space:]]*COMPOSE_PROJECT_NAME=' "$ENV_FILE" 2>/dev/null; then
  PROJ_NAME=$(grep -E '^[[:space:]]*COMPOSE_PROJECT_NAME=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | sed "s/^['\"]//;s/['\"]$//" | xargs)
fi
[ -n "$PROJ_NAME" ] || { echo "COMPOSE_PROJECT_NAME missing in $ENV_FILE" >&2; exit 1; }

cd "$REPO_ROOT"
COMPOSE=(docker compose -p "$PROJ_NAME" -f docker-compose.dev.yml --env-file "$ENV_FILE")

echo "Initializing Cassandra schema (project=$PROJ_NAME)..."
echo "1. Creating keyspace..."
cat db/init-cassandra/01-create-keyspace.cql | "${COMPOSE[@]}" exec -T cassandra cqlsh

echo "2. Creating template configs..."
cat db/init-cassandra/02-template-configs.cql | "${COMPOSE[@]}" exec -T cassandra cqlsh

echo "3. Creating textile templates..."
cat db/init-cassandra/03-template-textile-tables.cql | "${COMPOSE[@]}" exec -T cassandra cqlsh 2>&1 | grep -v "Materialized views are disabled" || true

echo "4. Creating multimode templates..."
cat db/init-cassandra/04-template-multimode-tables.cql | "${COMPOSE[@]}" exec -T cassandra cqlsh 2>&1 | grep -v "Materialized views are disabled" || echo "Note: Some schema updates may have warnings"

echo ""
echo "✅ Cassandra initialization complete!"
echo "Verify: ${COMPOSE[*]} exec cassandra cqlsh -e 'DESCRIBE KEYSPACES;'"
