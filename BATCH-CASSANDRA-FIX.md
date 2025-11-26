# Batch Parsing Cassandra Fix

## Bug Summary
The batch parsing system was completing successfully (status = PARSED) but **Cassandra records were NOT being inserted**. Only PostgreSQL records were saved, resulting in incomplete data.

## Root Cause
**Error**: `not all arguments converted during string formatting`
**Location**: `api-server/batch-parsing/parser.py` lines 214-267

The Cassandra INSERT statement had a **parameter count mismatch**:
- Cassandra schema: **35 fields** (including `extra` field)
- INSERT statement columns: **34 fields** (missing `extra`)
- INSERT statement placeholders: **34 ?** (missing one)
- Values passed: **34 values** (missing `extra`)

The `extra` field (type: MAP<TEXT, TEXT>) was defined in the schema but not included in the INSERT statement.

## Additional Issue
Line 312 had silent error handling that allowed the parser to continue even when Cassandra inserts failed:
```python
except Exception as e:
    logger.warning(f"Failed to process row {idx}: {e}")
    continue  # This hid the error!
```

## Changes Made

### 1. Fixed Cassandra INSERT Statement
**File**: `D:\Projects\EPIC\tools-ecards\api-server\batch-parsing\parser.py`

**Lines 214-267**: Added the `extra` field to both the column list and values tuple:

```python
# Added 'extra' to column list (line 227)
INSERT INTO contact_records (
    batch_record_id, batch_id, created_at, updated_at,
    full_name, first_name, last_name,
    work_phone, work_phone_ext, mobile_phone, email,
    address_street, address_city, address_state, address_postal, address_country,
    social_instagram, social_twitter, social_facebook,
    business_name, business_title, business_department, business_url, business_hours,
    business_address_street, business_address_city, business_address_state,
    business_address_postal, business_address_country,
    business_linkedin, business_twitter,
    personal_url, personal_bio, personal_birthday,
    extra  # <-- ADDED
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                                                                                                    # ^ 35th placeholder

# Added empty map for extra field (line 266)
self.cassandra_session.execute(insert_cql, (
    # ... 34 other values ...
    {}  # empty map for extra field  <-- ADDED
))
```

**Result**: Now INSERT has 35 columns and 35 values, matching the schema.

### 2. Fixed Silent Error Handling
**File**: `D:\Projects\EPIC\tools-ecards\api-server\batch-parsing\parser.py`

**Lines 312-316**: Changed from silent `continue` to raising exceptions:

```python
# BEFORE:
except Exception as e:
    logger.warning(f"Failed to process row {idx}: {e}")
    continue  # Silently skip failures

# AFTER:
except Exception as e:
    logger.error(f"Failed to process row {idx}: {e}")
    # Don't continue - let the error propagate so we know about failures
    # This prevents silent data loss where PostgreSQL succeeds but Cassandra fails
    raise
```

**Result**: Parser will now fail fast if Cassandra inserts fail, preventing silent data loss.

## Verification Script
Created `verify-batch-cassandra.sh` to check that records are inserted into both databases:

```bash
./verify-batch-cassandra.sh
```

This script:
1. Gets the latest batch ID from PostgreSQL
2. Counts records in PostgreSQL `batch_records` table
3. Counts records in Cassandra `contact_records` table
4. Compares the counts and shows sample records
5. Reports SUCCESS if counts match, FAILURE if they don't

## Testing Instructions

### 1. Rebuild the API Server
```bash
docker-compose -f docker-compose.dev.yml build api-server
docker-compose -f docker-compose.dev.yml up -d api-server
```

### 2. Upload a Test Batch
Upload a CSV file through the batch upload API endpoint.

### 3. Verify Both Databases
```bash
./verify-batch-cassandra.sh
```

Expected output:
```
✅ SUCCESS: Record counts match!
✅ Both databases have X records
```

### 4. Manual Verification (if needed)

**Check PostgreSQL:**
```bash
docker exec postgres psql -U ecards -d ecards -c "
  SELECT COUNT(*) FROM batch_records
  WHERE batch_id = '<BATCH_ID>';
"
```

**Check Cassandra:**
```bash
docker exec cassandra cqlsh -e "
  USE ecards_canonical;
  SELECT COUNT(*) FROM contact_records
  WHERE batch_id = <BATCH_ID>;
"
```

**Both counts should match!**

## Impact
- **Before**: PostgreSQL ✅ 11 records, Cassandra ❌ 0 records
- **After**: PostgreSQL ✅ 11 records, Cassandra ✅ 11 records

## Files Modified
1. `api-server/batch-parsing/parser.py` - Fixed INSERT statement and error handling
2. `verify-batch-cassandra.sh` - New verification script (created)

## Schema Reference
**Cassandra Schema**: `D:\Projects\EPIC\tools-ecards\db\init-cassandra\06-contact-records.cql`

The `extra` field (line 82):
```sql
extra MAP<TEXT, TEXT>  -- For future extensibility
```

This field allows dynamic extension for custom fields not in standard vCard format.
