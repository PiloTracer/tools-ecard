#!/bin/bash
# Verification script for batch parsing Cassandra fix
# This script verifies that records are being inserted into BOTH PostgreSQL AND Cassandra

echo "========================================="
echo "BATCH PARSING CASSANDRA FIX VERIFICATION"
echo "========================================="
echo ""

# Get the latest batch ID
echo "1. Fetching latest batch..."
LATEST_BATCH=$(docker exec postgres psql -U ecards -d ecards -t -A -c "SELECT id FROM batches ORDER BY created_at DESC LIMIT 1;" 2>/dev/null | tr -d '[:space:]')

if [ -z "$LATEST_BATCH" ]; then
    echo "   No batches found in database"
    exit 1
fi

echo "   Latest batch ID: $LATEST_BATCH"
echo ""

# Check batch status
echo "2. Checking batch status..."
docker exec postgres psql -U ecards -d ecards -c "SELECT id, file_name, status, records_count, records_processed FROM batches WHERE id = '$LATEST_BATCH';" 2>/dev/null
echo ""

# Count PostgreSQL records
echo "3. Counting PostgreSQL batch_records..."
PG_COUNT=$(docker exec postgres psql -U ecards -d ecards -t -A -c "SELECT COUNT(*) FROM batch_records WHERE batch_id = '$LATEST_BATCH';" 2>/dev/null)
echo "   PostgreSQL records: $PG_COUNT"
echo ""

# Count Cassandra records
echo "4. Counting Cassandra contact_records..."
CASS_COUNT=$(docker exec cassandra cqlsh -e "USE ecards_canonical; SELECT COUNT(*) FROM contact_records WHERE batch_id = $LATEST_BATCH;" 2>/dev/null | grep -oP '\d+' | tail -1)
echo "   Cassandra records: ${CASS_COUNT:-0}"
echo ""

# Compare counts
echo "5. Verification Result..."
if [ "$PG_COUNT" = "${CASS_COUNT:-0}" ] && [ "$PG_COUNT" != "0" ]; then
    echo "   ✅ SUCCESS: Record counts match!"
    echo "   ✅ Both databases have $PG_COUNT records"
else
    echo "   ❌ FAILURE: Record counts DO NOT match!"
    echo "   PostgreSQL: $PG_COUNT records"
    echo "   Cassandra: ${CASS_COUNT:-0} records"
    echo ""
    echo "   This indicates the bug is still present."
fi
echo ""

# Sample records from each database
echo "6. Sample PostgreSQL record..."
docker exec postgres psql -U ecards -d ecards -c "SELECT id, full_name, email, business_name FROM batch_records WHERE batch_id = '$LATEST_BATCH' LIMIT 1;" 2>/dev/null
echo ""

echo "7. Sample Cassandra record..."
docker exec cassandra cqlsh -e "USE ecards_canonical; SELECT batch_record_id, full_name, email, business_name FROM contact_records WHERE batch_id = $LATEST_BATCH LIMIT 1;" 2>/dev/null
echo ""

echo "========================================="
echo "Verification complete!"
echo ""
echo "To test the fix:"
echo "  1. Upload a new batch file via the API"
echo "  2. Wait for parsing to complete"
echo "  3. Run this script again: ./verify-batch-cassandra.sh"
echo "========================================="
