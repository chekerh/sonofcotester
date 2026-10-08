#!/usr/bin/env node
/**
 * CRUD Integration Test — starts NestJS API in-process, runs tests, exits.
 * Run from apps/api: cd apps/api && node ../../scripts/crud-test.mjs
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module.js';
import { ValidationPipe } from '@nestjs/common';

const PORT = 3099;
const BASE = `http://localhost:${PORT}/api`;
let pass = 0, fail = 0;

const log = (e, m) => console.log(`  ${e} ${m}`);
const ok = (m) => { pass++; log('✓', m); };
const fail_ = (m, x) => { fail++; log('✗', m + (x ? ` → ${x}` : '')); };
const assert = (l, body, exp) => {
  const s = typeof body === 'string' ? body : JSON.stringify(body);
  s.includes(exp) ? ok(l) : fail_(l, `expected "${exp}" in ${s.slice(0, 200)}`);
};
const exist = (l, body) => {
  const s = typeof body === 'string' ? body : JSON.stringify(body);
  s && s !== 'null' && !s.includes('"statusCode":500') ? ok(l) : fail_(l, s?.slice(0, 200));
};

const post = async (p, d) => (await fetch(`${BASE}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })).json();
const put_ = async (p, d) => (await fetch(`${BASE}${p}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })).json();
const get_ = async (p) => (await fetch(`${BASE}${p}`)).json();
const del_ = async (p) => (await fetch(`${BASE}${p}`, { method: 'DELETE' })).json();

const app = await NestFactory.create(AppModule, { logger: ['error'] });
app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
await app.listen(PORT);
console.log('\n\x1b[32mAPI ready on port ' + PORT + '\x1b[0m\n');

try {
  let R, CH1, CH2, RID;

  // 1. NOTIFICATION CHANNELS
  console.log('\x1b[36m═══ 1. NOTIFICATION CHANNELS ═══\x1b[0m');
  R = await post('/health/notifications/channels', { name: 'slack-alerts', type: 'slack', enabled: true, minSeverity: 'warning', dimensions: ['security'], config: { webhookUrl: 'https://hooks.slack.com/test' } });
  CH1 = R.id;
  assert('CREATE slack channel', R, 'slack-alerts');

  R = await post('/health/notifications/channels', { name: 'email-oncall', type: 'email', enabled: true, minSeverity: 'critical', config: { recipients: ['a@b.com'], smtpHost: 'smtp.b.com', smtpPort: 587, fromAddress: 'x@b.com' } });
  CH2 = R.id;
  assert('CREATE email channel', R, 'email-oncall');

  R = await get_('/health/notifications/channels');
  assert('LIST channels', R, 'slack-alerts');

  R = await get_(`/health/notifications/channels/${CH1}`);
  assert('GET channel by id', R, 'slack-alerts');

  R = await put_(`/health/notifications/channels/${CH1}`, { name: 'slack-alerts-updated', minSeverity: 'critical' });
  assert('UPDATE channel', R, 'slack-alerts-updated');

  R = await get_(`/health/notifications/channels/${CH1}/validate`);
  assert('VALIDATE channel', R, 'valid');

  R = await del_(`/health/notifications/channels/${CH2}`);
  assert('DELETE channel', R, 'ok');

  R = await get_('/health/notifications/stats');
  exist('GET stats', R);

  R = await get_('/health/notifications/delivery-log');
  exist('GET delivery log', R);

  // 2. DEDUP
  console.log('\n\x1b[36m═══ 2. DEDUP CONFIG ═══\x1b[0m');
  R = await get_('/health/notifications/dedup/config');
  exist('GET dedup config', R);
  R = await put_('/health/notifications/dedup/config', { globalCooldownMs: 120000 });
  assert('UPDATE dedup', R, 'ok');
  R = await get_('/health/notifications/dedup/stats');
  exist('GET dedup stats', R);
  R = await post('/health/notifications/dedup/reset', {});
  assert('RESET dedup', R, 'ok');

  // 3. ESCALATION RULES
  console.log('\n\x1b[36m═══ 3. ESCALATION RULES ═══\x1b[0m');
  R = await post('/health/escalation/rules', {
    name: 'critical-security', dimensions: ['security'], minSeverity: 'high', maxEscalations: 3,
    steps: [
      { name: 'notify-team', delayMs: 60000, action: 'notify-slack', targetSeverity: 'critical', messageTemplate: '{{alert.title}}' },
      { name: 'page-oncall', delayMs: 300000, action: 'page-oncall', targetSeverity: 'critical' },
    ],
  });
  RID = R.id;
  assert('CREATE escalation rule', R, 'critical-security');
  assert('  has steps', R, 'notify-team');

  R = await post('/health/escalation/rules', {
    name: 'perf-degraded', dimensions: ['performance'], minSeverity: 'medium',
    steps: [{ name: 'webhook', delayMs: 30000, action: 'webhook', targetSeverity: 'warning', messageTemplate: '{{alert.title}}' }],
  });
  assert('CREATE rule 2', R, 'perf-degraded');

  R = await get_('/health/escalation/rules');
  assert('LIST rules', R, 'critical-security');
  R = await get_(`/health/escalation/rules/${RID}`);
  assert('GET rule', R, 'critical-security');
  R = await put_(`/health/escalation/rules/${RID}`, { description: 'Updated', maxEscalations: 5 });
  assert('UPDATE rule', R, 'Updated');
  exist('GET active escalations', await get_('/health/escalation/active'));
  exist('GET escalation events', await get_('/health/escalation/events'));
  exist('GET escalation stats', await get_('/health/escalation/stats'));

  // 4. HEALTH ENDPOINTS
  console.log('\n\x1b[36m═══ 4. HEALTH ENDPOINTS ═══\x1b[0m');
  exist('GET health overview', await get_('/health/overview/test-project'));
  assert('RUN security scan', await post('/health/security/scan', { projectId: 'test-project' }), 'vulnerabilities');
  assert('RUN UI scan', await post('/health/ui/scan', { projectId: 'test-project', url: 'http://localhost:5173' }), 'checks');
  exist('GET DB snapshot', await get_('/health/db/test-project'));
  exist('GET perf snapshot', await get_('/health/performance/test-project'));
  exist('GET trend', await get_('/health/trend/test-project'));
  exist('GET alerts', await get_('/health/alerts/test-project'));

  // 5. SCHEDULER
  console.log('\n\x1b[36m═══ 5. SCHEDULER ═══\x1b[0m');
  exist('GET scheduler status', await get_('/health/scheduler/status'));
  exist('GET scheduler config', await get_('/health/scheduler/config'));
  assert('UPDATE scheduler config', await post('/health/scheduler/config', { intervalMs: 300000 }), 'intervalMs');

  // 6. PR HEALTH
  console.log('\n\x1b[36m═══ 6. PR HEALTH ═══\x1b[0m');
  exist('RUN PR summary', await post('/health/pr/summary', { repository: 'org/repo', prNumber: 42, headSha: 'abc123', branch: 'feat', baseBranch: 'main', projectId: 'test-project' }));
  exist('GET recent PRs', await get_('/health/pr/recent'));

  // 7. WEBHOOK INTEGRATIONS
  console.log('\n\x1b[36m═══ 7. WEBHOOK INTEGRATIONS ═══\x1b[0m');
  assert('CREATE integration', await post('/health/pr/integrations', { repository: 'org/repo', branches: ['main', 'feat/*'], enabled: true }), 'org/repo');
  assert('LIST integrations', await get_('/health/pr/integrations'), 'org/repo');

} catch (err) {
  console.error('\x1b[31mERROR:\x1b[0m', err.message);
  console.error(err.stack);
}

await app.close();
const total = pass + fail;
console.log(`\n\x1b[36m══════════════════════════════════════════════\x1b[0m`);
console.log(`  Results: \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m, ${total} total`);
fail === 0 ? console.log('  \x1b[32mALL TESTS PASSED ✓\x1b[0m') : console.log(`  \x1b[31m${fail} FAILED ✗\x1b[0m`);
console.log(`\x1b[36m══════════════════════════════════════════════\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
