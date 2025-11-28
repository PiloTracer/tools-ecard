# Cassandra Production Configuration

This document outlines production-specific Cassandra configuration to resolve common warnings seen in development.

## Development vs Production

**Development (Current Setup):**
- Warnings are acceptable for local development
- Focus is on functionality, not performance optimization
- Memory limits are conservative to avoid OOM on developer machines

**Production (Required Optimizations):**
- All warnings below must be addressed
- Full performance tuning required
- Security hardening needed

---

## Warning 1: JMX Remote Connections

### Development Warning
```
JMX is not enabled to receive remote connections. Please see cassandra-env.sh for more info.
```

### Production Fix

**Option A: Enable JMX (Recommended for monitoring)**

Add to `docker-compose.prod.yml`:
```yaml
cassandra:
  environment:
    LOCAL_JMX: "no"  # Enable remote JMX
    JVM_OPTS: >-
      -Dcom.sun.management.jmxremote.port=7199
      -Dcom.sun.management.jmxremote.rmi.port=7199
      -Dcom.sun.management.jmxremote.ssl=false
      -Dcom.sun.management.jmxremote.authenticate=true
      -Djava.rmi.server.hostname=cassandra
```

**Option B: Disable JMX (Not recommended)**

Leave as-is if monitoring not needed (development only).

---

## Warning 2: Swap Not Disabled

### Development Warning
```
Cassandra server running in degraded mode. Is swap disabled? : false
```

### Production Fix

**Why this matters:**
- Cassandra performance degrades significantly when OS swaps memory to disk
- Database operations become unpredictable and slow

**Fix (Linux Host):**

```bash
# Disable swap permanently
sudo swapoff -a

# Edit /etc/fstab and comment out swap lines
sudo nano /etc/fstab
# Comment out line containing "swap"

# Verify swap is off
free -h  # Should show 0B swap
```

**Fix (Docker on Windows/Mac):**

Not applicable - Docker Desktop manages memory differently. Ensure Cassandra container has sufficient memory allocation (4GB minimum).

---

## Warning 3: vm.max_map_count Too Low

### Development Warning
```
Maximum number of memory map areas per process (vm.max_map_count) 262144 is too low,
recommended value: 1048575
```

### Production Fix

**Why this matters:**
- Cassandra uses memory-mapped files extensively
- Low limit causes "Out of memory" errors under load

**Fix (Linux Host):**

```bash
# Set temporarily (lost on reboot)
sudo sysctl -w vm.max_map_count=1048575

# Set permanently
echo "vm.max_map_count=1048575" | sudo tee -a /etc/sysctl.conf

# Verify
sysctl vm.max_map_count
```

**Fix (Docker on Windows/Mac):**

**Windows with WSL2:**
```powershell
# In PowerShell as Administrator
wsl -d docker-desktop
sysctl -w vm.max_map_count=1048575
```

**Mac:**
```bash
# Create Docker Desktop setting
screen ~/Library/Containers/com.docker.docker/Data/vms/0/tty
# Then run: sysctl -w vm.max_map_count=1048575
```

---

## Memory Configuration

### Development (Current)
```yaml
MAX_HEAP_SIZE: 2G
HEAP_NEWSIZE: 512M
mem_limit: 4g
```

### Production (Recommended)

For production workloads, allocate more memory:

```yaml
cassandra:
  environment:
    MAX_HEAP_SIZE: 8G        # 50% of total RAM
    HEAP_NEWSIZE: 2G         # 25% of heap
    JVM_OPTS: >-
      -XX:MaxDirectMemorySize=8G
  mem_limit: 24g             # Total container limit
  memswap_limit: 24g         # Disable swap
```

**Memory Guidelines:**
- **Heap:** 50% of available RAM (max 32GB)
- **Young Gen:** 25% of heap size
- **Direct Memory:** Same as heap size
- **Total Container:** 3x heap size (heap + direct + overhead)

---

## Complete Production docker-compose Example

```yaml
cassandra:
  image: cassandra:5.0
  container_name: ecards-cassandra-prod
  environment:
    # Cluster config
    CASSANDRA_CLUSTER_NAME: ecards_production
    CASSANDRA_DC: datacenter1
    CASSANDRA_RACK: rack1
    CASSANDRA_ENDPOINT_SNITCH: GossipingPropertyFileSnitch

    # Memory (16GB RAM machine example)
    MAX_HEAP_SIZE: 8G
    HEAP_NEWSIZE: 2G

    # JMX (for monitoring)
    LOCAL_JMX: "no"

    # Performance
    JVM_OPTS: >-
      -XX:MaxDirectMemorySize=8G
      -Dcom.sun.management.jmxremote.port=7199
      -Dcom.sun.management.jmxremote.rmi.port=7199
      -Dcom.sun.management.jmxremote.ssl=false
      -Dcom.sun.management.jmxremote.authenticate=true

  volumes:
    - cassandra_prod_data:/var/lib/cassandra

  # Security
  networks:
    - backend-network  # Isolated network, not exposed to internet

  # Resource limits
  mem_limit: 24g
  memswap_limit: 24g

  # Restart policy
  restart: unless-stopped

  # Health check
  healthcheck:
    test: ["CMD-SHELL", "cqlsh -e 'describe cluster'"]
    interval: 30s
    timeout: 10s
    retries: 5
    start_period: 120s  # Longer for production startup
```

---

## Production Checklist

Before deploying to production:

- [ ] Disable swap on host (`sudo swapoff -a`)
- [ ] Set `vm.max_map_count=1048575` on host
- [ ] Configure JMX with authentication
- [ ] Increase memory allocation (min 8GB heap)
- [ ] Use dedicated backend network (not exposed)
- [ ] Enable authentication (`cassandra.yaml`)
- [ ] Configure SSL/TLS for client connections
- [ ] Set up monitoring (Prometheus, Grafana, DataStax tools)
- [ ] Configure backups (snapshots + incremental)
- [ ] Document disaster recovery procedures

---

## References

- [Cassandra Production Recommendations](https://cassandra.apache.org/doc/latest/cassandra/operating/hardware.html)
- [Docker Cassandra Best Practices](https://hub.docker.com/_/cassandra)
- [DataStax Production Guide](https://docs.datastax.com/en/cassandra-oss/3.x/cassandra/initialize/initTOC.html)
