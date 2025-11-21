#!/bin/bash
# Start development environment and initialize databases

echo "🚀 Starting development environment..."

# Start containers
docker-compose -f docker-compose.dev.yml up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Wait for Cassandra to be healthy
echo "Waiting for Cassandra to be healthy..."
until docker exec ecards-cassandra cqlsh -e "DESCRIBE KEYSPACES;" > /dev/null 2>&1; do
  echo -n "."
  sleep 2
done
echo " ✓"

# Initialize Cassandra schema
echo ""
echo "📊 Initializing Cassandra schema..."
bash init-cassandra.sh

echo ""
echo "✅ Development environment ready!"
echo ""
echo "Services:"
echo "  Frontend:    http://localhost:7300"
echo "  API Server:  http://localhost:7400"
echo "  PostgreSQL:  localhost:7432"
echo "  Cassandra:   localhost:7042"
echo ""
echo "To stop: docker-compose -f docker-compose.dev.yml down"
echo "To reset (⚠️ deletes data): docker-compose -f docker-compose.dev.yml down -v"
