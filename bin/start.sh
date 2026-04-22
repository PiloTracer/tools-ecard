#!/usr/bin/env bash
# bin/start.sh — Docker Compose helper for tools-ecards (E-Cards)
#
# Interactive menu (default when only env is given):
#   ./bin/start.sh
#   ./bin/start.sh dev
#
# CLI (no menu — runs command and exits):
#   ./bin/start.sh dev up
#   ./bin/start.sh dev up-build
#   ./bin/start.sh dev status
#   ./bin/start.sh dev help
#
# Environments: dev | stg | prd  (aliases: development, staging, prod|production)
# Only dev is fully supported unless docker-compose.stg.yml / docker-compose.prd.yml exist.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat <<'EOF'
tools-ecards — Docker Compose helper

Usage:
  ./bin/start.sh [dev|stg|prd]           Interactive menu
  ./bin/start.sh [env] <command>       Run one command and exit

Commands:
  up            Start stack (up -d, no image rebuild), wait for API /health, print URLs
  up-build      Start stack with image rebuild (--build)
  down          Stop stack (down --remove-orphans)
  logs          Follow all service logs (tail 100)
  status        Show paths, compose project, volumes, short compose ps
  restart       docker compose restart
  rebuild       Down → build (tee build.log) → up — keeps named volumes
  reset         Down -v (deletes compose volumes/data) → build → up — destructive
  force-rebuild Down → build --no-cache → up — keeps volumes
  menu          Open interactive menu
  help, -h      Show this help

Environment:
  ECARDS_URL_HOST   Host printed in URLs (default: localhost)
EOF
}

# --- Normalize environment name ---------------------------------------------
normalize_env() {
  case "$(echo "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    dev | development) echo dev ;;
    stg | staging) echo stg ;;
    prd | prod | production) echo prd ;;
    *) echo "" ;;
  esac
}

ECARDS_CLI_CMD=""
TARGET_ENV=""

# --- Argument parsing ---------------------------------------------------------
if [ "${#}" -ge 2 ]; then
  TARGET_ENV="$(normalize_env "$1")"
  if [ -z "$TARGET_ENV" ]; then
    echo "Unknown environment: $1" >&2
    usage >&2
    exit 1
  fi
  ECARDS_CLI_CMD="$(echo "$2" | tr '[:upper:]' '[:lower:]' | tr '_' '-')"
  case "$ECARDS_CLI_CMD" in
    up | up-build | down | logs | status | restart | rebuild | reset | force-rebuild | menu | help | -h | --help) ;;
    *)
      echo "Unknown command: $2" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift 2
elif [ "${#}" -eq 1 ]; then
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    -h | --help | help)
      usage
      exit 0
      ;;
  esac
  TARGET_ENV="$(normalize_env "$1")"
  if [ -z "$TARGET_ENV" ]; then
    echo "Unknown environment: $1" >&2
    usage >&2
    exit 1
  fi
else
  if [ -f "$PROJECT_ROOT/.env" ]; then
    TARGET_ENV="dev"
    echo "Auto-selected: dev (using $PROJECT_ROOT/.env)"
  elif [ -f "$PROJECT_ROOT/.env.dev" ]; then
    TARGET_ENV="dev"
    echo "Auto-selected: dev (using $PROJECT_ROOT/.env.dev)"
  else
    echo "No $PROJECT_ROOT/.env or .env.dev found."
    echo "Copy .env.dev.example to .env and adjust values, then retry."
    exit 1
  fi
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
  echo "Compose file not found: $COMPOSE_FILE"
  echo "This repository ships docker-compose.dev.yml for local development."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Env file not found: $ENV_FILE"
  exit 1
fi

# --- Compose project name & published ports -----------------------------------
PROJ_NAME=""
if grep -qE '^[[:space:]]*COMPOSE_PROJECT_NAME=' "$ENV_FILE" 2>/dev/null; then
  PROJ_NAME=$(grep -E '^[[:space:]]*COMPOSE_PROJECT_NAME=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | sed "s/^['\"]//;s/['\"]$//" | xargs)
