#!/bin/bash
# Reset development environment - deletes all data and restarts fresh

set -e  # Exit on any error

echo "⚠️  RESET DEVELOPMENT ENVIRONMENT"
echo ""
echo "This will:"
echo "  1. Stop all containers"
echo "  2. Delete ALL volumes (PostgreSQL, Cassandra, Redis data)"
echo "  3. Remove all containers and networks"
echo "  4. Rebuilds all containers"
echo "  5. Start fresh environment"
echo ""
echo "⚠️  WARNING: All database data will be permanently deleted!"
echo ""

# Prompt for confirmation
read -p "Are you sure you want to continue? Type 'yes' to confirm: " confirm

if [ "$confirm" != "yes" ]; then
  echo ""
  echo "❌ Reset cancelled"
  exit 0
fi

echo ""
echo "🗑️  Stopping containers and removing volumes..."
docker compose -f docker-compose.dev.yml down -v --remove-orphans

echo ""
echo "✅ Environment reset complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔨 Rebuilding all services..."
echo ""

# Rebuild all services to ensure fresh images
docker compose -f docker-compose.dev.yml build 2>&1 | tee build.log

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 Starting fresh environment..."
echo ""

# Execute start-dev.sh to bring up fresh environment
./start-dev.sh
