import { Injectable } from "@nestjs/common";
import {
  BugDraftService,
  HealingAnalysisService,
  TestGenerationService
} from "@sonofcotester/ai";
import {
  BrowserStackMobileProvider,
  BrowserStackWebProvider,
  CustomAppiumProvider,
  PlaywrightLocalProvider,
  ProviderRegistry
} from "@sonofcotester/automation";
import type {
  ExecutionRequest,
  ExecutionRun,
  GeneratedTestSuiteDraft,
  GitHubActionsWebhookPayload,
  HealingProposal,
  JiraSyncRequest,
  ProjectSummary,
  TestGenerationRequest
} from "@sonofcotester/sdk";
import { uid } from "./lib/ids.js";
import { DevStore, type StoredSuite } from "./store/dev-store.js";

@Injectable()
export class AppService {
  private readonly generator = new TestGenerationService();
  private readonly healing = new HealingAnalysisService();
  private readonly bugDrafts = new BugDraftService();
  private readonly providers = new ProviderRegistry([
    new PlaywrightLocalProvider(),
    new BrowserStackWebProvider(),
    new BrowserStackMobileProvider(),
    new CustomAppiumProvider()
  ]);
  private readonly store = new DevStore();

  async listProjects(): Promise<ProjectSummary[]> {
    const state = await this.store.read();
    return state.projects.map((project) => ({
      ...project,
      latestRun: state.runs.find((run) => run.suiteId.startsWith(project.id))
    }));
  }

  async listSuites() {
    const state = await this.store.read();
    return state.suites;
  }

  async generateTests(projectId: string, input: TestGenerationRequest): Promise<GeneratedTestSuiteDraft> {
    const state = await this.store.read();
    const draft = this.generator.generate(input);
    state.suites.unshift({
      id: draft.id,
      projectId,
      versionId: `${draft.id}_v1`,
      draft
    });
    await this.store.write(state);
    return draft;
  }

  async createExecution(suiteId: string, input: ExecutionRequest): Promise<ExecutionRun> {
    const state = await this.store.read();
    const suite = state.suites.find((entry) => entry.id === suiteId);
    if (!suite) {
      throw new Error(`Unknown suite ${suiteId}`);
    }

    const provider = this.providers.get(input.provider);
    const run = await provider.execute(input, {
      projectId: suite.projectId,
      suiteId,
      testCases: suite.draft.cases
    });

    if (run.status === "healing-required") {
      const proposal = this.healing.propose(suite.draft.cases[0]?.id ?? uid("case"), run.artifacts);
      const bug = this.bugDrafts.summarize("Potential regression detected", run.artifacts);
      run.healingProposals.push(proposal);
      run.bugDrafts.push(bug);
      state.healProposals.unshift(proposal);
    }

    state.runs.unshift(run);
    await this.store.write(state);
    return run;
  }

  async getExecution(runId: string): Promise<ExecutionRun | undefined> {
    const state = await this.store.read();
    return state.runs.find((run) => run.id === runId);
  }

  async listExecutions(): Promise<ExecutionRun[]> {
    const state = await this.store.read();
    return state.runs;
  }

  async listHealingProposals(): Promise<HealingProposal[]> {
    const state = await this.store.read();
    return state.healProposals;
  }

  async applyHealing(healProposalId: string): Promise<HealingProposal> {
    const state = await this.store.read();
    const proposal = state.healProposals.find((entry) => entry.id === healProposalId);
    if (!proposal) {
      throw new Error(`Unknown healing proposal ${healProposalId}`);
    }
    proposal.status = "applied";
    state.runs = state.runs.map((run) =>
      run.healingProposals.some((entry) => entry.id === healProposalId)
        ? {
            ...run,
            healingProposals: run.healingProposals.map((entry) =>
              entry.id === healProposalId ? proposal : entry
            )
          }
        : run
    );
    await this.store.write(state);
    return proposal;
  }

  syncJira(input: JiraSyncRequest) {
    return {
      status: "accepted",
      importedIssues: input.issueTypes.map((issueType, index) => ({
        id: `${input.projectKey}-${index + 1}`,
        issueType
      }))
    };
  }

  receiveGitHubActionsWebhook(payload: GitHubActionsWebhookPayload) {
    return {
      status: "received",
      workflow: payload.workflowName,
      repository: payload.repository,
      sha: payload.sha
    };
  }
}
