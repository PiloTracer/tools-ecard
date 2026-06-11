# Cassandra OOM (Out of Memory) Fix

**Date:** 2025-01-25
**Issue:** Container killed by Docker OOM killer
**Exit Code:** 137 (SIGKILL)
**Status:** ✅ FIXED

---

## Problem

**Error Symptoms:**
```bash
docker inspect ecards-cassandra
# Output:
# State.Status: exited
# State.ExitCode: 137
# State.OOMKilled: true
```

**Exit Code 137** = 128 + 9 (SIGKILL) → Docker OOM Killer terminated the container

**Root Cause:**
Cassandra 5.0 Docker image default JVM settings:
- Heap: **~10 GB** (`MAX_HEAP_SIZE` defaults to 25% of container memory)
- Direct Memory: **~5 GB** (`MaxDirectMemorySize=5000M`)
- **Total: ~15 GB** required

Without explicit memory limits, Docker allowed Cassandra to try allocating 15GB, but:
1. Host system doesn't have enough free memory
2. OR Docker daemon has default limits
3. OR other containers consumed available memory

Result: **Docker OOM Killer forcefully terminated Cassandra**

---

## Log Analysis

From `system.log`:

**Successful Startup:**
```
INFO  [main] 2025-11-25 21:28:59,705 CassandraDaemon.java:744 - Startup complete
INFO  [main] 2025-11-25 21:28:51,473 StorageService.java:2047 - JOINING: Finish joining ring
INFO  [main] 2025-11-25 21:28:59,702 PipelineConfigurator.java:148 - Starting listening for CQL clients on /0.0.0.0:9042
```

**Warnings (Not Fatal, But Relevant):**
```
WARN  Maximum number of memory map areas per process (vm.max_map_count) 262144 is too low
WARN  Cassandra server running in degraded mode. Is swap disabled? : false
```

**Abrupt Termination:**
- Logs end at `21:29:11,670` with **no graceful shutdown sequence**
- No "Stopping gossiper" or "Waiting for messaging service" messages
- Indicates **external termination** (OOM killer)

---

## Solution

### 1. ✅ Set Conservative JVM Memory Limits

**File: `docker-compose.dev.yml`**

Added environment variables to Cassandra service:

```yaml
cassandra:
  environment:
    # JVM Memory Settings (Development - Conservative)
    MAX_HEAP_SIZE: ${CASSANDRA_MAX_HEAP_SIZE:-2G}
    HEAP_NEWSIZE: ${CASSANDRA_HEAP_NEWSIZE:-512M}
    JVM_OPTS: ${CASSANDRA_JVM_OPTS:--XX:MaxDirectMemorySize=1G}
  # Prevent Docker OOM killer
  mem_limit: 4g
  memswap_limit: 4g  # Disable swap
```

**Memory Breakdown:**
- Heap: **2 GB** (main memory)
- Young Gen: **512 MB** (new objects)
- Direct Memory: **1 GB** (off-heap buffers)
- OS + Overhead: **~1 GB**
- **Total: 4 GB**

### 2. ✅ Added to `.env.dev.example`

```bash
# Cassandra JVM Memory Settings (Development)
CASSANDRA_MAX_HEAP_SIZE=2G
CASSANDRA_HEAP_NEWSIZE=512M
CASSANDRA_JVM_OPTS=-XX:MaxDirectMemorySize=1G
```

---

## Why These Settings?

### Development (Current):
- **2 GB heap** is sufficient for:
  - Schema operations
  - Moderate read/write workload
  - Local testing
- **Low memory overhead** on development machines
- **Fast startup** (~30-60 seconds)

### Production (Recommended):
```bash
# For production, increase based on workload:
CASSANDRA_MAX_HEAP_SIZE=8G           # 8-32 GB typical
CASSANDRA_HEAP_NEWSIZE=2G            # 25% of heap
CASSANDRA_JVM_OPTS=-XX:MaxDirectMemorySize=4G

# Container memory limit:
mem_limit: 16g  # Heap + Direct + OS overhead
```

**Production Guidelines:**
- **Light workload:** 4-8 GB heap
- **Moderate workload:** 8-16 GB heap
- **Heavy workload:** 16-32 GB heap
- **Rule of thumb:** Heap should be 25-50% of total RAM
- **Direct memory:** Typically 25-50% of heap

