import type {
  BugDraft,
  CanonicalTestCase,
  ExecutionArtifact,
  GeneratedTestSuiteDraft,
  HealingProposal,
  HealingSignal,
  TestGenerationRequest
} from "@sonofcotester/sdk";

const uid = () => Math.random().toString(36).slice(2, 10);

export class TestGenerationService {
  generate(input: TestGenerationRequest): GeneratedTestSuiteDraft {
    const normalized = input.sourcePayload.trim();
    const title = normalized.split("\n")[0]?.slice(0, 80) || "Generated test flow";
    const cases: CanonicalTestCase[] = [
      {
        id: uid(),
        title: `${title} happy path`,
        feature: "AI-generated workflow",
        priority: "p1",
        platform: input.targetPlatform,
        prerequisites: ["User has access to the target app"],
        tags: [input.sourceType, input.targetPlatform],
        steps: [
          {
            id: uid(),
            action: "Navigate to the feature entry point",
            expectedOutcome: "Entry point loads without blocking errors"
          },
          {
            id: uid(),
            action: "Perform the primary user action",
            expectedOutcome: "System accepts the input and continues"
          },
          {
            id: uid(),
            action: "Verify the success state",
            expectedOutcome: "Expected confirmation or resulting state is visible"
          }
        ]
      }
    ];

    return {
      id: uid(),
      sourceType: input.sourceType,
      summary: `Generated from ${input.sourceType} with ${input.browserOrDeviceScope.length} execution targets`,
      cases
    };
  }
}

export class HealingAnalysisService {
  propose(testCaseId: string, artifacts: ExecutionArtifact[]): HealingProposal {
    const signals: HealingSignal[] = [
      {
        type: "locator",
        confidence: 0.83,
        description: "Similar role and text match found near failing selector"
      },
      {
        type: "visual",
        confidence: 0.74,
        description: "Screenshot diff shows target button shifted but still visible"
      }
    ];

    return {
      id: uid(),
      testCaseId,
      status: "pending",
      patch: "replace page.getByTestId('submit-button') with page.getByRole('button', { name: /submit/i })",
      rationale: "Fallback selector found a stable accessible target after UI change.",
      signals
    };
  }
}

export class BugDraftService {
  summarize(title: string, artifacts: ExecutionArtifact[]): BugDraft {
    return {
      id: uid(),
      title,
      summary: "The run failed after a UI mismatch and generated a healing recommendation for review.",
      severity: "medium",
      reproductionSteps: [
        "Open the affected flow in the target environment",
        "Execute the primary action under test",
        "Observe the missing or renamed target element"
      ],
      evidence: artifacts
    };
  }
}

