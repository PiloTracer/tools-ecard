#!/bin/bash
# Wait until Cassandra accepts CQL, then apply *.cql scripts in order.
# Used by compose db-init (avoids stale "healthy" status while CQL is still down on restart).
set -euo pipefail

CASSANDRA_HOST="${CASSANDRA_HOST:-cassandra}"
SCRIPTS_DIR="${CASSANDRA_SCRIPTS_DIR:-/scripts}"
MAX_WAIT="${CASSANDRA_INIT_MAX_WAIT_SECS:-120}"
SLEEP_SECS="${CASSANDRA_INIT_RETRY_SLEEP_SECS:-2}"

echo "Waiting for Cassandra CQL at ${CASSANDRA_HOST} (up to ${MAX_WAIT}s)..."
elapsed=0
until cqlsh "${CASSANDRA_HOST}" -e "DESCRIBE KEYSPACES" >/dev/null 2>&1; do
  if [ "${elapsed}" -ge "${MAX_WAIT}" ]; then
    echo "Timeout: Cassandra not accepting CQL after ${MAX_WAIT}s" >&2
    exit 1
  fi
  echo "  Cassandra not ready (${elapsed}s)..."
  sleep "${SLEEP_SECS}"
  elapsed=$((elapsed + SLEEP_SECS))
done
echo "Cassandra is ready."

echo "Initializing Cassandra schemas from ${SCRIPTS_DIR}..."
shopt -s nullglob
scripts=("${SCRIPTS_DIR}"/*.cql)
if [ "${#scripts[@]}" -eq 0 ]; then
  echo "No .cql scripts found in ${SCRIPTS_DIR}" >&2
  exit 1
fi
for script in "${scripts[@]}"; do
  echo "Running ${script}..."
  cqlsh "${CASSANDRA_HOST}" -f "${script}" || {
    echo "Failed to run ${script}" >&2
    exit 1
  }
done
echo "Cassandra initialization complete!"
