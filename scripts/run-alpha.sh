#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
source "$ROOT_DIR/scripts/alpha-env.sh"
load_alpha_env "$ROOT_DIR/.env"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but not installed." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required but not installed." >&2
  exit 1
fi

echo "Starting postgres and redis..."
docker compose up -d --wait

POSTGRES_BINDING="$(docker compose port postgres 5432)"
REDIS_BINDING="$(docker compose port redis 6379)"
configure_alpha_environment "$POSTGRES_BINDING" "$REDIS_BINDING"

echo "Postgres ready at $POSTGRES_BINDING; Redis ready at $REDIS_BINDING."

echo "Installing workspace dependencies..."
pnpm install

echo "Generating Prisma client..."
pnpm prisma:generate

echo "Pushing database schema..."
pnpm db:push

echo "Starting sonofcotester alpha services..."
pnpm dev:alpha
