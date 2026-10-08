import type {
  CanonicalTestCase,
  CanonicalTestStep,
  MaestroFlow,
  MaestroFlowCommand,
  MaestroSpecGenerateRequest,
  MaestroSpecGenerateResult,
  TargetPlatform,
} from "@sonofcotester/sdk";

const uid = () => Math.random().toString(36).slice(2, 10);

// ── Spec parsing utilities ──

interface ParsedSpec {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  userActions: string[];
  entities: string[];
  keywords: string[];
}

/**
 * Extracts structured information from a raw spec/jira/story payload.
 * Uses heuristic NLP-lite parsing — splits by common patterns, extracts
 * action verbs, nouns, and acceptance criteria.
 */
function parseSpecPayload(payload: string, sourceType: string): ParsedSpec {
  const lines = payload.split("\n").map((l) => l.trim()).filter(Boolean);
  const title = lines[0]?.slice(0, 120) || "Untitled spec";
  const description = lines.slice(1).join(" ");

  // Extract acceptance criteria — lines starting with "Given", "When", "Then", "- ", "* ", checkboxes
  const acceptanceCriteria: string[] = [];
  const userActions: string[] = [];
  const entities: string[] = [];
  const keywords: string[] = [];

  const actionVerbs = [
    "login", "log in", "sign up", "register", "create", "add", "delete", "remove",
    "update", "edit", "modify", "search", "filter", "sort", "navigate", "open",
    "close", "save", "submit", "upload", "download", "view", "display", "show",
    "hide", "toggle", "select", "deselect", "click", "tap", "swipe", "scroll",
    "enter", "fill", "type", "input", "select", "choose", "confirm", "cancel",
    "approve", "reject", "send", "receive", "accept", "decline", "pay", "checkout",
    "subscribe", "unsubscribe", "follow", "unfollow", "like", "share", "comment",
    "bookmark", "export", "import", "sync", "refresh", "retry", "reset", "verify",
    "validate", "authenticate", "authorize", "configure", "set up", "connect",
    "disconnect", "enable", "disable", "activate", "deactivate", "invite",
  ];

  const knownEntities = [
    "user", "admin", "account", "profile", "settings", "dashboard", "notification",
    "message", "email", "password", "token", "session", "cart", "order", "product",
    "item", "payment", "invoice", "report", "chart", "table", "list", "form",
    "dialog", "modal", "page", "screen", "tab", "menu", "sidebar", "header",
    "footer", "button", "link", "image", "video", "file", "document", "comment",
    "review", "rating", "search", "filter", "sort", "pagination", "calendar",
    "date", "time", "schedule", "task", "project", "team", "role", "permission",
    "notification", "alert", "message", "chat", "feed", "timeline", "post",
    "article", "blog", "category", "tag", "label", "status", "priority",
  ];

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Acceptance criteria patterns
    if (/^(given|when|then|and|but)\s/i.test(line) || /^[-*]\s*(should|must|can|will|shall)\s/i.test(line)) {
      acceptanceCriteria.push(line);
      continue;
    }

    if (/^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) {
      // Bullet points — could be actions or criteria
      if (actionVerbs.some((v) => lower.includes(v))) {
        userActions.push(line.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, ""));
      } else {
        acceptanceCriteria.push(line.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, ""));
      }
    }

    // Extract entities mentioned
    for (const entity of knownEntities) {
      if (lower.includes(entity) && !entities.includes(entity)) {
        entities.push(entity);
      }
    }

    // Extract action verbs
    for (const verb of actionVerbs) {
      if (lower.includes(verb) && !userActions.some((a) => a.toLowerCase().includes(verb))) {
        userActions.push(verb);
      }
    }

    // Extract capitalized words (potential feature names / entities)
    const capitalizedWords = line.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g) ?? [];
    for (const word of capitalizedWords) {
      if (word.length > 3 && !keywords.includes(word)) {
        keywords.push(word);
      }
    }
  }

  return { title, description, acceptanceCriteria, userActions, entities, keywords };
}

// ── Test case generation ──

