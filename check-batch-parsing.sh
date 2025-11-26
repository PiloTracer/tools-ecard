#!/bin/bash
# Batch Parsing Diagnostic Script
# Run this to diagnose why parsing is not working

echo "🔍 BATCH PARSING DIAGNOSTICS"
echo "========================================"
echo ""

# 1. Check if services are running
echo "1️⃣ Checking Docker Services..."
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "api-server|redis|postgres|cassandra"
echo ""

# 2. Check Redis
echo "2️⃣ Checking Redis Connection..."
docker exec redis redis-cli ping 2>/dev/null || echo "❌ Redis not responding"
echo ""

# 3. Check API Server logs (last 20 lines)
echo "3️⃣ API Server Startup Logs (last 20 lines)..."
docker logs api-server --tail 20 2>&1 | grep -E "worker|queue|Redis|parsing"
echo ""

# 4. Check queue stats via diagnostic endpoint
echo "4️⃣ Queue Statistics..."
curl -s http://localhost:7200/api/diagnostics/queue-stats 2>/dev/null | jq '.' || echo "❌ Could not reach diagnostic endpoint"
echo ""

# 5. Check Redis queue directly
echo "5️⃣ Redis Queue Contents..."
echo "Jobs in queue: $(docker exec redis redis-cli LLEN batch-parse-queue 2>/dev/null || echo '?')"
echo "Delayed jobs: $(docker exec redis redis-cli ZCARD bull:batch-parse-queue:delayed 2>/dev/null || echo '?')"
echo "Active jobs: $(docker exec redis redis-cli LLEN bull:batch-parse-queue:active 2>/dev/null || echo '?')"
echo "Failed jobs: $(docker exec redis redis-cli ZCARD bull:batch-parse-queue:failed 2>/dev/null || echo '?')"
echo ""

# 6. Check latest batch in database
echo "6️⃣ Latest Batch Status..."
docker exec postgres psql -U ecards -d ecards -t -c "SELECT id, file_name, status, error_message FROM batches ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || echo "❌ Could not query database"
echo ""

# 7. Check Python availability
echo "7️⃣ Python Environment..."
docker exec api-server python3 --version 2>/dev/null || echo "❌ Python not installed"
docker exec api-server which python3 2>/dev/null || echo "❌ Python not in PATH"
echo ""

# 8. Check Python dependencies
echo "8️⃣ Python Dependencies..."
docker exec api-server bash -c "cd batch-parsing 2>/dev/null && pip list 2>/dev/null | grep -E 'pandas|boto3|cassandra|psycopg2'" 2>/dev/null || echo "❌ Cannot check Python deps (may not be installed)"
echo ""

echo "========================================"
echo "✅ Diagnostic Complete"
echo ""
echo "Next Steps:"
echo "  - If Redis is not running: docker-compose up -d redis"
echo "  - If worker not started: Check API server logs above"
echo "  - If queue has jobs but not processing: Worker may not be listening"
echo "  - If Python not found: Need to install Python in container"
