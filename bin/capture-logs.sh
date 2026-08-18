#!/bin/sh
# Capture live compose logs to a file while reproducing an issue.
#
# Usage:
#   bin/capture-logs.sh                 # capture api-server + render-worker + front-cards
#   bin/capture-logs.sh --services api-server
#   bin/capture-logs.sh --services api-server render-worker
#
# Output: tmp/logs-<timestamp>.log  (tmp/ is gitignored)
# Ctrl-C stops the capture and prints the output path.
#
# Why: docker compose logs is truncated in a terminal; when a bug produces
# thousands of lines (e.g. render-status polling, parser debug), capture to a
# file so an agent can read the whole stream afterward.

set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
OUT_DIR="tmp"
mkdir -p "$OUT_DIR"

SERVICES="api-server render-worker front-cards"
case "${1:-}" in
  --services)
    shift
    if [ "$#" -eq 0 ]; then
      echo "usage: bin/capture-logs.sh --services <service> [service...]" >&2
      exit 1
    fi
    SERVICES="$*"
    ;;
  -h|--help)
    echo "usage: bin/capture-logs.sh [--services api-server render-worker front-cards]"
    exit 0
    ;;
esac

OUT_FILE="$OUT_DIR/logs-$(date +%s).log"
echo "Capturing [$SERVICES] → $OUT_FILE  (Ctrl-C to stop)"
docker compose -f "$COMPOSE_FILE" logs -f --no-color $SERVICES > "$OUT_FILE"
