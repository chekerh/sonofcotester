import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { BugDraftService, HealingAnalysisService, TestGenerationService } from "@sonofcotester/ai";
import {
  applyHealingProposal,
  createExecutionRun,
  createGeneratedSuite,
  ensureSeedData,
  getExecution,
  getExecutionContext,
  getSuiteById,
  listExecutions,
  listHealingProposals,
  listProjects,
  listSuites,
  markRunStarted,
  updateRunResult,
  updateSuiteVersion
} from "@sonofcotester/data";
import type {
  ExecutionRequest,
  GeneratedSuiteResponse,
  GitHubActionsWebhookPayload,
  JiraSyncRequest,
  ProviderCapability,
  TestGenerationRequest,
  TestSuiteUpdateRequest
} from "@sonofcotester/sdk";

type ExecutionJobPayload = {
  runId: string;
  request: ExecutionRequest;
};

@Injectable()
export class AppService {
  private readonly generator = new TestGenerationService();
  private readonly healing = new HealingAnalysisService();
  private readonly bugs = new BugDraftService();
  private readonly queue = new Queue<ExecutionJobPayload>(
    "execution-jobs",
    {
      connection: new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
        maxRetriesPerRequest: null
      })
    }
  );

  async onModuleInit() {
    await ensureSeedData();
  }

  async listProjects() {
    return listProjects();
  }

  listProviderCapabilities(): ProviderCapability[] {
    const hasBrowserStackCreds = Boolean(
      process.env.BROWSERSTACK_USERNAME && process.env.BROWSERSTACK_ACCESS_KEY
    );

    return [
      {
        provider: "playwright-local",
        platform: "web",
        mode: "local",
        ready: true,
        status: "ready",
        summary: "Runs against the built-in local demo target and other reachable web apps.",
        requirements: ["Playwright browser binaries", "reachable baseUrl"]
      },
      {
        provider: "browserstack-web",
        platform: "web",
        mode: "cloud",
        ready: hasBrowserStackCreds,
        status: hasBrowserStackCreds ? "ready" : "configuration-required",
        summary: "Cloud browser execution contract is wired and awaiting BrowserStack credentials.",
        requirements: ["BROWSERSTACK_USERNAME", "BROWSERSTACK_ACCESS_KEY"]
      },
      {
        provider: "browserstack-mobile",
        platform: "mobile",
        mode: "cloud",
        ready: hasBrowserStackCreds,
        status: hasBrowserStackCreds ? "ready" : "configuration-required",
        summary: "Mobile execution is shaped around BrowserStack-style Appium cloud sessions.",
        requirements: ["BROWSERSTACK_USERNAME", "BROWSERSTACK_ACCESS_KEY", "mobile app id or build artifact"]
      },
      {
        provider: "custom-appium",
        platform: "mobile",
        mode: "custom",
        ready: false,
        status: "planned",
        summary: "Reserved for self-hosted Appium or alternative device lab integration.",
        requirements: ["Appium endpoint", "device lab capabilities", "app package reference"]
      }
    ];
  }

  async listSuites() {
    return listSuites();
  }

  async getSuite(suiteId: string) {
    return getSuiteById(suiteId);
  }

  async listExecutions() {
    return listExecutions();
  }

  async getExecution(runId: string) {
    return getExecution(runId);
  }

  async listHealingProposals() {
    return listHealingProposals();
  }

  async generateTests(projectId: string, input: TestGenerationRequest): Promise<GeneratedSuiteResponse> {
    const draft = this.generator.generate(input);
    return createGeneratedSuite(projectId, draft);
  }

  async updateSuite(suiteId: string, input: TestSuiteUpdateRequest) {
    return updateSuiteVersion(suiteId, input);
  }

  async createExecution(suiteId: string, input: ExecutionRequest) {
    const context = await getExecutionContext(input.suiteVersionId);
    const { run } = await createExecutionRun(context.projectId, suiteId, input);
    await this.queue.add(
      "run-suite",
      {
        runId: run.id,
        request: input
      },
      {
        attempts: 2,
        removeOnComplete: true,
        removeOnFail: false
      }
    );
    return run;
  }

  async applyHealing(healProposalId: string) {
    return applyHealingProposal(healProposalId);
  }

  async syncJira(input: JiraSyncRequest) {
    return {
      status: "accepted",
      importedIssues: input.issueTypes.map((issueType, index) => ({
        id: `${input.projectKey}-${index + 1}`,
        issueType
      }))
    };
  }

  async receiveGitHubActionsWebhook(payload: GitHubActionsWebhookPayload) {
    return {
      status: "received",
      workflow: payload.workflowName,
      repository: payload.repository,
      sha: payload.sha
    };
  }
}
