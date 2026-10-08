#!/usr/bin/env node
/**
 * Adversarial tests for production hardening code.
 * Exercises real entry points looking for boundary, empty-input, ordering,
 * async, cleanup, and state-synchronization failures.
 *
 * Run: node scripts/production-hardening-test.mjs
 */

import { execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import http from "node:http";
import fs from "node:fs";

const BASE = process.env.API_URL || "http://127.0.0.1:3101";
let passed = 0;
let failed = 0;
let apiProcess = null;
let apiPID = null;
const failures = [];

// ── Helpers ──
function api(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const reqOpts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json", ...headers },
      timeout: 10_000,
    };
    const req = http.request(reqOpts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString();
        let json = null;
        try { json = JSON.parse(raw); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: json ?? raw, raw });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(label, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push({ label, detail });
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── Start API ──
async function startAPI() {
  let pgPort = "5432", redisPort = "6379";
  try {
    const ports = execSync("docker compose -f docker-compose.yml ps --format '{{.Ports}}'", { encoding: "utf-8", timeout: 5000 });
    const pgMatch = ports.match(/127\.0\.0\.1:(\d+)->5432/);
    const redisMatch = ports.match(/127\.0\.0\.1:(\d+)->6379/);
    if (pgMatch) pgPort = pgMatch[1];
    if (redisMatch) redisPort = redisMatch[1];
  } catch {}

  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: "3101",
    DATABASE_URL: `postgresql://sonofcotester:sonofcotester@127.0.0.1:${pgPort}/sonofcotester?schema=public`,
    REDIS_URL: `redis://127.0.0.1:${redisPort}`,
    CORS_ORIGIN: "http://localhost:5173,http://localhost:3000",
  };

  apiProcess = spawn("node", ["--loader", "ts-node/esm", "src/main.ts"], {
    cwd: "apps/api",
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  apiPID = apiProcess.pid;

  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => {
      reject(new Error(`API did not start in 20s. Output:\n${output}`));
    }, 20_000);

    apiProcess.stdout.on("data", (d) => {
      const s = d.toString();
      output += s;
      if (s.includes("Son of CodeTester API listening") || s.includes("Nest application successfully started")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    apiProcess.stderr.on("data", (d) => { output += d.toString(); });
    apiProcess.on("error", (e) => { clearTimeout(timeout); reject(e); });
    apiProcess.on("exit", (code) => {
      if (!output.includes("listening")) {
        clearTimeout(timeout);
        reject(new Error(`API exited with code ${code}. Output:\n${output}`));
      }
    });
  });
}

function stopAPI() {
  if (apiProcess) {
    apiProcess.kill("SIGTERM");
    apiProcess = null;
  }
}

// ── Test Categories ──

async function testRequestId() {
  console.log("\n── Request ID Middleware ──");

  const r1 = await api("GET", "/api/health");
  const id1 = r1.headers["x-request-id"];
  assert("Server generates X-Request-ID when none provided", !!id1 && id1.length > 0, `got: ${id1}`);

  const clientID = "test-" + randomBytes(4).toString("hex");
  const r2 = await api("GET", "/api/health", null, { "X-Request-ID": clientID });
  assert("Server echoes client X-Request-ID", r2.headers["x-request-id"] === clientID, `expected: ${clientID}, got: ${r2.headers["x-request-id"]}`);

  const r3 = await api("GET", "/api/ready");
  assert("X-Request-ID present on /api/ready too", !!r3.headers["x-request-id"]);

  const r4 = await api("GET", "/api/health");
  assert("Generated ID is hex string", /^[0-9a-f]+$/.test(r4.headers["x-request-id"]), `got: ${r4.headers["x-request-id"]}`);

  // Boundary: very long client ID
  const longID = "a".repeat(1024);
  const r5 = await api("GET", "/api/health", null, { "X-Request-ID": longID });
  assert("Long X-Request-ID accepted without crash", r5.status === 200);

  // Empty string falls back to generated
  const r6 = await api("GET", "/api/health", null, { "X-Request-ID": "" });
  assert("Empty X-Request-ID falls back to generated", r6.status === 200 && !!r6.headers["x-request-id"] && r6.headers["x-request-id"] !== "");

  // Boundary: header with special chars
  const r7 = await api("GET", "/api/health", null, { "X-Request-ID": "../../../etc/passwd" });
  assert("Path-traversal X-Request-ID doesn't break server", r7.status === 200);
}

async function testHealthProbes() {
  console.log("\n── Health & Readiness Probes ──");

  const h = await api("GET", "/api/health");
  assert("Health returns 200", h.status === 200);
  assert("Health has ok: true", h.body?.ok === true);
  assert("Health has timestamp", typeof h.body?.timestamp === "string");
  assert("Health has uptime (number >= 0)", typeof h.body?.uptime === "number" && h.body.uptime >= 0);
  assert("Health has memory object", typeof h.body?.memory === "object" && h.body.memory !== null);
  assert("Health has env field", typeof h.body?.env === "string");
  assert("Health env reflects NODE_ENV=production", h.body?.env === "production", `got: ${h.body?.env}`);

  const r = await api("GET", "/api/ready");
  assert("Ready returns 200", r.status === 200);
  assert("Ready has ready: true", r.body?.ready === true);
  assert("Ready has service field", r.body?.service === "api");
}

async function testRateLimiting() {
  console.log("\n── Rate Limiting ──");

  // Fire 120 rapid requests to a rate-limited endpoint (NOT /api/health which is @SkipThrottle)
  let got429 = 0;
  let got200 = 0;
  let gotOther = 0;

  for (let i = 0; i < 120; i++) {
    try {
      const r = await api("GET", "/api/test-suites");
      if (r.status === 429) got429++;
      else if (r.status === 200) got200++;
      else gotOther++;
    } catch {
      gotOther++;
    }
  }

  console.log(`  Results: ${got200} OK, ${got429} 429, ${gotOther} other`);
  assert(
    "Rate limiting enforced (429s in 120 rapid requests)",
    got429 > 0,
    `got ${got429} 429 responses — ThrottlerGuard not registered as APP_GUARD?`
  );

  // Verify 429 response body is structured
  if (got429 > 0) {
    const r429 = await api("GET", "/api/test-suites");
    if (r429.status === 429) {
      assert("429 response has retryAfter header", !!r429.headers["retry-after"]);
    }
  }
}

async function testErrorHandling() {
  console.log("\n── Exception Filter ──");

  // 404 for unknown route
  const r1 = await api("GET", "/api/nonexistent-" + randomBytes(4).toString("hex"));
  assert("Unknown route returns 404", r1.status === 404);
  assert("404 has structured error body", typeof r1.body === "object" && r1.body?.statusCode === 404, JSON.stringify(r1.body));
  assert("404 has requestId", !!r1.body?.requestId);
  assert("404 has path field", typeof r1.body?.path === "string");
  assert("404 has timestamp", typeof r1.body?.timestamp === "string");
  assert("404 has method field", typeof r1.body?.method === "string");

  // POST with invalid body
  const r2 = await api("POST", "/api/projects/proj-1/test-generation", {
    sourceType: "not-a-valid-type",
  });
  assert("Invalid body returns 400", r2.status === 400);
  assert("400 has message field", typeof r2.body?.message === "string");
  assert("400 has error field", typeof r2.body?.error === "string");

  // Empty body
  const r3 = await api("POST", "/api/projects/proj-1/test-generation", {});
  assert("Empty body returns 400", r3.status === 400);

  // Client request ID echoed in error response
  const clientID = "err-test-" + randomBytes(4).toString("hex");
  const r5 = await api("GET", "/api/nonexistent-" + randomBytes(4).toString("hex"), null, { "X-Request-ID": clientID });
  assert("Error response includes client requestId", r5.body?.requestId === clientID, `expected: ${clientID}, got: ${r5.body?.requestId}`);

  // Server still works after bad requests (no state corruption)
  const r6 = await api("GET", "/api/health");
  assert("Server still works after bad requests", r6.status === 200);

  // Boundary: null body on POST
  const r7 = await api("POST", "/api/projects/proj-1/test-generation", null);
  assert("Null body on POST returns 400 or 415", r7.status === 400 || r7.status === 415);
}

async function testSecurityHeaders() {
  console.log("\n── Security Headers ──");

  const r = await api("GET", "/api/health");
  assert("X-Content-Type-Options: nosniff", r.headers["x-content-type-options"] === "nosniff");
  assert("X-Frame-Options: DENY", r.headers["x-frame-options"] === "DENY");
  assert("X-XSS-Protection present", !!r.headers["x-xss-protection"]);
  assert("Referrer-Policy present", !!r.headers["referrer-policy"]);
  assert("X-Powered-By cleared or absent", !r.headers["x-powered-by"] || r.headers["x-powered-by"] === "");

  // Verify HSTS NOT set in non-production (NODE_ENV=production was set for API)
  // The middleware checks process.env.NODE_ENV, which we set to "production"
  // In a real scenario, we'd check for HSTS only when NODE_ENV=production
}

async function testConcurrentRequests() {
  console.log("\n── Concurrency & State Synchronization ──");

  // 20 concurrent requests should all succeed
  const promises = Array.from({ length: 20 }, (_, i) =>
    api("GET", "/api/health", null, { "X-Request-ID": `concurrent-${i}` })
  );
  const results = await Promise.all(promises);
  const allOK = results.every((r) => r.status === 200);
  assert("20 concurrent requests all return 200", allOK);

  // Each gets unique ID when none provided
  const promises2 = Array.from({ length: 10 }, () => api("GET", "/api/health"));
  const results2 = await Promise.all(promises2);
  const ids2 = results2.map((r) => r.headers["x-request-id"]);
  assert("10 concurrent requests get unique IDs", new Set(ids2).size === 10);

  // Same client ID echoed for all
  const sameID = "shared-" + randomBytes(4).toString("hex");
  const promises3 = Array.from({ length: 10 }, () =>
    api("GET", "/api/health", null, { "X-Request-ID": sameID })
  );
  const results3 = await Promise.all(promises3);
  const allEchoed = results3.every((r) => r.headers["x-request-id"] === sameID);
  assert("10 concurrent with same ID all echo it", allEchoed);
}

async function testCORS() {
  console.log("\n── CORS ──");

  // Preflight from allowed origin
  const r1 = await new Promise((resolve, reject) => {
    const url = new URL("/api/health", BASE);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "OPTIONS",
      headers: {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers }));
    });
    req.on("error", reject);
    req.end();
  });
  assert("OPTIONS preflight returns 200/204", r1.status === 200 || r1.status === 204);
  assert("CORS allows localhost:5173", r1.headers["access-control-allow-origin"] === "http://localhost:5173");

  // Preflight from disallowed origin
  const r2 = await new Promise((resolve, reject) => {
    const url = new URL("/api/health", BASE);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "OPTIONS",
      headers: {
        "Origin": "http://evil.com",
        "Access-Control-Request-Method": "GET",
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers }));
    });
    req.on("error", reject);
    req.end();
  });
  assert("CORS rejects evil.com origin", r2.headers["access-control-allow-origin"] !== "http://evil.com");
}

