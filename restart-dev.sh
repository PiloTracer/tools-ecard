#!/bin/bash
# Reset development environment - deletes all data and restarts fresh

set -e  # Exit on any error

echo "🔄 RESTART DEVELOPMENT ENVIRONMENT"
echo ""
echo "This will:"
echo "  1. Stop all containers"
echo "  2. Rebuilds automatically when necessary"
echo "  3. Start services again"
echo ""
echo "Note: Data volumes will be preserved"
echo ""

# Prompt for confirmation
read -p "Are you sure you want to continue? Type 'yes' to confirm: " confirm

if [ "$confirm" != "yes" ]; then
  echo ""
  echo "❌ Restart cancelled"
  exit 0
fi

echo ""
echo "🛑 Stopping containers..."
docker compose -f docker-compose.dev.yml down

echo ""
echo "✅ Services stopped!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔨 Rebuilding services..."
echo ""

# Rebuild all services and save output to build.log
docker compose -f docker-compose.dev.yml build 2>&1 | tee build.log

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 Starting environment..."
echo ""

# Execute start-dev.sh to bring services back up
./start-dev.sh