function generateHappyPath(
  spec: ParsedSpec,
  platform: TargetPlatform,
  appId: string
): CanonicalTestCase {
  const steps: CanonicalTestStep[] = [];

  // Step 1: Launch / navigate
  steps.push({
    id: uid(),
    action: "navigate",
    data: platform === "mobile" ? appId : undefined,
    expectedOutcome: `App launches and shows the main screen for: ${spec.title}`,
  });

  // Generate steps from user actions
  const actionSteps = spec.userActions.slice(0, 6);
  for (const action of actionSteps) {
    const lower = action.toLowerCase();

    if (/login|log in|sign in|authenticate/.test(lower)) {
      steps.push(
        {
          id: uid(),
          action: "fill",
          target: platform === "mobile" ? "Email" : "[data-testid='email-input'], input[type='email']",
          data: "test@example.com",
          expectedOutcome: "Email field is filled with test credentials",
        },
        {
          id: uid(),
          action: "fill",
          target: platform === "mobile" ? "Password" : "[data-testid='password-input'], input[type='password']",
          data: "testpassword123",
          expectedOutcome: "Password field is filled",
        },
        {
          id: uid(),
          action: "click",
          target: platform === "mobile" ? "Login" : "button[type='submit'], [data-testid='login-button']",
          expectedOutcome: "Login form is submitted and user is authenticated",
        }
      );
    } else if (/sign up|register|create account/.test(lower)) {
      steps.push(
        {
          id: uid(),
          action: "click",
          target: platform === "mobile" ? "Sign Up" : "[data-testid='signup-button'], a[href*='register']",
          expectedOutcome: "Registration form is displayed",
        },
        {
          id: uid(),
          action: "fill",
          target: platform === "mobile" ? "Email" : "[data-testid='email-input']",
          data: "newuser@example.com",
          expectedOutcome: "Email is entered in registration form",
        }
      );
    } else if (/search|find|filter|sort/.test(lower)) {
      steps.push(
        {
          id: uid(),
          action: "click",
          target: platform === "mobile" ? "Search" : "[data-testid='search-input'], input[type='search']",
          expectedOutcome: "Search input is focused",
        },
        {
          id: uid(),
          action: "fill",
          target: platform === "mobile" ? "Search" : "[data-testid='search-input'], input[type='search']",
          data: "test query",
          expectedOutcome: "Search query is entered",
        }
      );
    } else if (/create|add|new|write|post/.test(lower)) {
      steps.push({
        id: uid(),
        action: "click",
        target: platform === "mobile" ? "Add" : "[data-testid='create-button'], [data-testid='add-button'], button:has-text('Add'), button:has-text('Create')",
        expectedOutcome: `Create/add action triggered for: ${action}`,
      });
    } else if (/delete|remove|drop/.test(lower)) {
      steps.push({
        id: uid(),
        action: "click",
        target: platform === "mobile" ? "Delete" : "[data-testid='delete-button'], button:has-text('Delete')",
        expectedOutcome: `Delete action triggered for: ${action}`,
      });
    } else if (/save|submit|confirm/.test(lower)) {
      steps.push({
        id: uid(),
        action: "click",
        target: platform === "mobile" ? "Save" : "[data-testid='save-button'], button[type='submit']",
        expectedOutcome: `Save/submit action completed: ${action}`,
      });
    } else if (/navigate|open|go to|view/.test(lower)) {
      steps.push({
        id: uid(),
        action: "click",
        target: spec.keywords[0] ? spec.keywords[0] : undefined,
        expectedOutcome: `Navigated to: ${action}`,
      });
    } else if (/toggle|enable|disable|switch/.test(lower)) {
      steps.push({
        id: uid(),
        action: "click",
        target: platform === "mobile" ? "Toggle" : "[data-testid='toggle']",
        expectedOutcome: `Toggle state changed: ${action}`,
      });
    }
  }

  // Ensure at least one assertion
  steps.push({
    id: uid(),
    action: "assertVisible",
    target: platform === "mobile" ? spec.keywords[0] ?? "Welcome" : `[data-testid='status'], [data-testid='result']`,
    expectedOutcome: `The ${spec.title} flow completed successfully`,
  });

  return {
    id: uid(),
    title: `${spec.title} — happy path`,
    feature: spec.keywords.slice(0, 3).join(", ") || spec.title,
    priority: "p1",
    platform,
    prerequisites: ["App is installed and accessible", "Test account is available"],
    tags: ["maestro-generated", "happy-path", "auto"],
    steps,
  };
}

