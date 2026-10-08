#!/bin/bash
# Complete CRUD test suite — starts API, runs tests, stops API
cd "$(dirname "$0")"
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
PASS=0; FAIL=0
BASE="http://localhost:3101/api"

# Start API in a subshell that stays alive
cd /Users/mac/Documents/sonofcotester/apps/api && DATABASE_URL="postgresql://sonofcotester:sonofcotester@localhost:50348/sonofcotester?schema=public" REDIS_URL="redis://localhost:50347" PORT=3101 node dist/main.js &
APIPID=$!
cd - > /dev/null
trap "kill $APIPID 2>/dev/null; wait $APIPID 2>/dev/null" EXIT

echo -e "${CYAN}Waiting for API...${NC}"
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" "$BASE/health" 2>/dev/null | grep -q "200"; then
    echo -e "${GREEN}API ready (${i}s)${NC}"
    break
  fi
  if [ "$i" -eq 30 ]; then echo -e "${RED}API failed to start${NC}"; cat /tmp/api.log 2>/dev/null; exit 1; fi
  sleep 1
done

assert_contains() {
  local label="$1" body="$2" expected="$3"
  if echo "$body" | grep -q "$expected"; then echo -e "${GREEN}  ✓ $1${NC}"; PASS=$((PASS + 1))
  else echo -e "${RED}  ✗ $1${NC}"; FAIL=$((FAIL + 1)); fi
}
assert_ok() {
  local label="$1" body="$2"
  if [ -n "$body" ] && [ "$body" != "null" ] && echo "$body" | grep -qv "error"; then echo -e "${GREEN}  ✓ $1${NC}"; PASS=$((PASS + 1))
  else echo -e "${RED}  ✗ $1 → $body${NC}"; FAIL=$((FAIL + 1)); fi
}

post() { curl -s -X POST "$1" -H "Content-Type: application/json" -d "$2" 2>/dev/null; }
put() { curl -s -X PUT "$1" -H "Content-Type: application/json" -d "$2" 2>/dev/null; }
get() { curl -s "$1" 2>/dev/null; }
del() { curl -s -X DELETE "$1" 2>/dev/null; }

# ═══ 1. NOTIFICATION CHANNELS ═══
echo -e "\n${CYAN}═══ 1. NOTIFICATION CHANNELS ═══${NC}"
R=$(post "$BASE/health/notifications/channels" '{"name":"slack-alerts","type":"slack","enabled":true,"minSeverity":"warning","dimensions":["security"],"config":{"webhookUrl":"https://hooks.slack.com/test"}}')
CH1=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null || true)
assert_contains "CREATE slack channel" "$R" "slack-alerts"

R=$(post "$BASE/health/notifications/channels" '{"name":"email-oncall","type":"email","enabled":true,"minSeverity":"critical","config":{"recipients":["a@b.com"],"smtpHost":"smtp.b.com","smtpPort":587,"fromAddress":"x@b.com"}}')
CH2=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null || true)
assert_contains "CREATE email channel" "$R" "email-oncall"

R=$(get "$BASE/health/notifications/channels")
assert_contains "LIST channels" "$R" "slack-alerts"

R=$(get "$BASE/health/notifications/channels/$CH1")
assert_contains "GET channel by id" "$R" "slack-alerts"

R=$(put "$BASE/health/notifications/channels/$CH1" '{"name":"slack-alerts-updated","minSeverity":"critical"}')
assert_contains "UPDATE channel" "$R" "slack-alerts-updated"

R=$(get "$BASE/health/notifications/channels/$CH1/validate")
assert_contains "VALIDATE channel" "$R" "valid"

R=$(del "$BASE/health/notifications/channels/$CH2")
assert_contains "DELETE channel" "$R" "ok"

R=$(get "$BASE/health/notifications/stats")
assert_ok "GET stats" "$R"

R=$(get "$BASE/health/notifications/delivery-log")
assert_ok "GET delivery log" "$R"

# ═══ 2. DEDUP ═══
echo -e "\n${CYAN}═══ 2. DEDUP CONFIG ═══${NC}"
R=$(get "$BASE/health/notifications/dedup/config")
assert_ok "GET dedup config" "$R"

R=$(put "$BASE/health/notifications/dedup/config" '{"globalCooldownMs":120000}')
assert_contains "UPDATE dedup" "$R" "ok"

R=$(get "$BASE/health/notifications/dedup/stats")
assert_ok "GET dedup stats" "$R"

R=$(post "$BASE/health/notifications/dedup/reset" '{}')
assert_contains "RESET dedup" "$R" "ok"

