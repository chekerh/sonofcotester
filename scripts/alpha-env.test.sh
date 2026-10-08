#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/alpha-env.sh"

assert_equal() {
  local expected="$1"
  local actual="$2"
  local message="$3"

  if [[ "$expected" != "$actual" ]]; then
    echo "FAIL: $message" >&2
    echo "  expected: $expected" >&2
    echo "  actual:   $actual" >&2
    exit 1
  fi
}

unset DATABASE_URL REDIS_URL
configure_alpha_environment "127.0.0.1:55432" "127.0.0.1:56379"

assert_equal \
  "postgresql://sonofcotester:sonofcotester@127.0.0.1:55432/sonofcotester" \
  "$DATABASE_URL" \
  "DATABASE_URL should use the discovered Postgres port"
assert_equal \
  "redis://127.0.0.1:56379" \
  "$REDIS_URL" \
  "REDIS_URL should use the discovered Redis port"

DATABASE_URL="postgresql://external.example/test"
REDIS_URL="redis://external.example:6380"
configure_alpha_environment "127.0.0.1:55433" "127.0.0.1:56380"

assert_equal \
  "postgresql://external.example/test" \
  "$DATABASE_URL" \
  "an explicit DATABASE_URL should be preserved"
assert_equal \
  "redis://external.example:6380" \
  "$REDIS_URL" \
  "an explicit REDIS_URL should be preserved"

assert_equal "55432" "$(compose_host_port "0.0.0.0:55432")" "IPv4 bindings should parse"
assert_equal "56379" "$(compose_host_port "[::1]:56379")" "IPv6 bindings should parse"

if ! node -e '
  const config = require(process.argv[1]);
  const configured = new Set(config.tasks?.dev?.env ?? []);
  const required = [
    "DATABASE_URL",
    "REDIS_URL",
    "PORT",
    "DEMO_TARGET_PORT",
    "VITE_API_URL",
    "BROWSERSTACK_USERNAME",
    "BROWSERSTACK_ACCESS_KEY",
    "BROWSERSTACK_APP_ID",
  ];
  const missing = required.filter((name) => !configured.has(name));
  if (missing.length > 0) {
    console.error(`Missing dev environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
' "$ROOT_DIR/turbo.json"; then
  echo "FAIL: Turbo should pass alpha runtime variables to dev tasks" >&2
  exit 1
fi

echo "alpha environment tests passed"
