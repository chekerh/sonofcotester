#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo "\x1b[36m╔══════════════════════════════════════════╗\x1b[0m"
echo "\x1b[36m║   Son of CodeTester — Production Deploy ║\x1b[0m"
echo "\x1b[36m╚══════════════════════════════════════════╝\x1b[0m\n"

# ── Check prerequisites ──
if ! command -v docker >/dev/null 2>&1; then
  echo "\x1b[31mError: Docker is required but not installed.\x1b[0m" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "\x1b[31mError: Docker daemon is not running.\x1b[0m" >&2
  exit 1
fi

# ── Check for .env.production ──
if [ ! -f ".env.production" ]; then
  echo "\x1b[33mWarning: .env.production not found. Copying from .env.production template...\x1b[0m"
  cp .env.example .env.production 2>/dev/null || true
fi

# ── Validate critical env vars ──
source .env.production 2>/dev/null || true
if [ -z "${POSTGRES_PASSWORD:-}" ] || [ "${POSTGRES_PASSWORD:-}" = "CHANGE_ME_IN_PRODUCTION" ]; then
  echo "\x1b[31mError: POSTGRES_PASSWORD must be set in .env.production\x1b[0m" >&2
  echo "  Edit .env.production and set a strong password." >&2
  exit 1
fi

echo "\x1b[36m── Building production images ──\x1b[0m"
docker compose -f docker-compose.production.yml build --no-cache

echo "\n\x1b[36m── Running database migrations ──\x1b[0m"
docker compose -f docker-compose.production.yml run --rm api sh -c "cd packages/data && npx prisma db push --schema prisma/schema.prisma && npx tsx prisma/seed.ts"

echo "\n\x1b[36m── Starting services ──\x1b[0m"
docker compose -f docker-compose.production.yml up -d --remove-orphans

echo "\n\x1b[36m── Waiting for health checks ──\x1b[0m"
for i in $(seq 1 30); do
  if curl -sf http://localhost:${WEB_PORT:-80}/api/health >/dev/null 2>&1; then
    echo "\n\x1b[32m✓ API is healthy!\x1b[0m"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "\n\x1b[33m⚠ API health check timed out — services may still be starting.\x1b[0m"
  fi
  printf "."
  sleep 1
done

echo "\n\n\x1b[36m── Service status ──\x1b[0m"
docker compose -f docker-compose.production.yml ps

echo "\n\x1b[32m╔══════════════════════════════════════════╗\x1b[0m"
echo "\x1b[32m║          Deployment Complete!            ║\x1b[0m"
echo "\x1b[32m╚══════════════════════════════════════════╝\x1b[0m"
echo "\n  Web:  http://localhost:${WEB_PORT:-80}"
echo "  API:  http://localhost:${WEB_PORT:-80}/api/health"
echo "  Logs: docker compose -f docker-compose.production.yml logs -f"
echo ""
