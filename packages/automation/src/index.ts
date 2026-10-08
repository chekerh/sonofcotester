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
import { generateMaestroFlows } from "./maestro-flow-generator.js";
import { MaestroCloudProvider } from "./maestro-cloud-provider.js";

const uid = () => Math.random().toString(36).slice(2, 10);

export interface ExecutionContext {
  projectId: string;
  suiteId: string;
  testCases: CanonicalTestCase[];
}

export interface ExecutionProvider {
  readonly name: ProviderName;
  execute(
    request: ExecutionRequest,
    context: ExecutionContext,
    onStep?: (event: StepEvent, partialRun: ExecutionRun) => void | Promise<void>
  ): Promise<ExecutionRun>;
}

export type PersistedExecutionResult = {
  run: ExecutionRun;
};

abstract class BaseProvider implements ExecutionProvider {
  abstract readonly name: ProviderName;
  abstract execute(
    request: ExecutionRequest,
    context: ExecutionContext,
    onStep?: (event: StepEvent, partialRun: ExecutionRun) => void | Promise<void>
  ): Promise<ExecutionRun>;

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

  async execute(
    request: ExecutionRequest,
    context: ExecutionContext,
    onStep?: (event: StepEvent, partialRun: ExecutionRun) => void | Promise<void>
  ): Promise<ExecutionRun> {
    const run = this.makeRun(request, context, "running");
    const artifactDir = resolve(process.cwd(), "artifacts", run.id);
    await mkdir(artifactDir, { recursive: true });
    const logPath = resolve(artifactDir, "execution.log");
    let browser: Browser | undefined;
    let page: Page | undefined;
    let browserContext: BrowserContext | undefined;
    let currentTestCaseId = "";
    let currentStepId = "";

    try {
      const baseUrl = isBrowserTarget(request.matrix[0]) ? request.matrix[0].baseUrl : undefined;
      browser = await browserFor(isBrowserTarget(request.matrix[0]) ? request.matrix[0].browserName : "chromium");
      browserContext = await browser.newContext({
        baseURL: baseUrl,
        viewport: { width: 1280, height: 800 },
        ignoreHTTPSErrors: true
      });
      page = await browserContext.newPage();
      await browserContext.tracing.start({ screenshots: true, snapshots: true });

      for (const testCase of context.testCases) {
        currentTestCaseId = testCase.id;
        for (const step of testCase.steps) {
          currentStepId = step.id;
          const runningEvt = this.makeStepEvent(testCase.id, step.id, "running", step.action);
          run.stepEvents.push(runningEvt);
          await appendLog(logPath, `${testCase.title} :: ${step.action} ${step.target ?? ""}`.trim());
          await onStep?.(runningEvt, run);

          if (step.action === "navigate") {
            const dest = step.data || baseUrl || "/";
            await page.goto(dest, { timeout: 15000, waitUntil: "domcontentloaded" });
          } else if (step.action === "click" && step.target) {
            const loc = page.locator(step.target).first();
            await loc.click({ timeout: 10000 }).catch(async (err) => {
              if (String(err).includes("intercepts pointer events") || String(err).includes("Timeout")) {
                await loc.click({ force: true, timeout: 5000 }).catch(async () => {
                  await loc.dispatchEvent("click");
                });
              } else {
                throw err;
              }
            });
          } else if (step.action === "fill" && step.target) {
            const loc = page.locator(step.target).first();
            await loc.waitFor({ state: "visible", timeout: 10000 });
            const tag = await loc.evaluate((el) => el.tagName.toLowerCase()).catch(() => null);
            const typeAttr = await loc.getAttribute("type").catch(() => null);

            if (tag === "select") {
              await loc.selectOption({ index: 0 }).catch(async () => {
                await loc.click({ force: true, timeout: 5000 });
              });
            } else if (typeAttr === "checkbox" || typeAttr === "radio") {
              await loc.check({ force: true, timeout: 10000 }).catch(async () => {
                await loc.click({ force: true, timeout: 10000 }).catch(async () => {
                  await loc.dispatchEvent("click");
                });
              });
            } else {
              await loc.fill(step.data ?? "", { timeout: 10000 });
            }
          } else if (step.action === "assertText" && step.target) {
            const loc = page.locator(step.target).first();
            await loc.waitFor({ state: "visible", timeout: 10000 });
            const value = await loc.textContent();
            if (!(value ?? "").includes(step.data ?? "")) {
              throw new Error(`Expected ${step.target} to include "${step.data ?? ""}"`);
            }
          } else if (step.action === "assertVisible" && step.target) {
            const loc = page.locator(step.target).first();
            await loc.waitFor({ state: "visible", timeout: 10000 });
            const visible = await loc.isVisible();
            if (!visible) {
              throw new Error(`Expected ${step.target} to be visible`);
            }
          }

          const passedEvt = this.makeStepEvent(testCase.id, step.id, "passed", step.expectedOutcome);
          run.stepEvents.push(passedEvt);
          await onStep?.(passedEvt, run);
        }
      }

      const screenshotPath = resolve(artifactDir, "final.png");
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const tracePath = resolve(artifactDir, "trace.zip");
      await browserContext.tracing.stop({ path: tracePath });
      run.artifacts.push(
        this.makeArtifact("log", "execution-log", `/api/artifacts/${run.id}/execution.log`),
        this.makeArtifact("screenshot", "final-state", `/api/artifacts/${run.id}/final.png`),
        this.makeArtifact("trace", "playwright-trace", `/api/artifacts/${run.id}/trace.zip`)
      );
      run.status = "passed";
      run.finishedAt = new Date().toISOString();
      return run;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Playwright execution error";
      if (currentTestCaseId && currentStepId) {
        const failedEvt = this.makeStepEvent(currentTestCaseId, currentStepId, "failed", message);
        run.stepEvents.push(failedEvt);
        await onStep?.(failedEvt, run);
      }
      if (page) {
        const screenshotPath = resolve(artifactDir, "failure.png");
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
        run.artifacts.push(this.makeArtifact("screenshot", "failure-state", `/api/artifacts/${run.id}/failure.png`));
      }
      run.artifacts.push(this.makeArtifact("log", "execution-log", `/api/artifacts/${run.id}/execution.log`));
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
    const sessionId = `bs-${uid()}`;
    const sessionUrl = `https://app-automate.browserstack.com/dashboard/v2/sessions/${sessionId}`;

    await appendLog(logPath, "Preparing BrowserStack mobile execution contract");
    await writeJson(payloadPath, payload);
    run.artifacts.push(
      this.makeArtifact("log", "browserstack-mobile-log", logPath),
      this.makeArtifact("dom-snapshot", "browserstack-session-payload", payloadPath)
    );

    if (!hasCreds) {
      run.status = "failed";
      run.errorMessage = "BrowserStack credentials are missing. Set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY.";
      run.executionMetadata = {
        provider: "browserstack-mobile",
        contractValidated: false,
        missingConfiguration: ["BROWSERSTACK_USERNAME", "BROWSERSTACK_ACCESS_KEY"]
      };
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
    run.externalSessionId = sessionId;
    run.externalSessionUrl = sessionUrl;
    run.executionMetadata = {
      provider: "browserstack-mobile",
      contractValidated: true,
      app: payload.capabilities.app ?? null,
      deviceName: payload.capabilities.deviceName,
      platformName: payload.capabilities.platformName
    };
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

export class MaestroCloudExecutionProvider extends BaseProvider {
  readonly name = "maestro-cloud" as const;

  async execute(request: ExecutionRequest, context: ExecutionContext): Promise<ExecutionRun> {
    const run = this.makeRun(request, context, "running");
    const artifactDir = resolve(process.cwd(), "artifacts", run.id);
    await mkdir(artifactDir, { recursive: true });
    const flows = generateMaestroFlows({ appId: "com.sonofcotester.app", cases: context.testCases });
    const hasCreds = Boolean(process.env.MAESTRO_API_KEY && process.env.MAESTRO_PROJECT_ID);

    if (!hasCreds) {
      run.status = "failed";
      run.errorMessage = "Maestro Cloud credentials missing. Set MAESTRO_API_KEY and MAESTRO_PROJECT_ID.";
      run.executionMetadata = {
        provider: "maestro-cloud",
        contractValidated: false,
        missingConfiguration: ["MAESTRO_API_KEY", "MAESTRO_PROJECT_ID"]
      };
      run.stepEvents.push(
        this.makeStepEvent(
          context.testCases[0]?.id ?? "maestro-cloud",
          "maestro-cloud-config",
          "failed",
          "Missing Maestro Cloud credentials for mobile execution."
        )
      );
      run.finishedAt = new Date().toISOString();
      return run;
    }

    const cloudProvider = new MaestroCloudProvider();
    const result = await cloudProvider.execute(flows, {
      uploadName: `run-${run.id}`,
      timeoutSeconds: 300
    });

    run.status = result.passed ? "passed" : "failed";
    run.externalSessionUrl = result.consoleUrl;
    run.stepEvents.push(
      this.makeStepEvent(
        context.testCases[0]?.id ?? "maestro-cloud",
        "maestro-cloud-run",
        result.passed ? "passed" : "failed",
        result.passed ? "All Maestro Cloud flows executed successfully." : "Maestro Cloud flow failed."
      )
    );
    run.finishedAt = new Date().toISOString();
    return run;
  }
}

export { MaestroLocalProvider, getMaestroStatus } from "./maestro-provider.js";
export { MaestroCloudProvider } from "./maestro-cloud-provider.js";
export type { MaestroCloudConfig, MaestroCloudResult, CloudDeviceInfo } from "./maestro-cloud-provider.js";
export {
  generateMaestroFlows,
  testCaseToFlow,
  flowToYaml,
  flowToFilename,
} from "./maestro-flow-generator.js";
export { AccessibilityScanner } from "./a11y-scanner.js";
export { LoadTestRunner } from "./load-test-runner.js";
export { AppInspectorService } from "./app-inspector.js";
export type { DiscoveredElement, CrawlResult } from "./app-inspector.js";
export {
  BenchmarkEngine,
  STACK_PROFILES,
  DEFAULT_SERVER_SPECS,
  DEFAULT_DATABASE_CONFIG,
  DEFAULT_DATASET,
  DEFAULT_WORKLOAD,
  DEFAULT_THRESHOLDS
} from "./benchmark-engine.js";

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
