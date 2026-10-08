import type {
  AcademyModule,
  SyntaxTranslationRequest,
  SyntaxTranslationResult,
  TestAntiPattern,
  TestQualityReport
} from "@sonofcotester/sdk";
import { defaultOllamaClient } from "./ollama-client.js";

export class StudentTestingTutor {
  /**
   * Get the standard 6-module curriculum for the Student Testing Academy.
   */
  getCurriculum(): AcademyModule[] {
    return [
      {
        id: "module-1",
        number: 1,
        title: "The QA Testing Pyramid & Multi-Level Strategy",
        badge: "🔺 Pyramid Architect",
        difficulty: "beginner",
        estimatedMinutes: 20,
        description: "Understand the core architecture of automated software testing: Unit, Integration, End-to-End, and Mobile UI layers.",
        keyConcepts: [
          "Testing Pyramid balance (70% Unit, 20% Integration, 10% E2E)",
          "Cost and execution time trade-offs across test levels",
          "Decoupling test state from live external third-party dependencies",
          "Test pyramid anti-patterns: The 'Ice Cream Cone' and 'Inverted Cupcake'"
        ],
        sampleCode: {
          language: "playwright",
          code: `import { test, expect } from '@playwright/test';

test('fast targeted checkout flow', async ({ page }) => {
  // Good: Navigate directly using pre-authenticated session state
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Order Summary' })).toBeVisible();
});`,
          explanation: "Bypasses repeating 20-step UI login for every single test by using mocked API cookies or storage state."
        },
        quizQuestions: [
          {
            id: "q1_1",
            question: "Why should end-to-end tests generally form the smallest tier of your test pyramid?",
            options: [
              "Because E2E tests are slower, more expensive to maintain, and prone to flakiness compared to unit/integration tests.",
              "Because browsers cannot execute JavaScript reliably.",
              "Because modern web frameworks do not support E2E tests.",
              "Because unit tests test database queries better than E2E tests."
            ],
            correctIndex: 0,
            explanation: "E2E tests have the highest execution latency and setup complexity; keeping them focused on critical user journeys provides the highest ROI."
          },
          {
            id: "q1_2",
            question: "What is the 'Ice Cream Cone' testing anti-pattern?",
            options: [
              "Having 90% unit tests and 0% E2E tests.",
              "Having few unit tests, almost no integration tests, and relying heavily on thousands of slow, flaky manual/E2E UI tests.",
              "Testing only mobile devices on warm days.",
              "Testing microservices without API contracts."
            ],
            correctIndex: 1,
            explanation: "The Ice Cream Cone occurs when teams neglect unit tests and try to catch all bugs through heavy UI tests."
          }
        ]
      },
      {
        id: "module-2",
        number: 2,
        title: "Selector Engineering & Resilient Locators",
        badge: "🎯 Selector Ninja",
        difficulty: "intermediate",
        estimatedMinutes: 25,
        description: "Learn how to write selectors that survive UI redesigns and changes to CSS classes or DOM depth.",
        keyConcepts: [
          "Locator priority hierarchy: Accessible Role > Data TestId > Text Content > CSS/XPath",
          "Why absolute XPaths (e.g. /div/div[2]/span) are testing suicide",
          "Accessible name computation and ARIA roles for robust assertions",
          "Handling dynamic elements, shadow DOM, and iframe boundaries"
        ],
        sampleCode: {
          language: "playwright",
          code: `// ❌ BRITTLE: Breaks whenever Tailwind classes or HTML wrapper changes
// await page.locator('.flex.justify-between > div:nth-child(2) > button').click();

// ✅ RESILIENT: Mirrors how real human screen-readers and users find elements
await page.getByRole('button', { name: /place order/i }).click();
await expect(page.getByTestId('order-confirmation-badge')).toBeVisible();`,
          explanation: "getByRole queries the accessibility tree, making tests self-documenting, resilient to layout refactors, and automatically auditing accessibility."
        },
        quizQuestions: [
          {
            id: "q2_1",
            question: "Which of the following is the most resilient locator strategy according to modern testing best practices?",
            options: [
              "Absolute XPath like `/html/body/div[1]/main/div[3]/button`",
              "Class name selectors like `.btn-primary.mt-4.rounded`",
              "Role-based accessible selectors like `page.getByRole('button', { name: 'Submit' })`",
              "Index-based locator like `page.locator('button').nth(4)`"
            ],
            correctIndex: 2,
            explanation: "Accessible roles reflect the semantic purpose of the element and withstand CSS styling updates."
          }
        ]
      },
      {
        id: "module-3",
        number: 3,
        title: "Declarative Mobile Testing with Maestro",
        badge: "📱 Maestro Maestro",
        difficulty: "intermediate",
        estimatedMinutes: 30,
        description: "Master Maestro — the modern, declarative, open-source alternative to Appium for iOS and Android testing.",
        keyConcepts: [
          "Declarative YAML flows vs imperative Appium WebDriver protocols",
          "Auto-waiting and built-in flakiness tolerance in Maestro",
          "Cross-platform parity: Running identical flows on iOS and Android",
          "Maestro Cloud device farm execution and CI/CD integration"
        ],
        sampleCode: {
          language: "maestro",
          code: `appId: com.sonofcotester.companion
---
- launchApp
- assertVisible: "Welcome back"
- tapOn:
    id: "login-email-input"
- inputText: "student@university.edu"
- tapOn: "Sign In"
- assertVisible: "Dashboard Overview"`,
          explanation: "Clean, human-readable YAML with zero boilerplate and automatic smart waits for animations and network requests."
        },
        quizQuestions: [
          {
            id: "q3_1",
            question: "What makes Maestro significantly less flaky than traditional Appium setups?",
            options: [
              "Maestro automatically waits for animations, network idle, and element visibility before attempting interaction.",
              "Maestro disables all JavaScript in the app.",
              "Maestro only works on physical hardware in California.",
              "Maestro does not execute assertions."
            ],
            correctIndex: 0,
            explanation: "Maestro was specifically designed with built-in tolerance for rendering lag and asynchronous state updates."
          }
        ]
      },
      {
        id: "module-4",
        number: 4,
        title: "AI in Quality Engineering & Self-Healing Tests",
        badge: "🔮 Self-Healing Sorcerer",
        difficulty: "advanced",
        estimatedMinutes: 30,
        description: "Understand how modern AI testing engines detect broken locators, compute DOM similarities, and heal test scripts.",
        keyConcepts: [
          "Visual & DOM similarity scoring (Levenshtein, tree edit distance, role match)",
          "Autonomous vs Human-in-the-Loop healing workflows",
          "Confidence thresholds and preventing hallucinated test repairs",
          "Regression categorization: Intentional feature change vs actual product bug"
        ],
        sampleCode: {
          language: "playwright",
          code: `// Original failing step:
// await page.click('#submit-btn'); // Element was renamed to #confirm-checkout-button

// AI Self-Healing Analysis:
// Found button with role 'button' and text 'Confirm Checkout' at 94% confidence.
// Generated proposal: page.getByRole('button', { name: 'Confirm Checkout' })`,
          explanation: "Self-healing algorithms isolate the semantic intention of the step and repair locators without failing CI builds."
        },
        quizQuestions: [
          {
            id: "q4_1",
            question: "When should an AI self-healing proposal be reviewed by a human rather than automatically applied silently?",
            options: [
              "When confidence is below safety thresholds or the underlying business workflow logic changed.",
              "Never; AI should always silently rewrite all test code.",
              "Only on weekends.",
              "Only when unit tests fail."
            ],
            correctIndex: 0,
            explanation: "Human-in-the-loop review ensures real product regressions are not accidentally covered up as locator shifts."
          }
        ]
      },
      {
        id: "module-5",
        number: 5,
        title: "Accessibility (WCAG 2.2 AA) & Security Assurance",
        badge: "🛡 Guardian of Quality",
        difficulty: "intermediate",
        estimatedMinutes: 25,
        description: "Integrate accessibility audits and security checks directly into automated testing pipelines.",
        keyConcepts: [
          "WCAG 2.2 Level AA success criteria (contrast, keyboard focus, screen-reader landmarks)",
          "Automated Axe-core scanner rules in test suites",
          "OWASP Top 10 vulnerabilities discoverable during QA",
          "Automated quality gates that block pull requests with critical a11y violations"
        ],
        sampleCode: {
          language: "playwright",
          code: `import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('homepage meets WCAG 2.2 AA accessibility standards', async ({ page }) => {
  await page.goto('/');
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});`,
          explanation: "Directly runs the Axe accessibility engine on the rendered DOM to catch 40%+ of accessibility violations automatically."
        },
        quizQuestions: [
          {
            id: "q5_1",
            question: "Why should accessibility tests be integrated into standard CI/CD test runs?",
            options: [
              "To catch accessible contrast, ARIA landmarks, and keyboard navigation issues before shipping to users with disabilities.",
              "Because it makes the webpage download faster.",
              "Because it reduces CSS file sizes.",
              "Because browsers refuse to render pages without Axe."
            ],
            correctIndex: 0,
            explanation: "Automated a11y testing prevents regressions and ensures legal compliance with ADA and WCAG standards."
          }
        ]
      },
      {
        id: "module-6",
        number: 6,
        title: "API Performance & Stress Testing with K6",
        badge: "⚡ Velocity Master",
        difficulty: "advanced",
        estimatedMinutes: 25,
        description: "Benchmark high-concurrency API performance, P95/P99 latency budgets, and system breaking points.",
        keyConcepts: [
          "Latency percentiles (P50, P95, P99) vs average response times",
          "Ramping Virtual Users (VUs) and concurrency patterns",
          "Defining strict SLA performance thresholds in CI/CD",
          "Distinguishing connection pool bottlenecks from slow database queries"
        ],
        sampleCode: {
          language: "playwright",
          code: `// K6 Benchmark script example
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests must finish within 200ms
    http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
  },
};

export default function () {
  const res = http.get('http://localhost:3101/api/projects');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(0.1);
}`,
          explanation: "Defines automated throughput thresholds that fail CI if latency degrades beyond 200ms under load."
        },
        quizQuestions: [
          {
            id: "q6_1",
            question: "Why is P95/P99 latency a better indicator of real-world user experience than average latency?",
            options: [
              "Averages hide extreme tail latency spikes experienced by slower connections or high-load database queries.",
              "Averages are mathematically harder to calculate.",
              "P95 is always zero.",
              "Because servers do not record averages."
            ],
            correctIndex: 0,
            explanation: "Tail latency represents the worst experience of your users; an average can look healthy while 5% of users experience terrible lag."
          }
        ]
      }
    ];
  }

