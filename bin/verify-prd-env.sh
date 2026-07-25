#!/usr/bin/env bash
# verify-prd-env.sh — fail if a production-style env still has CHANGE_ME_ placeholders
# or the wrong stack identity. Modes:
#   prd  (default): real production — DEMO_MODE must be OFF, suffix must be _prd_*
#   demo          : public demo     — DEMO_MODE must be ON,  suffix must be _demo_*
# Usage: bash bin/verify-prd-env.sh [.env.prd|.env.demo] [prd|demo]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env.prd}"
MODE="${2:-prd}"
case "$MODE" in
  prd | demo) ;;
  *)
    echo "ERROR: unknown mode: $MODE (expected: prd | demo)" >&2
    exit 2
    ;;
esac

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: env file not found: $ENV_FILE" >&2
  echo "Hint: cp .env.prd.example .env.prd && fill secrets, then re-run." >&2
  exit 2
fi

get_key() {
  local key="$1"
  # First matching assignment; ignore comments
  grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | head -1 | sed -E "s/^[[:space:]]*${key}=//" | tr -d '\r' || true
}

bad=0
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "${line// }" || "$line" =~ ^[[:space:]]*# ]] && continue
  if [[ "$line" == *CHANGE_ME_* ]]; then
    echo "PLACEHOLDER: $line" >&2
    bad=1
  fi
done < "$ENV_FILE"

required=(
  COMPOSE_PROJECT_NAME
  TD_STACK_SUFFIX
  DATABASE_URL
  POSTGRES_PASSWORD
  REDIS_PASSWORD
  JWT_SECRET
  OAUTH_CLIENT_SECRET
  NEXT_PUBLIC_API_URL
  API_URL
)

for key in "${required[@]}"; do
  val="$(get_key "$key")"
  if [[ -z "$val" ]]; then
    echo "MISSING: $key" >&2
    bad=1
  fi
done

suffix="$(get_key TD_STACK_SUFFIX)"
if [[ "$suffix" != _${MODE}_* ]]; then
  echo "ERROR: TD_STACK_SUFFIX should look like _${MODE}_tcrd (got: ${suffix:-empty})" >&2
  bad=1
fi

# DEMO_MODE semantics are mode-specific and checked before the generic FAIL line.
demo_flag="$(get_key DEMO_MODE)"
demo_public_flag="$(get_key NEXT_PUBLIC_DEMO_MODE)"
if [[ "$demo_flag" != "$demo_public_flag" ]]; then
  echo "ERROR: DEMO_MODE (${demo_flag:-empty}) and NEXT_PUBLIC_DEMO_MODE (${demo_public_flag:-empty}) must match." >&2
  bad=1
fi
demo_on=0
if [[ "$demo_flag" == "true" || "$demo_flag" == "1" ]]; then
  demo_on=1
fi
if [[ "$MODE" == "prd" && "$demo_on" -eq 1 ]]; then
  echo "ERROR: DEMO_MODE is enabled in a prd env — api-server would reject mutating writes. Set DEMO_MODE=false and NEXT_PUBLIC_DEMO_MODE=false." >&2
  bad=1
fi
if [[ "$MODE" == "demo" && "$demo_on" -ne 1 ]]; then
  echo "ERROR: DEMO_MODE is disabled in a demo env — the public demo requires DEMO_MODE=true and NEXT_PUBLIC_DEMO_MODE=true." >&2
  bad=1
fi

if [[ "$bad" -ne 0 ]]; then
  echo "FAIL: $ENV_FILE is not ready for ${MODE}." >&2
  exit 1
fi

echo "OK: $ENV_FILE looks ready for ${MODE} (no CHANGE_ME_ placeholders; required keys present; suffix _${MODE}_*)."
if [[ "$MODE" == "demo" ]]; then
  echo "NOTE: DEMO_MODE is enabled — api-server will reject mutating writes (expected for the public demo)."
fi
exit 0
