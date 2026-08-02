#!/usr/bin/env bash
# bin/deploy-prd-demo-fixes.sh — one-shot deploy + verify for the 2026-08-02
# batch-import / login / demo-bundle fixes.
#
# Run ON the production host, from the tools-ecards repo root:
#
#   git pull --ff-only
#   ./bin/deploy-prd-demo-fixes.sh
#
# What it does:
#   1. Ensures OAUTH_SCOPES=profile email in .env.prd and .env.demo (idempotent).
#   2. Rebuilds + recreates prd front-cards and api-server (parser fix, UI fixes).
#   3. Rebuilds + recreates the demo front-cards under its own image tag
#      (ecards-front:demo — stops prd builds clobbering the demo bundle).
#   4. Verifies: /health on both sites, baked API URL in each served bundle,
#      parse-queue stats.
#
# It does NOT touch postgres/cassandra/redis, and does NOT delete anything.
#
# Options:
#   --no-pull     skip the initial git pull (if you already pulled)
#   --no-deploy   only run the verification section

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

DO_PULL=1
DO_DEPLOY=1
for arg in "$@"; do
  case "$arg" in
    --no-pull) DO_PULL=0 ;;
    --no-deploy) DO_DEPLOY=0 ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

PRD_SITE="https://ecards.aiepic.app"
DEMO_SITE="https://ecards-demo.aiepic.app"

log()  { printf '%s\n' "$*"; }
step() { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[32mOK\033[0m   %s\n' "$*"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$*"; }
warn() { printf '  \033[33mWARN\033[0m %s\n' "$*"; }

[[ -f docker-compose.prd.yml ]] || { echo "Run from the tools-ecards repo root." >&2; exit 1; }

# ---------------------------------------------------------------- pull
if [[ "$DO_PULL" -eq 1 ]]; then
  step "git pull --ff-only"
  git pull --ff-only
  log "  HEAD: $(git rev-parse --short HEAD) ($(git log -1 --format=%s))"
fi

# ------------------------------------------------------- env sanity (host-local)
ensure_scopes() {
  local env_file="$1"
  [[ -f "$env_file" ]] || { warn "$env_file not found — skipping scope fix"; return 0; }
  if grep -qE '^OAUTH_SCOPES=' "$env_file"; then
    sed -i 's/^OAUTH_SCOPES=.*/OAUTH_SCOPES=profile email/' "$env_file"
  else
    echo 'OAUTH_SCOPES=profile email' >> "$env_file"
  fi
  ok "$env_file: $(grep -E '^OAUTH_SCOPES=' "$env_file")"
}

step "OAuth scopes in env files"
ensure_scopes .env.prd
ensure_scopes .env.demo

# ---------------------------------------------------------------- deploy
if [[ "$DO_DEPLOY" -eq 1 ]]; then
  step "Refresh prd: front-cards + api-server"
  ./bin/refresh-prd.sh --no-pull ui api

  step "Refresh demo: front-cards (own image tag)"
  ./bin/refresh-prd.sh --no-pull demo ui
fi

# ---------------------------------------------------------------- verify
step "Health checks"
check_health() {
  local name="$1" url="$2" expect_demo="$3" body demo
  body="$(curl -fsS -m 15 "$url/health" 2>/dev/null)" || { bad "$name: $url/health unreachable"; return 1; }
  demo="$(printf '%s' "$body" | grep -o '"demoMode":[a-z]*' | cut -d: -f2)"
  if [[ "$demo" == "$expect_demo" ]]; then
    ok "$name: healthy, demoMode=$demo"
  else
    bad "$name: demoMode=$demo (expected $expect_demo)"
  fi
}
check_health "prd " "$PRD_SITE"  "false" || true
check_health "demo" "$DEMO_SITE" "true"  || true

step "Baked bundle check (what the browser actually gets)"
# Next.js inlines NEXT_PUBLIC_API_URL at build time into getApiBaseUrl().
# This greps the served JS for the baked value — catches stale/wrong builds.
check_baked_api() {
  local name="$1" site="$2" expected="$3"
  local html chunks chunk body found="" page
  local re='let e="(https://[a-z0-9.-]+)"\.trim\(\)'
  for page in dashboard login ""; do
    html="$(curl -fsSL -m 20 "$site/$page" 2>/dev/null)" || continue
    chunks="$(printf '%s' "$html" | grep -oE '/_next/static/chunks/[^"]*\.js' | sort -u)"
    for chunk in $chunks; do
      body="$(curl -fsS -m 20 "$site$chunk" 2>/dev/null || true)"
      if [[ "$body" == *getApiBaseUrl* && "$body" =~ $re ]]; then
        found="${BASH_REMATCH[1]}"
        break 2
      fi
    done
  done
  if [[ -z "$found" ]]; then
    warn "$name: getApiBaseUrl not found in initial chunks (page may be cached; hard-refresh / purge Cloudflare)"
  elif [[ "$found" == "$expected" ]]; then
    ok "$name: bundle baked with API $found"
  else
    bad "$name: bundle baked with API $found (expected $expected) — wrong image deployed or stale cache"
  fi
}
check_baked_api "prd " "$PRD_SITE"  "https://ecards.aiepic.app"      || true
check_baked_api "demo" "$DEMO_SITE" "https://ecards-demo.aiepic.app" || true

step "Parse queue (prd)"
qs="$(curl -fsS -m 15 "$PRD_SITE/api/diagnostics/queue-stats" 2>/dev/null)" \
  && log "  $qs" \
  || warn "queue-stats unreachable"
if printf '%s' "${qs:-}" | grep -q '"failed":[1-9]'; then
  warn "failed parse jobs present — retry those batches from the UI (Batches → retry); no re-upload needed"
fi

step "Done — manual steps remaining"
cat <<'EOF'
  1. Hard-refresh your browser (Ctrl+Shift+R) or purge the Cloudflare cache —
     old JS chunks are cached aggressively.
  2. In the prd app: open Batches, hit "retry" on the failed batches; they
     should reach LOADED with their records (no re-upload needed).
  3. If a batch still sticks at UPLOADED (never reaches PARSING), the worker
     cannot reach a database. Check on this host:
       docker logs tools_dashboard_prd_tcrd-api --since 1h 2>&1 | grep -iE "python stderr|exited with error|cassandra|postgres" | tail -40
       docker exec tools_dashboard_prd_tcrd-cassandra cqlsh -e "DESCRIBE KEYSPACES;"
     (Container names assume TD_STACK_SUFFIX=_prd_tcrd; adjust if your .env.prd differs.)
  4. Login check: click "Login with Tools Dashboard" — you should reach the
     Tools Dashboard sign-in (no scope error). On OAuth failure you are
     redirected to the Tools Dashboard app library by design.
EOF
