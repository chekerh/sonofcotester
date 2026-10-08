import { Injectable, NotFoundException } from "@nestjs/common";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { BugDraftService, HealingAnalysisService, TestGenerationService } from "@sonofcotester/ai";
import { AppInspectorService } from "@sonofcotester/automation";
import {
  addTestCase,
  applyHealingProposal,
  cancelExecutionRun,
  createExecutionRun,
  createGeneratedSuite,
  createProject,
  createTestSuite,
  deleteExecutionRun,
  deleteProject,
  deleteTestCase,
  deleteTestSuite,
  ensureSeedData,
  getExecution,
  getExecutionContext,
  getProjectById,
  getSuiteById,
  listExecutions,
  listHealingProposals,
  listProjects,
  listSuites,
  markRunStarted,
  prisma,
  recordUsage,
  updateProject,
  updateRunResult,
  updateSuiteVersion,
  updateTestCase
} from "@sonofcotester/data";
import type {
  CanonicalTestCase,
  ExecutionRequest,
  GeneratedSuiteResponse,
  GitHubActionsWebhookPayload,
  JiraSyncRequest,
  PersistedSuite,
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
  private readonly inspector = new AppInspectorService();
  private queue: Queue<ExecutionJobPayload> | null = null;

  private getQueue(): Queue<ExecutionJobPayload> | null {
    if (!this.queue && process.env.REDIS_URL) {
      try {
        const r = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: null,
          enableOfflineQueue: false,
          lazyConnect: true,
          retryStrategy: () => null
        });
        r.on("error", () => {});
        this.queue = new Queue<ExecutionJobPayload>("execution-jobs", { connection: r });
      } catch {}
    }
    return this.queue;
  }

  async onModuleInit() {
    await ensureSeedData();
  }

  // ── Projects CRUD ──

  async listProjects() {
    return listProjects();
  }

  async createProject(workspaceId: string, name: string, description: string) {
    return createProject(workspaceId, name, description);
  }

  async getProject(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return project;
  }

  async updateProject(projectId: string, name?: string, description?: string) {
    return updateProject(projectId, name, description);
  }

  async deleteProject(projectId: string) {
    return deleteProject(projectId);
  }

  // ── Provider Capabilities ──

  listProviderCapabilities(): ProviderCapability[] {
    const hasBrowserStackCreds = Boolean(
      process.env.BROWSERSTACK_USERNAME && process.env.BROWSERSTACK_ACCESS_KEY
    );
    const hasMaestroCloudCreds = Boolean(
      process.env.MAESTRO_API_KEY && process.env.MAESTRO_PROJECT_ID
    );

    return [
      {
        provider: "playwright-local",
        platform: "web",
        mode: "local",
        ready: true,
        status: "ready",
        summary: "Executes canonical browser flows with Chromium, Firefox, WebKit tracing & screenshot capture.",
        requirements: ["Playwright browser binaries", "reachable target baseUrl"]
      },
      {
        provider: "maestro-local",
        platform: "mobile",
        mode: "local",
        ready: true,
        status: "ready",
        summary: "Declarative mobile UI testing for iOS and Android with auto-waiting and zero flakiness.",
        requirements: ["Maestro CLI (curl -fsSL https://get.maestro.mobile.dev | bash)", "Connected simulator or physical device"]
      },
      {
        provider: "maestro-cloud",
        platform: "mobile",
        mode: "cloud",
        ready: hasMaestroCloudCreds,
        status: hasMaestroCloudCreds ? "ready" : "configuration-required",
        summary: "Executes Maestro flows on parallel cloud device farm with video recordings and console links.",
        requirements: ["MAESTRO_API_KEY", "MAESTRO_PROJECT_ID", "App binary (.apk/.app)"]
      },
      {
        provider: "browserstack-web",
        platform: "web",
        mode: "cloud",
        ready: hasBrowserStackCreds,
        status: hasBrowserStackCreds ? "ready" : "configuration-required",
        summary: "Cloud browser matrix execution across 3000+ real browser combinations.",
        requirements: ["BROWSERSTACK_USERNAME", "BROWSERSTACK_ACCESS_KEY"]
      },
      {
        provider: "browserstack-mobile",
        platform: "mobile",
        mode: "cloud",
        ready: hasBrowserStackCreds,
        status: hasBrowserStackCreds ? "ready" : "configuration-required",
        summary: "Appium cloud sessions across real iOS & Android devices on BrowserStack.",
        requirements: ["BROWSERSTACK_USERNAME", "BROWSERSTACK_ACCESS_KEY", "BROWSERSTACK_APP_ID"]
      },
      {
        provider: "custom-appium",
        platform: "mobile",
        mode: "custom",
        ready: false,
        status: "planned",
        summary: "Self-hosted Appium grid integration for private enterprise device farms.",
        requirements: ["Appium WebDriver endpoint", "Device capability matrix"]
      }
    ];
  }

  // ── Test Suites & Cases CRUD ──

  async listSuites() {
    return listSuites();
  }

  async createSuite(projectId: string, summary: string, sourceType: string = "manual", cases: CanonicalTestCase[] = []) {
    return createTestSuite(projectId, summary, sourceType, cases);
  }

  async getSuite(suiteId: string) {
    const suite = await getSuiteById(suiteId);
    if (!suite) throw new NotFoundException(`Suite ${suiteId} not found`);
    return suite;
  }

  async updateSuite(suiteId: string, input: TestSuiteUpdateRequest) {
    return updateSuiteVersion(suiteId, input);
  }

  async deleteSuite(suiteId: string) {
    return deleteTestSuite(suiteId);
  }

  async addTestCase(suiteId: string, testCase: CanonicalTestCase) {
    const suite = await getSuiteById(suiteId);
    if (!suite || !suite.versions[0]) throw new NotFoundException(`Suite ${suiteId} not found`);
    return addTestCase(suite.versions[0].id, testCase);
  }

  async updateTestCase(caseId: string, updates: Partial<CanonicalTestCase>) {
    return updateTestCase(caseId, updates);
  }

  async deleteTestCase(caseId: string) {
    return deleteTestCase(caseId);
  }

  // ── Executions & Healing ──

  async listExecutions() {
    return listExecutions();
  }

  async getExecution(runId: string) {
    const run = await getExecution(runId);
    if (!run) throw new NotFoundException(`Execution ${runId} not found`);
    return run;
  }

  async cancelExecution(runId: string) {
    return cancelExecutionRun(runId);
  }

  async deleteExecution(runId: string) {
    return deleteExecutionRun(runId);
  }

  async listHealingProposals() {
    return listHealingProposals();
  }

  async generateTests(projectId: string, input: TestGenerationRequest & { model?: string }): Promise<GeneratedSuiteResponse> {
    const draft = await this.generator.generateWithModel(input, input.model);
    await recordUsage("ws_internal", "ai", 1).catch(() => undefined);
    return createGeneratedSuite(projectId, draft);
  }

  async createExecution(suiteId: string, input: ExecutionRequest) {
    const context = await getExecutionContext(input.suiteVersionId);
    const { run } = await createExecutionRun(context.projectId, suiteId, input);
    const queue = this.getQueue();
    if (queue) {
      try {
        await queue.add(
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
      } catch {}
    }
    return run;
  }

  async applyHealing(healProposalId: string) {
    return applyHealingProposal(healProposalId);
  }

  async rejectHealing(healProposalId: string) {
    await prisma.healingProposal.update({
      where: { id: healProposalId },
      data: { status: "rejected" }
    });
    return { id: healProposalId, status: "rejected" };
  }

  // ── Integrations ──

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

  async crawlTargetApp(url: string) {
    return this.inspector.inspect(url);
  }
}