async function testSeedScript() {
  console.log("\n── Seed Script ──");

  assert("seed.ts exists", fs.existsSync("packages/data/prisma/seed.ts"));

  const seedContent = fs.readFileSync("packages/data/prisma/seed.ts", "utf-8");
  assert("seed.ts contains upsert calls", (seedContent.match(/upsert/g) || []).length >= 2);
  assert("seed.ts disconnects prisma at end", seedContent.includes("$disconnect"));
  assert("seed.ts has error handler", seedContent.includes("catch"));

  // uid() should NOT be defined (was dead code, now removed)
  const uidDef = seedContent.match(/const uid = /);
  assert("uid() dead code removed", !uidDef, `uid() still defined: ${!!uidDef}`);
}

async function testDeployScript() {
  console.log("\n── Deploy Script ──");

  assert("deploy.sh exists", fs.existsSync("scripts/deploy.sh"));

  const content = fs.readFileSync("scripts/deploy.sh", "utf-8");
  assert("deploy.sh has set -euo pipefail", content.includes("set -euo pipefail"));
  assert("deploy.sh validates POSTGRES_PASSWORD", content.includes("POSTGRES_PASSWORD"));
  assert("deploy.sh rejects default password", content.includes("CHANGE_ME_IN_PRODUCTION"));
  assert("deploy.sh runs prisma migrations", content.includes("prisma db push"));
  assert("deploy.sh runs seed", content.includes("seed.ts"));
  assert("deploy.sh has health check loop", content.includes("health"));

  // deploy.sh sources .env.production — potential injection risk
  assert("deploy.sh sources .env.production (shell injection risk if unquoted)",
    content.includes("source .env.production") || content.includes(". .env.production"),
    "values with shell metacharacters could execute arbitrary commands");
}

