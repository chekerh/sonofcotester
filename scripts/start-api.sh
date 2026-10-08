#!/bin/bash
cd "$(dirname "$0")/../apps/api"
export DATABASE_URL="postgresql://sonofcotester:sonofcotester@localhost:50348/sonofcotester?schema=public"
export REDIS_URL="redis://localhost:50347"
export PORT=3101
exec node_modules/.bin/tsx src/main.ts
