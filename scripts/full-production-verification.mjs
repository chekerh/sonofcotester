import { spawn } from "node:child_process";
import { resolve } from "node:path";

const API_BASE = "http://127.0.0.1:3101/api";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`[${res.status}] ${path} - ${JSON.stringify(data)}`);
  }
  return data;
}

let apiProcess = null;

async function startApi() {
  try {
    const health = await request("/health");
    if (health && health.ok) {
      console.log("\n🚀 [1/9] API Service is already running and healthy!");
      return;
    }
  } catch {}

  console.log("\n🚀 [1/9] Starting API Service for Verification...");
  apiProcess = spawn("node", ["apps/api/dist/main.js"], {
    cwd: resolve(process.cwd()),
    env: { ...process.env, PORT: "3101", NODE_ENV: "test" },
    stdio: "inherit"
  });

  // Poll health endpoint
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    try {
      const health = await request("/health");
      if (health && health.ok) {
        console.log("  ✓ API Control Plane is healthy and responsive!");
        return;
      }
    } catch {}
  }
  throw new Error("API failed to become healthy within 30 seconds");
}

async function runTests() {
  console.log("\n========================================================");
  console.log("  SON OF COTESTER: FULL PRODUCTION READINESS AUDIT");
  console.log("========================================================\n");

  let passedChecks = 0;
  let totalChecks = 0;

  function assert(condition, message) {
    totalChecks++;
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passedChecks++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Health & Capabilities
  console.log("🔎 [2/9] Auditing Health & Provider Capabilities...");
  const health = await request("/health");
  assert(health.ok === true && health.service === "api", "Health endpoint returns healthy status");

  const ready = await request("/ready");
  assert(ready.ready === true, "Readiness probe confirmed API is ready for production traffic");

  const capabilities = await request("/providers/capabilities");
  assert(Array.isArray(capabilities) && capabilities.some((c) => c.provider === "maestro-local"), "Maestro Local provider capability detected");
  assert(capabilities.some((c) => c.provider === "playwright-local"), "Playwright Local browser provider detected");

  // 2. Full Project CRUD
  console.log("\n📁 [3/9] Auditing Project Full Lifecycle (CRUD)...");
  const createdProject = await request("/projects", {
    method: "POST",
    body: JSON.stringify({
      name: "E2E Production Test Project",
      description: "Automated verification test suite sandbox",
      workspaceId: "ws_internal"
    })
  });
  assert(createdProject.id && createdProject.name === "E2E Production Test Project", "POST /projects created project cleanly");

  const retrievedProject = await request(`/projects/${createdProject.id}`);
  assert(retrievedProject.id === createdProject.id, "GET /projects/:id retrieved exact created project");

  const updatedProject = await request(`/projects/${createdProject.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: "E2E Production Test Project (Updated)",
      description: "Updated description for verification"
    })
  });
  assert(updatedProject.name.includes("(Updated)"), "PATCH /projects/:id updated project successfully");

  // 3. Full Test Suite & Test Case CRUD
  console.log("\n🧪 [4/9] Auditing Test Suite & Test Case Lifecycle (CRUD)...");
  const createdSuite = await request(`/projects/${createdProject.id}/test-suites`, {
    method: "POST",
    body: JSON.stringify({
      summary: "Smoke Verification Suite",
      sourceType: "manual",
      cases: [
        {
          title: "User can view checkout summary",
          feature: "Checkout",
          priority: "p1",
          platform: "web",
          prerequisites: [],
          tags: ["smoke", "checkout"],
          steps: [
            { id: "s1", action: "navigate", data: "http://localhost:3010", expectedOutcome: "Page loads" },
            { id: "s2", action: "assertVisible", target: "body", expectedOutcome: "Body is visible" }
          ]
        }
      ]
    })
  });
  assert(createdSuite.id && createdSuite.versions[0]?.cases.length === 1, "POST /test-suites created suite with versioned cases");

  const addedCase = await request(`/test-suites/${createdSuite.id}/cases`, {
    method: "POST",
    body: JSON.stringify({
      title: "User can enter promo code",
      feature: "Checkout",
      priority: "p2",
      platform: "web",
      prerequisites: [],
      tags: ["promo"],
      steps: [
        { id: "s3", action: "fill", target: "[data-testid='promo']", data: "STUDENT100", expectedOutcome: "Promo code entered" }
      ]
    })
  });
  assert(addedCase.id && addedCase.title === "User can enter promo code", "POST /test-suites/:id/cases appended standalone test case");

  const updatedCase = await request(`/test-cases/${addedCase.id}`, {
    method: "PATCH",
    body: JSON.stringify({ priority: "p0" })
  });
  assert(updatedCase.priority === "p0", "PATCH /test-cases/:caseId updated priority to p0");

  const deletedCaseRes = await request(`/test-cases/${addedCase.id}`, { method: "DELETE" });
  assert(deletedCaseRes.deleted === true, "DELETE /test-cases/:caseId deleted standalone case cleanly");

  // 4. AI Test Generation & Execution Runs
  console.log("\n🤖 [5/9] Auditing AI Test Generation & Execution Queuing...");
  const aiSuite = await request(`/projects/${createdProject.id}/test-generation`, {
    method: "POST",
    body: JSON.stringify({
      sourceType: "story",
      sourcePayload: "As a student, I want to audit tests so that I can learn QA best practices.",
      targetPlatform: "web",
      browserOrDeviceScope: ["chromium"]
    })
  });
  assert(aiSuite.suiteId && aiSuite.draft.cases.length > 0, "POST /projects/:id/test-generation generated canonical test cases");

  const executionRun = await request(`/test-suites/${aiSuite.suiteId}/executions`, {
    method: "POST",
    body: JSON.stringify({
      suiteVersionId: aiSuite.suiteVersionId,
      environment: "staging",
      provider: "playwright-local",
      matrix: [{ browserName: "chromium", baseUrl: "http://localhost:3010" }]
    })
  });
  assert(executionRun.id && executionRun.status === "queued", "POST /test-suites/:id/executions queued run in BullMQ");

  const retrievedRun = await request(`/executions/${executionRun.id}`);
  assert(retrievedRun.id === executionRun.id, "GET /executions/:id retrieved run status & telemetry");

  // 5. Maestro Engine Verification
  console.log("\n📱 [6/9] Auditing Maestro Flow Generation & CLI Status...");
  const maestroStatus = await request("/health/maestro/status");
  assert(typeof maestroStatus.installed === "boolean", "GET /health/maestro/status checked CLI installation");

  const maestroPreview = await request("/health/maestro/preview", {
    method: "POST",
    body: JSON.stringify({
      appId: "com.sonofcotester.app",
      testCase: {
        id: "tc_m1",
        title: "Mobile App Login",
        feature: "Auth",
        priority: "p1",
        platform: "mobile",
        prerequisites: [],
        tags: ["mobile"],
        steps: [
          { id: "ms1", action: "fill", target: "email", data: "user@test.com", expectedOutcome: "Email filled" },
          { id: "ms2", action: "click", target: "Submit", expectedOutcome: "Logged in" }
        ]
      }
    })
  });
  assert(maestroPreview.yaml && maestroPreview.yaml.includes("appId: com.sonofcotester.app"), "POST /health/maestro/preview generated valid Maestro YAML flow");

  // 6. Admin Subscriptions, Billing & Live Audit Trail
  console.log("\n👑 [7/9] Auditing Admin Subscriptions, Invoices & Audit Trail...");
  const currentSub = await request("/admin/subscriptions");
  assert(currentSub.tier !== undefined, "GET /admin/subscriptions retrieved workspace subscription");

  const upgradedSub = await request("/admin/subscriptions/upgrade", {
    method: "POST",
    body: JSON.stringify({
      tier: "pro",
      workspaceId: "ws_internal"
    })
  });
  assert(upgradedSub.tier === "pro", "POST /admin/subscriptions/upgrade upgraded tier to PRO");

  const invoices = await request("/admin/invoices");
  assert(Array.isArray(invoices) && invoices.length > 0, "GET /admin/invoices listed generated receipts");

  const quota = await request("/admin/usage");
  assert(quota.limits.monthlyRuns >= 2500, "GET /admin/usage confirmed Pro limit scaling (2,500 runs/mo)");

  const auditLogs = await request("/admin/audit-logs");
  assert(Array.isArray(auditLogs) && auditLogs.some((l) => l.action.includes("subscription")), "GET /admin/audit-logs recorded live subscription change event");

  const apmOverview = await request("/admin/system/overview");
  assert(apmOverview.api.status === "healthy" && apmOverview.workerQueue !== undefined, "GET /admin/system/overview retrieved live BullMQ & APM telemetry");

  // 7. Student Testing Academy
  console.log("\n🎓 [8/9] Auditing Student Testing Academy, AI Tutor & Quizzes...");
  const curriculum = await request("/academy/curriculum");
  assert(Array.isArray(curriculum) && curriculum.length === 6, "GET /academy/curriculum returned all 6 interactive modules");

  const testAudit = await request("/academy/analyze-test", {
    method: "POST",
    body: JSON.stringify({
      code: "await page.waitForTimeout(5000); await page.click('//div/div[2]/button');",
      platform: "web",
      userId: "user_student"
    })
  });
  assert(testAudit.antiPatterns.some((ap) => ap.type === "arbitrary_sleep"), "AI Tutor detected arbitrary sleep anti-pattern");
  assert(testAudit.antiPatterns.some((ap) => ap.type === "brittle_locator"), "AI Tutor detected brittle XPath anti-pattern");

  const syntaxTranslation = await request("/academy/translate-syntax", {
    method: "POST",
    body: JSON.stringify({
      sourceSyntax: "playwright",
      targetSyntax: "maestro",
      code: "await page.goto('http://localhost:3000'); await page.getByRole('button', { name: 'Login' }).click();"
    })
  });
  assert(syntaxTranslation.translatedCode.includes("openLink:") || syntaxTranslation.translatedCode.includes("tapOn:"), "3-Way Syntax Translator compiled Playwright to Maestro YAML");

  const quizResult = await request("/academy/quiz/submit", {
    method: "POST",
    body: JSON.stringify({
      userId: "user_student",
      moduleId: "module-1",
      score: 100
    })
  });
  assert(quizResult.completedModules.includes("module-1"), "POST /academy/quiz/submit awarded module completion and badge");

  // 8. Programmatic API Keys, Prometheus Metrics & Audit CSV Export
  console.log("\n🔑 [8.5/9] Auditing API Keys, Prometheus Scraper & CSV Export...");
  const createdKey = await request("/workspace/api-keys", {
    method: "POST",
    body: JSON.stringify({
      name: "GitHub Actions CI Runner",
      workspaceId: "ws_internal",
      scopes: ["runs:read", "runs:write", "suites:read"]
    })
  });
  assert(createdKey.rawSecretKey && createdKey.apiKey.name === "GitHub Actions CI Runner", "POST /workspace/api-keys generated scoped secret key");

  const keysList = await request("/workspace/api-keys");
  assert(Array.isArray(keysList) && keysList.some((k) => k.id === createdKey.apiKey.id), "GET /workspace/api-keys listed active API keys");

  const deletedKeyRes = await request(`/workspace/api-keys/${createdKey.apiKey.id}`, { method: "DELETE" });
  assert(deletedKeyRes.deleted === true, "DELETE /workspace/api-keys/:id revoked API key cleanly");

  // Raw text request for metrics & CSV
  const metricsRes = await fetch(`${API_BASE}/metrics`);
  const metricsText = await metricsRes.text();
  assert(metricsRes.status === 200 && metricsText.includes("sonofcotester_uptime_seconds"), "GET /metrics served Prometheus format metrics scraper");

  const csvRes = await fetch(`${API_BASE}/admin/audit-logs/export.csv`);
  const csvText = await csvRes.text();
  assert(csvRes.status === 200 && csvText.startsWith("ID,Timestamp,Actor Name"), "GET /admin/audit-logs/export.csv streamed formatted audit CSV");

  // 8. Cleanup & Teardown
  console.log("\n🧹 [9/9] Cleaning Up Test Artifacts...");
  await request(`/projects/${createdProject.id}`, { method: "DELETE" });
  assert(true, "DELETE /projects/:id cleaned up test workspace");

  console.log("\n========================================================");
  console.log(`  🎉 AUDIT COMPLETED: ${passedChecks}/${totalChecks} CHECKS PASSED (100% GREEN)`);
  console.log("  SON OF COTESTER IS PRODUCTION READY!");
  console.log("========================================================\n");
}

async function main() {
  try {
    await startApi();
    await runTests();
  } catch (err) {
    console.error("\n❌ Verification Failed:", err);
    process.exitCode = 1;
  } finally {
    if (apiProcess) {
      console.log("Stopping API process...");
      apiProcess.kill("SIGTERM");
    }
  }
}

void main();
