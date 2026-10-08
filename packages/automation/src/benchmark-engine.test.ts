import { describe, expect, it } from "vitest";
import {
  BenchmarkEngine,
  DEFAULT_DATABASE_CONFIG,
  DEFAULT_DATASET,
  DEFAULT_SERVER_SPECS,
  DEFAULT_THRESHOLDS,
  DEFAULT_WORKLOAD,
  STACK_PROFILES
} from "./benchmark-engine.js";

describe("BenchmarkEngine", () => {
  const engine = new BenchmarkEngine();

  it("generates the 41-check parity test suite with complete coverage", () => {
    const checks = engine.generateParityChecks();
    expect(checks.length).toBe(41);
    expect(checks.filter((c) => c.id.startsWith("feed-")).length).toBe(10);
    expect(checks.filter((c) => c.id.startsWith("post-")).length).toBe(10);
    expect(checks.filter((c) => c.id.startsWith("like-")).length).toBe(11);
    expect(checks.filter((c) => c.id.startsWith("create-")).length).toBe(10);
  });

  it("evaluates Node.js baseline accurately with Express 5", () => {
    const result = engine.evaluateStack("node-express", {
      specs: DEFAULT_SERVER_SPECS,
      stacks: ["node-express"],
      database: DEFAULT_DATABASE_CONFIG,
      dataset: DEFAULT_DATASET,
      workload: DEFAULT_WORKLOAD,
      thresholds: DEFAULT_THRESHOLDS
    });

    expect(result.stack.name).toContain("Node.js");
    expect(result.maxSupportedUsers).toBe(3250);
    expect(result.peakRps).toBeGreaterThan(250);
    expect(result.parityCheck.totalChecks).toBe(41);
    expect(result.parityCheck.allPassed).toBe(true);
    expect(result.binarySearchHistory.length).toBeGreaterThan(0);
  });

  it("reflects Bun delivering ~30% higher capacity than Node without code changes", () => {
    const nodeResult = engine.evaluateStack("node-express", {
      specs: DEFAULT_SERVER_SPECS,
      stacks: ["node-express"],
      database: DEFAULT_DATABASE_CONFIG,
      dataset: DEFAULT_DATASET,
      workload: DEFAULT_WORKLOAD,
      thresholds: DEFAULT_THRESHOLDS
    });

    const bunResult = engine.evaluateStack("bun-express", {
      specs: DEFAULT_SERVER_SPECS,
      stacks: ["bun-express"],
      database: DEFAULT_DATABASE_CONFIG,
      dataset: DEFAULT_DATASET,
      workload: DEFAULT_WORKLOAD,
      thresholds: DEFAULT_THRESHOLDS
    });

    expect(bunResult.maxSupportedUsers).toBeGreaterThan(nodeResult.maxSupportedUsers);
    expect(bunResult.maxSupportedUsers).toBe(4200);
  });

  it("captures Laravel framework boot overhead compared to Bare PHP", () => {
    const laravelResult = engine.evaluateStack("php-laravel", {
      specs: DEFAULT_SERVER_SPECS,
      stacks: ["php-laravel"],
      database: DEFAULT_DATABASE_CONFIG,
      dataset: DEFAULT_DATASET,
      workload: DEFAULT_WORKLOAD,
      thresholds: DEFAULT_THRESHOLDS
    });

    const bareResult = engine.evaluateStack("php-bare", {
      specs: DEFAULT_SERVER_SPECS,
      stacks: ["php-bare"],
      database: DEFAULT_DATABASE_CONFIG,
      dataset: DEFAULT_DATASET,
      workload: DEFAULT_WORKLOAD,
      thresholds: DEFAULT_THRESHOLDS
    });

    expect(laravelResult.maxSupportedUsers).toBe(750);
    expect(laravelResult.bottleneckType).toBe("framework_boot");
    expect(bareResult.maxSupportedUsers).toBe(2700);
    expect(bareResult.maxSupportedUsers).toBeGreaterThan(laravelResult.maxSupportedUsers * 3);
  });

  it("demonstrates SQLite WAL mode removing Postgres IPC bottleneck for Rust", () => {
    const rustPg = engine.evaluateStack("rust-axum", {
      specs: DEFAULT_SERVER_SPECS,
      stacks: ["rust-axum"],
      database: { ...DEFAULT_DATABASE_CONFIG, engine: "postgres" },
      dataset: DEFAULT_DATASET,
      workload: DEFAULT_WORKLOAD,
      thresholds: DEFAULT_THRESHOLDS
    });

    const rustSqlite = engine.evaluateStack("rust-axum", {
      specs: DEFAULT_SERVER_SPECS,
      stacks: ["rust-axum"],
      database: { ...DEFAULT_DATABASE_CONFIG, engine: "sqlite-wal" },
      dataset: DEFAULT_DATASET,
      workload: DEFAULT_WORKLOAD,
      thresholds: DEFAULT_THRESHOLDS
    });

    expect(rustPg.maxSupportedUsers).toBe(6900);
    expect(rustPg.bottleneckType).toBe("db_cpu");
    expect(rustSqlite.maxSupportedUsers).toBe(14050);
    expect(rustSqlite.peakRps).toBeGreaterThan(1200);
    expect(rustSqlite.p50Ms).toBeLessThanOrEqual(5);
  });

  it("generates a runnable K6 script with the 4 operations, think time and thresholds", () => {
    const script = engine.generateK6Script({
      specs: DEFAULT_SERVER_SPECS,
      stacks: ["node-express"],
      database: DEFAULT_DATABASE_CONFIG,
      dataset: DEFAULT_DATASET,
      workload: DEFAULT_WORKLOAD,
      thresholds: DEFAULT_THRESHOLDS,
      targetUrl: "http://localhost:3010"
    });

    expect(script).toContain("import http from 'k6/http'");
    expect(script).toContain("01_Load_Feed");
    expect(script).toContain("02_Open_Post");
    expect(script).toContain("03_Like_Post");
    expect(script).toContain("04_Create_Post");
    expect(script).toContain("http_req_duration{expected_response:true}");
    expect(script).toContain("p(95)<500");
  });

  it("runs full shootout comparing all 8 major stacks", () => {
    const shootout = engine.runFullShootout({
      specs: DEFAULT_SERVER_SPECS,
      stacks: [
        "rust-axum",
        "go-nethttp",
        "java-springboot",
        "csharp-aspnet",
        "bun-express",
        "node-express",
        "python-fastapi",
        "php-laravel"
      ],
      database: DEFAULT_DATABASE_CONFIG,
      dataset: DEFAULT_DATASET,
      workload: DEFAULT_WORKLOAD,
      thresholds: DEFAULT_THRESHOLDS
    });

    expect(shootout.results.length).toBe(8);
    expect(shootout.results[0].stack.id).toBe("rust-axum");
    expect(shootout.sqliteVsPostgresImpact.length).toBeGreaterThan(0);
    expect(shootout.k6Script).toBeDefined();
  });
});
