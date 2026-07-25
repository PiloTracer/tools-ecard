#!/usr/bin/env bash
# bin/refresh-prd.sh — targeted production/demo refresh (minimal blast radius)
#
# Rebuilds and recreates only the compose services you name. Data stores
# (postgres, cassandra, redis) are never touched. Use this after UI/i18n or
# single-service code changes instead of a full `./bin/start.sh prd up-build`.
#
# Typical usage on the production host (from repo root):
#   git pull --ff-only
#   ./bin/refresh-prd.sh              # prd: UI only (front-cards) — landing + i18n
#   ./bin/refresh-prd.sh --pull       # pull then refresh prd UI
#   ./bin/refresh-prd.sh api          # prd api-server only
#   ./bin/refresh-prd.sh ui api       # prd front + API
#   ./bin/refresh-prd.sh --app        # prd api-server + front-cards + render-worker
#   ./bin/refresh-prd.sh --all        # same as --app (alias)
#   ./bin/refresh-prd.sh demo         # same, but for the demo stack (.env.demo)
#   ./bin/refresh-prd.sh demo ui      # demo UI only
#   ./bin/refresh-demo.sh             # shorthand for `refresh-prd.sh demo`
#
# Requirements:
#   - .env.prd filled (see .env.prd.example); demo mode needs .env.demo
#   - Docker + compose v2
#   - Stack already provisioned once via `./bin/start.sh prd|demo up` or `up-build`
#
# Logs: build transcript appended view at repo-root build.log (same as start.sh)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_LOG="$PROJECT_ROOT/build.log"

# Optional leading mode: prd (default) | demo — selects compose file + env file.
MODE="prd"
if [[ "${1:-}" == "prd" || "${1:-}" == "demo" ]]; then
  MODE="$1"
  shift
fi
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.${MODE}.yml"
ENV_FILE="$PROJECT_ROOT/.env.${MODE}"

DO_PULL=0
DO_VERIFY=1
DO_WAIT=1
PRESET=""
SERVICES=()

usage() {
  sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'
  cat <<'EOF'

Modes (optional first argument):
  prd           production stack (docker-compose.prd.yml + .env.prd) — default
  demo          public demo stack (docker-compose.demo.yml + .env.demo)

Options:
  --pull        git pull --ff-only before building
  --no-verify   skip bin/verify-prd-env.sh
  --no-wait     do not wait for container health / loopback smoke checks
  --app, --all  refresh api-server, front-cards, and render-worker
  -h, --help    show this help

Service aliases:
  ui, front, frontend  →  front-cards
  api                  →  api-server
  worker               →  render-worker

Default (no services given): front-cards only.
EOF
}

log() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

read_env_port() {
  local key="$1" default="$2" val
  val="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' | sed "s/^['\"]//;s/['\"]$//" | xargs || true)"
  if [[ -n "$val" ]]; then echo "$val"; else echo "$default"; fi
}

read_env_key() {
  local key="$1" default="${2:-}"
  local val
  val="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' | sed "s/^['\"]//;s/['\"]$//" | xargs || true)"
  if [[ -n "$val" ]]; then echo "$val"; else echo "$default"; fi
}

normalize_service() {
  case "$(echo "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    ui | front | frontend | front-cards) echo front-cards ;;
    api | api-server) echo api-server ;;
    worker | render-worker) echo render-worker ;;
    front-cards | api-server | render-worker) echo "$1" ;;
    *) return 1 ;;
  esac
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pull) DO_PULL=1; shift ;;
    --no-verify) DO_VERIFY=0; shift ;;
    --no-wait) DO_WAIT=0; shift ;;
    --app | --all) PRESET=app; shift ;;
    -h | --help) usage; exit 0 ;;
    --) shift; break ;;
    -*) die "Unknown option: $1 (try --help)" ;;
    *)
      if svc="$(normalize_service "$1")"; then
        SERVICES+=("$svc")
      else
        die "Unknown service: $1 (allowed: front-cards, api-server, render-worker, or aliases ui/api/worker)"
      fi
      shift
      ;;
  esac
done

if [[ -n "$PRESET" ]]; then
  SERVICES=(api-server front-cards render-worker)