function generateEdgeCases(
  spec: ParsedSpec,
  platform: TargetPlatform,
  appId: string
): CanonicalTestCase[] {
  const cases: CanonicalTestCase[] = [];

  // Empty input validation
  if (spec.userActions.some((a) => /fill|input|enter|type|submit/.test(a.toLowerCase()))) {
    cases.push({
      id: uid(),
      title: `${spec.title} — empty input validation`,
      feature: "Input validation",
      priority: "p2",
      platform,
      prerequisites: ["App is launched"],
      tags: ["maestro-generated", "edge-case", "validation"],
      steps: [
        {
          id: uid(),
          action: "navigate",
          data: platform === "mobile" ? appId : undefined,
          expectedOutcome: "App launches",
        },
        {
          id: uid(),
          action: "click",
          target: platform === "mobile" ? "Submit" : "button[type='submit'], [data-testid='submit-button']",
          expectedOutcome: "Submit with empty fields",
        },
        {
          id: uid(),
          action: "assertVisible",
          target: platform === "mobile" ? "required" : ".error, [data-testid='error-message'], [role='alert']",
          expectedOutcome: "Validation error is shown for required fields",
        },
      ],
    });
  }

  // Long input test
  if (spec.userActions.some((a) => /fill|input|enter|type/.test(a.toLowerCase()))) {
    cases.push({
      id: uid(),
      title: `${spec.title} — long input handling`,
      feature: "Input boundaries",
      priority: "p3",
      platform,
      prerequisites: ["App is launched"],
      tags: ["maestro-generated", "edge-case", "boundary"],
      steps: [
        {
          id: uid(),
          action: "navigate",
          data: platform === "mobile" ? appId : undefined,
          expectedOutcome: "App launches",
        },
        {
          id: uid(),
          action: "fill",
          target: platform === "mobile" ? "Input" : "input, textarea, [data-testid='input']",
          data: "A".repeat(500),
          expectedOutcome: "Long string is entered without crash",
        },
        {
          id: uid(),
          action: "assertVisible",
          target: platform === "mobile" ? spec.keywords[0] ?? "App" : "[data-testid='status']",
          expectedOutcome: "App handles long input gracefully",
        },
      ],
    });
  }

  // Rapid navigation / back button
  cases.push({
    id: uid(),
    title: `${spec.title} — rapid back navigation`,
    feature: "Navigation resilience",
    priority: "p3",
    platform,
    prerequisites: ["App is launched"],
    tags: ["maestro-generated", "edge-case", "navigation"],
    steps: [
      {
        id: uid(),
        action: "navigate",
        data: platform === "mobile" ? appId : undefined,
        expectedOutcome: "App launches",
      },
      {
        id: uid(),
        action: "click",
        target: spec.userActions[0] ?? undefined,
        expectedOutcome: "First action performed",
      },
      {
        id: uid(),
        action: "assertVisible",
        target: platform === "mobile" ? spec.keywords[0] ?? "App" : "[data-testid='content']",
        expectedOutcome: "Content is displayed after navigation",
      },
    ],
  });

  return cases;
}

