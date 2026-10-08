import type {
  CanonicalTestCase,
  CanonicalTestStep,
  MaestroFlow,
  MaestroFlowCommand,
  MaestroGenerateRequest,
} from "@sonofcotester/sdk";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Converts a CanonicalTestStep into one or more Maestro flow commands.
 * Maps the universal test step vocabulary to Maestro YAML commands:
 *   navigate  → openLink / launchApp (if first step)
 *   click     → tapOn
 *   fill      → tapOn (target) + inputText (data)
 *   assertText → assertVisible or assertVisible (with text match)
 *   assertVisible → assertVisible
 */
function stepToCommands(step: CanonicalTestStep, isFirst: boolean): MaestroFlowCommand[] {
  const commands: MaestroFlowCommand[] = [];

  switch (step.action) {
    case "navigate":
      if (isFirst && step.data) {
        // For mobile apps, launchApp is the entry point
        commands.push({
          command: "launchApp",
          value: "true",
          comment: step.expectedOutcome,
        });
      } else if (step.data) {
        commands.push({
          command: "openLink",
          value: step.data,
          comment: step.expectedOutcome,
        });
      }
      break;

    case "click":
      if (step.target) {
        commands.push({
          command: "tapOn",
          value: step.target,
          comment: step.expectedOutcome,
        });
      }
      break;

    case "fill":
      // Maestro's tapOn + inputText pattern
      if (step.target) {
        commands.push({
          command: "tapOn",
          value: step.target,
          comment: `Focus on ${step.target}`,
        });
      }
      if (step.data !== undefined) {
        commands.push({
          command: "inputText",
          value: step.data,
          comment: step.expectedOutcome,
        });
      }
      break;

    case "assertText":
      // Use assertVisible with the expected text — Maestro resolves it against the accessibility tree
      if (step.data) {
        commands.push({
          command: "assertVisible",
          value: step.data,
          comment: step.expectedOutcome,
        });
      } else if (step.target) {
        commands.push({
          command: "assertVisible",
          value: step.target,
          comment: step.expectedOutcome,
        });
      }
      break;

    case "assertVisible":
      if (step.target) {
        commands.push({
          command: "assertVisible",
          value: step.target,
          comment: step.expectedOutcome,
        });
      }
      break;

    default:
      // Unknown step — emit a comment so it's not silently lost
      commands.push({
        command: "takeScreenshot",
        value: `unknown-step-${step.id}`,
        comment: `Unhandled step action: ${step.action} — ${step.expectedOutcome}`,
      });
      break;
  }

  return commands;
}

/**
 * Generates a MaestroFlow from a single CanonicalTestCase.
 */
export function testCaseToFlow(
  testCase: CanonicalTestCase,
  appId: string,
  opts?: { env?: Record<string, string>; tags?: string[] }
): MaestroFlow {
  const commands: MaestroFlowCommand[] = [];

  for (let i = 0; i < testCase.steps.length; i++) {
    const step = testCase.steps[i];
    const isFirst = i === 0;
    commands.push(...stepToCommands(step, isFirst));
  }

  // Add a final screenshot for debugging
  commands.push({
    command: "takeScreenshot",
    value: `${testCase.id}-final`,
    comment: "Capture final state for debugging",
  });

  return {
    appId,
    name: testCase.title,
    tags: [...(testCase.tags ?? []), ...(opts?.tags ?? []), `priority:${testCase.priority}`],
    env: opts?.env,
    commands,
  };
}

/**
 * Generates MaestroFlow[] from a full test generation request.
 */
export function generateMaestroFlows(request: MaestroGenerateRequest): MaestroFlow[] {
  return request.cases.map((tc) =>
    testCaseToFlow(tc, request.appId, {
      env: request.env,
      tags: request.tags,
    })
  );
}

/**
 * Serializes a MaestroFlow into valid Maestro YAML string.
 * Uses a minimal YAML emitter to avoid external dependencies.
 */
export function flowToYaml(flow: MaestroFlow): string {
  const lines: string[] = [];

  // Header: appId
  lines.push(`appId: ${flow.appId}`);
  lines.push("---");

  // Optional: takeScreenshot before launch to capture initial state
  lines.push(`- takeScreenshot: initial-state`);

  for (const cmd of flow.commands) {
    if (cmd.comment) {
      lines.push(`# ${cmd.comment}`);
    }

    if (cmd.value === undefined) {
      // Boolean command like `back`, `takeScreenshot`
      lines.push(`- ${cmd.command}`);
    } else if (typeof cmd.value === "object") {
      // Object value: emit as nested YAML
      lines.push(`- ${cmd.command}:`);
      for (const [k, v] of Object.entries(cmd.value)) {
        lines.push(`    ${k}: ${yamlScalar(v)}`);
      }
    } else {
      // String value — use inline form
      lines.push(`- ${cmd.command}: ${yamlScalar(cmd.value)}`);
    }
  }

  return lines.join("\n") + "\n";
}

/**
 * Serializes a MaestroFlow to a safe filename.
 */
export function flowToFilename(flow: MaestroFlow): string {
  const slug = flow.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug}.yaml`;
}

// ── Internal helpers ──

function yamlScalar(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  const s = String(value);
  // Quote strings that contain special YAML chars
  if (/[:{}\[\],&*?|>!%@`#\-]/.test(s) || /^\d/.test(s) || s.includes("'")) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}
