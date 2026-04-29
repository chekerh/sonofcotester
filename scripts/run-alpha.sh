#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but not installed." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required but not installed." >&2
  exit 1
fi

echo "Starting postgres and redis..."
docker compose up -d

echo "Installing workspace dependencies..."
pnpm install

echo "Generating Prisma client..."
pnpm prisma:generate

echo "Pushing database schema..."
pnpm db:push

echo "Starting sonofcotester alpha services..."
pnpm dev:alpha

