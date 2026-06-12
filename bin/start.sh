#!/usr/bin/env bash
# bin/start.sh — Docker Compose helper for tools-ecards (E-Cards)
#
# Interactive menu (default when only env is given):
#   ./bin/start.sh
#   ./bin/start.sh dev
#
# If startup errors scroll away in the menu, use CLI (no menu, stable output):
#   ./bin/start.sh dev up
# Or skip clearing the screen once: ECARDS_START_NO_CLEAR=1 ./bin/start.sh dev
#
# CLI (no menu — runs command and exits):
#   ./bin/start.sh dev up
#   ./bin/start.sh dev up-build
#   ./bin/start.sh dev status
#   ./bin/start.sh dev help
#
# Environments: dev | stg | prd  (aliases: development, staging, prod|production)
# Production: copy .env.prd.example → .env.prd, then: ./bin/start.sh prd up
# (requires docker-compose.prd.yml — shipped in this repository.)
#
# Env file policy (tools-ecards): canonical key lists are repo root .env.dev.example and .env.prd.example
# only. Dev uses .env (or optional .env.dev with the same keys). Prd uses .env.prd. No per-package .env files.

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
                (best for debugging: full docker output, no interactive menu — use this if menu hides errors)
  up-build      Start stack with image rebuild (--build)
  down          Stop stack (down --remove-orphans)
  logs          Follow all service logs (tail 100)
  status        Show paths, compose project, volumes, short compose ps
  restart       docker compose restart
  rebuild       Down → build → up — keeps named volumes (build tee’d to repo-root build.log)
  reset         Down -v (deletes compose volumes/data) → build → up — destructive (same build.log)
  force-rebuild Down → build --no-cache → up — keeps volumes (same build.log)
  restore       Restore volumes + config from backups, then up — builds (same build.log)
  menu          Open interactive menu
  help, -h      Show this help

Environment:
  ECARDS_URL_HOST           Host printed in URLs (default: localhost)
  ECARDS_START_NO_CLEAR=1   Skip clearing the terminal when opening the interactive menu
  ECARDS_START_LOG_TAIL_ALL=1   With diagnostics: tail logs for all services (default: api, postgres, cassandra, redis, db-init)

Stack identity (in the env file; Tools Dashboard naming; keeps this stack separate on a shared host):
  TD_APP_CODE               e.g. tcrd
  TD_STACK_SUFFIX             e.g. _dev_tcrd or _prd_tcrd (use _prd_tcrd for production)
  COMPOSE_PROJECT_NAME      Must equal tools_dashboard + TD_STACK_SUFFIX, e.g. tools_dashboard_dev_tcrd. start.sh passes -p.

Build output:
  After up-build, rebuild, reset, force-rebuild, or restore+up — full transcript is written to:
    <repo-root>/build.log   (same path as rebuild; re-run overwrites the file)
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
    up | up-build | down | logs | status | restart | rebuild | reset | force-rebuild | restore | menu | help | -h | --help) ;;
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
    PG_VOLUME_NAME="postgres_data"
    REDIS_VOLUME_NAME="redis_data"
    CASSANDRA_VOLUME_NAME="cassandra_data"
    ;;
  stg)
    COMPOSE_FILE="$PROJECT_ROOT/docker-compose.stg.yml"
    ENV_FILE="$PROJECT_ROOT/.env.stg"
    BACKUP_BASE="/data"
    PG_VOLUME_NAME="postgres_data"
    REDIS_VOLUME_NAME="redis_data"
    CASSANDRA_VOLUME_NAME="cassandra_data"
    ;;
  prd)
    COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prd.yml"
    ENV_FILE="$PROJECT_ROOT/.env.prd"
    BACKUP_BASE="/data"
    PG_VOLUME_NAME="postgres_prd_data"
    REDIS_VOLUME_NAME="redis_prd_data"
    CASSANDRA_VOLUME_NAME="cassandra_prd_data"
    ;;
