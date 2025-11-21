#!/bin/bash
# Initialize Cassandra schema for ecards

echo "Initializing Cassandra schema..."

cd "$(dirname "$0")"

echo "1. Creating keyspace..."
cat db/init-cassandra/01-create-keyspace.cql | docker exec -i ecards-cassandra cqlsh

echo "2. Creating template configs..."
cat db/init-cassandra/02-template-configs.cql | docker exec -i ecards-cassandra cqlsh

echo "3. Creating textile templates..."
cat db/init-cassandra/03-template-textile-tables.cql | docker exec -i ecards-cassandra cqlsh 2>&1 | grep -v "Materialized views are disabled"

echo "4. Creating multimode templates..."
cat db/init-cassandra/04-template-multimode-tables.cql | docker exec -i ecards-cassandra cqlsh 2>&1 | grep -v "Materialized views are disabled" || echo "Note: Some schema updates may have warnings"

echo ""
echo "✅ Cassandra initialization complete!"
echo ""
echo "Verify with:"
echo "  docker exec ecards-cassandra cqlsh -e 'DESCRIBE KEYSPACES;'"
echo "  docker exec ecards-cassandra cqlsh -e 'USE ecards_canonical; DESCRIBE TABLES;'"
