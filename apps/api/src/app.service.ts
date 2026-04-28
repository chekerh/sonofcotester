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
  TestGenerationRequest,
  TestSuiteUpdateRequest
} from "@sonofcotester/sdk";

type ExecutionJobPayload = {
  runId: string;
  suiteVersionId: string;
  provider: ExecutionRequest["provider"];
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
        suiteVersionId: input.suiteVersionId,
        provider: input.provider
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