esac

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Compose file not found: $COMPOSE_FILE"
  echo "This repository ships docker-compose.dev.yml (dev) and docker-compose.prd.yml (prd)."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Env file not found: $ENV_FILE"
  if [ "$TARGET_ENV" = "prd" ]; then
    echo "Create it from the example: cp \"$PROJECT_ROOT/.env.prd.example\" \"$ENV_FILE\" then fill secrets."
  elif [ "$TARGET_ENV" = "stg" ]; then
    echo "Create \"$ENV_FILE\" (staging compose is optional in this repo)."
  fi
  exit 1
fi

# --- Compose project name, stack suffix (host-safe isolation) & published ports
PROJ_NAME=""
if grep -qE '^[[:space:]]*COMPOSE_PROJECT_NAME=' "$ENV_FILE" 2>/dev/null; then
  PROJ_NAME=$(grep -E '^[[:space:]]*COMPOSE_PROJECT_NAME=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | sed "s/^['\"]//;s/['\"]$//" | xargs)
fi

TD_APP_CODE_VAL=""
if grep -qE '^[[:space:]]*TD_APP_CODE=' "$ENV_FILE" 2>/dev/null; then
  TD_APP_CODE_VAL=$(grep -E '^[[:space:]]*TD_APP_CODE=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | sed "s/^['\"]//;s/['\"]$//" | xargs)
fi

TD_STACK_SUFFIX_VAL=""
if grep -qE '^[[:space:]]*TD_STACK_SUFFIX=' "$ENV_FILE" 2>/dev/null; then
  TD_STACK_SUFFIX_VAL=$(grep -E '^[[:space:]]*TD_STACK_SUFFIX=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' | sed "s/^['\"]//;s/['\"]$//" | xargs)
fi
if [ -z "$TD_STACK_SUFFIX_VAL" ]; then
  case "$TARGET_ENV" in
    dev) TD_STACK_SUFFIX_VAL="_dev_tcrd" ;;
    prd) TD_STACK_SUFFIX_VAL="_prd_tcrd" ;;
    stg) TD_STACK_SUFFIX_VAL="_stg_tcrd" ;;
    *) TD_STACK_SUFFIX_VAL="_dev_tcrd" ;;
  esac
  echo "WARN: TD_STACK_SUFFIX missing in $ENV_FILE — using ${TD_STACK_SUFFIX_VAL} (set in .env for multi-stack hosts)" >&2
fi
case "$TARGET_ENV" in
  dev)
    if ! echo "$TD_STACK_SUFFIX_VAL" | grep -qE '^_dev_'; then
      echo "ERROR: dev stack expects TD_STACK_SUFFIX like _dev_tcrd (got: ${TD_STACK_SUFFIX_VAL})" >&2
      exit 1
    fi
    ;;
  prd)
    if ! echo "$TD_STACK_SUFFIX_VAL" | grep -qE '^_prd_'; then
      echo "ERROR: prd stack expects TD_STACK_SUFFIX like _prd_tcrd (got: ${TD_STACK_SUFFIX_VAL})" >&2
      exit 1
    fi
    ;;
  stg)
    if ! echo "$TD_STACK_SUFFIX_VAL" | grep -qE '^_stg_'; then
      echo "ERROR: stg stack expects TD_STACK_SUFFIX like _stg_tcrd (got: ${TD_STACK_SUFFIX_VAL})" >&2
      exit 1
    fi
    ;;
esac
# COMPOSE_PROJECT_NAME and Docker: tools_dashboard + TD_STACK_SUFFIX => e.g. tools_dashboard_dev_tcrd
TD_COMPOSE_ID="tools_dashboard${TD_STACK_SUFFIX_VAL}"
if [ -n "$PROJ_NAME" ] && [ "$PROJ_NAME" != "$TD_COMPOSE_ID" ]; then
  echo "ERROR: COMPOSE_PROJECT_NAME ($PROJ_NAME) must equal tools_dashboard + TD_STACK_SUFFIX = ${TD_COMPOSE_ID} (fix $ENV_FILE)" >&2
  exit 1