async function testDockerCompose() {
  console.log("\n── Docker Compose Production ──");

  const content = fs.readFileSync("docker-compose.production.yml", "utf-8");

  assert("API has healthcheck", content.includes("curl") && content.includes("/api/health"));
  assert("Postgres has healthcheck", content.includes("pg_isready"));
  assert("Redis has healthcheck", content.includes("redis-cli") && content.includes("ping"));
  assert("API depends on postgres healthy", content.includes("condition: service_healthy"));
  assert("Web depends on API healthy", content.includes("api:") && content.includes("service_healthy"));
  assert("Postgres has persistent volume", content.includes("postgres-data"));
  assert("Redis has memory limit", content.includes("maxmemory"));
  assert("Worker uses same Dockerfile as API", content.includes("apps/api/Dockerfile"));
}

// ── Run all tests ──
async function main() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  Adversarial Tests: Production Hardening    ║");
  console.log("╚══════════════════════════════════════════════╝");

  try {
    console.log("\nStarting API in production mode...");
    await startAPI();
    console.log("API started.\n");

    await testRequestId();
    await testHealthProbes();
    await testRateLimiting();
    await testErrorHandling();
    await testSecurityHeaders();
    await testConcurrentRequests();
    await testCORS();
    await testSeedScript();
    await testDeployScript();
    await testDockerCompose();

  } catch (err) {
    console.error("\n💥 Fatal error:", err.message);
    failed++;
  } finally {
    stopAPI();
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n══════════════════════════════════════════════`);
  console.log(`Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  console.log(`══════════════════════════════════════════════\n`);

  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures) {
      console.log(`  ❌ ${f.label}${f.detail ? ` — ${f.detail}` : ""}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
