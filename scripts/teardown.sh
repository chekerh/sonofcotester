#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo "\x1b[33mTearing down production services...\x1b[0m"
docker compose -f docker-compose.production.yml down --remove-orphans
echo "\x1b[32mDone.\x1b[0m"
