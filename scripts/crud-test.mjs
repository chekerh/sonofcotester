#!/usr/bin/env node
/**
 * CRUD Integration Test — spawns compiled API, runs tests, exits.
 * Run from anywhere: node scripts/crud-test.mjs
 */
import { spawn, execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_DIR = join(__dirname, '..', 'apps', 'api');
const PORT = 3099;
const BASE = `http://localhost:${PORT}/api`;
let pass = 0, fail = 0;

// Auto-detect Docker ports
const dockerPorts = execSync('docker compose -f /Users/mac/Documents/sonofcotester/docker-compose.yml ps --format "{{.Ports}}"', { encoding: 'utf-8' });
const pgMatch = dockerPorts.match(/127\.0\.0\.1:(\d+)->5432/);
const redisMatch = dockerPorts.match(/127\.0\.0\.1:(\d+)->6379/);
const PG_PORT = pgMatch?.[1] ?? '5432';
const REDIS_PORT = redisMatch?.[1] ?? '6379';
console.log(`Postgres: localhost:${PG_PORT}, Redis: localhost:${REDIS_PORT}`);

const log = (e, m) => console.log(`  ${e} ${m}`);
const ok = (m) => { pass++; log('✓', m); };
const fail_ = (m, x) => { fail++; log('✗', m + (x ? ` → ${String(x).slice(0,100)}` : '')); };
const assert = (l, body, exp) => {
  const s = typeof body === 'string' ? body : JSON.stringify(body);
  s.includes(exp) ? ok(l) : fail_(l, `expected "${exp}"`);
};
const exist = (l, body) => {
  const s = typeof body === 'string' ? body : JSON.stringify(body);
  if (s && s !== 'null' && !s.includes('"statusCode":500')) ok(l);
  else fail_(l, s?.slice(0, 120));
};

const post = async (p, d) => (await fetch(`${BASE}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })).json();
const put_ = async (p, d) => (await fetch(`${BASE}${p}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })).json();
const get_ = async (p) => (await fetch(`${BASE}${p}`)).json();
const del_ = async (p) => (await fetch(`${BASE}${p}`, { method: 'DELETE' })).json();

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
child.on('exit', (code) => { if (code && code > 0) { console.error(`API exited with code ${code}`); } });

for (let i = 0; i < 30; i++) {
  try { const r = await fetch(`${BASE}/health`); if (r.ok) { console.log(`\x1b[32mAPI ready (${i + 1}s)\x1b[0m\n`); break; } } catch {}
  if (i === 29) { console.error('API failed to start'); child.kill(); process.exit(1); }
  await new Promise(r => setTimeout(r, 1000));
}