  /**
   * Analyze a student test script or user story and produce an AI Quality Report with anti-pattern detection.
   */
  analyzeTest(code: string, platform: "web" | "mobile" = "web"): TestQualityReport {
    const lines = code.split("\n");
    const antiPatterns: TestAntiPattern[] = [];
    const strengths: string[] = [];

    // 1. Check for hardcoded arbitrary sleeps
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/sleep\s*\(|page\.waitForTimeout\s*\(\s*\d+\s*\)|wait\s*:\s*\d+/i.test(line)) {
        antiPatterns.push({
          type: "arbitrary_sleep",
          severity: "critical",
          title: "Arbitrary Hardcoded Sleep / Delay Detected",
          message: `Line ${i + 1} contains a hardcoded delay. Hardcoded sleeps drastically slow down CI suites and cause flaky failures when servers take 1ms longer than the sleep duration.`,
          lineSnippet: line.trim(),
          recommendation: "Replace hardcoded sleeps with explicit assertions or auto-waiting locators, e.g. `await expect(locator).toBeVisible()`."
        });
      }
    }

    // 2. Check for brittle selectors (absolute XPath, deeply nested CSS)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\/\/[a-z0-9_-]+|\/html\/body|div\s*>\s*div|\/div\/|\.flex\.|nth-child\(\d+\)/i.test(line)) {
        antiPatterns.push({
          type: "brittle_locator",
          severity: "critical",
          title: "Brittle DOM Depth / XPath Selector",
          message: `Line ${i + 1} uses a DOM-depth dependent selector that will break upon any layout refactoring.`,
          lineSnippet: line.trim(),
          recommendation: "Use accessible roles (`getByRole`) or dedicated `data-testid` attributes instead."
        });
      }
    }

    // 3. Check for presence of assertions
    const hasAssertions = /expect\s*\(|assertVisible|assertText|assertNotVisible|should\s*\(/i.test(code);
    if (!hasAssertions) {
      antiPatterns.push({
        type: "missing_assertion",
        severity: "critical",
        title: "No Verifiable Assertions Found",
        message: "The test performs navigation or click actions but never validates expected outcome or state changes.",
        recommendation: "Add explicit assertions, e.g. checking that a success toast, redirect URL, or confirmation badge is visible."
      });
    } else {
      strengths.push("Contains explicit verifiable assertions");
    }

    // 4. Check for accessible locators
    const hasRoleOrTestId = /getByRole|getByTestId|getByLabel|data-testid/i.test(code);
    if (hasRoleOrTestId) {
      strengths.push("Uses modern accessible role or testId locators");
    } else if (code.trim().length > 30) {
      antiPatterns.push({
        type: "missing_a11y",
        severity: "warning",
        title: "Consider Role-Based Accessible Locators",
        message: "Using `getByRole` or `getByLabel` ensures your test simultaneously audits screen-reader accessibility.",
        recommendation: "Try rewriting element queries with `page.getByRole('button', { name: '...' })`"
      });
    }

    // Calculate score
    let score = 100;
    for (const p of antiPatterns) {
      if (p.severity === "critical") score -= 25;
      if (p.severity === "warning") score -= 10;
      if (p.severity === "tip") score -= 5;
    }
    score = Math.max(10, Math.min(100, score));

    let grade: TestQualityReport["grade"] = "F";
    if (score >= 95) grade = "A+";
    else if (score >= 85) grade = "A";
    else if (score >= 70) grade = "B";
    else if (score >= 55) grade = "C";
    else if (score >= 40) grade = "D";

    const assertionMatches = code.match(/expect|assert/gi) || [];
    const stepMatches = code.match(/click|fill|tapOn|inputText|goto|navigate/gi) || [];

    return {
      score,
      grade,
      summary: score >= 85
        ? "Excellent test structure with resilient selectors and clear assertions."
        : "Test contains anti-patterns that may cause flakiness or maintenance overhead.",
      antiPatterns,
      strengths,
      metrics: {
        stepCount: Math.max(1, stepMatches.length),
        assertionCount: assertionMatches.length,
        resilientLocatorRatio: hasRoleOrTestId ? 0.9 : 0.4,
        hasAccessibilityChecks: hasRoleOrTestId,
        estimatedExecutionSpeed: antiPatterns.some((a) => a.type === "arbitrary_sleep") ? "slow" : "fast"
      }
    };
  }

  /**
   * Translate test syntax between Playwright, Maestro YAML, and Cypress.
   */
  translateSyntax(req: SyntaxTranslationRequest): SyntaxTranslationResult {
    const { sourceSyntax, targetSyntax, code } = req;
    const notes: string[] = [];

    if (sourceSyntax === targetSyntax) {
      return {
        sourceSyntax,
        targetSyntax,
        translatedCode: code,
        notes: ["Source and target syntax are identical."]
      };
    }

    // Convert Playwright -> Maestro YAML
    if (sourceSyntax === "playwright" && targetSyntax === "maestro") {
      let yaml = "appId: com.example.app\n---\n- launchApp\n";
      const statements = code.split(/[\n;]+/);
      for (const line of statements) {
        if (/goto\s*\(\s*["']([^"']+)["']\s*\)/i.test(line)) {
          const url = line.match(/goto\s*\(\s*["']([^"']+)["']\s*\)/i)?.[1];
          yaml += `- openLink: "${url}"\n`;
        } else if (/click\s*\(/i.test(line)) {
          const text = line.match(/name:\s*['"]([^'"]+)['"]/i)?.[1]
            || line.match(/getByTestId\(['"]([^'"]+)['"]/i)?.[1]
            || line.match(/click\s*\(\s*['"]([^'"]+)['"]\s*\)/i)?.[1]
            || "Target";
          yaml += `- tapOn: "${text}"\n`;
        } else if (/fill\s*\(\s*['"]([^'"]+)['"]\s*\)/i.test(line)) {
          const text = line.match(/fill\s*\(\s*['"]([^'"]+)['"]\s*\)/i)?.[1];
          yaml += `- inputText: "${text}"\n`;
        } else if (/toBeVisible/i.test(line)) {
          const text = line.match(/name:\s*['"]([^'"]+)['"]/i)?.[1]
            || line.match(/getByText\(['"]([^'"]+)['"]/i)?.[1]
            || "Expected Content";
          yaml += `- assertVisible: "${text}"\n`;
        }
      }
      notes.push("Converted Playwright actions into declarative Maestro YAML commands.");
      notes.push("Ensure appId is set to your target mobile package identifier.");
      return { sourceSyntax, targetSyntax, translatedCode: yaml, notes };
    }

    // Convert Maestro YAML -> Playwright
    if (sourceSyntax === "maestro" && targetSyntax === "playwright") {
      let pw = `import { test, expect } from '@playwright/test';\n\ntest('converted mobile flow', async ({ page }) => {\n`;
      const statements = code.split(/[\n;]+/);
      for (const line of statements) {
        if (/openLink:\s*["']?([^"'\n]+)/i.test(line)) {
          const url = line.match(/openLink:\s*["']?([^"'\n]+)/i)?.[1];
          pw += `  await page.goto('${url}');\n`;
        } else if (/tapOn:\s*["']?([^"'\n]+)/i.test(line)) {
          const target = line.match(/tapOn:\s*["']?([^"'\n]+)/i)?.[1];
          pw += `  await page.getByRole('button', { name: /${target}/i }).click();\n`;
        } else if (/inputText:\s*["']?([^"'\n]+)/i.test(line)) {
          const text = line.match(/inputText:\s*["']?([^"'\n]+)/i)?.[1];
          pw += `  await page.locator('input').fill('${text}');\n`;
        } else if (/assertVisible:\s*["']?([^"'\n]+)/i.test(line)) {
          const text = line.match(/assertVisible:\s*["']?([^"'\n]+)/i)?.[1];
          pw += `  await expect(page.getByText('${text}')).toBeVisible();\n`;
        }
      }
      pw += `});\n`;
      notes.push("Generated standard Playwright test with accessible role and text assertions.");
      return { sourceSyntax, targetSyntax, translatedCode: pw, notes };
    }

    // Convert Playwright -> Cypress
    if (sourceSyntax === "playwright" && targetSyntax === "cypress") {
      let cy = `describe('Converted E2E Test Suite', () => {\n  it('executes user flow', () => {\n`;
      const statements = code.split(/[\n;]+/);
      for (const line of statements) {
        if (/goto\s*\(\s*["']([^"']+)["']\s*\)/i.test(line)) {
          const url = line.match(/goto\s*\(\s*["']([^"']+)["']\s*\)/i)?.[1];
          cy += `    cy.visit('${url}');\n`;
        } else if (/click\s*\(/i.test(line)) {
          const sel = line.match(/click\s*\(\s*['"]([^'"]+)['"]\s*\)/i)?.[1]
            || line.match(/locator\s*\(\s*['"]([^'"]+)['"]\s*\)/i)?.[1]
            || line.match(/getByTestId\s*\(\s*['"]([^'"]+)['"]\s*\)/i)?.[1]
            || line.match(/name:\s*['"]([^'"]+)['"]/i)?.[1];
          cy += `    cy.get('${sel || "button"}').click();\n`;
        } else if (/fill\s*\(\s*['"]([^'"]+)['"]\s*\)/i.test(line)) {
          const text = line.match(/fill\s*\(\s*['"]([^'"]+)['"]\s*\)/i)?.[1];
          cy += `    cy.get('input').type('${text}');\n`;
        }
      }
      cy += `  });\n});\n`;
      notes.push("Converted Playwright test actions into Cypress chaining syntax.");
      return { sourceSyntax, targetSyntax, translatedCode: cy, notes };
    }

    // Default fallback translation
    return {
      sourceSyntax,
      targetSyntax,
      translatedCode: `// Translated from ${sourceSyntax} to ${targetSyntax}\n// Target: ${targetSyntax}\n${code}`,
      notes: [`Generic translation applied for ${sourceSyntax} to ${targetSyntax}.`]
    };
  }

  /**
   * Analyze student test code using local Ollama model if available, falling back to rule engine.
   */
  async analyzeTestWithModel(
    code: string,
    platform: "web" | "mobile" = "web",
    modelName?: string
  ): Promise<TestQualityReport> {
    const isAvailable = await defaultOllamaClient.isAvailable();
    if (!isAvailable) {
      return this.analyzeTest(code, platform);
    }

    try {
      const system = `You are a QA Professor and Lead Test Automation Engineer.
Analyze the student's test script for quality, anti-patterns (arbitrary sleeps, brittle locators, missing assertions), strengths, and best practices.
Output MUST be valid JSON with this schema:
{
  "score": 85,
  "grade": "A" | "A+" | "B" | "C" | "D" | "F",
  "summary": "Clear summary of the code quality",
  "strengths": ["Strength 1", "Strength 2"],
  "antiPatterns": [
    {
      "type": "arbitrary_sleep" | "brittle_locator" | "missing_assertion" | "missing_a11y",
      "severity": "critical" | "warning" | "tip",
      "title": "Short title",
      "message": "Detailed explanation",
      "recommendation": "How to fix it"
    }
  ],
  "metrics": {
    "stepCount": 3,
    "assertionCount": 2,
    "resilientLocatorRatio": 0.8,
    "hasAccessibilityChecks": true,
    "estimatedExecutionSpeed": "fast" | "medium" | "slow"
  }
}`;

      const prompt = `Platform: ${platform}
Test Script to Analyze:
\`\`\`
${code}
\`\`\`

Provide an AI quality evaluation.`;

      const result = await defaultOllamaClient.generateJson<TestQualityReport>(prompt, {
        system,
        model: modelName
      });

      if (result && typeof result.score === "number" && result.grade) {
        return result;
      }
    } catch (err) {
      console.warn("[StudentTestingTutor] Local model test analysis failed, using rule engine:", err);
    }

    return this.analyzeTest(code, platform);
  }

  /**
   * Translate test syntax between frameworks using local Ollama model with AST/heuristic fallback.
   */
  async translateSyntaxWithModel(
    req: SyntaxTranslationRequest,
    modelName?: string
  ): Promise<SyntaxTranslationResult> {
    const isAvailable = await defaultOllamaClient.isAvailable();
    if (!isAvailable) {
      return this.translateSyntax(req);
    }

    try {
      const system = `You are an expert test framework polyglot (Playwright, Cypress, Maestro YAML, Selenium, Appium).
Translate the input code from ${req.sourceSyntax} into ${req.targetSyntax}.
Output MUST be valid JSON with this schema:
{
  "translatedCode": "string with complete valid executable code in the target framework",
  "notes": ["Note 1 on translation decisions or required setup"]
}`;

      const prompt = `Source Framework: ${req.sourceSyntax}
Target Framework: ${req.targetSyntax}

Code to translate:
\`\`\`
${req.code}
\`\`\`

Translate to ${req.targetSyntax}.`;

      const result = await defaultOllamaClient.generateJson<{
        translatedCode?: string;
        notes?: string[];
      }>(prompt, { system, model: modelName });

      if (result && result.translatedCode) {
        return {
          sourceSyntax: req.sourceSyntax,
          targetSyntax: req.targetSyntax,
          translatedCode: result.translatedCode,
          notes: result.notes || [`Translated from ${req.sourceSyntax} to ${req.targetSyntax} using local AI model.`]
        };
      }
    } catch (err) {
      console.warn("[StudentTestingTutor] Local model translation failed, using heuristic fallback:", err);
    }

    return this.translateSyntax(req);
  }
}
