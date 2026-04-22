#!/usr/bin/env bash
# start.sh — Docker Compose helper for tools-ecards (E-Cards)
# Dev stack: docker-compose.dev.yml + .env (or .env.dev)
#
# Usage: ./bin/start.sh [dev|stg|prd]
# Only "dev" is fully supported unless you add docker-compose.stg.yml / docker-compose.prd.yml.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET_ENV="${1:-}"

# --- Resolve environment -----------------------------------------------------
if [ -z "$TARGET_ENV" ]; then
  if [ -f "$PROJECT_ROOT/.env" ]; then
    TARGET_ENV="dev"
    echo "Auto-selected: dev (using $PROJECT_ROOT/.env)"
  elif [ -f "$PROJECT_ROOT/.env.dev" ]; then
    TARGET_ENV="dev"
    echo "Auto-selected: dev (using $PROJECT_ROOT/.env.dev)"
  else
    echo "❌ No $PROJECT_ROOT/.env or .env.dev found."
    echo "   Copy .env.dev.example to .env and adjust values, then retry."
    exit 1
  fi
else
  TARGET_ENV=$(echo "$TARGET_ENV" | tr '[:upper:]' '[:lower:]')
fi

if [[ "$TARGET_ENV" != "dev" && "$TARGET_ENV" != "stg" && "$TARGET_ENV" != "prd" ]]; then
  echo "❌ Invalid environment: $TARGET_ENV"
  echo "Usage: $0 [dev|stg|prd]"
  exit 1
fi

case "$TARGET_ENV" in
  dev)
    COMPOSE_FILE="$PROJECT_ROOT/docker-compose.dev.yml"
    if [ -f "$PROJECT_ROOT/.env" ]; then
      ENV_FILE="$PROJECT_ROOT/.env"
    else
      ENV_FILE="$PROJECT_ROOT/.env.dev"
    fi
    if [ -d "/mnt/data" ]; then BACKUP_BASE="/mnt/data"; else BACKUP_BASE="/data"; fi
    ;;
  stg)
    COMPOSE_FILE="$PROJECT_ROOT/docker-compose.stg.yml"
    ENV_FILE="$PROJECT_ROOT/.env.stg"
    BACKUP_BASE="/data"
    ;;
  prd)
    COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prd.yml"
    ENV_FILE="$PROJECT_ROOT/.env.prd"
    BACKUP_BASE="/data"
    ;;
esac

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "❌ Compose file not found: $COMPOSE_FILE"
  echo "   This repository currently ships docker-compose.dev.yml for local development."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Env file not found: $ENV_FILE"
  exit 1
fi

# --- Compose project name (must match Docker volume prefix) ------------------
PROJ_NAME=""
if grep -qE '^[[:space:]]*COMPOSE_PROJECT_NAME=' "$ENV_FILE" 2>/dev/null; then
  PROJ_NAME=$(grep -E '^[[:space:]]*COMPOSE_PROJECT_NAME=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | sed "s/^['\"]//;s/['\"]$//" | xargs)
fi
if [ -z "$PROJ_NAME" ]; then
  PROJ_NAME=$(basename "$PROJECT_ROOT")
  echo "INFO: COMPOSE_PROJECT_NAME not set in $ENV_FILE — assuming Docker project name: $PROJ_NAME"
fi

VOL_PREFIX="${PROJ_NAME}_"
PG_VOLUME="${VOL_PREFIX}postgres_data"
REDIS_VOLUME="${VOL_PREFIX}redis_data"
CASSANDRA_VOLUME="${VOL_PREFIX}cassandra_data"
BACKUP_DIR="${BACKUP_BASE}/backups_${PROJ_NAME}"

if docker compose version &>/dev/null; then
  DOCKER_COMPOSE=(docker compose)
elif docker-compose version &>/dev/null; then
  DOCKER_COMPOSE=(docker-compose)
else
  echo "ERROR: Neither 'docker compose' nor 'docker-compose' is available."
  exit 1
fi

