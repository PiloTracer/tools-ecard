#!/bin/bash
#
# Initialize Cassandra Keyspace
#
# Run this script once after starting docker-compose to create the keyspace
#

set -e

echo "🔄 Initializing Cassandra keyspace..."

# Wait for Cassandra to be ready
echo "⏳ Waiting for Cassandra to be ready..."
until docker exec ecards-cassandra cqlsh -e "DESCRIBE KEYSPACES" > /dev/null 2>&1; do
  echo "   Cassandra is starting up - waiting..."
  sleep 3
done

echo "✅ Cassandra is ready!"

# Execute initialization script
echo "📝 Creating keyspace 'ecards_canonical'..."
docker exec ecards-cassandra cqlsh -f /docker-entrypoint-initdb.d/01-create-keyspace.cql

echo "✅ Cassandra initialization complete!"
echo ""
echo "Keyspace 'ecards_canonical' is now ready to use."