fi
PROJ_NAME="$TD_COMPOSE_ID"
if [ -n "$TD_APP_CODE_VAL" ] && [ -n "$TD_STACK_SUFFIX_VAL" ]; then
  case "$TD_STACK_SUFFIX_VAL" in
    *_"${TD_APP_CODE_VAL}") ;;
    *)
      echo "ERROR: TD_STACK_SUFFIX (${TD_STACK_SUFFIX_VAL}) must end with _\${TD_APP_CODE} (TD_APP_CODE=${TD_APP_CODE_VAL})" >&2
      exit 1
      ;;
  esac
fi

VOL_PREFIX="${PROJ_NAME}_"
PG_VOLUME="${VOL_PREFIX}${PG_VOLUME_NAME}"
REDIS_VOLUME="${VOL_PREFIX}${REDIS_VOLUME_NAME}"
CASSANDRA_VOLUME="${VOL_PREFIX}${CASSANDRA_VOLUME_NAME}"
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

# API_PORT: dev / logical default. API_HOST_PORT: prd host publish (see docker-compose.prd.yml).
ECARDS_API_PORT="$(read_env_port API_PORT 7400)"
ECARDS_API_PUBLISHED_PORT="$(read_env_port API_HOST_PORT "${ECARDS_API_PORT}")"
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
  # -p: always use validated PROJ_NAME (tools_dashboard + TD_STACK_SUFFIX) so this script and compose stay aligned.
  "${DOCKER_COMPOSE[@]}" -p "$PROJ_NAME" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# Full transcript of image builds / `up --build` (requires set -o pipefail).
BUILD_LOG="${PROJECT_ROOT}/build.log"

report_build_log_tail() {
  local lines="${1:-200}"
  if [ -f "$BUILD_LOG" ]; then
    echo >&2 ""
    echo >&2 "━━ Build transcript: $BUILD_LOG (last ${lines} lines) ━━"
    tail -n "$lines" "$BUILD_LOG" 2>&1 | sed 's/^/  /' >&2 || true
    echo >&2 "━━ Full file: less $BUILD_LOG  |  wc -l $BUILD_LOG ━━" >&2
  else
    echo >&2 "(No build log at $BUILD_LOG — nothing was tee'd.)" >&2
  fi
}

# docker compose build … — tee to BUILD_LOG; on failure print tail (image build errors).
run_compose_build_logged() {
  echo "docker compose build — output to terminal and: $BUILD_LOG" >&2
  if ! run_compose build "$@" 2>&1 | tee "$BUILD_LOG"; then
    echo "docker compose build failed." >&2
    report_build_log_tail 220
    return 1
  fi
  echo "Build finished — transcript: $BUILD_LOG"
  return 0
}

# docker compose up -d --build — tee full output to BUILD_LOG; on failure tail + compose diagnostics.
run_compose_up_build_logged() {
  echo "docker compose up -d --build — output to terminal and: $BUILD_LOG" >&2
  if ! run_compose up -d --build 2>&1 | tee "$BUILD_LOG"; then
    echo "docker compose up -d --build failed (includes image build output)." >&2
    report_build_log_tail 220
    compose_failure_context
    return 1
  fi
  echo "Build/up transcript: $BUILD_LOG"
  return 0
}

