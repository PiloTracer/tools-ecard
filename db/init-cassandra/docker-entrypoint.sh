#!/bin/bash
#
# Cassandra Docker Entrypoint Script
#
# Waits for Cassandra to be ready, then executes CQL initialization scripts
#

set -e

echo "Waiting for Cassandra to be ready..."

# Wait for Cassandra to be fully started
until cqlsh -e "DESCRIBE KEYSPACES" > /dev/null 2>&1; do
  echo "Cassandra is unavailable - sleeping"
  sleep 2
done

echo "Cassandra is ready - executing init scripts"

# Execute all .cql files in the init directory
for f in /docker-entrypoint-initdb.d/*.cql; do
  if [ -f "$f" ]; then
    echo "Executing $f"
    cqlsh -f "$f"
  fi
done

echo "Cassandra initialization complete"