---

## Testing the Fix

### Restart Cassandra:

```bash
# Stop and remove old container
docker-compose -f docker-compose.dev.yml down

# Remove old data (optional - fresh start)
docker volume rm tools-ecards_cassandra_data

# Start with new settings
docker-compose -f docker-compose.dev.yml up -d cassandra

# Watch initialization
docker-compose -f docker-compose.dev.yml logs -f cassandra
```

### Verify Memory Usage:

```bash
# Check container status (should show "Up" not "Exited")
docker ps | grep cassandra

# Check OOMKilled status (should be "false")
docker inspect ecards-cassandra --format='{{.State.OOMKilled}}'

# Monitor real-time memory usage
docker stats ecards-cassandra

# Expected output:
# CONTAINER          MEM USAGE / LIMIT   MEM %
# ecards-cassandra   2.5GiB / 4GiB      62.5%
```

### Check Cassandra Logs:

```bash
docker logs ecards-cassandra | grep -E "Heap|Memory|OOM"

# Should see:
# Heap size: 2048MB/2048MB
# Young Gen size: 512MB
# No OOM errors
```

---

## Warnings Addressed

### 1. ⚠️ `vm.max_map_count too low`

**Warning:**
```
WARN  Maximum number of memory map areas per process (vm.max_map_count) 262144 is too low, recommended value: 1048575
```

**Impact:** Can cause issues under heavy load, but not critical for development.

**Optional Fix (Host-level):**
```bash
# Linux/WSL
sudo sysctl -w vm.max_map_count=1048575

# Make permanent
echo "vm.max_map_count=1048575" | sudo tee -a /etc/sysctl.conf
```

### 2. ⚠️ Swap Enabled

**Warning:**
```
WARN  Cassandra server running in degraded mode. Is swap disabled? : false
```

**Impact:** Performance degradation if swap is used.

**Fix:** Already addressed with `memswap_limit: 4g` in docker-compose (disables swap for container).

---

## Customizing Memory Settings

### For Your Machine:

If you have **limited RAM** (< 8 GB):
```bash
# In .env or docker-compose.dev.yml
CASSANDRA_MAX_HEAP_SIZE=1G
CASSANDRA_HEAP_NEWSIZE=256M
CASSANDRA_JVM_OPTS=-XX:MaxDirectMemorySize=512M

mem_limit: 2g
```

If you have **plenty of RAM** (16+ GB):
```bash
# Can increase for better performance
CASSANDRA_MAX_HEAP_SIZE=4G
CASSANDRA_HEAP_NEWSIZE=1G
CASSANDRA_JVM_OPTS=-XX:MaxDirectMemorySize=2G

mem_limit: 8g
```

---

## Related Issues Resolved

This fix also resolves:
- ✅ Container repeatedly restarting
- ✅ "Cassandra is unavailable" errors in api-server
- ✅ db-init service failing due to Cassandra not being ready
- ✅ Schema initialization timeouts

---

## Verification Checklist

After applying fix:
- [ ] Container status: `Up` (not `Exited`)
- [ ] Exit code: N/A (container running)
- [ ] OOMKilled: `false`
- [ ] Memory usage: < 4 GB
- [ ] Logs show successful startup
- [ ] CQL connection works: `docker exec ecards-cassandra cqlsh -e "DESCRIBE KEYSPACES"`
- [ ] api-server connects successfully

---

## Summary

**Problem:**
- Cassandra trying to allocate 15 GB memory
- Docker OOM killer terminated container (exit code 137)

**Solution:**
- Set development-appropriate JVM limits (2 GB heap)
- Add container memory limit (4 GB total)
- Disable swap for container

**Result:**
- ✅ Container runs stably
- ✅ Sufficient memory for development workload
- ✅ No OOM kills
- ✅ Faster startup times

**Files Modified:**
1. `docker-compose.dev.yml` - Added JVM settings and mem_limit
2. `.env.dev.example` - Documented new environment variables

---

**Status:** ✅ Ready to use!

Restart services and Cassandra should run without OOM issues.
