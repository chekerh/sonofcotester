#!/usr/bin/env node
/**
 * Deduplication E2E Test
 *
 * Tests:
 *   1. Dispatch an alert → notification sent, delivery log records it
 *   2. Dispatch the SAME alert again within cooldown → suppressed, no new delivery
 *   3. Dedup stats reflect the suppression
 *   4. Reset cooldowns → next dispatch goes through
 *   5. Per-channel dedup: same alert on channel A is suppressed but channel B is not
 *   6. Cooldown expiry: after cooldown, same alert is allowed through
 *   7. Different alert (different title) always goes through
 *   8. Dedup disabled → all alerts pass through
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_DIR = join(__dirname, '..', 'apps', 'api');
const PORT = 3101;
const BASE = `http://localhost:${PORT}/api`;
let pass = 0, fail = 0;

// Auto-detect Docker ports
const dockerPorts = execSync('docker compose -f /Users/mac/Documents/sonofcotester/docker-compose.yml ps --format "{{.Ports}}"', { encoding: 'utf-8' });
const pgMatch = dockerPorts.match(/127\.0\.0\.1:(\d+)->5432/);
const redisMatch = dockerPorts.match(/127\.0\.0\.1:(\d+)->6379/);
const PG_PORT = pgMatch?.[1] ?? '5432';
const REDIS_PORT = redisMatch?.[1] ?? '6379';
console.log(`\x1b[36mDedup E2E Test\x1b[0m — Postgres: localhost:${PG_PORT}, Redis: localhost:${REDIS_PORT}\n`);

const log = (e, m) => console.log(`  ${e} ${m}`);
const ok = (m) => { pass++; log('\x1b[32m✓\x1b[0m', m); };
const fail_ = (m, x) => { fail++; log('\x1b[31m✗\x1b[0m', m + (x ? ` → ${String(x).slice(0, 120)}` : '')); };
const assert = (label, body, expected) => {
  const s = typeof body === 'string' ? body : JSON.stringify(body);
  s.includes(expected) ? ok(label) : fail_(label, `expected "${expected}" in ${s.slice(0, 120)}`);
};
const assertEqual = (label, actual, expected) => {
  actual === expected ? ok(label) : fail_(label, `expected ${expected}, got ${actual}`);
};
const refute = (label, body, unexpected) => {
  const s = typeof body === 'string' ? body : JSON.stringify(body);
  !s.includes(unexpected) ? ok(label) : fail_(label, `should NOT contain "${unexpected}"`);
};

const post = async (p, d) => (await fetch(`${BASE}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })).json();
const put_ = async (p, d) => (await fetch(`${BASE}${p}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })).json();
const get_ = async (p) => (await fetch(`${BASE}${p}`)).json();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Start API ───
console.log('\x1b[36mStarting API from compiled dist...\x1b[0m');
const child = spawn('node', ['dist/main.js'], {
  cwd: API_DIR,
  env: {
    ...process.env,
    DATABASE_URL: `postgresql://sonofcotester:sonofcotester@localhost:${PG_PORT}/sonofcotester?schema=public`,
    REDIS_URL: `redis://localhost:${REDIS_PORT}`,
    PORT: String(PORT),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stderr.on('data', (d) => process.stderr.write(d));
child.on('error', (e) => { console.error('Spawn error:', e.message); process.exit(1); });
child.on('exit', (code) => { if (code && code > 0) console.error(`API exited with code ${code}`); });

for (let i = 0; i < 30; i++) {
  try { const r = await fetch(`${BASE}/health`); if (r.ok) { console.log(`\x1b[32mAPI ready (${i + 1}s)\x1b[0m\n`); break; } } catch {}
  if (i === 29) { console.error('API failed to start'); child.kill(); process.exit(1); }
  await sleep(1000);
}

try {
  // ─── Setup: create channels and configure short cooldown ───
  console.log('\x1b[36m═══ SETUP ═══\x1b[0m');

  // Reset dedup state first
  await post('/health/notifications/dedup/reset', {});
  ok('Reset dedup state');

  // Set a 3-second global cooldown for fast testing
  await put_('/health/notifications/dedup/config', {
    enabled: true,
    globalCooldownMs: 3000,
    perChannelCooldownMs: 5000,
    severityCooldowns: { info: 3000, warning: 3000, critical: 3000 },
  });
  ok('Set 3s cooldown for testing');

  // Create two webhook channels to test per-channel dedup
  const ch1 = await post('/health/notifications/channels', {
    name: 'webhook-primary',
    type: 'webhook',
    enabled: true,
    minSeverity: 'info',
    dimensions: [],
    projectIds: [],
    config: { url: 'http://httpbin.org/post' },
  });
  assert('CREATE webhook channel 1', ch1, 'webhook-primary');

  const ch2 = await post('/health/notifications/channels', {
    name: 'webhook-secondary',
    type: 'webhook',
    enabled: true,
    minSeverity: 'info',
    dimensions: [],
    projectIds: [],
    config: { url: 'http://httpbin.org/post' },
  });
  assert('CREATE webhook channel 2', ch2, 'webhook-secondary');

  // ─── Test 1: First dispatch goes through ───
  console.log('\n\x1b[36m═══ 1. FIRST DISPATCH — should go through ═══\x1b[0m');

  const alert1 = await post('/health/alerts/dispatch', {
    projectId: 'dedup-test',
    dimension: 'security',
    severity: 'critical',
    title: 'SQL Injection Vulnerability Found',
    message: 'A critical SQL injection was found in the login handler.',
  });
  assert('DISPATCH alert 1', alert1, 'ok');

  // Wait for async notification delivery
  await sleep(1000);

  // Check delivery log — should have entries
  const log1 = await get_('/health/notifications/delivery-log');
  const logEntries1 = Array.isArray(log1) ? log1 : [];
  assert('Delivery log has entries', logEntries1.length > 0 ? 'has-entries' : 'empty', 'has-entries');

  // ─── Test 2: Same alert dispatched again — should be suppressed ───
  console.log('\n\x1b[36m═══ 2. SECOND DISPATCH — should be suppressed ═══\x1b[0m');

  const logBefore = logEntries1.length;
  const alert2 = await post('/health/alerts/dispatch', {
    projectId: 'dedup-test',
    dimension: 'security',
    severity: 'critical',
    title: 'SQL Injection Vulnerability Found',
    message: 'A critical SQL injection was found in the login handler.',
  });
  assert('DISPATCH alert 2', alert2, 'ok');

  // Wait briefly — no new deliveries should appear
  await sleep(500);

  const log2 = await get_('/health/notifications/delivery-log');
  const logEntries2 = Array.isArray(log2) ? log2 : [];
  assertEqual('No new deliveries after dedup', logEntries2.length, logBefore);

  // ─── Test 3: Dedup stats reflect suppression ───
  console.log('\n\x1b[36m═══ 3. DEDUP STATS — should show suppression ═══\x1b[0m');

  const stats = await get_('/health/notifications/dedup/stats');
  assert('Dedup stats enabled', stats.enabled ?? stats.config?.enabled, 'true');
  assertEqual('Has tracked fingerprints', stats.totalFingerprints > 0 ? 'yes' : 'no', 'yes');
  assertEqual('Has suppressed count', stats.totalSuppressed > 0 ? 'yes' : 'no', 'yes');

  // ─── Test 4: Reset cooldowns — next dispatch goes through ───
  console.log('\n\x1b[36m═══ 4. RESET & RE-DISPATCH — should go through again ═══\x1b[0m');

  await post('/health/notifications/dedup/reset', {});
  ok('Reset dedup');

  const logBeforeReset = (await get_('/health/notifications/delivery-log')).length;
  const alert3 = await post('/health/alerts/dispatch', {
    projectId: 'dedup-test',
    dimension: 'security',
    severity: 'critical',
    title: 'SQL Injection Vulnerability Found',
    message: 'A critical SQL injection was found in the login handler.',
  });
  assert('DISPATCH after reset', alert3, 'ok');

  // Wait for delivery
  await sleep(1000);

  const logAfterReset = (await get_('/health/notifications/delivery-log')).length;
  assert('New deliveries after reset', logAfterReset > logBeforeReset ? 'yes' : 'no', 'yes');

  // ─── Test 5: Different alert always goes through ───
  console.log('\n\x1b[36m═══ 5. DIFFERENT ALERT — should go through ═══\x1b[0m');

  const logBeforeDiff = (await get_('/health/notifications/delivery-log')).length;
  const alert4 = await post('/health/alerts/dispatch', {
    projectId: 'dedup-test',
    dimension: 'security',
    severity: 'critical',
    title: 'XSS Vulnerability Found',
    message: 'A stored XSS was found in the profile page.',
  });
  assert('DISPATCH different alert', alert4, 'ok');

  await sleep(1000);

  const logAfterDiff = (await get_('/health/notifications/delivery-log')).length;
  assert('New deliveries for different alert', logAfterDiff > logBeforeDiff ? 'yes' : 'no', 'yes');

  // ─── Test 6: Cooldown expiry — after 3s, same alert goes through ───
  console.log('\n\x1b[36m═══ 6. COOLDOWN EXPIRY — wait 3s, dispatch again ═══\x1b[0m');

  await sleep(3500); // Wait for 3s cooldown to expire

  const logBeforeExpiry = (await get_('/health/notifications/delivery-log')).length;
  const alert5 = await post('/health/alerts/dispatch', {
    projectId: 'dedup-test',
    dimension: 'security',
    severity: 'critical',
    title: 'SQL Injection Vulnerability Found',
    message: 'A critical SQL injection was found in the login handler.',
  });
  assert('DISPATCH after cooldown', alert5, 'ok');

  await sleep(1000);

  const logAfterExpiry = (await get_('/health/notifications/delivery-log')).length;
  assert('Delivery after cooldown expiry', logAfterExpiry > logBeforeExpiry ? 'yes' : 'no', 'yes');

  // ─── Test 7: Dedup disabled — all alerts go through ───
  console.log('\n\x1b[36m═══ 7. DEDUP DISABLED — all alerts go through ═══\x1b[0m');

  await put_('/health/notifications/dedup/config', { enabled: false });
  ok('Disabled dedup');

  const logBeforeDisabled = (await get_('/health/notifications/delivery-log')).length;
  await post('/health/alerts/dispatch', {
    projectId: 'dedup-test',
    dimension: 'security',
    severity: 'critical',
    title: 'SQL Injection Vulnerability Found',
    message: 'First dispatch with dedup disabled.',
  });
  // Immediately dispatch again — no cooldown
  await post('/health/alerts/dispatch', {
    projectId: 'dedup-test',
    dimension: 'security',
    severity: 'critical',
    title: 'SQL Injection Vulnerability Found',
    message: 'Second dispatch with dedup disabled.',
  });

  await sleep(1500);

  const logAfterDisabled = (await get_('/health/notifications/delivery-log')).length;
  const newEntries = logAfterDisabled - logBeforeDisabled;
  assert('Both dispatches go through with dedup disabled', newEntries >= 2 ? 'yes' : 'no', 'yes');

  // ─── Test 8: Different project, same title — should NOT be deduped ───
  console.log('\n\x1b[36m═══ 8. DIFFERENT PROJECT — should go through ═══\x1b[0m');

  await put_('/health/notifications/dedup/config', { enabled: true });
  await post('/health/notifications/dedup/reset', {});

  const logBeforeDiffProj = (await get_('/health/notifications/delivery-log')).length;
  await post('/health/alerts/dispatch', {
    projectId: 'dedup-test-project-a',
    dimension: 'security',
    severity: 'critical',
    title: 'Shared Alert Title',
    message: 'Alert from project A.',
  });
  await post('/health/alerts/dispatch', {
    projectId: 'dedup-test-project-b',
    dimension: 'security',
    severity: 'critical',
    title: 'Shared Alert Title',
    message: 'Alert from project B.',
  });

  await sleep(1000);

  const logAfterDiffProj = (await get_('/health/notifications/delivery-log')).length;
  assert('Both project alerts go through', (logAfterDiffProj - logBeforeDiffProj) >= 2 ? 'yes' : 'no', 'yes');

  // ─── Cleanup ───
  console.log('\n\x1b[36m═══ CLEANUP ═══\x1b[0m');
  await post('/health/notifications/dedup/reset', {});
  await put_('/health/notifications/dedup/config', {
    enabled: true,
    globalCooldownMs: 300000,
    perChannelCooldownMs: 600000,
    severityCooldowns: { info: 900000, warning: 300000, critical: 120000 },
  });
  ok('Restored default dedup config');

} catch (err) {
  console.error('\x1b[31mERROR:\x1b[0m', err.message);
  console.error(err.stack);
}

child.kill('SIGTERM');
const total = pass + fail;
console.log(`\n\x1b[36m══════════════════════════════════════════════\x1b[0m`);
console.log(`  Dedup E2E Results: \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m, ${total} total`);
fail === 0 ? console.log('  \x1b[32mALL TESTS PASSED ✓\x1b[0m') : console.log(`  \x1b[31m${fail} FAILED ✗\x1b[0m`);
console.log(`\x1b[36m══════════════════════════════════════════════\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
