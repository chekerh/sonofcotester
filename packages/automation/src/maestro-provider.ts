import { execFile, spawn } from "node:child_process";
import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { promisify } from "node:util";
import type {
  CanonicalTestCase,
  ExecutionArtifact,
  ExecutionRequest,
  ExecutionRun,
  MaestroFlow,
  MaestroMatrixTarget,
  MaestroFlowResult,
  MaestroStepResult,
  ProviderName,
  RunStatus,
  StepEvent,
} from "@sonofcotester/sdk";
import {
  generateMaestroFlows,
  flowToYaml,
  flowToFilename,
  testCaseToFlow,
} from "./maestro-flow-generator.js";

const execFileAsync = promisify(execFile);
const uid = () => Math.random().toString(36).slice(2, 10);

// ── Types ──

interface ExecutionContext {
  projectId: string;
  suiteId: string;
  testCases: CanonicalTestCase[];
}

// ── Base ──

function makeArtifact(
  type: ExecutionArtifact["type"],
  label: string,
  url: string
): ExecutionArtifact {
  return { id: uid(), type, label, url, createdAt: new Date().toISOString() };
}

function makeStepEvent(
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
    createdAt: new Date().toISOString(),
  };
}

function getAugmentedEnv(): NodeJS.ProcessEnv {
  const home = process.env.HOME || "/Users/mac";
  const extraPaths = [`${home}/.local/bin`, "/opt/homebrew/bin", "/usr/local/bin"];
  const currentPath = process.env.PATH || "";
  return {
    ...process.env,
    PATH: `${extraPaths.join(":")}:${currentPath}`,
  };
}

// ── Maestro CLI detection ──

interface MaestroInfo {
  installed: boolean;
  version?: string;
  binPath?: string;
}

async function detectMaestro(): Promise<MaestroInfo> {
  const env = getAugmentedEnv();
  try {
    const { stdout } = await execFileAsync("maestro", ["--version"], {
      timeout: 10_000,
      env,
    });
    const version = stdout.trim().replace(/^maestro\s+version\s*/i, "").trim();
    const { stdout: whichOut } = await execFileAsync("which", ["maestro"], {
      timeout: 5_000,
      env,
    }).catch(() => ({ stdout: "/Users/mac/.local/bin/maestro" }));
    return {
      installed: true,
      version: version || undefined,
      binPath: whichOut.trim() || "/Users/mac/.local/bin/maestro",
    };
  } catch {
    return { installed: false };
  }
}

async function listConnectedDevices(): Promise<string[]> {
  const env = getAugmentedEnv();
  try {
    // Try modern Maestro 2.9+ "list-devices", fall back to legacy "devices"
    let stdout = "";
    try {
      const res = await execFileAsync("maestro", ["list-devices"], {
        timeout: 15_000,
        env,
      });
      stdout = res.stdout;
    } catch {
      const res = await execFileAsync("maestro", ["devices"], {
        timeout: 15_000,
        env,
      });
      stdout = res.stdout;
    }

    const devices: string[] = [];
    const lines = stdout.split("\n");
    let currentCategory = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("Showing") || trimmed.includes("───") || trimmed.startsWith("Local Devices")) {
        continue;
      }
      if (trimmed === "iOS" || trimmed === "Android" || trimmed === "Web") {
        currentCategory = trimmed;
        continue;
      }
      // If line is indented device name like "  iPhone-17-Pro    iOS-26-2"
      if (line.startsWith("  ") && trimmed) {
        const parts = trimmed.split(/\s{2,}/);
        const devName = parts[0];
        if (devName) {
          devices.push(currentCategory ? `${devName} (${currentCategory})` : devName);
        }
      } else if (line.includes("─")) {
        const parts = line.split("─").map((s) => s.trim()).filter(Boolean);
        if (parts[0]) devices.push(parts[0]);
      }
    }

    return devices;
  } catch {
    return [];
  }
}

// ── Parse maestro test output ──