# ═══ 3. ESCALATION RULES ═══
echo -e "\n${CYAN}═══ 3. ESCALATION RULES ═══${NC}"
R=$(post "$BASE/health/escalation/rules" '{"name":"critical-security","dimensions":["security"],"minSeverity":"high","maxEscalations":3,"steps":[{"name":"notify-team","delayMs":60000,"action":"notify-slack","targetSeverity":"critical","messageTemplate":"{{alert.title}}"},{"name":"page-oncall","delayMs":300000,"action":"page-oncall","targetSeverity":"critical"}]}')
RID=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null || true)
assert_contains "CREATE escalation rule" "$R" "critical-security"

R=$(post "$BASE/health/escalation/rules" '{"name":"perf-degraded","dimensions":["performance"],"minSeverity":"medium","steps":[{"name":"webhook","delayMs":30000,"action":"webhook","targetSeverity":"warning","messageTemplate":"{{alert.title}}"}]}')
assert_contains "CREATE rule 2" "$R" "perf-degraded"

R=$(get "$BASE/health/escalation/rules")
assert_contains "LIST rules" "$R" "critical-security"

R=$(get "$BASE/health/escalation/rules/$RID")
assert_contains "GET rule" "$R" "critical-security"

R=$(put "$BASE/health/escalation/rules/$RID" '{"description":"Updated","maxEscalations":5}')
assert_contains "UPDATE rule" "$R" "Updated"

R=$(get "$BASE/health/escalation/active")
assert_ok "GET active escalations" "$R"

R=$(get "$BASE/health/escalation/events")
assert_ok "GET escalation events" "$R"

R=$(get "$BASE/health/escalation/stats")
assert_ok "GET escalation stats" "$R"

# ═══ 4. HEALTH ENDPOINTS ═══
echo -e "\n${CYAN}═══ 4. HEALTH ENDPOINTS ═══${NC}"
R=$(get "$BASE/health/overview/test-project")
assert_ok "GET health overview" "$R"

R=$(post "$BASE/health/security/scan" '{"projectId":"test-project"}')
assert_contains "RUN security scan" "$R" "vulnerabilities"

R=$(post "$BASE/health/ui/scan" '{"projectId":"test-project","url":"http://localhost:5173"}')
assert_contains "RUN UI scan" "$R" "checks"

R=$(get "$BASE/health/database/snapshot/test-project")
assert_ok "GET DB snapshot" "$R"

R=$(get "$BASE/health/performance/snapshot/test-project")
assert_ok "GET perf snapshot" "$R"

R=$(get "$BASE/health/trend/test-project")
assert_ok "GET trend" "$R"

R=$(get "$BASE/health/alerts/test-project")
assert_ok "GET alerts" "$R"

# ═══ 5. SCHEDULER ═══
echo -e "\n${CYAN}═══ 5. SCHEDULER ═══${NC}"
R=$(get "$BASE/health/scheduler/status")
assert_ok "GET scheduler status" "$R"

R=$(get "$BASE/health/scheduler/config")
assert_ok "GET scheduler config" "$R"

R=$(post "$BASE/health/scheduler/config" '{"intervalMs":300000}')
assert_contains "UPDATE scheduler config" "$R" "intervalMs"

# ═══ 6. PR HEALTH ═══
echo -e "\n${CYAN}═══ 6. PR HEALTH ═══${NC}"
R=$(post "$BASE/health/pr/summary" '{"repository":"org/repo","prNumber":42,"headSha":"abc123","branch":"feat","baseBranch":"main","projectId":"test-project"}')
assert_ok "RUN PR summary" "$R"

R=$(get "$BASE/health/pr/recent")
assert_ok "GET recent PRs" "$R"

# ═══ 7. WEBHOOK INTEGRATIONS ═══
echo -e "\n${CYAN}═══ 7. WEBHOOK INTEGRATIONS ═══${NC}"
R=$(post "$BASE/health/pr/integrations" '{"repository":"org/repo","branches":["main","feat/*"],"enabled":true}')
assert_contains "CREATE integration" "$R" "org/repo"

R=$(get "$BASE/health/pr/integrations")
assert_contains "LIST integrations" "$R" "org/repo"

# ═══ RESULTS ═══
echo -e "\n${CYAN}══════════════════════════════════════════════${NC}"
TOTAL=$((PASS + FAIL))
echo -e "  Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}, ${TOTAL} total"
[ $FAIL -eq 0 ] && echo -e "  ${GREEN}ALL TESTS PASSED ✓${NC}" || echo -e "  ${RED}${FAIL} FAILED ✗${NC}"
echo -e "${CYAN}══════════════════════════════════════════════${NC}"
exit $FAIL