# After failed compose up or health wait: ps + log tails (stderr so it stays visible).
compose_failure_context() {
  echo >&2 ""
  echo >&2 "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo >&2 "--- Compose diagnostics (last failure) ---"
  echo >&2 "Project: $PROJ_NAME  |  Compose: $(basename "$COMPOSE_FILE")  |  Env: $(basename "$ENV_FILE")"
  echo >&2 "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  run_compose ps -a 2>&1 | sed 's/^/  /' >&2 || true
  echo >&2 ""
  if [ "${ECARDS_START_LOG_TAIL_ALL:-0}" = 1 ]; then
    echo >&2 "--- logs --tail=120 (all services) ---"
    run_compose logs --tail=120 2>&1 | sed 's/^/  /' >&2 || true
  else
    for svc in api-server postgres cassandra redis; do
      echo >&2 "--- logs --tail=60 ${svc} ---"
      run_compose logs --tail=60 "$svc" 2>&1 | sed 's/^/  /' >&2 || true
    done
    echo >&2 "--- logs --tail=40 db-init ---"
    run_compose logs --tail=40 db-init 2>&1 | sed 's/^/  /' >&2 || true
  fi
  echo >&2 "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

pause() {
  read -r -n1 -s -p "Press any key to continue..." || true
  echo
}

# After a failed menu action: do not clear diagnostics; wait for Enter.
pause_after_error() {
  echo >&2 ""
  echo >&2 "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo >&2 "The last command did not complete successfully. Read the output above."
  echo >&2 "Tip (stable scrollback, no menu):  $0 $TARGET_ENV up"
  echo >&2 "     (follow logs):                  $0 $TARGET_ENV logs"
  echo >&2 "     (last build transcript):        less ${BUILD_LOG}  (repo root build.log)"
  echo >&2 "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  read -r -p "Press Enter to return to the menu..." _ || true
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

wait_for_api_ready() {
  local max="${1:-120}"
  local n=0
  local H="127.0.0.1"
  local nginx_p

  if [ "$TARGET_ENV" = "prd" ]; then
    nginx_p="$(read_env_port NGINX_HTTP_PORT 80)"
    echo "Waiting for production readiness (nginx http://${H}:${nginx_p}/health — up to ${max}s)..."
    while [ "$n" -lt "$max" ]; do
      if curl -sf "http://${H}:${nginx_p}/health" >/dev/null 2>&1; then
        echo "Nginx /health passed (API + frontend chain is up)."
        return 0
      fi
      sleep 1
      n=$((n + 1))
      if [ $((n % 20)) -eq 0 ]; then echo "  ... ${n}s"; fi
    done
    echo "Timeout waiting for nginx /health (check api-server and front-cards logs)." >&2
    compose_failure_context
    return 1
  fi

  echo "Waiting for API GET /health at http://${H}:${ECARDS_API_PUBLISHED_PORT}/health (up to ${max}s)..."
  while [ "$n" -lt "$max" ]; do
    if curl -sf "http://${H}:${ECARDS_API_PUBLISHED_PORT}/health" >/dev/null 2>&1; then
      echo "API health check passed."
      return 0
    fi
    sleep 1
    n=$((n + 1))
    if [ $((n % 20)) -eq 0 ]; then echo "  ... ${n}s"; fi
  done
  echo "Timeout waiting for API /health." >&2
  compose_failure_context
  return 1
}

# Cassandra + db-init + images — prd needs a longer first-boot window than dev.
compose_api_wait_secs() {
  if [ "$TARGET_ENV" = "prd" ]; then
    echo "${1:-300}"
  else
    echo "$1"
  fi
}

print_stack_urls() {
  local H="$ECARDS_URL_HOST"
  local ext_auth oauth_authz oauth_token oauth_user ext_user_api ext_sub_ws sub_url seaweed api_pub ws_pub oauth_redirect

  ext_auth="$(read_env_value NEXT_PUBLIC_EXTERNAL_AUTH_URL "")"
  [ -z "$ext_auth" ] && ext_auth="$(read_env_value EXTERNAL_AUTH_URL 'https://dev.aiepic.app/app')"
  oauth_authz="$(read_env_value NEXT_PUBLIC_OAUTH_AUTHORIZATION_ENDPOINT "")"
  [ -z "$oauth_authz" ] && oauth_authz="$(read_env_value OAUTH_AUTHORIZATION_ENDPOINT 'https://dev.aiepic.app/oauth/authorize')"
  oauth_token="$(read_env_value NEXT_PUBLIC_OAUTH_TOKEN_ENDPOINT "")"
  [ -z "$oauth_token" ] && oauth_token="$(read_env_value OAUTH_TOKEN_ENDPOINT 'https://dev.aiepic.app/oauth/token')"
  oauth_user="$(read_env_value NEXT_PUBLIC_OAUTH_USER_INFO_ENDPOINT "")"
  [ -z "$oauth_user" ] && oauth_user="$(read_env_value OAUTH_USER_INFO_ENDPOINT 'https://dev.aiepic.app/api/users/me')"
  ext_user_api="$(read_env_value EXTERNAL_USER_API 'https://dev.aiepic.app/admin/api')"
  ext_sub_ws="$(read_env_value EXTERNAL_SUBSCRIPTION_WS 'ws://dev.aiepic.app/admin/ws')"
  sub_url="$(read_env_value NEXT_PUBLIC_USER_SUBSCRIPTION_URL "")"
  [ -z "$sub_url" ] && sub_url="$(read_env_value USER_SUBSCRIPTION_URL 'https://dev.aiepic.app/app/features/user-subscription')"
  seaweed="$(read_env_value SEAWEEDFS_ENDPOINT 'http://host.docker.internal:18333')"
  api_pub="$(read_env_value NEXT_PUBLIC_API_URL "http://${H}:${ECARDS_API_PUBLISHED_PORT}")"
  ws_pub="$(read_env_value NEXT_PUBLIC_WS_URL "ws://${H}:${ECARDS_API_PUBLISHED_PORT}")"
  oauth_redirect="$(read_env_value OAUTH_REDIRECT_URI "http://${H}:${ECARDS_FRONT_PORT}/oauth/complete")"

  echo ""
  echo "Stack is up (env=$TARGET_ENV, project=$PROJ_NAME) — open in your browser (replace ${H} with your host if remote)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if [ "$TARGET_ENV" = "prd" ]; then
    local nginx_port
    nginx_port="$(read_env_port NGINX_HTTP_PORT 80)"
    echo "  Production entry (nginx → Next + API)"
    echo "  Public URL:          http://${H}:${nginx_port}/  (TLS at load balancer or extend deploy/nginx)"
    echo "  API (browser env):   ${api_pub}"
    echo "  WebSocket (env):     ${ws_pub}"
    echo "  OAuth callback:      ${oauth_redirect}"
    echo "  API direct (ops):  http://${H}:${ECARDS_API_PUBLISHED_PORT}/health  (bound to loopback in compose prd)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  fi
  echo "  E-Cards in this compose (direct host ports — not TD nginx)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Frontend (Next.js):    http://${H}:${ECARDS_FRONT_PORT}/"
  echo "  API (REST + WS):       http://${H}:${ECARDS_API_PUBLISHED_PORT}/   health: /health"
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
  echo "  ${DOCKER_COMPOSE[*]} -p $PROJ_NAME -f $(basename "$COMPOSE_FILE") --env-file $(basename "$ENV_FILE") exec -it postgres psql -U ecards_user -d ecards_db"
  echo "  ${DOCKER_COMPOSE[*]} -p $PROJ_NAME -f $(basename "$COMPOSE_FILE") --env-file $(basename "$ENV_FILE") exec -it redis redis-cli"
  echo "  ${DOCKER_COMPOSE[*]} -p $PROJ_NAME -f $(basename "$COMPOSE_FILE") --env-file $(basename "$ENV_FILE") exec -it cassandra cqlsh"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "CLI: $0 $TARGET_ENV logs | down | restart | rebuild | reset"
  echo ""
}

cmd_up_quick() {
  echo "Starting stack (no image rebuild)..."
  if ! run_compose up -d; then
    echo "docker compose up -d failed." >&2
    compose_failure_context
    return 1
  fi
  if ! wait_for_api_ready "$(compose_api_wait_secs 120)"; then
    echo "Stack may still be starting — check: $0 $TARGET_ENV logs" >&2
    return 1
  fi
  print_stack_urls
}

cmd_up_build() {
  echo "Starting stack (with image rebuild)..."
  if ! run_compose_up_build_logged; then
    return 1
  fi
  if ! wait_for_api_ready "$(compose_api_wait_secs 180)"; then
    echo "Stack may still be starting — check: $0 $TARGET_ENV logs" >&2
    return 1
  fi
  print_stack_urls
}

cmd_down() {
  echo "Stopping stack..."
  run_compose down --remove-orphans
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
  echo "Stack suffix:       $TD_STACK_SUFFIX_VAL  (container: tools_dashboard${TD_STACK_SUFFIX_VAL}-…)"
  echo "Docker project:     $PROJ_NAME"
  echo "Backup directory:   $BACKUP_DIR"
  ensure_volumes_info
  echo ""
  run_compose ps
}

cmd_restart() {
  echo "Restarting all services..."
  run_compose restart
  if wait_for_api_ready "$(compose_api_wait_secs 120)"; then
    print_stack_urls
    return 0
  fi
  echo "Warning: API /health not ready after restart — inspect logs." >&2
  compose_failure_context
  return 1
}

cmd_rebuild_stack() {
  echo "This will: down → build (see build.log) → up — named volumes are kept."
  read -r -p "Type yes to continue: " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    return 0
  fi
  run_compose down --remove-orphans
  if ! run_compose_build_logged; then
    return 1
  fi
  if ! run_compose up -d; then
    echo "docker compose up -d failed after rebuild." >&2
    report_build_log_tail 80
    compose_failure_context
    return 1
  fi
  if ! wait_for_api_ready "$(compose_api_wait_secs 180)"; then
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
  if ! run_compose_build_logged; then
    return 1
  fi
  if ! run_compose up -d; then
    echo "docker compose up -d failed after reset build." >&2
    report_build_log_tail 80
    compose_failure_context
    return 1
  fi
  if ! wait_for_api_ready "$(compose_api_wait_secs 180)"; then
    return 1
  fi
  print_stack_urls
}

cmd_force_rebuild() {
  echo "Force rebuild (no cache) — volumes kept."
  run_compose down --remove-orphans
  if ! run_compose_build_logged --no-cache; then
    return 1
  fi
  if ! run_compose up -d; then
    echo "docker compose up -d failed after force build." >&2
    report_build_log_tail 80
    compose_failure_context
    return 1
  fi
  if ! wait_for_api_ready "$(compose_api_wait_secs 180)"; then
    return 1
  fi
  print_stack_urls
}

run_cleanup() {
  # Only this compose project — never run host-wide docker prune (other stacks on the same machine).
  echo "Stopping stack; pruning stopped containers for project ${PROJ_NAME} only (volumes preserved)..."
  run_compose down --remove-orphans
  docker container prune -f --filter "label=com.docker.compose.project=${PROJ_NAME}" >/dev/null 2>&1 || true
}

run_full_cleanup() {
  echo "Down and remove images built by this compose project (volumes preserved)..."
  run_compose down --rmi local --remove-orphans
}

mount_and_start() {
  if [ -z "${ECARDS_CLI_CMD:-}" ]; then clear || true; fi
  echo "DANGER: restore from backup into named volumes"
  echo "  Volumes: $PG_VOLUME, $REDIS_VOLUME, $CASSANDRA_VOLUME"
  echo "  Backup dir: $BACKUP_DIR"
  if [ -n "${ECARDS_CLI_CMD:-}" ]; then
    echo "  CLI mode: skipping confirmation prompt."
  else
    read -r -p "Type yes to continue: " confirm
    if [ "$confirm" != "yes" ]; then echo "Cancelled."; pause; return 0; fi
  fi

  [ -f "$BACKUP_DIR/_backup_pg.tar.gz" ] || { echo "Missing $BACKUP_DIR/_backup_pg.tar.gz"; if [ -z "${ECARDS_CLI_CMD:-}" ]; then pause; fi; return 0; }
  [ -f "$BACKUP_DIR/_backup_redis.tar.gz" ] || { echo "Missing $BACKUP_DIR/_backup_redis.tar.gz"; if [ -z "${ECARDS_CLI_CMD:-}" ]; then pause; fi; return 0; }
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

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "WARNING: SeaweedFS data is NOT included in this backup."
  echo "SeaweedFS is a remote/external service. If you rely on templates,"
  echo "generated cards, or assets stored in SeaweedFS, back it up separately."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  if ! run_compose_up_build_logged; then
    pause_after_error
    return 1
  fi
  echo "Restore complete."
  if [ -z "${ECARDS_CLI_CMD:-}" ]; then pause; fi
}

backup() {
  if [ -z "${ECARDS_CLI_CMD:-}" ]; then clear || true; fi
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  echo "Backup: $TIMESTAMP"
  mkdir -p "$BACKUP_DIR"

  echo "Stopping stack for consistent backup..."
  run_compose down --remove-orphans

  echo "Backing up volumes..."
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

  echo "Restarting stack after backup..."
  if ! run_compose up -d; then
    echo "Warning: failed to restart stack after backup." >&2
    compose_failure_context
  fi
  echo "Waiting for API health after restart..."
  wait_for_api_ready "$(compose_api_wait_secs 120)" || true

  echo ""
  echo "Backup complete."
  ls -lh "$BACKUP_DIR" | grep "$TIMESTAMP" || ls -lh "$BACKUP_DIR"
  if [ -z "${ECARDS_CLI_CMD:-}" ]; then pause; fi
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
    restart) cmd_restart || exit 1 ;;
    rebuild) cmd_rebuild_stack || exit 1 ;;
    reset) cmd_reset_stack || exit 1 ;;
    force-rebuild) cmd_force_rebuild || exit 1 ;;
    restore) mount_and_start || exit 1 ;;
  esac
  exit 0
