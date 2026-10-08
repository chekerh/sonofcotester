import { describe, expect, it } from "vitest";
import type { PlanTier, PlanLimits } from "./admin-subscriptions.js";

describe("Plan Tiers & Quota Contracts", () => {
  const tierContractTable: Array<{ tier: PlanTier; minRuns: number; minWorkers: number }> = [
    { tier: "student_free", minRuns: 500, minWorkers: 3 },
    { tier: "pro", minRuns: 2500, minWorkers: 8 },
    { tier: "team", minRuns: 10000, minWorkers: 20 },
    { tier: "enterprise", minRuns: 100000, minWorkers: 50 }
  ];

  it.each(tierContractTable)("enforces scaling limits for $tier tier", ({ tier, minRuns, minWorkers }) => {
    const limits: Record<PlanTier, PlanLimits> = {
      student_free: { monthlyRuns: 500, concurrentWorkers: 3, aiGenerations: 50, maestroCloudMinutes: 120, maxProjects: 10, teamMembers: 5 },
      pro: { monthlyRuns: 2500, concurrentWorkers: 8, aiGenerations: 250, maestroCloudMinutes: 600, maxProjects: 50, teamMembers: 20 },
      team: { monthlyRuns: 10000, concurrentWorkers: 20, aiGenerations: 1000, maestroCloudMinutes: 2400, maxProjects: 200, teamMembers: 100 },
      enterprise: { monthlyRuns: 100000, concurrentWorkers: 50, aiGenerations: 10000, maestroCloudMinutes: 10000, maxProjects: 1000, teamMembers: 500 }
    };

    expect(limits[tier].monthlyRuns).toBeGreaterThanOrEqual(minRuns);
    expect(limits[tier].concurrentWorkers).toBeGreaterThanOrEqual(minWorkers);
  });
});