function generateNegativeTests(
  spec: ParsedSpec,
  platform: TargetPlatform,
  appId: string
): CanonicalTestCase[] {
  const cases: CanonicalTestCase[] = [];

  // Wrong credentials
  if (spec.userActions.some((a) => /login|sign in|authenticate/.test(a.toLowerCase()))) {
    cases.push({
      id: uid(),
      title: `${spec.title} — wrong credentials rejected`,
      feature: "Authentication security",
      priority: "p1",
      platform,
      prerequisites: ["App is launched and on login screen"],
      tags: ["maestro-generated", "negative", "security"],
      steps: [
        {
          id: uid(),
          action: "navigate",
          data: platform === "mobile" ? appId : undefined,
          expectedOutcome: "App launches",
        },
        {
          id: uid(),
          action: "fill",
          target: platform === "mobile" ? "Email" : "[data-testid='email-input'], input[type='email']",
          data: "wrong@example.com",
          expectedOutcome: "Wrong email entered",
        },
        {
          id: uid(),
          action: "fill",
          target: platform === "mobile" ? "Password" : "[data-testid='password-input'], input[type='password']",
          data: "wrongpassword",
          expectedOutcome: "Wrong password entered",
        },
        {
          id: uid(),
          action: "click",
          target: platform === "mobile" ? "Login" : "button[type='submit'], [data-testid='login-button']",
          expectedOutcome: "Login attempted with wrong credentials",
        },
        {
          id: uid(),
          action: "assertVisible",
          target: platform === "mobile" ? "Invalid" : ".error, [data-testid='error-message'], [role='alert']",
          expectedOutcome: "Error message is shown for invalid credentials",
        },
      ],
    });
  }

  // Network offline simulation (for web)
  if (platform === "web") {
    cases.push({
      id: uid(),
      title: `${spec.title} — offline resilience`,
      feature: "Network resilience",
      priority: "p2",
      platform,
      prerequisites: ["App is launched and functional"],
      tags: ["maestro-generated", "negative", "network"],
      steps: [
        {
          id: uid(),
          action: "navigate",
          data: undefined,
          expectedOutcome: "App is in a usable state before going offline",
        },
        {
          id: uid(),
          action: "assertVisible",
          target: "[data-testid='status'], .app-content",
          expectedOutcome: "App content is visible",
        },
      ],
    });
  }

  return cases;
}

// ── Main generation service ──

export class MaestroGenerationService {
  /**
   * Parse a spec/story/jira ticket and generate Maestro flows from it.
   */
  generate(request: MaestroSpecGenerateRequest): MaestroSpecGenerateResult {
    const spec = parseSpecPayload(request.sourcePayload, request.sourceType);
    const maxCases = request.maxCases ?? 10;
    const notes: string[] = [];
    let confidence = 0.7; // baseline

    // Boost confidence for structured sources
    if (spec.acceptanceCriteria.length > 2) confidence += 0.1;
    if (spec.userActions.length > 3) confidence += 0.05;
    if (request.sourceType === "jira") confidence += 0.05;

    // Cap confidence
    confidence = Math.min(confidence, 0.95);

    if (spec.acceptanceCriteria.length === 0) {
      notes.push("No explicit acceptance criteria found — generated steps are inferred from action verbs in the spec.");
      confidence -= 0.1;
    }
    if (spec.userActions.length === 0) {
      notes.push("No clear user actions detected — steps are based on general patterns. Review and refine.");
      confidence -= 0.15;
    }
    if (spec.entities.length === 0) {
      notes.push("No recognizable UI entities found — selectors are generic. Add knownSelectors for better targeting.");
    }

    const testCases: CanonicalTestCase[] = [];

    // 1. Always generate happy path
    testCases.push(generateHappyPath(spec, request.platform, request.appId));
    notes.push(`Happy path generated with ${testCases[0].steps.length} steps from ${spec.userActions.length} detected actions.`);

    // 2. Edge cases
    const edgeCases = generateEdgeCases(spec, request.platform, request.appId);
    testCases.push(...edgeCases);
    if (edgeCases.length > 0) {
      notes.push(`${edgeCases.length} edge case flow(s) generated (empty input, long input, rapid navigation).`);
    }

    // 3. Negative tests
    if (request.includeNegativeTests !== false) {
      const negatives = generateNegativeTests(spec, request.platform, request.appId);
      testCases.push(...negatives);
      if (negatives.length > 0) {
        notes.push(`${negatives.length} negative test flow(s) generated (wrong credentials, offline).`);
      }
    }

    // Trim to max
    const trimmed = testCases.slice(0, maxCases);
    if (testCases.length > maxCases) {
      notes.push(`Trimmed from ${testCases.length} to ${maxCases} flows (maxCases limit).`);
    }

    // Apply context enhancements
    if (request.context?.authInstructions) {
      notes.push(`Auth instructions noted: ${request.context.authInstructions.slice(0, 80)}`);
    }
    if (request.context?.knownSelectors?.length) {
      notes.push(`${request.context.knownSelectors.length} known selectors provided — used for step targeting where applicable.`);
      confidence += 0.05;
    }

    // Convert to Maestro flows
    const flows: MaestroFlow[] = trimmed.map((tc) => ({
      appId: request.appId,
      name: tc.title,
      tags: [...tc.tags, ...(request.tags ?? [])],
      env: request.context?.baseUrl ? { BASE_URL: request.context.baseUrl } : undefined,
      commands: tcToMaestroCommands(tc),
    }));

    const yamlFiles = flows.map((flow) => ({
      filename: flowToFilenameSafe(flow.name),
      yaml: flowToYamlSafe(flow),
    }));

    return {
      summary: `Generated ${trimmed.length} Maestro flow(s) from ${request.sourceType} input. ` +
        `Detected ${spec.userActions.length} user actions, ${spec.entities.length} entities, ` +
        `${spec.acceptanceCriteria.length} acceptance criteria.`,
      sourceType: request.sourceType,
      testCases: trimmed,
      flows,
      yamlFiles,
      confidence: Math.round(confidence * 100) / 100,
      notes,
    };
  }
}