fi

# --- Banner + interactive menu ----------------------------------------------
echo "========================================="
echo "   tools-ecards — Docker manager"
echo "========================================="
echo "Environment:    $TARGET_ENV"
echo "Stack suffix:   $TD_STACK_SUFFIX_VAL  (project $PROJ_NAME)"
echo "Volumes:        $PG_VOLUME / $REDIS_VOLUME / $CASSANDRA_VOLUME"
echo "Backup dir:     $BACKUP_DIR"
echo "Compose file:   $COMPOSE_FILE"
echo "Env file:       $ENV_FILE"
echo "CLI:            $0 $TARGET_ENV up | up-build | down | logs | status | ..."
echo "Debug (no menu, full compose output):  $0 $TARGET_ENV up"
echo "Or:  ECARDS_START_NO_CLEAR=1 $0 $TARGET_ENV   — keeps prior terminal output when opening menu"
echo "========================================="
echo ""

if [ "${ECARDS_START_NO_CLEAR:-0}" != 1 ] && [ "$(echo "${ECARDS_START_NO_CLEAR:-}" | tr '[:upper:]' '[:lower:]')" != "true" ]; then
  clear || true
fi

while true; do
  echo "========================================="
  echo "   tools-ecards — Docker ($TARGET_ENV)"
  echo "========================================="
  echo "  1. Up (quick — no image rebuild)"
  echo "  2. Up (build & start)"
  echo "  3. Down"
  echo "  4. Cleanup (down; prune stopped containers for this project only, volumes kept)"
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
  echo "Debug (no menu): $0 $TARGET_ENV up"
  echo "========================================="
  read -r -p "Select: " opt
  case "$opt" in
    1) cmd_up_quick || pause_after_error ;;
    2) cmd_up_build || pause_after_error ;;
    3) cmd_down; pause ;;
    4) run_cleanup; pause ;;
    5) if cmd_force_rebuild; then pause; else pause_after_error; fi ;;
    6) if cmd_restart; then pause; else pause_after_error; fi ;;
    7) if cmd_rebuild_stack; then pause; else pause_after_error; fi ;;
    8) if cmd_reset_stack; then pause; else pause_after_error; fi ;;
    9) mount_and_start ;;
    10) backup ;;
    11) view_logs || true ;;
    12) run_full_cleanup; pause ;;
    13) cmd_status; pause ;;
    0) exit 0 ;;
    *) ;;
  esac
done
