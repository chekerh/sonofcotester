import { describe, expect, it } from "vitest";
import type { CanonicalTestCase, ExecutionRun } from "./index.js";

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
          action: "click buy",
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
      healingProposals: [],
      bugDrafts: []
    };

    expect(run.provider).toBe("playwright-local");
  });
});

