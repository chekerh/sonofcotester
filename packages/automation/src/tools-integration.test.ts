import { describe, expect, it } from "vitest";
import { AccessibilityScanner } from "./a11y-scanner.js";
import { LoadTestRunner } from "./load-test-runner.js";

describe("Tools Integration (Executable Contract)", () => {
  const scanner = new AccessibilityScanner();
  const runner = new LoadTestRunner();

  describe("AccessibilityScanner (Axe WCAG 2.2 AA)", () => {
    const a11yCases = [
      {
        scenario: "Accessible clean page",
        html: `<html><body><h1>Title</h1><button aria-label="Submit">Send</button><img src="/img.png" alt="Pic" /></body></html>`,
        expectViolation: null
      },
      {
        scenario: "Missing image alt text",
        html: `<html><body><img src="/unlabeled.jpg" /></body></html>`,
        expectViolation: "image-alt"
      },
      {
        scenario: "Unlabeled empty interactive button",
        html: `<html><body><button></button></body></html>`,
        expectViolation: "button-name"
      }
    ];

    it.each(a11yCases)("audits $scenario", ({ html, expectViolation }) => {
      const result = scanner.auditHtml(html, "http://localhost:3000");
      if (expectViolation) {
        expect(result.violations.some((v) => v.id === expectViolation)).toBe(true);
      } else {
        expect(result.violations).toHaveLength(0);
        expect(result.passesCount).toBeGreaterThan(0);
      }
    });
  });

  describe("LoadTestRunner (K6 Simulation)", () => {
    const loadCases = [
      { virtualUsers: 10, durationSeconds: 2, p95Threshold: 200 },
      { virtualUsers: 25, durationSeconds: 3, p95Threshold: 300 }
    ];

    it.each(loadCases)("computes latency metrics for VU=$virtualUsers", async ({ virtualUsers, durationSeconds, p95Threshold }) => {
      const result = await runner.runLoadTest({
        name: `Load Test VU-${virtualUsers}`,
        targetUrl: "http://localhost:3001/api/projects",
        virtualUsers,
        durationSeconds,
        thresholds: {
          p95LatencyMs: p95Threshold,
          errorRatePercent: 2
        }
      });
      expect(result.metrics.totalRequests).toBeGreaterThan(0);
      expect(result.metrics.latencyP50Ms).toBeGreaterThan(0);
      expect(result.metrics.latencyP95Ms).toBeGreaterThanOrEqual(result.metrics.latencyP50Ms);
      expect(typeof result.passed).toBe("boolean");
    });
  });
});