fi
if [ -z "$PROJ_NAME" ]; then
  PROJ_NAME=$(basename "$PROJECT_ROOT")
  echo "INFO: COMPOSE_PROJECT_NAME not set in $ENV_FILE — Docker project name: $PROJ_NAME"
fi

VOL_PREFIX="${PROJ_NAME}_"
PG_VOLUME="${VOL_PREFIX}postgres_data"
REDIS_VOLUME="${VOL_PREFIX}redis_data"
CASSANDRA_VOLUME="${VOL_PREFIX}cassandra_data"
BACKUP_DIR="${BACKUP_BASE}/backups_${PROJ_NAME}"

read_env_port() {
  local key="$1"
  local def="$2"
  local line val
  line=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1) || true
  if [ -z "$line" ]; then echo "$def"; return; fi
  val=${line#*=}
  val=$(echo "$val" | tr -d '\r' | tr -d '"' | tr -d "'" | xargs)
  [ -n "$val" ] && echo "$val" || echo "$def"
}

# Read a non-port env value from ENV_FILE (first KEY= match); empty uses default.
read_env_value() {
  local key="$1"
  local def="$2"
  local line val
  line=$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" 2>/dev/null | head -1) || true
  if [ -z "$line" ]; then echo "$def"; return; fi
  val=${line#*=}
  val=$(echo "$val" | tr -d '\r' | sed "s/^['\"]//;s/['\"]$//" | xargs)
  [ -n "$val" ] && echo "$val" || echo "$def"
}

ECARDS_API_PORT="$(read_env_port API_PORT 7400)"
ECARDS_FRONT_PORT="$(read_env_port FRONTEND_HOST_PORT 7300)"
ECARDS_PG_PORT="$(read_env_port POSTGRES_HOST_PORT 7432)"
ECARDS_CASS_PORT="$(read_env_port CASSANDRA_NATIVE_PORT_HOST 7042)"
ECARDS_REDIS_PORT="$(read_env_port REDIS_HOST_PORT 7379)"
ECARDS_URL_HOST="${ECARDS_URL_HOST:-localhost}"

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

pause() {
  read -r -n1 -s -p "Press any key to continue..." || true
  echo
}

ensure_volumes_info() {
  echo "Compose-managed volumes (created on first successful 'up'):"
  for v in "$PG_VOLUME" "$REDIS_VOLUME" "$CASSANDRA_VOLUME"; do
    if docker volume inspect "$v" &>/dev/null; then
      echo "  ✓ $v"
    else
      echo "  — $v (not created yet — start the stack)"
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

wait_for_api_ready() {
  local max="${1:-120}"
  local n=0
  local H="127.0.0.1"
  echo "Waiting for API GET /health at http://${H}:${ECARDS_API_PORT}/health (up to ${max}s)..."
  while [ "$n" -lt "$max" ]; do
    if curl -sf "http://${H}:${ECARDS_API_PORT}/health" >/dev/null 2>&1; then
      echo "API health check passed."
      return 0
    fi
    sleep 1
    n=$((n + 1))
    if [ $((n % 20)) -eq 0 ]; then echo "  ... ${n}s"; fi
  done
  echo "Timeout waiting for API /health." >&2
  run_compose ps || true
  return 1
}

print_stack_urls() {
  local H="$ECARDS_URL_HOST"
  local ext_auth oauth_authz oauth_token oauth_user ext_user_api ext_sub_ws sub_url seaweed api_pub ws_pub oauth_redirect

  ext_auth="$(read_env_value NEXT_PUBLIC_EXTERNAL_AUTH_URL "")"
  [ -z "$ext_auth" ] && ext_auth="$(read_env_value EXTERNAL_AUTH_URL 'http://dev.aiepic.app/app')"
  oauth_authz="$(read_env_value NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT "")"
  [ -z "$oauth_authz" ] && oauth_authz="$(read_env_value OAUTH_AUTHORIZATION_ENDPOINT 'http://dev.aiepic.app/oauth/authorize')"
  oauth_token="$(read_env_value NEXT_PUBLIC_OAUTH_TOKEN_ENDPOINT "")"
  [ -z "$oauth_token" ] && oauth_token="$(read_env_value OAUTH_TOKEN_ENDPOINT 'http://dev.aiepic.app/oauth/token')"
  oauth_user="$(read_env_value NEXT_PUBLIC_OAUTH_USER_INFO_ENDPOINT "")"
  [ -z "$oauth_user" ] && oauth_user="$(read_env_value OAUTH_USER_INFO_ENDPOINT 'http://dev.aiepic.app/api/users/me')"
  ext_user_api="$(read_env_value EXTERNAL_USER_API 'http://dev.aiepic.app/admin/api')"
  ext_sub_ws="$(read_env_value EXTERNAL_SUBSCRIPTION_WS 'ws://dev.aiepic.app/admin/ws')"
  sub_url="$(read_env_value NEXT_PUBLIC_USER_SUBSCRIPTION_URL "")"
  [ -z "$sub_url" ] && sub_url="$(read_env_value USER_SUBSCRIPTION_URL 'http://dev.aiepic.app/app/features/user-subscription')"
  seaweed="$(read_env_value SEAWEEDFS_ENDPOINT 'http://host.docker.internal:8333')"
  api_pub="$(read_env_value NEXT_PUBLIC_API_URL "http://${H}:${ECARDS_API_PORT}")"
  ws_pub="$(read_env_value NEXT_PUBLIC_WS_URL "ws://${H}:${ECARDS_API_PORT}")"
  oauth_redirect="$(read_env_value OAUTH_REDIRECT_URI "http://${H}:${ECARDS_FRONT_PORT}/oauth/complete")"

  echo ""
  echo "Stack is up (env=$TARGET_ENV, project=$PROJ_NAME) — open in your browser (replace ${H} with your host if remote)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  E-Cards in this compose (direct host ports — not TD nginx)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Frontend (Next.js):    http://${H}:${ECARDS_FRONT_PORT}/"
  echo "  API (REST + WS):       http://${H}:${ECARDS_API_PORT}/   health: /health"
  echo "  Frontend→API (env):   NEXT_PUBLIC_API_URL=${api_pub}"
  echo "  Frontend→WS (env):    NEXT_PUBLIC_WS_URL=${ws_pub}"
  echo "  OAuth redirect (env):  OAUTH_REDIRECT_URI=${oauth_redirect}"
  echo ""
  echo "  Identity / OAuth platform (separate stack; URLs from $ENV_FILE)"
  echo "  — Paths match TD/nginx when that stack serves /app/, /oauth/, /api/, /admin/"
  echo "    Public app:          ${ext_auth%/}/"
  echo "    OAuth authorize:     ${oauth_authz}"
  echo "    OAuth token:         ${oauth_token}"
  echo "    User info (API):     ${oauth_user}"
  echo "    Admin user API:      ${ext_user_api}"
  echo "    Subscription WS:     ${ext_sub_ws}"
  echo "    User subscription:   ${sub_url}"
  echo ""
  echo "  If identity stack is on http://${H}/ (nginx), same paths apply, e.g."
  echo "    http://${H}/app/  http://${H}/oauth/  http://${H}/api/  http://${H}/admin/"
  echo ""
  echo "  Databases (CLI / clients, not a normal web page)"
  echo "    PostgreSQL:  ${H}:${ECARDS_PG_PORT}  user/db from $ENV_FILE (default ecards_user / ecards_db)"
  echo "    Redis:       ${H}:${ECARDS_REDIS_PORT}"
  echo "    Cassandra:   ${H}:${ECARDS_CASS_PORT}"
  echo ""
  echo "  SeaweedFS (optional; not in this compose):  SEAWEEDFS_ENDPOINT=${seaweed}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ${DOCKER_COMPOSE[*]} -f $(basename "$COMPOSE_FILE") exec -it postgres psql -U ecards_user -d ecards_db"
  echo "  ${DOCKER_COMPOSE[*]} -f $(basename "$COMPOSE_FILE") exec -it redis redis-cli"
  echo "  ${DOCKER_COMPOSE[*]} -f $(basename "$COMPOSE_FILE") exec -it cassandra cqlsh"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "CLI: $0 $TARGET_ENV logs | down | restart | rebuild | reset"
  echo ""
}

cmd_up_quick() {
  echo "Starting stack (no image rebuild)..."
  run_compose up -d
  prune_anonymous_volumes
  if ! wait_for_api_ready 120; then
    echo "Stack may still be starting — check: $0 $TARGET_ENV logs" >&2
    return 1
  fi
  print_stack_urls
}

cmd_up_build() {
  echo "Starting stack (with image rebuild)..."
  run_compose up -d --build
  prune_anonymous_volumes
  if ! wait_for_api_ready 180; then
    echo "Stack may still be starting — check: $0 $TARGET_ENV logs" >&2
    return 1
  fi
  print_stack_urls
}

cmd_down() {
  echo "Stopping stack..."
  run_compose down --remove-orphans
  prune_anonymous_volumes
  echo "Stopped."
}

cmd_logs() {
  run_compose logs -f --tail=100
}

cmd_status() {
  echo "Project root:       $PROJECT_ROOT"
  echo "Environment:        $TARGET_ENV"
  echo "Compose file:       $COMPOSE_FILE"
  echo "Env file:           $ENV_FILE"
  echo "Docker project:     $PROJ_NAME"
  echo "Backup directory:   $BACKUP_DIR"
  ensure_volumes_info
  echo ""
  run_compose ps
}

cmd_restart() {
  echo "Restarting all services..."
  run_compose restart
  if wait_for_api_ready 120; then
    print_stack_urls
  else
    echo "Warning: API /health not ready after restart — inspect logs." >&2
  fi
}

cmd_rebuild_stack() {
  echo "This will: down → build (see build.log) → up — named volumes are kept."
  read -r -p "Type yes to continue: " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    return 0
  fi
  run_compose down --remove-orphans
  run_compose build 2>&1 | tee "${PROJECT_ROOT}/build.log"
  run_compose up -d
  prune_anonymous_volumes
  if ! wait_for_api_ready 180; then
    return 1
  fi
  print_stack_urls
}

cmd_reset_stack() {
  echo "This will: down -v (DELETE compose volumes / DB data) → build → up."
  read -r -p "Type yes to confirm destructive reset: " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    return 0
  fi
  run_compose down -v --remove-orphans
  run_compose build 2>&1 | tee "${PROJECT_ROOT}/build.log"
  run_compose up -d
  prune_anonymous_volumes
  if ! wait_for_api_ready 180; then
    return 1
  fi
  print_stack_urls
}

cmd_force_rebuild() {
  echo "Force rebuild (no cache) — volumes kept."
  run_compose down --remove-orphans
  if ! run_compose build --no-cache; then
    echo "Build failed."
    return 1
  fi
  run_compose up -d
  prune_anonymous_volumes
  if ! wait_for_api_ready 180; then
    return 1
  fi
  print_stack_urls
}

run_cleanup() {
  echo "Down + prune containers/networks (volumes preserved)..."
  run_compose down --remove-orphans
  docker container prune -f >/dev/null 2>&1 || true
  docker network prune -f >/dev/null 2>&1 || true
}

run_full_cleanup() {
  echo "Down and remove images built by this compose project (volumes preserved)..."
  run_compose down --rmi local --remove-orphans
  prune_anonymous_volumes
}

mount_and_start() {
  clear || true
  echo "DANGER: restore from backup tarballs into named volumes"
  echo "  Volumes: $PG_VOLUME, $REDIS_VOLUME, $CASSANDRA_VOLUME"
  echo "  Backup dir: $BACKUP_DIR"
  read -r -p "Type yes to continue: " confirm
  if [ "$confirm" != "yes" ]; then echo "Cancelled."; pause; return 0; fi

  [ -f "$BACKUP_DIR/_backup_pg.tar.gz" ] || { echo "Missing $BACKUP_DIR/_backup_pg.tar.gz"; pause; return 0; }
  [ -f "$BACKUP_DIR/_backup_redis.tar.gz" ] || { echo "Missing $BACKUP_DIR/_backup_redis.tar.gz"; pause; return 0; }
  [ -f "$BACKUP_DIR/_backup_cassandra.tar.gz" ] && echo "Cassandra backup found" || echo "Optional: _backup_cassandra.tar.gz not found — Cassandra volume will be empty after restore"

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
  echo "Manual volume backup: $TIMESTAMP"
  mkdir -p "$BACKUP_DIR"

  docker run --rm -v "${REDIS_VOLUME}:/data" -v "$BACKUP_DIR:/backup" busybox sh -c "tar czf /backup/redis_${TIMESTAMP}.tar.gz -C /data ."
  docker run --rm -v "${PG_VOLUME}:/data" -v "$BACKUP_DIR:/backup" busybox sh -c "tar czf /backup/pg_${TIMESTAMP}.tar.gz -C /data ."
  docker run --rm -v "${CASSANDRA_VOLUME}:/data" -v "$BACKUP_DIR:/backup" busybox sh -c "tar czf /backup/cassandra_${TIMESTAMP}.tar.gz -C /data ." \
    || echo "Warning: Cassandra backup step failed (empty volume?)"

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

# --- Non-interactive CLI ------------------------------------------------------
if [ -n "${ECARDS_CLI_CMD:-}" ] && [ "$ECARDS_CLI_CMD" != "menu" ]; then
  case "$ECARDS_CLI_CMD" in
    help | -h | --help) usage ;;
    up) cmd_up_quick || exit 1 ;;
    up-build) cmd_up_build || exit 1 ;;
    down) cmd_down ;;
    logs) cmd_logs ;;
    status) cmd_status ;;
    restart) cmd_restart ;;
    rebuild) cmd_rebuild_stack || exit 1 ;;
    reset) cmd_reset_stack || exit 1 ;;
    force-rebuild) cmd_force_rebuild || exit 1 ;;
  esac
  exit 0