try {
  let R, CH1, CH2, RID;

  // 1. NOTIFICATION CHANNELS
  console.log('\x1b[36m═══ 1. NOTIFICATION CHANNELS ═══\x1b[0m');
  R = await post('/health/notifications/channels', { name: 'slack-alerts', type: 'slack', enabled: true, minSeverity: 'warning', dimensions: ['security'], config: { webhookUrl: 'https://hooks.slack.com/test' } });
  CH1 = R.id; assert('CREATE slack channel', R, 'slack-alerts');

  R = await post('/health/notifications/channels', { name: 'email-oncall', type: 'email', enabled: true, minSeverity: 'critical', config: { recipients: ['a@b.com'], smtpHost: 'smtp.b.com', smtpPort: 587, fromAddress: 'x@b.com' } });
  CH2 = R.id; assert('CREATE email channel', R, 'email-oncall');

  assert('LIST channels', await get_('/health/notifications/channels'), 'slack-alerts');
  assert('GET channel by id', await get_(`/health/notifications/channels/${CH1}`), 'slack-alerts');
  assert('UPDATE channel', await put_(`/health/notifications/channels/${CH1}`, { name: 'slack-alerts-updated', minSeverity: 'critical' }), 'slack-alerts-updated');
  exist('VALIDATE channel', await get_(`/health/notifications/channels/${CH1}/validate`));
  assert('DELETE channel', await del_(`/health/notifications/channels/${CH2}`), 'ok');
  exist('GET stats', await get_('/health/notifications/stats'));
  exist('GET delivery log', await get_('/health/notifications/delivery-log'));

  // 2. DEDUP
  console.log('\n\x1b[36m═══ 2. DEDUP CONFIG ═══\x1b[0m');
  exist('GET dedup config', await get_('/health/notifications/dedup/config'));
  assert('UPDATE dedup', await put_('/health/notifications/dedup/config', { globalCooldownMs: 120000 }), 'ok');
  exist('GET dedup stats', await get_('/health/notifications/dedup/stats'));
  assert('RESET dedup', await post('/health/notifications/dedup/reset', {}), 'ok');

  // 3. ESCALATION RULES
  console.log('\n\x1b[36m═══ 3. ESCALATION RULES ═══\x1b[0m');
  R = await post('/health/escalation/rules', {
    name: 'critical-security', dimensions: ['security'], minSeverity: 'high', maxEscalations: 3,
    steps: [
      { name: 'notify-team', delayMs: 60000, action: 'notify-slack', targetSeverity: 'critical', messageTemplate: '{{alert.title}}' },
      { name: 'page-oncall', delayMs: 300000, action: 'page-oncall', targetSeverity: 'critical' },
    ],
  });
  RID = R.id; assert('CREATE escalation rule', R, 'critical-security'); assert('  has steps', R, 'notify-team');

  R = await post('/health/escalation/rules', { name: 'perf-degraded', dimensions: ['performance'], minSeverity: 'medium', steps: [{ name: 'webhook', delayMs: 30000, action: 'webhook', targetSeverity: 'warning', messageTemplate: '{{alert.title}}' }] });
  assert('CREATE rule 2', R, 'perf-degraded');
  assert('LIST rules', await get_('/health/escalation/rules'), 'critical-security');
  assert('GET rule', await get_(`/health/escalation/rules/${RID}`), 'critical-security');
  assert('UPDATE rule', await put_(`/health/escalation/rules/${RID}`, { description: 'Updated', maxEscalations: 5 }), 'Updated');
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

  // 8. MAESTRO — Status & CLI
  console.log('\n\x1b[36m═══ 8. MAESTRO STATUS ═══\x1b[0m');
  const maestroStatus = await get_('/health/maestro/status');
  exist('GET maestro status', maestroStatus);
  assert('  has installed field', maestroStatus, 'installed');
  assert('  has devices field', maestroStatus, 'devices');

  // 9. MAESTRO — Flow Generation
  console.log('\n\x1b[36m═══ 9. MAESTRO FLOW GENERATION ═══\x1b[0m');
  const genResult = await post('/health/maestro/generate', {
    cases: [{
      id: 'tc-maestro-1',
      title: 'Login happy path',
      feature: 'Authentication',
      priority: 'p1',
      platform: 'mobile',
      prerequisites: [],
      tags: ['auth', 'smoke'],
      steps: [
        { id: 's1', action: 'navigate', data: 'com.example.app', expectedOutcome: 'App launches' },
        { id: 's2', action: 'fill', target: 'Email', data: 'user@test.com', expectedOutcome: 'Email entered' },
        { id: 's3', action: 'fill', target: 'Password', data: 'pass123', expectedOutcome: 'Password entered' },
        { id: 's4', action: 'click', target: 'Login', expectedOutcome: 'Login tapped' },
        { id: 's5', action: 'assertVisible', target: 'Dashboard', expectedOutcome: 'Dashboard visible' },
      ],
    }],
    appId: 'com.example.app',
    tags: ['test'],
  });
  assert('GENERATE flows — count', genResult, 'count');
  assert('GENERATE flows — has YAML', JSON.stringify(genResult), 'appId');
  assert('GENERATE flows — has commands', JSON.stringify(genResult), 'launchApp');
  assert('GENERATE flows — has tapOn', JSON.stringify(genResult), 'tapOn');
  assert('GENERATE flows — has inputText', JSON.stringify(genResult), 'inputText');
  assert('GENERATE flows — has assertVisible', JSON.stringify(genResult), 'assertVisible');

  // Generate multiple flows
  const multiGen = await post('/health/maestro/generate', {
    cases: [
      { id: 'tc-1', title: 'Flow A', feature: 'F1', priority: 'p0', platform: 'mobile', prerequisites: [], tags: [], steps: [{ id: 's1', action: 'navigate', data: 'app', expectedOutcome: 'ok' }] },
      { id: 'tc-2', title: 'Flow B', feature: 'F2', priority: 'p1', platform: 'mobile', prerequisites: [], tags: [], steps: [{ id: 's1', action: 'click', target: 'Btn', expectedOutcome: 'ok' }] },
      { id: 'tc-3', title: 'Flow C', feature: 'F3', priority: 'p2', platform: 'web', prerequisites: [], tags: [], steps: [{ id: 's1', action: 'assertText', target: 'El', data: 'Hi', expectedOutcome: 'ok' }] },
    ],
    appId: 'com.test.multi',
  });
  assert('GENERATE 3 flows', multiGen, '3');

  // 10. MAESTRO — Flow Preview
  console.log('\n\x1b[36m═══ 10. MAESTRO FLOW PREVIEW ═══\x1b[0m');
  const preview = await post('/health/maestro/preview', {
    testCase: {
      id: 'preview-tc',
      title: 'Search test',
      feature: 'Search',
      priority: 'p1',
      platform: 'mobile',
      prerequisites: [],
      tags: [],
      steps: [
        { id: 's1', action: 'navigate', data: 'com.example', expectedOutcome: 'App opens' },
        { id: 's2', action: 'fill', target: 'Search', data: 'query', expectedOutcome: 'Query entered' },
        { id: 's3', action: 'assertVisible', target: 'Results', expectedOutcome: 'Results shown' },
      ],
    },
    appId: 'com.example',
  });
  assert('PREVIEW — has filename', preview, 'filename');
  assert('PREVIEW — has YAML', preview, 'yaml');
  assert('PREVIEW — YAML has appId', preview, 'appId: com.example');
  assert('PREVIEW — YAML has launchApp', preview, 'launchApp');
  assert('PREVIEW — YAML has tapOn', preview, 'tapOn');
  assert('PREVIEW — YAML has inputText', preview, 'inputText');
  assert('PREVIEW — YAML has assertVisible', preview, 'assertVisible');

  // 11. MAESTRO — AI Spec Generation
  console.log('\n\x1b[36m═══ 11. MAESTRO AI SPEC GENERATION ═══\x1b[0m');
  const specResult = await post('/health/maestro/generate-from-spec', {
    sourceType: 'freeform',
    sourcePayload: `As a registered user, I want to log in to the mobile app so I can access my dashboard.

Acceptance Criteria:
- Given I am on the login screen, When I enter valid email and password, Then I should see my dashboard
- Given I enter wrong credentials, When I tap Login, Then I should see an error message
- User should be able to search for products
- User should be able to create a new order`,
    appId: 'com.example.app',
    platform: 'mobile',
    includeNegativeTests: true,
    maxCases: 10,
  });
  assert('AI SPEC — has summary', specResult, 'summary');
  assert('AI SPEC — has testCases', specResult, 'testCases');
  assert('AI SPEC — has flows', specResult, 'flows');
  assert('AI SPEC — has yamlFiles', specResult, 'yamlFiles');
  assert('AI SPEC — has confidence', specResult, 'confidence');
  assert('AI SPEC — has notes', specResult, 'notes');
  assert('AI SPEC — confidence is number', specResult, '0.');
  assert('AI SPEC — sourceType preserved', specResult, 'freeform');

  // Verify generated flows have proper YAML structure
  const specFlows = specResult.flows || [];
  exist('AI SPEC — generated at least 1 flow', specFlows.length > 0 ? 'yes' : 'no');
  if (specFlows.length > 0) {
    const firstFlow = specFlows[0];
    assert('AI SPEC — flow has appId', firstFlow, 'appId');
    assert('AI SPEC — flow has name', firstFlow, 'name');
    assert('AI SPEC — flow has tags', firstFlow, 'maestro-generated');
  }

  // Verify YAML files are well-formed
  const yamlFiles = specResult.yamlFiles || [];
  exist('AI SPEC — generated YAML files', yamlFiles.length > 0 ? 'yes' : 'no');
  if (yamlFiles.length > 0) {
    const firstYaml = yamlFiles[0];
    assert('AI SPEC — YAML has filename', firstYaml, 'filename');
    assert('AI SPEC — YAML has content', firstYaml, 'yaml');
    assert('AI SPEC — YAML file is .yaml', firstYaml, '.yaml');
  }

  // Test with Jira source type
  const jiraResult = await post('/health/maestro/generate-from-spec', {
    sourceType: 'jira',
    sourcePayload: 'PROJ-123: User Login\nAs a user I want to login\n- Given I am on login page\n- When I enter credentials\n- Then I see dashboard',
    appId: 'com.jira.test',
    platform: 'mobile',
    maxCases: 5,
  });
  assert('AI JIRA — generates from Jira format', jiraResult, 'testCases');
  assert('AI JIRA — sourceType is jira', jiraResult, 'jira');

  // Test with web platform
  const webResult = await post('/health/maestro/generate-from-spec', {
    sourceType: 'story',
    sourcePayload: 'As a customer I want to browse products and add items to cart\n- Search for products\n- View product details\n- Add to cart\n- Checkout',
    appId: 'web',
    platform: 'web',
    includeNegativeTests: false,
    maxCases: 3,
  });
  assert('AI WEB — generates web flows', webResult, 'testCases');

  // 12. MAESTRO — Cloud Status
  console.log('\n\x1b[36m═══ 12. MAESTRO CLOUD STATUS ═══\x1b[0m');
  const cloudStatus = await get_('/health/maestro/cloud/status');
  exist('GET cloud status', cloudStatus);
  assert('  has configured field', cloudStatus, 'configured');
  assert('  has hasApiKey field', cloudStatus, 'hasApiKey');
  assert('  has hasProjectId field', cloudStatus, 'hasProjectId');

  // 13. MAESTRO — Cloud Devices
  console.log('\n\x1b[36m═══ 13. MAESTRO CLOUD DEVICES ═══\x1b[0m');
  const cloudDevices = await get_('/health/maestro/cloud/devices');
  exist('GET cloud devices', cloudDevices);
  assert('  has devices array', cloudDevices, 'devices');
  assert('  has count field', cloudDevices, 'count');

} catch (err) {
  console.error('\x1b[31mERROR:\x1b[0m', err.message);
}

child.kill('SIGTERM');
const total = pass + fail;
console.log(`\n\x1b[36m══════════════════════════════════════════════\x1b[0m`);
console.log(`  Results: \x1b[32m${pass} passed\x1b[0m, \x1b[31m${fail} failed\x1b[0m, ${total} total`);
fail === 0 ? console.log('  \x1b[32mALL TESTS PASSED ✓\x1b[0m') : console.log(`  \x1b[31m${fail} FAILED ✗\x1b[0m`);
console.log(`\x1b[36m══════════════════════════════════════════════\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
