import { describe, expect, it } from "vitest";
import { PlaywrightLocalProvider } from "./index.js";

describe("automation providers", () => {
  it("returns a healing-required run for local playwright execution", async () => {
    const provider = new PlaywrightLocalProvider();
    const run = await provider.execute(
      {
        suiteVersionId: "suite_v1",
        environment: "staging",
        provider: "playwright-local",
        matrix: []
      },
      {
        projectId: "project_1",
        suiteId: "suite_1",
        testCases: []
      }
    );

    expect(run.status).toBe("healing-required");
    expect(run.artifacts.length).toBeGreaterThan(0);
  });
});

