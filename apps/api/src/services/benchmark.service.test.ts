import { describe, expect, it } from "vitest";
import { BenchmarkService } from "./benchmark.service.js";
import { BenchmarkController } from "./benchmark.controller.js";

describe("BenchmarkService & Controller", () => {
  const service = new BenchmarkService();
  const controller = new BenchmarkController(service);

  it("returns standard presets including the YouTube $12 VPS experiment", () => {
    const presets = controller.getPresets();
    expect(presets.length).toBeGreaterThanOrEqual(4);
    const vps8 = presets.find((p) => p.id === "preset-vps-8-languages");
    expect(vps8).toBeDefined();
    expect(vps8?.config.specs.ramMb).toBe(2048);
    expect(vps8?.config.stacks).toContain("rust-axum");
    expect(vps8?.config.stacks).toContain("go-nethttp");
  });

  it("lists all available stack profiles", () => {
    const stacks = controller.getStackProfiles();
    expect(stacks.length).toBeGreaterThanOrEqual(10);
    const rust = stacks.find((s) => s.id === "rust-axum");
    expect(rust?.framework).toContain("Axum");
    const laravel = stacks.find((s) => s.id === "php-laravel");
    expect(laravel?.framework).toContain("Laravel");
  });

  it("executes a shootout run and persists it in history", async () => {
    const presets = controller.getPresets();
    const result = await controller.runShootout(presets[0].config);

    expect(result.id).toBeDefined();
    expect(result.results.length).toBe(presets[0].config.stacks.length);
    expect(result.results[0].stack.id).toBe("rust-axum");

    const history = controller.getHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(controller.getRunById(result.id)?.id).toBe(result.id);
  });

  it("generates a runnable K6 test script", () => {
    const presets = controller.getPresets();
    const { script } = controller.generateK6Script(presets[0].config);
    expect(script).toContain("import http from 'k6/http'");
    expect(script).toContain("01_Load_Feed");
    expect(script).toContain("p(95)<500");
  });

  it("runs the 41-check parity verification suite", async () => {
    const parity = await controller.runParityTest();
    expect(parity.totalChecks).toBe(41);
    expect(parity.passedChecks).toBe(41);
    expect(parity.allPassed).toBe(true);
  });
});
