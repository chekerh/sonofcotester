import { Body, Controller, Get, Post } from "@nestjs/common";
import type {
  MaestroGenerateRequest,
  MaestroExecuteRequest,
  MaestroFlow,
  MaestroFlowResult,
  MaestroSpecGenerateRequest,
  CanonicalTestCase,
} from "@sonofcotester/sdk";
import {
  generateMaestroFlows,
  flowToYaml,
  flowToFilename,
  MaestroLocalProvider,
  MaestroCloudProvider,
  getMaestroStatus,
} from "@sonofcotester/automation";
import type { MaestroCloudConfig } from "@sonofcotester/automation";
import { MaestroGenerationService } from "@sonofcotester/ai";

@Controller("health/maestro")
export class MaestroController {
  private readonly localProvider = new MaestroLocalProvider();
  private readonly cloudProvider = new MaestroCloudProvider();
  private readonly generationService = new MaestroGenerationService();

  /**
   * GET /health/maestro/status
   * Check if Maestro CLI is installed and devices are connected.
   */
  @Get("status")
  async getStatus() {
    return getMaestroStatus();
  }

  /**
   * POST /health/maestro/generate
   * Convert canonical test cases into Maestro YAML flows.
   */
  @Post("generate")
  async generateFlows(@Body() body: MaestroGenerateRequest) {
    const flows = generateMaestroFlows(body);
    const yamlFiles = flows.map((flow) => ({
      filename: flowToFilename(flow),
      yaml: flowToYaml(flow),
      flow,
    }));
    return {
      count: yamlFiles.length,
      flows: yamlFiles,
    };
  }

  /**
   * POST /health/maestro/preview
   * Preview the YAML for a single flow without generating all.
   */
  @Post("preview")
  async previewFlow(@Body() body: { testCase: CanonicalTestCase; appId: string; env?: Record<string, string> }) {
    const flow = generateMaestroFlows({
      cases: [body.testCase],
      appId: body.appId,
      env: body.env,
    })[0];
    return {
      filename: flowToFilename(flow),
      yaml: flowToYaml(flow),
      flow,
    };
  }

  /**
   * POST /health/maestro/generate-from-spec
   * AI-powered: parse a Jira ticket, user story, or spec doc and generate Maestro flows.
   */
  @Post("generate-from-spec")
  async generateFromSpec(@Body() body: MaestroSpecGenerateRequest) {
    const result = this.generationService.generate(body);
    return result;
  }

  /**
   * POST /health/maestro/execute
   * Execute Maestro flows against a local device/emulator.
   */
  @Post("execute")
  async executeFlows(@Body() body: MaestroExecuteRequest) {
    const results = await this.localProvider.executeFlows(body.flows, {
      environment: body.environment,
      target: body.target,
      timeoutSeconds: body.timeoutSeconds,
    });
    return {
      totalFlows: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      results,
    };
  }

  // ── Maestro Cloud Endpoints ──

  /**
   * GET /health/maestro/cloud/status
   * Check if Maestro Cloud is configured (API key + project ID).
   */
  @Get("cloud/status")
  async getCloudStatus() {
    const config = await this.cloudProvider.checkCloudConfig();
    return config;
  }

  /**
   * GET /health/maestro/cloud/devices
   * List available Maestro Cloud device models.
   */
  @Get("cloud/devices")
  async listCloudDevices() {
    const devices = await this.cloudProvider.listCloudDevices();
    return { devices, count: devices.length };
  }

  /**
   * POST /health/maestro/cloud/execute
   * Execute Maestro flows on the Maestro Cloud device farm.
   */
  @Post("cloud/execute")
  async executeOnCloud(@Body() body: { flows: import("@sonofcotester/sdk").MaestroFlow[]; config: MaestroCloudConfig }) {
    const result = await this.cloudProvider.execute(body.flows, body.config);
    return result;
  }

  /**
   * POST /health/maestro/cloud/generate-and-execute
   * One-shot: AI-generate flows from spec, then execute on cloud.
   */
  @Post("cloud/generate-and-execute")
  async generateAndExecuteOnCloud(
    @Body() body: {
      spec: import("@sonofcotester/sdk").MaestroSpecGenerateRequest;
      cloudConfig: MaestroCloudConfig;
    }
  ) {
    // Step 1: AI-generate flows from the spec
    const genResult = this.generationService.generate(body.spec);

    // Step 2: Execute on cloud
    const cloudResult = await this.cloudProvider.execute(genResult.flows, body.cloudConfig);

    return {
      generation: {
        summary: genResult.summary,
        confidence: genResult.confidence,
        testCases: genResult.testCases,
        notes: genResult.notes,
      },
      execution: cloudResult,
    };
  }
}
