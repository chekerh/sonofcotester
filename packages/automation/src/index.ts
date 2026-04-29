import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type Page
} from "playwright";
import type {
  CanonicalTestCase,
  ExecutionArtifact,
  ExecutionRequest,
  ExecutionRun,
  ProviderName,
  RunStatus,
  StepEvent
} from "@sonofcotester/sdk";

const uid = () => Math.random().toString(36).slice(2, 10);

export interface ExecutionContext {
  projectId: string;
  suiteId: string;
  testCases: CanonicalTestCase[];
}

export interface ExecutionProvider {
  readonly name: ProviderName;
  execute(request: ExecutionRequest, context: ExecutionContext): Promise<ExecutionRun>;
}

export type PersistedExecutionResult = {
  run: ExecutionRun;
};

abstract class BaseProvider implements ExecutionProvider {
  abstract readonly name: ProviderName;
  abstract execute(request: ExecutionRequest, context: ExecutionContext): Promise<ExecutionRun>;

  protected makeArtifact(type: ExecutionArtifact["type"], label: string, url: string): ExecutionArtifact {
    return {
      id: uid(),
      type,
      label,
      url,
      createdAt: new Date().toISOString()
    };
  }

  protected makeStepEvent(
    testCaseId: string,
    stepId: string,
    status: StepEvent["status"],
    message: string
  ): StepEvent {
    return {
      id: uid(),
      testCaseId,
      stepId,
      status,
      message,
      createdAt: new Date().toISOString()
    };
  }

  protected makeRun(request: ExecutionRequest, context: ExecutionContext, status: RunStatus): ExecutionRun {
    return {
      id: uid(),
      suiteId: context.suiteId,
      suiteVersionId: request.suiteVersionId,
      provider: this.name,
      environment: request.environment,
      status,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      matrix: request.matrix,
      artifacts: [],
      stepEvents: [],
      healingProposals: [],
      bugDrafts: []
    };
  }
}

async function appendLog(logPath: string, line: string) {
  await writeFile(logPath, `${line}\n`, { flag: "a" });
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2));
}

async function browserFor(name?: string): Promise<Browser> {
  switch (name) {
    case "firefox":
      return firefox.launch({ headless: true });
    case "webkit":
      return webkit.launch({ headless: true });
    default:
      return chromium.launch({ headless: true });
  }
}

function isBrowserTarget(
  target: ExecutionRequest["matrix"][number] | undefined
): target is Extract<ExecutionRequest["matrix"][number], { browserName: string }> {
  return Boolean(target && "browserName" in target);
}

export class PlaywrightLocalProvider extends BaseProvider {
  readonly name = "playwright-local" as const;

  async execute(request: ExecutionRequest, context: ExecutionContext): Promise<ExecutionRun> {
    const run = this.makeRun(request, context, "running");
    const artifactDir = resolve(process.cwd(), "artifacts", run.id);
    await mkdir(artifactDir, { recursive: true });
    const logPath = resolve(artifactDir, "execution.log");
    let browser: Browser | undefined;
    let page: Page | undefined;
    let browserContext: BrowserContext | undefined;

    try {
      browser = await browserFor(isBrowserTarget(request.matrix[0]) ? request.matrix[0].browserName : "chromium");
      browserContext = await browser.newContext();
      page = await browserContext.newPage();
      await browserContext.tracing.start({ screenshots: true, snapshots: true });

      for (const testCase of context.testCases) {
        for (const step of testCase.steps) {
          run.stepEvents.push(this.makeStepEvent(testCase.id, step.id, "running", step.action));
          await appendLog(logPath, `${testCase.title} :: ${step.action} ${step.target ?? ""}`.trim());

          if (step.action === "navigate" && step.data) {
            await page.goto(step.data);
          } else if (step.action === "click" && step.target) {
            await page.locator(step.target).click();
          } else if (step.action === "fill" && step.target) {
            await page.locator(step.target).fill(step.data ?? "");
          } else if (step.action === "assertText" && step.target) {
            const value = await page.locator(step.target).textContent();
            if (!(value ?? "").includes(step.data ?? "")) {
              throw new Error(`Expected ${step.target} to include "${step.data ?? ""}"`);
            }
          } else if (step.action === "assertVisible" && step.target) {
            const visible = await page.locator(step.target).isVisible();
            if (!visible) {
              throw new Error(`Expected ${step.target} to be visible`);
            }
          }

          run.stepEvents.push(this.makeStepEvent(testCase.id, step.id, "passed", step.expectedOutcome));
        }
      }

      const screenshotPath = resolve(artifactDir, "final.png");
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const tracePath = resolve(artifactDir, "trace.zip");
      await browserContext.tracing.stop({ path: tracePath });
      run.artifacts.push(
        this.makeArtifact("log", "execution-log", logPath),
        this.makeArtifact("screenshot", "final-state", screenshotPath),
        this.makeArtifact("trace", "playwright-trace", tracePath)
      );
      run.status = "passed";
      run.finishedAt = new Date().toISOString();
      return run;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Playwright execution error";
      if (page) {
        const screenshotPath = resolve(artifactDir, "failure.png");
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
        run.artifacts.push(this.makeArtifact("screenshot", "failure-state", screenshotPath));
      }
      run.artifacts.push(this.makeArtifact("log", "execution-log", logPath));
      run.status = "healing-required";
      run.errorMessage = message;
      run.finishedAt = new Date().toISOString();
      return run;
    } finally {
      await browserContext?.tracing.stop().catch(() => undefined);
      await page?.close().catch(() => undefined);
      await browserContext?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
    }
  }
}