function parseMaestroOutput(stdout: string, stderr: string): {
  passed: boolean;
  steps: MaestroStepResult[];
} {
  const steps: MaestroStepResult[] = [];
  const lines = stdout.split("\n");

  for (const line of lines) {
    // Maestro outputs lines like:
    //   ✅ tapOn "Login"
    //   ❌ assertVisible "Welcome"
    //   ⏳ inputText "test"
    const match = line.match(/^([✅❌⏳⚠️])\s+(.+)$/);
    if (match) {
      const [, icon, description] = match;
      steps.push({
        command: description,
        passed: icon === "✅",
        error: icon === "❌" ? description : undefined,
      });
    }
  }

  // Check for overall pass/fail
  const passed =
    stdout.includes("Tests passed") ||
    stdout.includes("Flow passed") ||
    (steps.length > 0 && steps.every((s) => s.passed));

  return { passed, steps };
}

// ── MaestroLocalProvider ──

export class MaestroLocalProvider {
  readonly name = "maestro-local" as const;

  /**
   * Execute a set of Maestro flows against a local device/emulator.
   */
  async executeFlows(
    flows: MaestroFlow[],
    opts?: {
      environment?: string;
      target?: MaestroMatrixTarget;
      timeoutSeconds?: number;
      artifactDir?: string;
    }
  ): Promise<MaestroFlowResult[]> {
    const info = await detectMaestro();
    if (!info.installed) {
      throw new Error(
        "Maestro CLI is not installed. Run: curl -fsSL \"https://get.maestro.mobile.dev\" | bash"
      );
    }

    const results: MaestroFlowResult[] = [];
    const baseDir =
      opts?.artifactDir ?? resolve(process.cwd(), "artifacts", `maestro-${uid()}`);
    await mkdir(baseDir, { recursive: true });

    for (const flow of flows) {
      const result = await this.executeSingleFlow(flow, baseDir, {
        environment: opts?.environment,
        target: opts?.target,
        timeoutSeconds: opts?.timeoutSeconds ?? 300,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Execute a single Maestro flow.
   */
  private async executeSingleFlow(
    flow: MaestroFlow,
    baseDir: string,
    opts: {
      environment?: string;
      target?: MaestroMatrixTarget;
      timeoutSeconds: number;
    }
  ): Promise<MaestroFlowResult> {
    const yaml = flowToYaml(flow);
    const filename = flowToFilename(flow);
    const flowDir = join(baseDir, filename.replace(".yaml", ""));
    await mkdir(flowDir, { recursive: true });

    const flowPath = join(flowDir, filename);
    await writeFile(flowPath, yaml, "utf-8");

    const screenshotsDir = join(flowDir, "screenshots");
    const recordingDir = join(flowDir, "recording");
    await mkdir(screenshotsDir, { recursive: true });
    await mkdir(recordingDir, { recursive: true });

    // Build maestro test command args
    const args: string[] = ["test", flowPath];

    // Add --include-tags if flow has tags
    if (flow.tags && flow.tags.length > 0) {
      args.push("--include-tags", flow.tags.join(","));
    }

    // Add env vars
    if (flow.env) {
      for (const [key, value] of Object.entries(flow.env)) {
        args.push("--env", `${key}=${value}`);
      }
    }

    // Run the flow
    try {
      const { stdout, stderr } = await execFileAsync("maestro", args, {
        timeout: opts.timeoutSeconds * 1000,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        env: {
          ...getAugmentedEnv(),
          ...(opts.environment ? { MAESTRO_ENV: opts.environment } : {}),
        },
      });

      const { passed, steps } = parseMaestroOutput(stdout, stderr);

      // Collect screenshots from the flow directory
      const screenshots = await readdir(screenshotsDir).catch(() => []);
      const videos = await readdir(recordingDir).catch(() => []);

      return {
        passed,
        stdout,
        stderr,
        exitCode: 0,
        flowPath,
        screenshotsDir: screenshots.length > 0 ? screenshotsDir : undefined,
        recordingPath:
          videos.length > 0 ? join(recordingDir, videos[0]) : undefined,
        steps,
      };
    } catch (error: unknown) {
      const execError = error as {
        code?: number;
        stdout?: string;
        stderr?: string;
        message?: string;
      };

      // Parse whatever output we got
      const stdout = execError.stdout ?? "";
      const stderr = execError.stderr ?? execError.message ?? "Unknown error";
      const { steps } = parseMaestroOutput(stdout, stderr);

      return {
        passed: false,
        stdout,
        stderr,
        exitCode: execError.code ?? 1,
        flowPath,
        steps,
      };
    }
  }

  /**
   * Execute canonical test cases by converting them to Maestro flows first.
   */
  async execute(
    request: ExecutionRequest,
    context: ExecutionContext
  ): Promise<ExecutionRun> {
    const startedAt = new Date().toISOString();

    const run: ExecutionRun = {
      id: uid(),
      suiteId: context.suiteId,
      suiteVersionId: request.suiteVersionId,
      provider: this.name as ProviderName,
      environment: request.environment,
      status: "running",
      startedAt,
      matrix: request.matrix,
      artifacts: [],
      stepEvents: [],
      healingProposals: [],
      bugDrafts: [],
    };

    const target = request.matrix[0] as MaestroMatrixTarget | undefined;
    const appId = target?.appId ?? "com.example.app";

    // Convert test cases to Maestro flows
    const flows = context.testCases.map((tc) =>
      testCaseToFlow(tc, appId, {
        env: { PROJECT_ID: context.projectId },
      })
    );

    const baseDir = resolve(process.cwd(), "artifacts", run.id);
    await mkdir(baseDir, { recursive: true });

    // Execute all flows
    const results = await this.executeFlows(flows, {
      environment: request.environment,
      target,
      artifactDir: baseDir,
    });

    // Map results back to ExecutionRun
    let allPassed = true;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const testCase = context.testCases[i];

      if (!testCase) continue;

      if (!result.passed) {
        allPassed = false;
      }

      // Create step events for each parsed step
      if (result.steps) {
        for (const step of result.steps) {
          run.stepEvents.push(
            makeStepEvent(
              testCase.id,
              uid(),
              step.passed ? "passed" : "failed",
              step.command
            )
          );
        }
      } else {
        // Fallback: one step event per test case
        run.stepEvents.push(
          makeStepEvent(
            testCase.id,
            uid(),
            result.passed ? "passed" : "failed",
            result.passed
              ? "Maestro flow passed"
              : `Maestro flow failed: ${result.stderr.slice(0, 200)}`
          )
        );
      }

      // Collect artifacts
      run.artifacts.push(
        makeArtifact("log", `maestro-${testCase.id}-stdout`, result.flowPath)
      );
      if (result.screenshotsDir) {
        run.artifacts.push(
          makeArtifact("screenshot", `${testCase.id}-screenshots`, result.screenshotsDir)
        );
      }
      if (result.recordingPath) {
        run.artifacts.push(
          makeArtifact("video", `${testCase.id}-recording`, result.recordingPath)
        );
      }
    }

    // Write the YAML flows as artifacts
    for (let i = 0; i < flows.length; i++) {
      const flowPath = resolve(baseDir, flowToFilename(flows[i]));
      await writeFile(flowPath, flowToYaml(flows[i]), "utf-8");
      run.artifacts.push(
        makeArtifact("log", `flow-${i + 1}`, flowPath)
      );
    }

    run.status = allPassed ? "passed" : "failed";
    run.finishedAt = new Date().toISOString();

    if (!allPassed) {
      const failedFlows = results.filter((r) => !r.passed);
      run.errorMessage = `${failedFlows.length} of ${results.length} Maestro flow(s) failed`;
    }

    // Add execution metadata
    run.executionMetadata = {
      provider: "maestro-local",
      flowCount: flows.length,
      passedCount: results.filter((r) => r.passed).length,
      failedCount: results.filter((r) => !r.passed).length,
      appId,
    };

    return run;
  }
}

// ── Utility: check if Maestro is available ──

export async function getMaestroStatus(): Promise<{
  installed: boolean;
  version?: string;
  devices: string[];
  ready: boolean;
}> {
  const info = await detectMaestro();
  const devices = info.installed ? await listConnectedDevices() : [];
  return {
    installed: info.installed,
    version: info.version,
    devices,
    ready: info.installed && devices.length > 0,
  };
}