run_compose() {
  "${DOCKER_COMPOSE[@]}" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

echo "========================================="
echo "   tools-ecards — Docker manager"
echo "========================================="
echo "Environment:    $TARGET_ENV"
echo "Project name:   $PROJ_NAME"
echo "Volumes:        $PG_VOLUME / $REDIS_VOLUME / $CASSANDRA_VOLUME"
echo "Backup dir:     $BACKUP_DIR"
echo "Compose file:   $COMPOSE_FILE"
echo "Env file:       $ENV_FILE"
echo "========================================="
echo ""

pause() {
  read -r -n1 -s -p "Press any key to continue..." || true
  echo
}

# Compose creates named volumes on first up — no external volume pre-create.
ensure_volumes_info() {
  echo "Compose-managed volumes (created on first successful 'up'):"
  for v in "$PG_VOLUME" "$REDIS_VOLUME" "$CASSANDRA_VOLUME"; do
    if docker volume inspect "$v" &>/dev/null; then
      echo "  ✓ $v"
    else
      echo "  — $v (not created yet — run option 1)"
    fi
  done
}

prune_anonymous_volumes() {
  echo "Pruning dangling anonymous volumes (keeping ${PROJ_NAME}_*)..."
  local list
  list=$(docker volume ls -q -f dangling=true 2>/dev/null || true)
  while IFS= read -r volume_name; do
    [ -z "$volume_name" ] && continue
    case "$volume_name" in
      "${PROJ_NAME}_"*) continue ;;
    esac
    echo "  Removing: $volume_name"
    docker volume rm "$volume_name" 2>/dev/null || true
  done <<< "$list"
  echo "Done."
}

up() {
  clear || true
  echo "Bringing up $TARGET_ENV..."
  if ! run_compose up -d --build; then
    echo "❌ Startup failed."
    pause
    return 0
  fi
  prune_anonymous_volumes
  echo ""
  echo "✅ Stack is up."
  run_compose ps
  pause
}

down() {
  clear || true
  echo "Stopping stack..."
  run_compose down --remove-orphans
  prune_anonymous_volumes
  echo "Stopped."
  pause
}

cleanup() {
  clear || true
  echo "Stopping stack (images kept)..."
  run_compose down --remove-orphans
  docker container prune -f
  docker network prune -f
  echo "Cleanup done."
  pause
}

full_cleanup() {
  clear || true
  echo "FULL cleanup: removing images used by this compose project (volumes kept)."
  run_compose down --rmi local --remove-orphans
  prune_anonymous_volumes
  echo "Done."
  pause
}

force_rebuild() {
  clear || true
  echo "Force rebuild (no cache)..."
  run_compose down --remove-orphans
  if ! run_compose build --no-cache; then
    echo "❌ Build failed."
    pause
    return 0
  fi
  run_compose up -d --build
  prune_anonymous_volumes
  echo "Rebuild complete."
  pause
}

restart() {
  clear || true
  echo "Restarting all services..."
  run_compose restart
  echo "Done."
  pause
}

mount_and_start() {
  clear || true
  echo "⚠️  DANGER: restore from backup tarballs into named volumes"
  echo "    Volumes: $PG_VOLUME, $REDIS_VOLUME, $CASSANDRA_VOLUME"
  echo "    Backup dir: $BACKUP_DIR"
  read -r -p "Type YES to continue: " confirm
  if [ "$confirm" != "YES" ]; then echo "Cancelled."; pause; return 0; fi

  [ -f "$BACKUP_DIR/_backup_pg.tar.gz" ] && echo "✓ pg backup found" || { echo "❌ missing $BACKUP_DIR/_backup_pg.tar.gz"; pause; return 0; }
  [ -f "$BACKUP_DIR/_backup_redis.tar.gz" ] && echo "✓ redis backup found" || { echo "❌ missing $BACKUP_DIR/_backup_redis.tar.gz"; pause; return 0; }
  [ -f "$BACKUP_DIR/_backup_cassandra.tar.gz" ] && echo "✓ cassandra backup found" || echo "⚠️  cassandra backup optional — missing _backup_cassandra.tar.gz"

  run_compose down

  for v in "$PG_VOLUME" "$REDIS_VOLUME" "$CASSANDRA_VOLUME"; do
    docker volume rm "$v" 2>/dev/null || true
    docker volume create "$v" >/dev/null
  done

  echo "Restoring PostgreSQL volume..."
  docker run --rm -v "${PG_VOLUME}:/data" -v "$BACKUP_DIR:/backup" busybox sh -c "tar xzf /backup/_backup_pg.tar.gz -C /data"
  echo "Restoring Redis volume..."
  docker run --rm -v "${REDIS_VOLUME}:/data" -v "$BACKUP_DIR:/backup" busybox sh -c "tar xzf /backup/_backup_redis.tar.gz -C /data"
  if [ -f "$BACKUP_DIR/_backup_cassandra.tar.gz" ]; then
    echo "Restoring Cassandra volume..."
    docker run --rm -v "${CASSANDRA_VOLUME}:/data" -v "$BACKUP_DIR:/backup" busybox sh -c "tar xzf /backup/_backup_cassandra.tar.gz -C /data"
  fi

  run_compose up -d --build
  prune_anonymous_volumes
  echo "Restore complete."
  pause
}

