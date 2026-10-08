#!/usr/bin/env bash
set -eo pipefail

# SonOfCoTester - Local Startup Script
#
# Bootstraps PostgreSQL + Redis, installs dependencies, syncs the Prisma schema,
# builds the workspace and then runs the alpha service stack:
#
#   * api          -> http://localhost:$PORT            (default 3101)
#   * web          -> http://localhost:5174
#   * demo-target  -> http://localhost:$DEMO_TARGET_PORT (default 3010)
#   * worker       -> background queue consumer (Redis / BullMQ)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Colors for terminal output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info() { echo -e "${CYAN}$*${NC}"; }
ok()   { echo -e "${GREEN}$*${NC}"; }
warn() { echo -e "${YELLOW}$*${NC}"; }
err()  { echo -e "${RED}$*${NC}" >&2; }

APP_PID=""
SERVICES_STARTED=0

# ---------------------------------------------------------------------------
# Small utilities (bash 3.2 compatible - macOS ships bash 3.2)
# ---------------------------------------------------------------------------

pid_cwd() {
  lsof -a -d cwd -p "$1" -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1
}

is_repo_path() {
  [[ -n "$1" && ( "$1" == "$ROOT_DIR" || "$1" == "$ROOT_DIR"/* ) ]]
}

port_listeners() {
  lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}

wait_for_port_free() {
  local port="$1"
  local tries="${2:-15}"
  local i=0
  while (( i < tries )); do
    if [[ -z "$(port_listeners "$port")" ]]; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

list_descendants() {
  local parent="$1"
  local child
  for child in $(pgrep -P "$parent" 2>/dev/null || true); do
    echo "$child"
    list_descendants "$child"
  done
}

has_process_in_dir() {
  local dir="$1"
  local pid cwd
  for pid in $APP_PID $(list_descendants "$APP_PID"); do
    cwd="$(pid_cwd "$pid")"
    if [[ "$cwd" == "$dir" ]]; then
      return 0
    fi
  done
  return 1
}

http_ok() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 2 -o /dev/null "$1" 2>/dev/null
  else
    node -e 'fetch(process.argv[1]).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' "$1" 2>/dev/null
  fi
}

wait_until() {
  local check="$1"
  local attempts="${2:-30}"
  local i=0
  while (( i < attempts )); do
    if "$check"; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

# ---------------------------------------------------------------------------
# Teardown: never leave stale processes holding ports for the next run
# ---------------------------------------------------------------------------

# Kills processes that match an exact dev command line AND live in the given
# scope, so a stray shell in the repo can never be caught by accident.
#   scope "root" -> cwd must be the repository root
#   scope "apps" -> cwd must be one of the application directories
sweep_matching() {
  local signal="$1"
  local pattern="$2"
  local scope="$3"
  local pid cwd

  for pid in $(pgrep -f "$pattern" 2>/dev/null || true); do
    if [[ "$pid" == "$$" || "$pid" == "1" ]]; then
      continue
    fi
    cwd="$(pid_cwd "$pid")"
    if [[ "$scope" == "root" ]]; then
      if [[ "$cwd" != "$ROOT_DIR" ]]; then
        continue
      fi
    else
      if [[ "$cwd" != "$ROOT_DIR"/apps/* ]]; then
        continue
      fi
    fi
    kill "-${signal}" "$pid" 2>/dev/null || true
  done
}

sweep_orphans() {
  local signal="$1"
  sweep_matching "$signal" "turbo run dev --filter=@sonofcotester|pnpm(\.cjs)? dev:alpha" root
  sweep_matching "$signal" "node .*--env-file=\.\./\.\./\.env dist/main\.js|tsx watch src/main\.ts|vite/bin/vite\.js" apps
}

reclaim_ports() {
  local port pid cwd
  for port in "$PORT_API" "$PORT_DEMO" "$PORT_WEB"; do
    for pid in $(port_listeners "$port"); do
      cwd="$(pid_cwd "$pid")"
      if is_repo_path "$cwd"; then
        kill -KILL "$pid" 2>/dev/null || true
      fi
    done
  done
}

stop_services() {
  local pid tree=""
  local launcher_alive=0

  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    launcher_alive=1
  fi

  if [[ -n "$APP_PID" ]]; then
    tree="$APP_PID $(list_descendants "$APP_PID" 2>/dev/null || true)"
    for pid in $tree; do
      if kill -0 "$pid" 2>/dev/null; then
        kill -TERM "$pid" 2>/dev/null || true
      fi
    done
    sleep 1
    for pid in $tree; do
      if kill -0 "$pid" 2>/dev/null; then
        kill -KILL "$pid" 2>/dev/null || true
      fi
    done
  fi

  if (( ! launcher_alive )); then
    sweep_orphans TERM
    sleep 1
    sweep_orphans KILL
  fi

  reclaim_ports
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if (( SERVICES_STARTED )); then
    # Bash prints "Terminated: <pid>" job notices when the launcher is killed;
    # keep the shutdown output clean by silencing stderr while tearing down.
    exec 3>&2 2>/dev/null
    stop_services
    exec 2>&3 3>&-
  fi
  exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo -e "${CYAN}${BOLD}"
echo "========================================================"
echo "         🚀 Starting SonOfCoTester Services             "
echo "========================================================"
echo -e "${NC}"

# ---------------------------------------------------------------------------
# 1. Verify Node.js and pnpm prerequisites
# ---------------------------------------------------------------------------
echo -e "${BOLD}[1/6] Checking prerequisites...${NC}"

if ! command -v node >/dev/null 2>&1; then
  err "❌ Node.js is required but not installed. Please install Node.js (>= 20)."
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 20 )); then
  err "❌ Node.js >= 20 is required (found $(node -v)). The API/worker use 'node --env-file'."
  exit 1
fi
ok "✓ Node.js detected: $(node -v)"

if ! command -v pnpm >/dev/null 2>&1; then
  warn "⚠️  pnpm is not found in PATH. Attempting to activate via corepack..."
  if command -v corepack >/dev/null 2>&1; then
    corepack enable || true
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    err "❌ pnpm is required. Install it using: npm install -g pnpm"
    exit 1
  fi
fi
ok "✓ pnpm detected: $(pnpm -v)"

# ---------------------------------------------------------------------------
# 2. Setup or load .env
# ---------------------------------------------------------------------------
echo -e "\n${BOLD}[2/6] Preparing environment file...${NC}"

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  if [[ -f "$ROOT_DIR/.env.example" ]]; then
    warn "ℹ️  Creating .env from .env.example..."
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  else
    touch "$ROOT_DIR/.env"
  fi
fi

env_value() {
  local key="$1"
  local default="$2"
  local value
  value="$(grep -E "^${key}=" "$ROOT_DIR/.env" 2>/dev/null | tail -n 1 | cut -d= -f2-)"
  value="${value%\"}"
  value="${value#\"}"
  printf '%s' "${value:-$default}"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local file="$ROOT_DIR/.env"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    if sed --version >/dev/null 2>&1; then
      sed -i -e "s|^${key}=.*|${key}=${value}|" "$file"
    else
      sed -i '' -e "s|^${key}=.*|${key}=${value}|" "$file"
    fi
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

PORT_API="$(env_value PORT 3101)"
PORT_DEMO="$(env_value DEMO_TARGET_PORT 3010)"
PORT_WEB=5174
VITE_API_URL="$(env_value VITE_API_URL "http://localhost:${PORT_API}")"
ok "✓ .env ready (api=${PORT_API}, demo-target=${PORT_DEMO}, web=${PORT_WEB})"

# ---------------------------------------------------------------------------
# 3. PostgreSQL provisioning & health check
# ---------------------------------------------------------------------------
echo -e "\n${BOLD}[3/6] Checking PostgreSQL...${NC}"

PG_HOST="127.0.0.1"
PG_PORT="5432"
PG_USER="sonofcotester"
PG_PASS="sonofcotester"
PG_DB="sonofcotester"

is_pg_ready() {
  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -h "$PG_HOST" -p "$PG_PORT" -t 2 >/dev/null 2>&1
  else
    nc -z "$PG_HOST" "$PG_PORT" >/dev/null 2>&1
  fi
}

psql_exec() {
  local user="$1"
  local sql="$2"
  if ! command -v psql >/dev/null 2>&1; then
    return 1
  fi
  # -w: never prompt, so a missing password can never hang the script
  PGPASSWORD="$PG_PASS" psql -w -h "$PG_HOST" -p "$PG_PORT" -U "$user" -d postgres -c "$sql" >/dev/null 2>&1
}

if ! is_pg_ready; then
  warn "PostgreSQL is not reachable on ${PG_HOST}:${PG_PORT}. Attempting to start it..."

  if command -v brew >/dev/null 2>&1; then
    brew services start postgresql@16 >/dev/null 2>&1 || brew services start postgresql >/dev/null 2>&1 || true
  fi

  if ! is_pg_ready && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    info "Starting PostgreSQL via Docker Compose..."
    docker compose up -d --wait postgres || true
    PG_BINDING="$(docker compose port postgres 5432 2>/dev/null || true)"
    if [[ -n "$PG_BINDING" ]]; then
      PG_PORT="${PG_BINDING##*:}"
    fi
  fi

  wait_until is_pg_ready 30 || true
fi

if is_pg_ready; then
  ok "✓ PostgreSQL is ready on ${PG_HOST}:${PG_PORT}"
  for admin in postgres "$USER"; do
    psql_exec "$admin" "CREATE ROLE ${PG_USER} WITH LOGIN PASSWORD '${PG_PASS}' SUPERUSER;" || true
    psql_exec "$admin" "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};" || true
  done
  if command -v psql >/dev/null 2>&1 && ! PGPASSWORD="$PG_PASS" psql -w -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tAc "SELECT 1" >/dev/null 2>&1; then
    warn "⚠️  Cannot reach database '${PG_DB}' as '${PG_USER}' yet - 'db:push' will create it."
  fi
  export DATABASE_URL="postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}?schema=public"
else
  warn "⚠️  PostgreSQL could not be started automatically. The API will fall back to in-memory storage."
  export DATABASE_URL="${DATABASE_URL:-postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}?schema=public}"
fi

# ---------------------------------------------------------------------------
# 4. Redis provisioning & health check
# ---------------------------------------------------------------------------
echo -e "\n${BOLD}[4/6] Checking Redis...${NC}"

REDIS_HOST="127.0.0.1"
REDIS_PORT="6379"

is_redis_ready() {
  if command -v redis-cli >/dev/null 2>&1; then
    [[ "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null)" == "PONG" ]]
  else
    nc -z "$REDIS_HOST" "$REDIS_PORT" >/dev/null 2>&1
  fi
}

if ! is_redis_ready; then
  warn "Redis is not reachable on ${REDIS_HOST}:${REDIS_PORT}. Attempting to start it..."

  if command -v brew >/dev/null 2>&1; then
    brew services start redis >/dev/null 2>&1 || true
  fi

  if ! is_redis_ready && command -v redis-server >/dev/null 2>&1; then
    redis-server --daemonize yes --bind 127.0.0.1 --port "$REDIS_PORT" >/dev/null 2>&1 || true
  fi

  if ! is_redis_ready && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    info "Starting Redis via Docker Compose..."
    docker compose up -d --wait redis || true
    REDIS_BINDING="$(docker compose port redis 6379 2>/dev/null || true)"
    if [[ -n "$REDIS_BINDING" ]]; then
      REDIS_PORT="${REDIS_BINDING##*:}"
    fi
  fi

  wait_until is_redis_ready 30 || true
fi

if is_redis_ready; then
  ok "✓ Redis is ready on ${REDIS_HOST}:${REDIS_PORT}"
  export REDIS_URL="redis://${REDIS_HOST}:${REDIS_PORT}"
else
  warn "⚠️  Redis is not running. The worker cannot consume BullMQ jobs until it is."
  export REDIS_URL="${REDIS_URL:-redis://${REDIS_HOST}:${REDIS_PORT}}"
fi

set_env_value DATABASE_URL "$DATABASE_URL"
set_env_value REDIS_URL "$REDIS_URL"

export PORT="$PORT_API"
export DEMO_TARGET_PORT="$PORT_DEMO"
export VITE_API_URL

# ---------------------------------------------------------------------------
# 5. Dependencies, Prisma schema and workspace build
# ---------------------------------------------------------------------------
echo -e "\n${BOLD}[5/6] Installing dependencies & preparing the workspace...${NC}"

if ! pnpm install --silent; then
  err "❌ pnpm install failed."
  exit 1
fi

info "Generating Prisma client..."
if ! pnpm prisma:generate; then
  err "❌ prisma generate failed."
  exit 1
fi

info "Synchronizing Prisma schema with the database..."
if ! pnpm db:push --accept-data-loss; then
  if is_pg_ready; then
    err "❌ prisma db push failed while PostgreSQL is reachable. Check DATABASE_URL=${DATABASE_URL}"
    exit 1
  fi
  warn "⚠️  Could not push the Prisma schema - PostgreSQL is unreachable, the API will fall back to in-memory storage."
fi

# The api/worker 'dev' tasks run 'node dist/main.js' and every workspace package
# resolves to its built ./dist, so a build must happen before the stack starts.
info "Building workspace packages and services..."
if ! pnpm build; then
  err "❌ Build failed - fix the TypeScript errors above and re-run ./run_app.sh"
  exit 1
fi

# ---------------------------------------------------------------------------
# 6. Ports, launch and health verification
# ---------------------------------------------------------------------------
echo -e "\n${BOLD}[6/6] Launching application services...${NC}"

ensure_port_free() {
  local port="$1"
  local name="$2"
  local pids pid cwd stale=0 foreign=0

  pids="$(port_listeners "$port")"
  if [[ -z "$pids" ]]; then
    ok "✓ Port ${port} (${name}) is available."
    return 0
  fi

  for pid in $pids; do
    cwd="$(pid_cwd "$pid")"
    if is_repo_path "$cwd"; then
      warn "⚠️  Port ${port} (${name}) is held by stale process ${pid} from a previous run - stopping it."
      kill "$pid" 2>/dev/null || true
      stale=1
    else
      err "❌ Port ${port} (${name}) is already used by another program (PID ${pid}, cwd: ${cwd:-unknown})."
      foreign=1
    fi
  done

  if (( foreign )); then
    err "   Stop that program (or change PORT / DEMO_TARGET_PORT in .env) and re-run ./run_app.sh"
    return 1
  fi

  if (( stale )); then
    if ! wait_for_port_free "$port" 15; then
      err "❌ Port ${port} (${name}) did not become free."
      return 1
    fi
    ok "✓ Port ${port} (${name}) is now available."
  fi
  return 0
}

if ! ensure_port_free "$PORT_API" "API Server"; then exit 1; fi
if ! ensure_port_free "$PORT_DEMO" "Demo Target"; then exit 1; fi
if ! ensure_port_free "$PORT_WEB" "Web Console"; then exit 1; fi

echo -e "\n${GREEN}${BOLD}========================================================"
echo "    🚀 SonOfCoTester is launching all services!         "
echo "========================================================"
echo -e "${NC}"
echo -e "  🌐 Web Console:   ${CYAN}${BOLD}http://localhost:${PORT_WEB}${NC}"
echo -e "  📡 API Server:    ${CYAN}${BOLD}http://localhost:${PORT_API}${NC}"
echo -e "  🩺 Health Check:  ${CYAN}http://localhost:${PORT_API}/api/health${NC}"
echo -e "  🎯 Demo Target:   ${CYAN}http://localhost:${PORT_DEMO}${NC}"
echo -e "  ⚙️  Worker:        ${CYAN}Background Job Engine Active${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop all services.${NC}\n"

pnpm dev:alpha &
APP_PID=$!
SERVICES_STARTED=1

info "Waiting for the services to respond..."
DEADLINE=$((SECONDS + 90))
API_UP=0
DEMO_UP=0
WEB_UP=0
WORKER_UP=0
FAILED=1

while (( SECONDS < DEADLINE )); do
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    err "❌ The service stack exited during startup - see the output above."
    exit 1
  fi

  if (( ! API_UP )) && http_ok "http://127.0.0.1:${PORT_API}/api/health"; then
    API_UP=1
    ok "  ✓ api          http://localhost:${PORT_API}"
  fi
  if (( ! DEMO_UP )) && http_ok "http://127.0.0.1:${PORT_DEMO}/health"; then
    DEMO_UP=1
    ok "  ✓ demo-target  http://localhost:${PORT_DEMO}"
  fi
  if (( ! WEB_UP )) && http_ok "http://127.0.0.1:${PORT_WEB}/"; then
    WEB_UP=1
    ok "  ✓ web          http://localhost:${PORT_WEB}"
  fi
  if (( ! WORKER_UP )) && has_process_in_dir "$ROOT_DIR/apps/worker"; then
    WORKER_UP=1
    ok "  ✓ worker       queue consumer running"
  fi

  if (( API_UP && DEMO_UP && WEB_UP && WORKER_UP )); then
    FAILED=0
    break
  fi
  sleep 1
done

if (( FAILED )); then
  err ""
  err "❌ Startup timed out before every service became healthy:"
  (( API_UP ))      || err "   ✗ api          not responding on http://localhost:${PORT_API}/api/health"
  (( DEMO_UP ))     || err "   ✗ demo-target  not responding on http://localhost:${PORT_DEMO}/health"
  (( WEB_UP ))      || err "   ✗ web          not responding on http://localhost:${PORT_WEB}"
  (( WORKER_UP ))   || err "   ✗ worker       process not found in apps/worker (is Redis running?)"
  exit 1
fi

echo ""
ok "✅ All services are up and running."

set +e
wait "$APP_PID"
EXIT_CODE=$?
set -e

echo ""
if (( EXIT_CODE == 0 )); then
  info "SonOfCoTester services stopped."
else
  warn "SonOfCoTester services stopped unexpectedly (exit code ${EXIT_CODE}) - see the output above."
fi
exit "$EXIT_CODE"
