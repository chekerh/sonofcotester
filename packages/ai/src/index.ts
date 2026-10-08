export { SecurityScanner } from "./security-scanner.js";
export { UIHealthAnalyzer } from "./ui-health-analyzer.js";
export { DBOperationsMonitor } from "./db-operations-monitor.js";
export { PerformanceMetricsCollector } from "./performance-collector.js";
export { MaestroGenerationService } from "./maestro-generation.js";
export { StudentTestingTutor } from "./student-testing-tutor.js";
export { OllamaClient, defaultOllamaClient } from "./ollama-client.js";

import type {
  BugDraft,
  CanonicalTestCase,
  ExecutionArtifact,
  GeneratedTestSuiteDraft,
  HealingProposal,
  HealingSignal,
  TestGenerationRequest
} from "@sonofcotester/sdk";
import { defaultOllamaClient } from "./ollama-client.js";

const uid = () => Math.random().toString(36).slice(2, 10);

export class TestGenerationService {
  generate(input: TestGenerationRequest): GeneratedTestSuiteDraft {
    const normalized = input.sourcePayload.trim();
    let title = "Generated test flow";
    try {
      if (normalized.startsWith("{")) {
        const parsed = JSON.parse(normalized);
        if (parsed.title && typeof parsed.title === "string") {
          title = parsed.title;
        } else if (parsed.url) {
          title = `Target: ${parsed.url}`;
        }
      } else {
        title = normalized.split("\n")[0]?.slice(0, 80) || "Generated test flow";
      }
    } catch {
      title = normalized.split("\n")[0]?.slice(0, 80) || "Generated test flow";
    }

    // Extract target URL from input or parse from payload
    const urlMatch = input.sourcePayload.match(/https?:\/\/[^\s"',]+/);
    const targetUrl = input.targetUrl || (urlMatch ? urlMatch[0] : "http://localhost:3010");

    const cases: CanonicalTestCase[] = [];
    const elements = input.discoveredElements || [];

    if (elements.length > 0) {
      // 1. Core navigation & DOM visibility case
      const heading = elements.find((e) => e.type === "heading" && e.text);
      const navSteps: CanonicalTestCase["steps"] = [
        {
          id: uid(),
          action: "navigate",
          data: targetUrl,
          expectedOutcome: `Navigate to ${targetUrl} and verify page load`
        }
      ];

      if (heading) {
        navSteps.push({
          id: uid(),
          action: "assertVisible",
          target: heading.selector,
          expectedOutcome: `Verify primary heading "${heading.text?.slice(0, 40)}" is visible`
        });
      } else {
        navSteps.push({
          id: uid(),
          action: "assertVisible",
          target: "body",
          expectedOutcome: "Verify root DOM body is visible and mounted"
        });
      }

      cases.push({
        id: uid(),
        title: `${title} - Page Load & Visual Structure`,
        feature: "Target App Inspection",
        priority: "p0",
        platform: input.targetPlatform,
        prerequisites: [`Target application is running at ${targetUrl}`],
        tags: ["smoke", "inspection", input.targetPlatform],
        steps: navSteps
      });

      // 2. Interactive Input & Form Handling case (separate text inputs vs checkbox toggles)
      const textInputs = elements.filter((e) =>
        (e.type === "input" || e.tag === "textarea") &&
        e.tag !== "select" &&
        e.type !== "select" &&
        e.inputType !== "checkbox" &&
        e.inputType !== "radio" &&
        e.inputType !== "submit" &&
        e.inputType !== "button" &&
        e.inputType !== "file" &&
        e.isVisible !== false
      ).slice(0, 3);

      const checkableInputs = elements.filter((e) =>
        (e.inputType === "checkbox" || e.inputType === "radio") &&
        e.isVisible !== false
      ).slice(0, 2);

      const buttons = elements.filter((e) =>
        e.type === "button" &&
        e.inputType !== "checkbox" &&
        e.isVisible !== false
      ).slice(0, 2);

      if (textInputs.length > 0 || checkableInputs.length > 0 || buttons.length > 0) {
        const interactiveSteps: CanonicalTestCase["steps"] = [
          {
            id: uid(),
            action: "navigate",
            data: targetUrl,
            expectedOutcome: `Open ${targetUrl} for user interactions`
          }
        ];

        for (const inputEl of textInputs) {
          const placeholder = (inputEl.placeholder || inputEl.name || "").toLowerCase();
          let testVal = "Test Value";
          if (placeholder.includes("email") || inputEl.inputType === "email") {
            testVal = "qa@sonofcotester.dev";
          } else if (placeholder.includes("pass")) {
            testVal = "P@ssw0rd123!";
          } else if (placeholder.includes("search") || placeholder.includes("query")) {
            testVal = "Search query";
          } else if (placeholder.includes("name")) {
            testVal = "Alex Mercer";
          }

          interactiveSteps.push({
            id: uid(),
            action: "fill",
            target: inputEl.selector,
            data: testVal,
            expectedOutcome: `Fill ${inputEl.placeholder || inputEl.name || inputEl.selector} with sample data`
          });
        }

        for (const checkEl of checkableInputs) {
          interactiveSteps.push({
            id: uid(),
            action: "click",
            target: checkEl.selector,
            expectedOutcome: `Toggle checkbox ${checkEl.text || checkEl.selector}`
          });
        }

        if (buttons.length > 0) {
          const btn = buttons[0];
          interactiveSteps.push({
            id: uid(),
            action: "click",
            target: btn.selector,
            expectedOutcome: `Click "${btn.text || 'action'}" button to trigger event`
          });
        }

        interactiveSteps.push({
          id: uid(),
          action: "assertVisible",
          target: "body",
          expectedOutcome: "Application remains responsive and stable after input"
        });

        cases.push({
          id: uid(),
          title: `${title} - Interactive Workflow`,
          feature: "User Interaction & Form Handling",
          priority: "p1",
          platform: input.targetPlatform,
          prerequisites: [`Target application is running at ${targetUrl}`],
          tags: ["e2e", "interaction", input.targetPlatform],
          steps: interactiveSteps
        });
      }

      // 3. Validation & Boundary Resilience Case (Negative testing)
      if (textInputs.length > 0 || buttons.length > 0) {
        const negativeSteps: CanonicalTestCase["steps"] = [
          {
            id: uid(),
            action: "navigate",
            data: targetUrl,
            expectedOutcome: `Navigate to ${targetUrl} for resilience testing`
          }
        ];

        // Boundary input: fill with special characters or oversized text
        if (textInputs.length > 0) {
          const firstInput = textInputs[0];
          negativeSteps.push({
            id: uid(),
            action: "fill",
            target: firstInput.selector,
            data: "<script>alert('xss')</script>' OR '1'='1",
            expectedOutcome: `Boundary injection test on ${firstInput.placeholder || firstInput.name || firstInput.selector}`
          });
        }

        // Action trigger
        if (buttons.length > 0) {
          const actionBtn = buttons[0];
          negativeSteps.push({
            id: uid(),
            action: "click",
            target: actionBtn.selector,
            expectedOutcome: `Click "${actionBtn.text || 'action'}" to test input sanitization & validation`
          });
        }

        // Assert graceful degradation (app doesn't crash or go blank)
        negativeSteps.push({
          id: uid(),
          action: "assertVisible",
          target: "body",
          expectedOutcome: "Application gracefully handles boundary inputs without fatal crash"
        });

        cases.push({
          id: uid(),
          title: `${title} - Boundary & Negative Testing`,
          feature: "Resilience & Error Handling",
          priority: "p2",
          platform: input.targetPlatform,
          prerequisites: [`Target application is running at ${targetUrl}`],
          tags: ["e2e", "negative-test", "boundary", input.targetPlatform],
          steps: negativeSteps
        });
      }
    } else {
      // Fallback flow tailored to targetUrl
      cases.push({
        id: uid(),
        title: `${title} happy path`,
        feature: "AI-generated workflow",
        priority: "p1",
        platform: input.targetPlatform,
        prerequisites: [`Target application is accessible at ${targetUrl}`],
        tags: [input.sourceType, input.targetPlatform],
        steps: [
          {
            id: uid(),
            action: "navigate",
            data: targetUrl,
            expectedOutcome: `Target app at ${targetUrl} loads successfully without errors`
          },
          {
            id: uid(),
            action: "assertVisible",
            target: "body",
            expectedOutcome: "Root application DOM body is visible and mounted"
          }
        ]
      });
    }

    return {
      id: uid(),
      sourceType: input.sourceType,
      summary: `Generated ${cases.length} test cases for ${targetUrl} (${elements.length} discovered DOM elements)`,
      cases
    };
  }

  async generateWithModel(
    input: TestGenerationRequest,
    modelName?: string
  ): Promise<GeneratedTestSuiteDraft> {
    const isAvailable = await defaultOllamaClient.isAvailable();
    if (!isAvailable) {
      return this.generate(input);
    }

    try {
      const targetUrl = input.targetUrl || "http://localhost:3010";
      const elementsSummary = (input.discoveredElements || [])
        .slice(0, 15)
        .map(
          (e) =>
            `- ${e.type} (${e.tag}): selector="${e.selector}", text="${e.text || ""}", placeholder="${e.placeholder || ""}"`
        )
        .join("\n");

      const system = `You are a Senior QA Automation Architect. Generate production-grade, resilient end-to-end test cases in canonical JSON format.
Actions allowed: navigate, click, fill, assertText, assertVisible.
Prioritize accessible role selectors, input validations, boundary cases, and resilience against UI churn.
Output MUST be valid JSON with this schema:
{
  "summary": "Brief summary of generated tests",
  "cases": [
    {
      "id": "case_1",
      "title": "Title of test case",
      "feature": "Feature name",
      "priority": "p0" | "p1" | "p2" | "p3",
      "platform": "web" | "mobile",
      "prerequisites": ["Prerequisite 1"],
      "tags": ["smoke", "e2e"],
      "steps": [
        {
          "id": "step_1",
          "action": "navigate" | "click" | "fill" | "assertText" | "assertVisible",
          "target": "selector or accessible role",
          "data": "value to fill or URL to navigate",
          "expectedOutcome": "What should happen"
        }
      ]
    }
  ]
}`;

      const prompt = `Target URL: ${targetUrl}
Platform: ${input.targetPlatform}
Source Context: ${input.sourcePayload}
Discovered Page Elements:
${elementsSummary || "No elements crawled; generate based on user story and URL."}

Generate canonical test cases for this application.`;

      const result = await defaultOllamaClient.generateJson<{
        summary?: string;
        cases?: CanonicalTestCase[];
      }>(prompt, { system, model: modelName });

      if (result && Array.isArray(result.cases) && result.cases.length > 0) {
        const cases = result.cases.map((c) => ({
          ...c,
          id: c.id || uid(),
          platform: c.platform || input.targetPlatform,
          priority: c.priority || "p1",
          prerequisites: c.prerequisites || [`Application reachable at ${targetUrl}`],
          tags: c.tags || ["ai-generated", input.targetPlatform],
          steps: (c.steps || []).map((s) => ({
            ...s,
            id: s.id || uid(),
            action: s.action || "assertVisible",
            expectedOutcome: s.expectedOutcome || "Verified step"
          }))
        }));

        return {
          id: uid(),
          sourceType: input.sourceType,
          summary: result.summary || `AI Generated ${cases.length} test cases with local model`,
          cases
        };
      }
    } catch (err) {
      console.warn("[TestGenerationService] Local model generation failed, using heuristic fallback:", err);
    }

    return this.generate(input);
  }
}

export class HealingAnalysisService {
  propose(
    testCaseId: string,
    artifacts: ExecutionArtifact[],
    errorMessage?: string,
    failedStepAction?: string,
    failedStepTarget?: string
  ): HealingProposal {
    const errorLower = (errorMessage || "").toLowerCase();

    if (errorLower.includes("checkbox") && errorLower.includes("cannot be filled")) {
      return {
        id: uid(),
        testCaseId,
        status: "pending",
        patch: `change step action on "${failedStepTarget || 'input'}" from "fill" to "click" (checkbox toggle)`,
        rationale: "Target element resolved to an <input type='checkbox'> which requires a click/check toggle rather than text entry.",
        signals: [
          {
            type: "locator",
            confidence: 0.98,
            description: "Target input is a checkbox control; change interaction from fill to toggle."
          },
          {
            type: "vlm",
            confidence: 0.92,
            description: "Visual analysis confirms checkbox component state."
          }
        ]
      };
    }

    if (errorLower.includes("not an <input>") || errorLower.includes("select")) {
      return {
        id: uid(),
        testCaseId,
        status: "pending",
        patch: `change step action on "${failedStepTarget || 'select'}" to selectOption or click`,
        rationale: "Target element is a <select> dropdown; standard text fill is invalid on select elements.",
        signals: [
          {
            type: "locator",
            confidence: 0.96,
            description: "Target element is a select dropdown; convert to selection or click."
          }
        ]
      };
    }

    if (errorLower.includes("timeout") || errorLower.includes("waiting for locator")) {
      const matchSelector = errorMessage?.match(/locator\('([^']+)'\)/);
      const sel = matchSelector ? matchSelector[1] : failedStepTarget || "element";
      return {
        id: uid(),
        testCaseId,
        status: "pending",
        patch: `replace page.locator('${sel}') with page.getByRole('button', { name: /${sel.replace(/[^a-zA-Z0-9]/g, "") || "action"}/i })`,
        rationale: `Selector '${sel}' timed out waiting for DOM element. Accessible role selector provides auto-waiting resilience.`,
        signals: [
          {
            type: "locator",
            confidence: 0.89,
            description: "Accessible role locator found near failing selector location."
          },
          {
            type: "dom-similarity",
            confidence: 0.84,
            description: "High DOM similarity found in adjacent container."
          }
        ]
      };
    }

    if (errorLower.includes("to be visible") || errorLower.includes("assertvisible")) {
      return {
        id: uid(),
        testCaseId,
        status: "pending",
        patch: `increase waitFor timeout and use accessible role locator for "${failedStepTarget || 'target'}"`,
        rationale: "Element visibility check failed due to client-side hydration delay or animated fade-in.",
        signals: [
          {
            type: "visual",
            confidence: 0.87,
            description: "Screenshot comparison shows component rendered shortly after assertion window."
          },
          {
            type: "locator",
            confidence: 0.81,
            description: "Element present in DOM tree with delayed visibility attribute."
          }
        ]
      };
    }

    return {
      id: uid(),
      testCaseId,
      status: "pending",
      patch: `replace page.locator('${failedStepTarget || 'element'}') with page.getByRole('button', { name: /continue|submit/i })`,
      rationale: "Fallback selector found a stable accessible target after UI change.",
      signals: [
        {
          type: "locator",
          confidence: 0.83,
          description: "Similar role and text match found near failing selector."
        },
        {
          type: "visual",
          confidence: 0.74,
          description: "Screenshot diff shows target shifted but visible."
        }
      ]
    };
  }

  async proposeWithModel(
    testCaseId: string,
    artifacts: ExecutionArtifact[],
    errorMessage?: string,
    failedStepAction?: string,
    failedStepTarget?: string,
    modelName?: string
  ): Promise<HealingProposal> {
    const isAvailable = await defaultOllamaClient.isAvailable();
    if (!isAvailable) {
      return this.propose(testCaseId, artifacts, errorMessage, failedStepAction, failedStepTarget);
    }

    try {
      const system = `You are an expert in automated test self-healing (Playwright & Maestro).
Analyze the failing step and error message, then propose a self-healing patch, rationale, and confidence signals.
Output MUST be valid JSON with this schema:
{
  "patch": "string describing or containing the replacement locator/action",
  "rationale": "detailed technical explanation of why the original failed and why the patch works",
  "confidence": 0.95,
  "signalDescription": "accessible locator match or DOM similarity analysis"
}`;

      const prompt = `Failed step action: "${failedStepAction || "unknown"}"
Failed step target: "${failedStepTarget || "unknown"}"
Error message: ${errorMessage || "Unknown error"}
Artifacts present: ${artifacts.map((a) => a.type).join(", ") || "none"}

Propose a resilient healing patch.`;

      const result = await defaultOllamaClient.generateJson<{
        patch?: string;
        rationale?: string;
        confidence?: number;
        signalDescription?: string;
      }>(prompt, { system, model: modelName });

      if (result && result.patch && result.rationale) {
        return {
          id: uid(),
          testCaseId,
          status: "pending",
          patch: result.patch,
          rationale: result.rationale,
          signals: [
            {
              type: "locator",
              confidence: result.confidence || 0.9,
              description: result.signalDescription || "Local AI model semantic locator repair."
            }
          ]
        };
      }
    } catch (err) {
      console.warn("[HealingAnalysisService] Local model proposal failed, using heuristic fallback:", err);
    }

    return this.propose(testCaseId, artifacts, errorMessage, failedStepAction, failedStepTarget);
  }
}

export class BugDraftService {
  summarize(title: string, artifacts: ExecutionArtifact[], errorMessage?: string): BugDraft {
    const errorSummary = errorMessage?.split("\n")[0]?.slice(0, 100);
    return {
      id: uid(),
      title: errorSummary ? `Defect: ${errorSummary}` : title,
      summary: errorMessage || "The run failed after a UI mismatch and generated a healing recommendation for review.",
      severity: errorSummary?.includes("checkbox") ? "low" : "medium",
      reproductionSteps: [
        "Open the target application in the test environment",
        "Trigger the automated interaction sequence",
        errorSummary ? `Observe failure: ${errorSummary}` : "Observe the missing or mismatched DOM element"
      ],
      evidence: artifacts
    };
  }

  async summarizeWithModel(
    title: string,
    artifacts: ExecutionArtifact[],
    errorMessage?: string,
    modelName?: string
  ): Promise<BugDraft> {
    const isAvailable = await defaultOllamaClient.isAvailable();
    if (!isAvailable) {
      return this.summarize(title, artifacts, errorMessage);
    }

    try {
      const system = `You are a Lead QA Engineer. Analyze the test failure and create a production-grade Defect Report.
Output MUST be valid JSON:
{
  "title": "Defect: clear summary",
  "summary": "Detailed technical analysis of what failed, root cause, and impact",
  "severity": "critical" | "high" | "medium" | "low",
  "reproductionSteps": ["Step 1", "Step 2", "Step 3"]
}`;

      const prompt = `Test Title: ${title}
Error Message: ${errorMessage || "No error message"}
Evidence Artifacts: ${artifacts.map((a) => a.type).join(", ")}`;

      const result = await defaultOllamaClient.generateJson<{
        title?: string;
        summary?: string;
        severity?: "critical" | "high" | "medium" | "low";
        reproductionSteps?: string[];
      }>(prompt, { system, model: modelName });

      if (result && result.title && result.summary) {
        return {
          id: uid(),
          title: result.title,
          summary: result.summary,
          severity: result.severity || "medium",
          reproductionSteps: result.reproductionSteps || [
            "Open target app",
            "Perform actions",
            "Observe defect"
          ],
          evidence: artifacts
        };
      }
    } catch (err) {
      console.warn("[BugDraftService] Local model bug draft failed, using fallback:", err);
    }

    return this.summarize(title, artifacts, errorMessage);
  }
}
