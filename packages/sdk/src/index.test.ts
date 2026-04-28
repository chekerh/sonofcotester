import { describe, expect, it } from "vitest";
import type { CanonicalTestCase, ExecutionRun, PersistedSuite, ProviderCapability } from "./index.js";

describe("sdk contracts", () => {
  it("supports canonical test cases", () => {
    const testCase: CanonicalTestCase = {
      id: "tc_1",
      title: "checkout happy path",
      feature: "checkout",
      priority: "p1",
      platform: "web",
      prerequisites: ["user is signed in"],
      tags: ["checkout"],
      steps: [
        {
          id: "step_1",
          action: "click",
          target: "#buy",
          expectedOutcome: "checkout opens"
        }
      ]
    };

    expect(testCase.steps).toHaveLength(1);
  });

  it("supports execution runs with artifacts", () => {
    const run: ExecutionRun = {
      id: "run_1",
      suiteId: "suite_1",
      suiteVersionId: "suite_1_v1",
      provider: "playwright-local",
      environment: "staging",
      status: "queued",
      matrix: [],
      artifacts: [],
      stepEvents: [],
      healingProposals: [],
      bugDrafts: []
    };

    expect(run.provider).toBe("playwright-local");
  });

  it("supports persisted suite versions", () => {
    const suite: PersistedSuite = {
      id: "suite_1",
      projectId: "project_1",
      sourceType: "story",
      summary: "Checkout suite",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions: [
        {
          id: "suite_1_v1",
          suiteId: "suite_1",
          versionNumber: 1,
          status: "draft",
          cases: []
        }
      ]
    };

    expect(suite.versions[0]?.versionNumber).toBe(1);
  });

  it("supports provider capability summaries", () => {
    const capability: ProviderCapability = {
      provider: "browserstack-mobile",
      platform: "mobile",
      mode: "cloud",
      ready: false,
      status: "configuration-required",
      summary: "Requires BrowserStack credentials",
      requirements: ["BROWSERSTACK_USERNAME", "BROWSERSTACK_ACCESS_KEY"]
    };

    expect(capability.platform).toBe("mobile");
  });
});