backup() {
  clear || true
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  echo "Manual backup: $TIMESTAMP"
  mkdir -p "$BACKUP_DIR"

  echo "Backing up Redis..."
  docker run --rm -v "${REDIS_VOLUME}:/data" -v "$BACKUP_DIR:/backup" busybox sh -c "tar czf /backup/redis_${TIMESTAMP}.tar.gz -C /data ."
  echo "Backing up PostgreSQL..."
  docker run --rm -v "${PG_VOLUME}:/data" -v "$BACKUP_DIR:/backup" busybox sh -c "tar czf /backup/pg_${TIMESTAMP}.tar.gz -C /data ."
  echo "Backing up Cassandra..."
  docker run --rm -v "${CASSANDRA_VOLUME}:/data" -v "$BACKUP_DIR:/backup" busybox sh -c "tar czf /backup/cassandra_${TIMESTAMP}.tar.gz -C /data ." || echo "⚠️  Cassandra backup failed (volume missing?)"

  ln -sf "$BACKUP_DIR/redis_${TIMESTAMP}.tar.gz" "$BACKUP_DIR/_backup_redis.tar.gz"
  ln -sf "$BACKUP_DIR/pg_${TIMESTAMP}.tar.gz" "$BACKUP_DIR/_backup_pg.tar.gz"
  ln -sf "$BACKUP_DIR/cassandra_${TIMESTAMP}.tar.gz" "$BACKUP_DIR/_backup_cassandra.tar.gz" 2>/dev/null || true

  RETENTION_DAYS=7
  find "$BACKUP_DIR" -maxdepth 1 -name "redis_*.tar.gz" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
  find "$BACKUP_DIR" -maxdepth 1 -name "pg_*.tar.gz" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
  find "$BACKUP_DIR" -maxdepth 1 -name "cassandra_*.tar.gz" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

  echo "Backup complete."
  ls -lh "$BACKUP_DIR" | grep "$TIMESTAMP" || ls -lh "$BACKUP_DIR"
  pause
}

view_logs() {
  clear || true
  echo "Logs (Ctrl+C to stop following)..."
  run_compose logs -f --tail=100
  pause
}

check_volumes() {
  clear || true
  ensure_volumes_info
  pause
}

# --- Main menu ---------------------------------------------------------------
while true; do
  clear || true
  echo "========================================="
  echo "   tools-ecards — Docker: $TARGET_ENV"
  echo "========================================="
  echo " 1. Up (build & start)"
  echo " 2. Down (stop)"
  echo " 3. Cleanup (stop, prune containers/networks)"
  echo " 4. Force rebuild (no cache)"
  echo " 5. Restart"
  echo " 6. RESTORE backup (overwrites DB volumes!)"
  echo " 7. Backup (manual — postgres + redis + cassandra volumes)"
  echo " 8. View logs"
  echo " 9. Full cleanup (remove local images for this compose)"
  echo " 0. Exit"
  echo "-----------------------------------------"
  echo " A. Check volume status"
  echo "========================================="
  read -r -p "Select: " opt
  case "$opt" in
    1) up ;;
    2) down ;;
    3) cleanup ;;
    4) force_rebuild ;;
    5) restart ;;
    6) mount_and_start ;;
    7) backup ;;
    8) view_logs ;;
    9) full_cleanup ;;
    0) exit 0 ;;
    [aA]) check_volumes ;;
    *) ;;
  esac
done
