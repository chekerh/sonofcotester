import { describe, expect, it } from "vitest";
import { BrowserStackWebProvider } from "./index.js";

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
});
