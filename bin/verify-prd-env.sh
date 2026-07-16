#!/usr/bin/env bash
# verify-prd-env.sh — fail if production env still has CHANGE_ME_ placeholders
# Usage: bash bin/verify-prd-env.sh [.env.prd]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env.prd}"

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
if [[ "$suffix" != _prd_* ]]; then
  echo "ERROR: TD_STACK_SUFFIX should look like _prd_tcrd (got: ${suffix:-empty})" >&2
  bad=1
fi

if [[ "$bad" -ne 0 ]]; then
  echo "FAIL: $ENV_FILE is not ready for production." >&2
  exit 1
fi

echo "OK: $ENV_FILE looks ready (no CHANGE_ME_ placeholders; required keys present)."
demo="$(get_key DEMO_MODE)"
if [[ "$demo" == "true" || "$demo" == "1" ]]; then
  echo "NOTE: DEMO_MODE is enabled — api-server will reject mutating writes."
fi
exit 0
