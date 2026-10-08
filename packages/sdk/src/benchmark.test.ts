import { describe, expect, it } from "vitest";
import type { FullShootoutConfig, ServerSpecs } from "./benchmark.js";

describe("Benchmark SDK Types", () => {
  it("allows constructing a valid $12 VPS shootout configuration", () => {
    const specs: ServerSpecs = {
      vCpuCores: 1,
      cpuGhz: 2.3,
      ramMb: 2048,
      storageGb: 50,
      monthlyCostUsd: 12,
      provider: "DigitalOcean / Linode VPS"
    };

    const config: FullShootoutConfig = {
      specs,
      stacks: ["node-express", "bun-express", "python-fastapi", "rust-axum"],
      database: {
        engine: "postgres",
        poolSize: 10,
        connectionTimeoutMs: 5000,
        discardAllOnReset: false,
        walMode: false,
        queryExecutionTimeMs: 1.2
      },
      dataset: {
        userCount: 50000,
        postCount: 500000,
        likeCount: 2000000,
        estimatedDbSizeMb: 350,
        inMemoryPercent: 95
      },
      workload: {
        thinkTimeMinSec: 3,
        thinkTimeMaxSec: 7,
        feedWeight: 100,
        viewPostWeight: 75,
        likePostProbability: 0.25,
        createPostProbability: 0.05,
        avgRequestsPerUserPerSec: 0.1
      },
      thresholds: {
        maxP95LatencyMs: 500,
        maxP99LatencyMs: 1000,
        maxErrorRatePercent: 1.0
      }
    };

    expect(config.specs.ramMb).toBe(2048);
    expect(config.stacks.length).toBe(4);
    expect(config.thresholds.maxP95LatencyMs).toBe(500);
  });
});