elif [[ ${#SERVICES[@]} -eq 0 ]]; then
  SERVICES=(front-cards)
fi

# De-duplicate while preserving order
deduped=()
for svc in "${SERVICES[@]}"; do
  skip=0
  for seen in "${deduped[@]:-}"; do
    [[ "$seen" == "$svc" ]] && skip=1 && break
  done
  [[ $skip -eq 0 ]] && deduped+=("$svc")
done
SERVICES=("${deduped[@]}")

[[ -f "$COMPOSE_FILE" ]] || die "Missing $COMPOSE_FILE"
[[ -f "$ENV_FILE" ]] || die "Missing $ENV_FILE — seed from .env.prd.example and fill secrets (see start.sh ${MODE} hints)"

if [[ "$DO_VERIFY" -eq 1 ]]; then
  log "Verifying ${MODE} env..."
  bash "$SCRIPT_DIR/verify-prd-env.sh" "$ENV_FILE" "$MODE"
fi

if docker compose version &>/dev/null; then
  DOCKER_COMPOSE=(docker compose)
elif docker-compose version &>/dev/null; then
  DOCKER_COMPOSE=(docker-compose)
else
  die "Neither 'docker compose' nor 'docker-compose' is available"
fi

PROJ_NAME="$(read_env_key COMPOSE_PROJECT_NAME)"
if [[ -z "$PROJ_NAME" ]]; then
  suffix="$(read_env_key TD_STACK_SUFFIX "_${MODE}_tcrd")"
  PROJ_NAME="tools_dashboard${suffix}"
fi

export ECARDS_ENV_FILE=".env.${MODE}"
export ECARDS_API_BUILD_ID="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"

run_compose() {
  "${DOCKER_COMPOSE[@]}" -p "$PROJ_NAME" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

service_container_id() {
  local svc="$1" cid
  cid="$(run_compose ps -q "$svc" 2>/dev/null | head -1 || true)"
  if [[ -n "$cid" ]]; then
    echo "$cid"
    return 0
  fi
  return 1
}

wait_for_service_ready() {
  local svc="$1" max="${2:-180}" n=0 status cid
  log "Waiting for $svc to be healthy (up to ${max}s)..."
  while [[ "$n" -lt "$max" ]]; do
    if cid="$(service_container_id "$svc" 2>/dev/null || true)" && [[ -n "$cid" ]]; then
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$cid" 2>/dev/null || echo missing)"
      case "$status" in
        healthy) log "  $svc is healthy."; return 0 ;;
        unhealthy)
          die "$svc is unhealthy — inspect: ${DOCKER_COMPOSE[*]} -p $PROJ_NAME logs --tail=80 $svc"
          ;;
        no-healthcheck)
          if docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null | grep -q true; then
            log "  $svc is running (no healthcheck)."
            return 0
          fi
          ;;
      esac
    fi
    sleep 2
    n=$((n + 2))
    if [[ $((n % 20)) -eq 0 ]]; then log "  ... ${n}s (${status:-starting})"; fi
  done
  die "Timeout waiting for $svc (last status: ${status:-unknown})"
}

smoke_loopback() {
  local front_port api_port public_url
  front_port="$(read_env_port FRONTEND_HOST_PORT 7300)"
  api_port="$(read_env_port API_HOST_PORT 7400)"
  public_url="$(read_env_key NEXT_PUBLIC_API_URL "")"
  public_url="${public_url%/}"

  log ""
  log "Smoke checks (loopback)..."

  if printf '%s\n' "${SERVICES[@]}" | grep -qx 'api-server'; then
    curl -sf "http://127.0.0.1:${api_port}/health" >/dev/null \
      || die "API /health failed on 127.0.0.1:${api_port}"
    log "  OK  http://127.0.0.1:${api_port}/health"
  fi

  if printf '%s\n' "${SERVICES[@]}" | grep -qx 'front-cards'; then
    curl -sf -o /dev/null "http://127.0.0.1:${front_port}/" \
      || die "Frontend failed on 127.0.0.1:${front_port}/"
    log "  OK  http://127.0.0.1:${front_port}/"
  fi

  log ""
  log "Deploy SHA: ${ECARDS_API_BUILD_ID}"
  log "Refreshed:  ${SERVICES[*]}"
  if [[ -n "$public_url" ]]; then
    log "Public URL: ${public_url}/"
    log "Tip: hard-refresh the browser (Ctrl+Shift+R) or purge Cloudflare cache if the old UI persists."
  fi
  log "Build log:  $BUILD_LOG"
}

cd "$PROJECT_ROOT"

if [[ "$DO_PULL" -eq 1 ]]; then
  log "Pulling latest main..."
  git pull --ff-only
fi

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Stack refresh (mode: ${MODE})"
log "  Project:   $PROJ_NAME"
log "  Env file:  $ENV_FILE"
log "  Services:  ${SERVICES[*]}"
log "  Build ID:  $ECARDS_API_BUILD_ID"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

{
  echo ""
  echo "=== refresh-prd $(date -u +%Y-%m-%dT%H:%M:%SZ) services=${SERVICES[*]} sha=${ECARDS_API_BUILD_ID} ==="
  run_compose build "${SERVICES[@]}"
  # --no-deps: do not restart postgres/redis/cassandra or sibling app services.
  run_compose up -d --force-recreate --no-deps "${SERVICES[@]}"
} 2>&1 | tee -a "$BUILD_LOG"

if [[ "$DO_WAIT" -eq 1 ]]; then
  for svc in "${SERVICES[@]}"; do
    wait_for_service_ready "$svc" 180
  done
  smoke_loopback
else
  log "Skipped health wait (--no-wait). Check: ./bin/start.sh prd status"
fi

log "Done."
