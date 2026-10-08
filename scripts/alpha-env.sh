#!/usr/bin/env bash

compose_host_port() {
  local binding="$1"
  local port="${binding##*:}"

  if [[ ! "$port" =~ ^[0-9]+$ ]] || ((port < 1 || port > 65535)); then
    echo "Unable to determine a valid host port from '$binding'." >&2
    return 1
  fi

  printf "%s" "$port"
}

load_alpha_env() {
  local env_file="$1"

  if [[ ! -f "$env_file" ]]; then
    return
  fi

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
}

configure_alpha_environment() {
  local postgres_binding="$1"
  local redis_binding="$2"
  local postgres_port
  local redis_port

  postgres_port="$(compose_host_port "$postgres_binding")"
  redis_port="$(compose_host_port "$redis_binding")"

  export DATABASE_URL="${DATABASE_URL:-postgresql://sonofcotester:sonofcotester@127.0.0.1:${postgres_port}/sonofcotester}"
  export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:${redis_port}}"
}
