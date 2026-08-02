#!/usr/bin/env bash
# bin/diagnose-prd-parse.sh — pinpoint why prd batch parse jobs fail before PARSING.
#
# Run ON the production host, from the tools-ecards repo root:
#
#   ./bin/diagnose-prd-parse.sh
#
# Read-only diagnostics (no deletes, no schema changes). It WILL run parser.py
# manually against the most recent failed batch — same effect as the worker's
# own retry (records inserted + batch status updated if it succeeds).
#
# What it checks, in order:
#   1. Stack containers are up (postgres, cassandra, redis, api).
#   2. Python + parser deps inside the api container.
#   3. Postgres: most recent batches and their status/error.
#   4. Cassandra: keyspace + contact_records table exist.
#   5. Python connectivity from the api container to postgres AND cassandra.
#   6. Manual parser.py run against the latest non-LOADED batch (the exact
#      error the worker hits, printed in full).

set -uo pipefail

ENV_FILE="${ENV_FILE:-.env.prd}"

log()  { printf '%s\n' "$*"; }
step() { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[32mOK\033[0m   %s\n' "$*"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$*"; }
warn() { printf '  \033[33mWARN\033[0m %s\n' "$*"; }

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE — run from the tools-ecards repo root (set ENV_FILE to override)." >&2; exit 1; }

SUFFIX="$(grep -E '^TD_STACK_SUFFIX=' "$ENV_FILE" | head -1 | cut -d= -f2 | tr -d '\r' | xargs || true)"
SUFFIX="${SUFFIX:-_prd_tcrd}"
API="tools_dashboard${SUFFIX}-api"
PG="tools_dashboard${SUFFIX}-postgres"
CASS="tools_dashboard${SUFFIX}-cassandra"
log "Stack suffix: $SUFFIX (containers: $API, $PG, $CASS)"

step "1. Containers"
for c in "$API" "$PG" "$CASS"; do
  st="$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$c" 2>/dev/null || echo MISSING)"
  case "$st" in
    running*) ok "$c: $st" ;;
    *) bad "$c: $st" ;;
  esac
done

step "2. Python + parser deps in api container"
docker exec "$API" sh -c 'python3 --version && python3 -c "import pandas, psycopg2, cassandra, boto3; print(\"deps OK\")"' \
  && ok "python3 + deps present" \
  || bad "python3 or parser deps MISSING in $API (image problem — rebuild api)"

step "3. Recent batches (postgres)"
docker exec "$PG" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, file_name, status, records_count, left(coalesce(error_message, '"'"''"'"'), 80) AS error, created_at FROM batches ORDER BY created_at DESC LIMIT 5;"'

step "4. Cassandra schema"
docker exec "$CASS" cqlsh -e "DESCRIBE KEYSPACES;" 2>&1 | tail -3
docker exec "$CASS" cqlsh -e "DESCRIBE TABLE ecards_canonical.contact_records;" >/dev/null 2>&1 \
  && ok "ecards_canonical.contact_records exists" \
  || bad "ecards_canonical.contact_records MISSING (db-init never ran or wrong keyspace)"

step "5. Python connectivity from api container"
docker exec "$API" sh -c 'python3 - <<PYEOF
import os, sys
try:
    import psycopg2
    psycopg2.connect(os.environ["DATABASE_URL"]).close()
    print("postgres: OK")
except Exception as e:
    print(f"postgres: FAIL -> {type(e).__name__}: {e}")
try:
    from cassandra.cluster import Cluster
    hosts = [h.strip() for h in os.environ.get("CASSANDRA_HOSTS", "cassandra").split(",")]
    ks = os.environ.get("CASSANDRA_KEYSPACE", "ecards")
    s = Cluster(hosts, connect_timeout=10).connect(ks)
    s.shutdown()
    print(f"cassandra: OK (keyspace {ks})")
except Exception as e:
    print(f"cassandra: FAIL -> {type(e).__name__}: {e}")
PYEOF'

step "6. Manual parser run against latest non-LOADED batch"
BATCH_LINE="$(docker exec "$PG" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -F"|" -c "SELECT id, file_path FROM batches WHERE status <> '"'"'LOADED'"'"' ORDER BY created_at DESC LIMIT 1;"')"
if [[ -z "$BATCH_LINE" ]]; then
  ok "no non-LOADED batches — nothing to test against"
else
  BATCH_ID="${BATCH_LINE%%|*}"
  FILE_PATH="${BATCH_LINE#*|}"
  log "  batch: $BATCH_ID"
  log "  file:  $FILE_PATH"
  STORAGE_MODE="seaweedfs"
  [[ "$(docker exec "$API" sh -c 'printf %s "$USE_LOCAL_STORAGE"')" == "true" ]] && STORAGE_MODE="local"
  log "  storage-mode: $STORAGE_MODE"
  log "  --- parser output (the exact error is in here) ---"
  docker exec "$API" sh -c "cd /app/batch-parsing && python3 parser.py \
    --batch-id '$BATCH_ID' \
    --file-path '$FILE_PATH' \
    --postgres-url \"\$DATABASE_URL\" \
    --cassandra-hosts \"\$CASSANDRA_HOSTS\" \
    --cassandra-keyspace \"\$CASSANDRA_KEYSPACE\" \
    --storage-mode '$STORAGE_MODE' 2>&1 | tail -30"
  log "  --- end parser output ---"
fi

step "7. Worker/spawn errors in api logs (last 3h)"
log "  (if empty: retry a batch in the UI first, then re-run this script)"
docker logs "$API" --since 3h 2>&1 \
  | grep -iE "BatchParsing|Python parser|spawn|ENOENT|Failed to start Python|Batch parse job failed|Batch parsing job failed" \
  | grep -vE '"level":30|INFO' \
  | tail -40

step "Summary"
cat <<'EOF'
  Read it top-down; the first FAIL is your culprit:
  - Step 2 FAIL            → api image lacks python/deps: ./bin/refresh-prd.sh api
  - Step 4 FAIL            → schema missing: ./bin/start.sh prd up (db-init applies init-cassandra)
  - Step 5 cassandra FAIL  → Cassandra down/unreachable from api: docker ps -a, docker logs <cassandra>
  - Step 5 postgres FAIL   → DATABASE_URL wrong for python (check .env.prd host part is "postgres")
  - Step 6 error text      → the literal exception the worker hits every time
  - Step 7                 → the worker-side error (spawn failure, exit code, argparse
                             mismatch). If step 6 succeeds but step 7 shows an error,
                             the difference is in HOW the worker spawns the parser.
EOF