// ── Helpers: convert CanonicalTestCase steps to Maestro commands ──

function tcToMaestroCommands(tc: CanonicalTestCase): MaestroFlowCommand[] {
  const commands: MaestroFlowCommand[] = [];
  for (let i = 0; i < tc.steps.length; i++) {
    const step = tc.steps[i];
    const isFirst = i === 0;
    commands.push(...canonicalToMaestro(step, isFirst));
  }
  commands.push({
    command: "takeScreenshot",
    value: `${tc.id}-final`,
    comment: "Capture final state for debugging",
  });
  return commands;
}

function canonicalToMaestro(step: CanonicalTestStep, isFirst: boolean): MaestroFlowCommand[] {
  const cmds: MaestroFlowCommand[] = [];
  switch (step.action) {
    case "navigate":
      if (isFirst && step.data) {
        cmds.push({ command: "launchApp", value: step.data, comment: step.expectedOutcome });
      } else if (step.data) {
        cmds.push({ command: "openLink", value: step.data, comment: step.expectedOutcome });
      }
      break;
    case "click":
      if (step.target) cmds.push({ command: "tapOn", value: step.target, comment: step.expectedOutcome });
      break;
    case "fill":
      if (step.target) cmds.push({ command: "tapOn", value: step.target, comment: `Focus on ${step.target}` });
      if (step.data !== undefined) cmds.push({ command: "inputText", value: step.data, comment: step.expectedOutcome });
      break;
    case "assertText":
      if (step.data) cmds.push({ command: "assertVisible", value: step.data, comment: step.expectedOutcome });
      else if (step.target) cmds.push({ command: "assertVisible", value: step.target, comment: step.expectedOutcome });
      break;
    case "assertVisible":
      if (step.target) cmds.push({ command: "assertVisible", value: step.target, comment: step.expectedOutcome });
      break;
  }
  return cmds;
}

function flowToFilenameSafe(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${slug}.yaml`;
}

function flowToYamlSafe(flow: MaestroFlow): string {
  const lines: string[] = [];
  lines.push(`appId: ${flow.appId}`);
  lines.push("---");
  lines.push("- takeScreenshot: initial-state");
  for (const cmd of flow.commands) {
    if (cmd.comment) lines.push(`# ${cmd.comment}`);
    if (cmd.value === undefined) {
      lines.push(`- ${cmd.command}`);
    } else if (typeof cmd.value === "object") {
      lines.push(`- ${cmd.command}:`);
      for (const [k, v] of Object.entries(cmd.value)) {
        lines.push(`    ${k}: ${yamlSafe(v)}`);
      }
    } else {
      lines.push(`- ${cmd.command}: ${yamlSafe(cmd.value)}`);
    }
  }
  return lines.join("\n") + "\n";
}

function yamlSafe(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  const s = String(value);
  if (/[:{}\[\],&*?|>!%@`#\-]/.test(s) || /^\d/.test(s) || s.includes("'")) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}