fi

# --- Banner + interactive menu ----------------------------------------------
echo "========================================="
echo "   tools-ecards — Docker manager"
echo "========================================="
echo "Environment:    $TARGET_ENV"
echo "Project name:   $PROJ_NAME"
echo "Volumes:        $PG_VOLUME / $REDIS_VOLUME / $CASSANDRA_VOLUME"
echo "Backup dir:     $BACKUP_DIR"
echo "Compose file:   $COMPOSE_FILE"
echo "Env file:       $ENV_FILE"
echo "CLI:            $0 $TARGET_ENV up | up-build | down | logs | status | ..."
echo "========================================="
echo ""

while true; do
  clear || true
  echo "========================================="
  echo "   tools-ecards — Docker ($TARGET_ENV)"
  echo "========================================="
  echo "  1. Up (quick — no image rebuild)"
  echo "  2. Up (build & start)"
  echo "  3. Down"
  echo "  4. Cleanup (prune containers/networks, volumes kept)"
  echo "  5. Force rebuild (no cache)"
  echo "  6. Restart"
  echo "  7. Rebuild stack (down → build → up, keeps data; log: build.log)"
  echo "  8. Reset data (down -v → build → up) — destructive"
  echo "  9. Restore from volume backups (overwrites DB volumes)"
  echo " 10. Backup volumes (Postgres, Redis, Cassandra)"
  echo " 11. View logs"
  echo " 12. Full cleanup (down --rmi local)"
  echo " 13. Status (volumes + compose ps)"
  echo "  0. Exit"
  echo "-----------------------------------------"
  echo "CLI: $0 $TARGET_ENV up | up-build | down | logs | status | restart | rebuild | reset | force-rebuild"
  echo "========================================="
  read -r -p "Select: " opt
  case "$opt" in
    1) cmd_up_quick || pause ;;
    2) cmd_up_build || pause ;;
    3) cmd_down; pause ;;
    4) run_cleanup; pause ;;
    5) cmd_force_rebuild || pause ;;
    6) cmd_restart; pause ;;
    7) cmd_rebuild_stack || true; pause ;;
    8) cmd_reset_stack || true; pause ;;
    9) mount_and_start ;;
    10) backup ;;
    11) view_logs || true ;;
    12) run_full_cleanup; pause ;;
    13) cmd_status; pause ;;
    0) exit 0 ;;
    *) ;;
  esac
done
