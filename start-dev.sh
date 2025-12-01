#!/bin/bash
# Start development environment - databases auto-initialize via docker-compose

set -e  # Exit on any error

echo "🚀 Starting E-Cards development environment..."
echo ""
echo "This will:"
echo "  1. Start PostgreSQL, Cassandra, and Redis"
echo "  2. Wait for databases to be healthy"
echo "  3. Auto-initialize Cassandra schema via db-init service"
echo "  4. Start application services (front-cards, api-server, render-worker)"
echo ""

# Start all services - docker compose handles initialization order via depends_on
echo "Starting containers..."
docker compose -f docker-compose.dev.yml up -d

echo ""
echo "⏳ Services are starting in background..."
echo "   You can monitor progress with: docker compose -f docker-compose.dev.yml logs -f"
echo ""
echo "⏳ Waiting for all services to be ready (this may take 1-2 minutes)..."
echo ""

# Wait for api-server to be healthy (indicates all dependencies are ready)
max_attempts=60
attempt=0
while ! curl -s http://localhost:7400/health > /dev/null 2>&1; do
  if [ $attempt -ge $max_attempts ]; then
    echo ""
    echo "⚠️  Timeout waiting for API server to be ready"
    echo ""
    echo "Check service status:"
    docker compose -f docker-compose.dev.yml ps
    echo ""
    echo "Check logs for errors:"
    echo "  docker compose -f docker-compose.dev.yml logs api-server"
    exit 1
  fi

  # Show progress every 5 seconds
  if [ $((attempt % 5)) -eq 0 ]; then
    echo -n "  [${attempt}s] Waiting for API server"
  fi
  echo -n "."

  sleep 1
  attempt=$((attempt + 1))
done

echo ""
echo ""
echo "✅ Development environment ready!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Application Services:"
echo "   Frontend:    http://localhost:7300"
echo "   API Server:  http://localhost:7400"
echo "   API Health:  http://localhost:7400/health"
echo ""
echo "🗄️  Database Services:"
echo "   PostgreSQL:  localhost:7432 (user: ecards_user, db: ecards_db)"
echo "   Cassandra:   localhost:7042 (keyspace: ecards_canonical)"
echo "   Redis:       localhost:7379"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Useful commands:"
echo "   View all logs:      docker compose -f docker-compose.dev.yml logs -f"
echo "   View API logs:      docker compose -f docker-compose.dev.yml logs -f api-server"
echo "   View frontend logs: docker compose -f docker-compose.dev.yml logs -f front-cards"
echo "   Service status:     docker compose -f docker-compose.dev.yml ps"
echo ""
echo "   Stop services:      docker compose -f docker-compose.dev.yml down"
echo "   Reset databases:    docker compose -f docker-compose.dev.yml down -v  ⚠️  (deletes all data)"
echo ""
echo "🔧 Database access:"
echo "   PostgreSQL CLI:     psql -h localhost -p 7432 -U ecards_user -d ecards_db"
echo "   Cassandra CLI:      docker exec -it ecards-cassandra cqlsh"
echo "   Redis CLI:          docker exec -it ecards-redis redis-cli"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
