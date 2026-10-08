import { describe, expect, it } from "vitest";
import {
  createApiKey,
  createAuditLog,
  deleteApiKey,
  getUsageQuota,
  getWorkspaceSubscription,
  listApiKeys,
  listAuditLogs,
  listProjects,
  patchTestSteps,
  updateWorkspaceSubscription,
  validateApiKey
} from "./repository.js";
import type { CanonicalTestStep } from "@sonofcotester/sdk";

describe("Data Layer Resilient Contract (Table-driven)", () => {
  it("manages project listings", async () => {
    const projects = await listProjects();
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
  });

  describe("Subscription & Quota Transitions", () => {
    const tierTransitions = [
      { tier: "pro" as const, expectedMonthlyRuns: 2500 },
      { tier: "team" as const, expectedMonthlyRuns: 10000 },
      { tier: "student_free" as const, expectedMonthlyRuns: 500 }
    ];

    it.each(tierTransitions)("transitions subscription to $tier and scales quotas", async ({ tier, expectedMonthlyRuns }) => {
      const sub = await updateWorkspaceSubscription("ws_internal", tier);
      expect(sub.tier).toBe(tier);

      const quota = await getUsageQuota("ws_internal");
      expect(quota.limits.monthlyRuns).toBe(expectedMonthlyRuns);
    });
  });

  describe("API Key Cryptographic Lifecycle", () => {
    it("creates, validates, lists, and revokes scoped API keys", async () => {
      const { apiKey, rawSecretKey } = await createApiKey(
        "ws_internal",
        "CI Runner Test",
        ["runs:read", "runs:write"]
      );

      expect(rawSecretKey.startsWith("sct_live_")).toBe(true);
      expect(apiKey.scopes).toEqual(["runs:read", "runs:write"]);

      // Validate key
      const validation = await validateApiKey(rawSecretKey);
      expect(validation.valid).toBe(true);
      expect(validation.apiKey?.id).toBe(apiKey.id);

      // List keys
      const list = await listApiKeys("ws_internal");
      expect(list.some((k) => k.id === apiKey.id)).toBe(true);

      // Revoke key
      const res = await deleteApiKey(apiKey.id);
      expect(res.deleted).toBe(true);

      // Validate after revocation
      const revalidation = await validateApiKey(rawSecretKey);
      expect(revalidation.valid).toBe(false);
    });
  });

  describe("Audit Logs Trail", () => {
    it("appends and reads back audit events", async () => {
      await createAuditLog({
        workspaceId: "ws_internal",
        actorId: "user_test",
        actorName: "Test Actor",
        actorEmail: "test@example.com",
        action: "project.create",
        entityType: "project",
        entityId: "proj_contract_test"
      });

      const logs = await listAuditLogs("ws_internal", 10);
      expect(logs.some((l) => l.entityId === "proj_contract_test")).toBe(true);
    });
  });

  describe("Self-Healing Step Patching", () => {
    it("patches checkbox step from fill to click", () => {
      const initialSteps: CanonicalTestStep[] = [
        { id: "s1", action: "navigate", data: "http://localhost:3000", expectedOutcome: "Open target" },
        { id: "s2", action: "fill", target: "input[type='checkbox']", data: "test", expectedOutcome: "Fill input" }
      ];
      const patch = 'change step action on "input[type=\'checkbox\']" from "fill" to "click" (checkbox toggle)';
      const healed = patchTestSteps(initialSteps, patch);
      expect(healed[1].action).toBe("click");
      expect(healed[1].data).toBeUndefined();
    });

    it("replaces timed-out selectors with accessible role selectors", () => {
      const initialSteps: CanonicalTestStep[] = [
        { id: "s1", action: "click", target: ".legacy-btn", expectedOutcome: "Click button" }
      ];
      const patch = "replace page.locator('.legacy-btn') with page.getByRole('button', { name: /Submit/i })";
      const healed = patchTestSteps(initialSteps, patch);
      expect(healed[0].target).toBe("page.getByRole('button', { name: /Submit/i })");
    });
  });
});
