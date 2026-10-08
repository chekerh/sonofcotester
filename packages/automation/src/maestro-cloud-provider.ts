import { execFile } from "node:child_process";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { promisify } from "node:util";
import type {
  MaestroFlow,
  MaestroFlowResult,
  MaestroMatrixTarget,
} from "@sonofcotester/sdk";
import { flowToYaml, flowToFilename } from "./maestro-flow-generator.js";

const execFileAsync = promisify(execFile);
const uid = () => Math.random().toString(36).slice(2, 10);

// ── Types ──

export interface MaestroCloudConfig {
  /** Maestro Cloud API key (or set MAESTRO_API_KEY env var) */
  apiKey?: string;
  /** Maestro Cloud project ID */
  projectId?: string;
  /** Upload name for this run */
  uploadName?: string;
  /** Path to the app binary (.apk for Android, .app/.zip for iOS) */
  appFile?: string;
  /** Target device OS version (e.g. "android-34", "ios-18.0") */
  deviceOs?: string;
  /** Target device model (e.g. "iPhone 17 Pro", "Pixel 8") — iOS only */
  deviceModel?: string;
  /** Timeout in seconds (default: 600 = 10 min) */
  timeoutSeconds?: number;
}

export interface MaestroCloudResult {
  /** Whether all flows passed */
  passed: boolean;
  /** Exit code from maestro cloud */
  exitCode: number;
  /** Raw stdout */
  stdout: string;
  /** Raw stderr */
  stderr: string;
  /** Link to the Maestro Console for this upload */
  consoleUrl?: string;
  /** The upload name */
  uploadName: string;
  /** Per-flow results if parsed */
  flowResults: MaestroFlowResult[];
}

export interface CloudDeviceInfo {
  name: string;
  os: string;
  osVersion: string;
  type: "android" | "ios";
}

// ── MaestroCloudProvider ──

export class MaestroCloudProvider {
  /**
   * Execute flows on Maestro Cloud.
   * Writes flows to a temp directory, then runs `maestro cloud`.
   */
  async execute(
    flows: MaestroFlow[],
    config: MaestroCloudConfig
  ): Promise<MaestroCloudResult> {
    const apiKey = config.apiKey ?? process.env.MAESTRO_API_KEY;
    const projectId = config.projectId ?? process.env.MAESTRO_PROJECT_ID;

    if (!apiKey) {
      throw new Error(
        "Maestro Cloud API key is required. Set MAESTRO_API_KEY env var or pass apiKey in config."
      );
    }
    if (!projectId) {
      throw new Error(
        "Maestro Cloud project ID is required. Set MAESTRO_PROJECT_ID env var or pass projectId in config."
      );
    }

    // Create workspace directory with flows
    const workspaceDir = resolve(process.cwd(), "artifacts", `maestro-cloud-${uid()}`);
    const flowsDir = join(workspaceDir, "flows");
    await mkdir(flowsDir, { recursive: true });

    // Write each flow as a YAML file
    for (const flow of flows) {
      const filename = flowToFilename(flow);
      const yaml = flowToYaml(flow);
      await writeFile(join(flowsDir, filename), yaml, "utf-8");
    }

    // Build the maestro cloud command
    const args: string[] = [
      "cloud",
      "--api-key", apiKey,
      "--project-id", projectId,
      "--flows", flowsDir,
    ];

    if (config.uploadName) {
      args.push("--name", config.uploadName);
    }
    if (config.appFile) {
      args.push("--app-file", config.appFile);
    }
    if (config.deviceOs) {
      args.push("--device-os", config.deviceOs);
    }
    if (config.deviceModel) {
      args.push("--device-model", config.deviceModel);
    }

    const timeout = (config.timeoutSeconds ?? 600) * 1000;
    const uploadName = config.uploadName ?? `sonofcotester-${new Date().toISOString().slice(0, 19)}`;

    try {
      const { stdout, stderr } = await execFileAsync("maestro", args, {
        timeout,
        maxBuffer: 50 * 1024 * 1024, // 50MB
        env: {
          ...process.env,
          MAESTRO_API_KEY: apiKey,
        },
      });

      const consoleUrl = parseConsoleUrl(stdout);
      const passed = stdout.includes("Tests passed") || stdout.includes("Flows passed");

      return {
        passed,
        exitCode: 0,
        stdout,
        stderr,
        consoleUrl,
        uploadName,
        flowResults: flows.map((flow) => ({
          passed,
          stdout,
          stderr,
          exitCode: 0,
          flowPath: join(flowsDir, flowToFilename(flow)),
          steps: [],
        })),
      };
    } catch (error: unknown) {
      const execError = error as {
        code?: number;
        stdout?: string;
        stderr?: string;
        message?: string;
      };

      const stdout = execError.stdout ?? "";
      const stderr = execError.stderr ?? execError.message ?? "Unknown error";
      const consoleUrl = parseConsoleUrl(stdout);

      return {
        passed: false,
        exitCode: execError.code ?? 1,
        stdout,
        stderr,
        consoleUrl,
        uploadName,
        flowResults: flows.map((flow) => ({
          passed: false,
          stdout,
          stderr,
          exitCode: execError.code ?? 1,
          flowPath: join(flowsDir, flowToFilename(flow)),
          steps: [],
        })),
      };
    }
  }

  /**
   * List available cloud devices.
   */
  async listCloudDevices(): Promise<CloudDeviceInfo[]> {
    try {
      const { stdout } = await execFileAsync("maestro", ["list-cloud-devices"], {
        timeout: 30_000,
      });
      return parseCloudDevices(stdout);
    } catch {
      return [];
    }
  }

  /**
   * Check if Maestro Cloud is configured (API key + project ID available).
   */
  async checkCloudConfig(): Promise<{
    configured: boolean;
    hasApiKey: boolean;
    hasProjectId: boolean;
    hasAppFile: boolean;
  }> {
    const apiKey = process.env.MAESTRO_API_KEY;
    const projectId = process.env.MAESTRO_PROJECT_ID;
    return {
      configured: Boolean(apiKey && projectId),
      hasApiKey: Boolean(apiKey),
      hasProjectId: Boolean(projectId),
      hasAppFile: false, // Can't auto-detect this
    };
  }
}

// ── Parsers ──

function parseConsoleUrl(stdout: string): string | undefined {
  // Maestro prints a URL like:
  //   ✅ Upload completed! View results at:
  //   https://console.maestro.dev/project/xxx/uploads/yyy
  const urlMatch = stdout.match(/https:\/\/console\.maestro\.dev\/[^\s]+/);
  return urlMatch?.[0];
}

function parseCloudDevices(stdout: string): CloudDeviceInfo[] {
  const devices: CloudDeviceInfo[] = [];
  const lines = stdout.split("\n");

  for (const line of lines) {
    // Parse lines like:
    //   Pixel 8 — android — API 34
    //   iPhone 17 Pro — ios — 18.0
    const match = line.match(/^[\s]*([^\s—-]+(?:\s[^\s—-]+)*)\s*[—-]\s*(android|ios)\s*[—-]\s*(.+)$/i);
    if (match) {
      const [, name, os, osVersion] = match;
      devices.push({
        name: name.trim(),
        os: os.toLowerCase(),
        osVersion: osVersion.trim(),
        type: os.toLowerCase() as "android" | "ios",
      });
    }
  }

  return devices;
}
