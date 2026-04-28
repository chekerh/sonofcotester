import { describe, expect, it } from "vitest";
import { BugDraftService, HealingAnalysisService, TestGenerationService } from "./index.js";

describe("ai services", () => {
  it("generates a suite draft from source text", () => {
    const service = new TestGenerationService();
    const draft = service.generate({
      sourceType: "story",
      sourcePayload: "As a buyer, I want to complete checkout.",
      targetPlatform: "web",
      browserOrDeviceScope: ["chromium"]
    });

    expect(draft.cases[0]?.steps[0]?.action).toBe("navigate");
  });

  it("creates healing proposals and bug drafts", () => {
    const healing = new HealingAnalysisService();
    const bugs = new BugDraftService();
    const artifacts = [
      {
        id: "artifact_1",
        type: "screenshot" as const,
        label: "failure",
        url: "/failure.png",
        createdAt: new Date().toISOString()
      }
    ];

    expect(healing.propose("case_1", artifacts).signals.length).toBeGreaterThan(0);
    expect(bugs.summarize("regression", artifacts).severity).toBe("medium");
  });
});
