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

type StoredSuite = {
  id: string;
  projectId: string;
  versionId: string;
  draft: GeneratedTestSuiteDraft;
};

const uid = () => Math.random().toString(36).slice(2, 10);

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

  private readonly projects: ProjectSummary[] = [
    { id: "proj_demo", name: "Checkout Web", description: "Primary storefront regression pack" },
    { id: "proj_mobile", name: "Companion App", description: "Mobile smoke coverage" }
  ];

  private readonly suites = new Map<string, StoredSuite>();
  private readonly runs = new Map<string, ExecutionRun>();
  private readonly healProposals = new Map<string, HealingProposal>();

  listProjects(): ProjectSummary[] {
    return this.projects.map((project) => ({
      ...project,
      latestRun: [...this.runs.values()].find((run) => run.suiteId.startsWith(project.id))
    }));
  }

  generateTests(projectId: string, input: TestGenerationRequest): GeneratedTestSuiteDraft {
    const draft = this.generator.generate(input);
    this.suites.set(draft.id, {
      id: draft.id,
      projectId,
      versionId: `${draft.id}_v1`,
      draft
    });
    return draft;
  }

  async createExecution(suiteId: string, input: ExecutionRequest): Promise<ExecutionRun> {
    const suite = this.suites.get(suiteId);
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
      const proposal = this.healing.propose(suite.draft.cases[0]?.id ?? uid(), run.artifacts);
      const bug = this.bugDrafts.summarize("Potential regression detected", run.artifacts);
      run.healingProposals.push(proposal);
      run.bugDrafts.push(bug);
      this.healProposals.set(proposal.id, proposal);
    }

    this.runs.set(run.id, run);
    return run;
  }

  getExecution(runId: string): ExecutionRun | undefined {
    return this.runs.get(runId);
  }

  listExecutions(): ExecutionRun[] {
    return [...this.runs.values()];
  }

  applyHealing(healProposalId: string): HealingProposal {
    const proposal = this.healProposals.get(healProposalId);
    if (!proposal) {
      throw new Error(`Unknown healing proposal ${healProposalId}`);
    }
    proposal.status = "applied";
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