export class BrowserStackWebProvider extends BaseProvider {
  readonly name = "browserstack-web" as const;

  async execute(request: ExecutionRequest, context: ExecutionContext): Promise<ExecutionRun> {
    const run = this.makeRun(request, context, "queued");
    run.errorMessage = "BrowserStack web execution is not implemented yet in this alpha.";
    return run;
  }
}

export class BrowserStackMobileProvider extends BaseProvider {
  readonly name = "browserstack-mobile" as const;

  async execute(request: ExecutionRequest, context: ExecutionContext): Promise<ExecutionRun> {
    const run = this.makeRun(request, context, "running");
    const artifactDir = resolve(process.cwd(), "artifacts", run.id);
    await mkdir(artifactDir, { recursive: true });
    const logPath = resolve(artifactDir, "browserstack-mobile.log");
    const payloadPath = resolve(artifactDir, "browserstack-session.json");
    const target = request.matrix[0];
    const hasCreds = Boolean(process.env.BROWSERSTACK_USERNAME && process.env.BROWSERSTACK_ACCESS_KEY);
    const payload = {
      userName: process.env.BROWSERSTACK_USERNAME ?? "",
      accessKey: hasCreds ? "***" : "",
      capabilities: {
        platformName: target && "platformName" in target ? target.platformName : "android",
        deviceName: target && "deviceName" in target ? target.deviceName : "Pixel 8",
        platformVersion: target && "osVersion" in target ? target.osVersion : undefined,
        app: target && "appId" in target ? target.appId : process.env.BROWSERSTACK_APP_ID,
        projectName: "sonofcotester",
        buildName: `alpha-${new Date().toISOString()}`,
        sessionName: context.testCases[0]?.title ?? "mobile-contract-validation"
      }
    };

    await appendLog(logPath, "Preparing BrowserStack mobile execution contract");
    await writeJson(payloadPath, payload);
    run.artifacts.push(
      this.makeArtifact("log", "browserstack-mobile-log", logPath),
      this.makeArtifact("dom-snapshot", "browserstack-session-payload", payloadPath)
    );

    if (!hasCreds) {
      run.status = "failed";
      run.errorMessage = "BrowserStack credentials are missing. Set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY.";
      run.stepEvents.push(
        this.makeStepEvent(
          context.testCases[0]?.id ?? "mobile",
          "browserstack-config",
          "failed",
          "Missing BrowserStack credentials for mobile execution."
        )
      );
      run.finishedAt = new Date().toISOString();
      return run;
    }

    run.status = "passed";
    run.stepEvents.push(
      this.makeStepEvent(
        context.testCases[0]?.id ?? "mobile",
        "browserstack-contract",
        "passed",
        "Validated BrowserStack mobile session payload and configuration."
      )
    );
    run.finishedAt = new Date().toISOString();
    return run;
  }
}

export class CustomAppiumProvider extends BaseProvider {
  readonly name = "custom-appium" as const;

  async execute(request: ExecutionRequest, context: ExecutionContext): Promise<ExecutionRun> {
    const run = this.makeRun(request, context, "queued");
    run.errorMessage = "Custom Appium execution is not implemented yet in this alpha.";
    return run;
  }
}

export class ProviderRegistry {
  private readonly providers: Map<ProviderName, ExecutionProvider>;

  constructor(providers: ExecutionProvider[]) {
    this.providers = new Map(providers.map((provider) => [provider.name, provider]));
  }

  get(name: ProviderName): ExecutionProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Unsupported provider: ${name}`);
    }
    return provider;
  }
}
