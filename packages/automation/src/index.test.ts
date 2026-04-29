import { describe, expect, it } from "vitest";
import { BrowserStackMobileProvider, BrowserStackWebProvider } from "./index.js";

describe("automation providers", () => {
  it("returns a queued run for unimplemented browserstack execution", async () => {
    const provider = new BrowserStackWebProvider();
    const run = await provider.execute(
      {
        suiteVersionId: "suite_v1",
        environment: "staging",
        provider: "browserstack-web",
        matrix: []
      },
      {
        projectId: "project_1",
        suiteId: "suite_1",
        testCases: []
      }
    );

    expect(run.status).toBe("queued");
    expect(run.errorMessage).toContain("not implemented");
  });

  it("returns a failed mobile contract validation when browserstack creds are missing", async () => {
    delete process.env.BROWSERSTACK_USERNAME;
    delete process.env.BROWSERSTACK_ACCESS_KEY;

    const provider = new BrowserStackMobileProvider();
    const run = await provider.execute(
      {
        suiteVersionId: "suite_v1",
        environment: "staging",
        provider: "browserstack-mobile",
        matrix: [{ platformName: "android", deviceName: "Pixel 8", osVersion: "14" }]
      },
      {
        projectId: "project_1",
        suiteId: "suite_1",
        testCases: [{ id: "case_1", title: "mobile smoke", feature: "mobile", priority: "p1", platform: "mobile", prerequisites: [], tags: [], steps: [] }]
      }
    );

    expect(run.status).toBe("failed");
    expect(run.artifacts.length).toBeGreaterThan(0);
    expect(run.executionMetadata?.provider).toBe("browserstack-mobile");
  });
});
