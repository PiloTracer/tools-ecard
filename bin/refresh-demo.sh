#!/usr/bin/env bash
# bin/refresh-demo.sh — demo-stack shorthand for bin/refresh-prd.sh.
#
# Exactly equivalent to: ./bin/refresh-prd.sh demo "$@"
# All logic lives in refresh-prd.sh (mode: demo → docker-compose.demo.yml + .env.demo).
#
# Examples:
#   ./bin/refresh-demo.sh            # demo UI only (front-cards)
#   ./bin/refresh-demo.sh api        # demo api-server only
#   ./bin/refresh-demo.sh --app      # demo api-server + front-cards + render-worker
#   ./bin/refresh-demo.sh --pull     # git pull --ff-only first
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/refresh-prd.sh" demo "$@"
