import { Prisma } from "@prisma/client";
import { prisma } from "./index.js";
import type {
  BugDraft,
  CanonicalTestCase,
  ExecutionArtifact,
  ExecutionRequest,
  ExecutionRun,
  GeneratedSuiteResponse,
  GeneratedTestSuiteDraft,
  HealingProposal,
  PersistedSuite,
  PersistedSuiteVersion,
  ProjectSummary,
  StepEvent,
  TestSuiteUpdateRequest
} from "@sonofcotester/sdk";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const asJson = (value: unknown) => value as Prisma.InputJsonValue;

function parseCases(rows: Array<{ id: string; title: string; feature: string; priority: string; platform: string; prerequisites: unknown; tags: unknown; steps: unknown }>): CanonicalTestCase[] {
  return rows.map((testCase) => ({
    id: testCase.id,
    title: testCase.title,
    feature: testCase.feature,
    priority: testCase.priority as CanonicalTestCase["priority"],
    platform: testCase.platform as CanonicalTestCase["platform"],
    prerequisites: testCase.prerequisites as string[],
    tags: testCase.tags as string[],
    steps: testCase.steps as CanonicalTestCase["steps"]
  }));
}

function mapArtifacts(artifacts: Array<{ id: string; type: string; label: string; path: string; createdAt: Date }>): ExecutionArtifact[] {
  return artifacts.map((artifact) => ({
    id: artifact.id,
    type: artifact.type as ExecutionArtifact["type"],
    label: artifact.label,
    url: artifact.path,
    createdAt: artifact.createdAt.toISOString()
  }));
}

function mapStepEvents(events: Array<{ id: string; testCaseId: string; stepId: string; status: string; message: string; createdAt: Date }>): StepEvent[] {
  return events.map((event) => ({
    id: event.id,
    testCaseId: event.testCaseId,
    stepId: event.stepId,
    status: event.status as StepEvent["status"],
    message: event.message,
    createdAt: event.createdAt.toISOString()
  }));
}

function mapHealing(rows: Array<{ id: string; executionId: string; testCaseId: string; status: string; patch: string; rationale: string; signals: unknown }>): HealingProposal[] {
  return rows.map((proposal) => ({
    id: proposal.id,
    executionId: proposal.executionId,
    testCaseId: proposal.testCaseId,
    status: proposal.status as HealingProposal["status"],
    patch: proposal.patch,
    rationale: proposal.rationale,
    signals: proposal.signals as unknown as HealingProposal["signals"]
  }));
}

function mapBugs(
  rows: Array<{ id: string; title: string; summary: string; severity: string; reproductionSteps: unknown }>,
  evidence: ExecutionArtifact[]
): BugDraft[] {
  return rows.map((bug) => ({
    id: bug.id,
    title: bug.title,
    summary: bug.summary,
    severity: bug.severity as BugDraft["severity"],
    reproductionSteps: bug.reproductionSteps as string[],
    evidence
  }));
}

function mapRun(run: {
  id: string;
  suiteId: string;
  suiteVersionId: string;
  provider: string;
  environment: string;
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
  externalSessionId?: string | null;
  externalSessionUrl?: string | null;
  executionMetadata?: unknown;
  matrix: unknown;
  artifacts: Array<{ id: string; type: string; label: string; path: string; createdAt: Date }>;
  stepEvents: Array<{ id: string; testCaseId: string; stepId: string; status: string; message: string; createdAt: Date }>;
  healingProposals: Array<{ id: string; executionId: string; testCaseId: string; status: string; patch: string; rationale: string; signals: unknown }>;
  bugReports: Array<{ id: string; title: string; summary: string; severity: string; reproductionSteps: unknown }>;
}): ExecutionRun {
  const artifacts = mapArtifacts(run.artifacts);
  return {
    id: run.id,
    suiteId: run.suiteId,
    suiteVersionId: run.suiteVersionId,
    provider: run.provider as ExecutionRun["provider"],
    environment: run.environment,
    status: run.status as ExecutionRun["status"],
    startedAt: run.startedAt?.toISOString(),
    finishedAt: run.finishedAt?.toISOString(),
    errorMessage: run.errorMessage ?? undefined,
    externalSessionId: run.externalSessionId ?? undefined,
    externalSessionUrl: run.externalSessionUrl ?? undefined,
    executionMetadata: (run.executionMetadata as Record<string, unknown> | null) ?? undefined,
    matrix: run.matrix as ExecutionRun["matrix"],
    artifacts,
    stepEvents: mapStepEvents(run.stepEvents),
    healingProposals: mapHealing(run.healingProposals),
    bugDrafts: mapBugs(run.bugReports, artifacts)
  };
}

export async function ensureSeedData() {
  const workspace = await prisma.workspace.findFirst();
  if (workspace) {
    return workspace;
  }

  return prisma.workspace.create({
    data: {
      id: "ws_internal",
      name: "sonofcotester internal",
      description: "Seeded workspace for internal alpha",
      users: {
        create: [
          {
            id: "user_owner",
            email: "owner@sonofcotester.local",
            name: "Internal Owner",
            role: "owner"
          }
        ]
      },
      projects: {
        create: [
          {
            id: "proj_demo",
            name: "Checkout Web",
            description: "Primary storefront regression pack"
          },
          {
            id: "proj_mobile",
            name: "Companion App",
            description: "Mobile smoke coverage"
          }
        ]
      }
    }
  });
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const projects = await prisma.project.findMany({
    include: {
      executionRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          artifacts: true,
          stepEvents: true,
          healingProposals: true,
          bugReports: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    latestRun: project.executionRuns[0] ? mapRun(project.executionRuns[0]) : undefined
  }));
}

export async function createGeneratedSuite(
  projectId: string,
  draft: GeneratedTestSuiteDraft
): Promise<GeneratedSuiteResponse> {
  const suiteId = draft.id;
  const versionId = `${suiteId}_v1`;

  await prisma.testSuite.create({
    data: {
      id: suiteId,
      projectId,
      sourceType: draft.sourceType,
      summary: draft.summary,
      versions: {
        create: {
          id: versionId,
          versionNumber: 1,
          status: "draft",
          testCases: {
            create: draft.cases.map((testCase) => ({
              id: testCase.id,
              title: testCase.title,
              feature: testCase.feature,
              priority: testCase.priority,
              platform: testCase.platform,
              prerequisites: asJson(testCase.prerequisites),
              tags: asJson(testCase.tags),
              steps: asJson(testCase.steps)
            }))
          }
        }
      }
    }
  });

  return {
    suiteId,
    suiteVersionId: versionId,
    draft
  };
}

export async function listSuites(): Promise<PersistedSuite[]> {
  const suites = await prisma.testSuite.findMany({
    include: {
      versions: {
        include: { testCases: true },
        orderBy: { versionNumber: "desc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return suites.map((suite) => ({
    id: suite.id,
    projectId: suite.projectId,
    sourceType: suite.sourceType as PersistedSuite["sourceType"],
    summary: suite.summary,
    createdAt: suite.createdAt.toISOString(),
    updatedAt: suite.updatedAt.toISOString(),
    versions: suite.versions.map((version) => ({
      id: version.id,
      suiteId: version.suiteId,
      versionNumber: version.versionNumber,
      status: version.status as PersistedSuiteVersion["status"],
      notes: version.notes ?? undefined,
      cases: parseCases(version.testCases)
    }))
  }));
}

export async function getSuiteById(suiteId: string): Promise<PersistedSuite | null> {
  const suites = await listSuites();
  return suites.find((suite) => suite.id === suiteId) ?? null;
}

export async function updateSuiteVersion(suiteId: string, input: TestSuiteUpdateRequest) {
  const current = await prisma.testSuite.findUnique({
    where: { id: suiteId },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { testCases: true } } }
  });
  if (!current || !current.versions[0]) {
    throw new Error(`Unknown suite ${suiteId}`);
  }

  const nextVersion = current.versions[0].versionNumber + 1;
  const versionId = `${suiteId}_v${nextVersion}`;

  await prisma.testVersion.create({
    data: {
      id: versionId,
      suiteId,
      versionNumber: nextVersion,
      status: "ready",
      notes: input.notes,
      testCases: {
        create: input.cases.map((testCase) => ({
          id: testCase.id,
          title: testCase.title,
          feature: testCase.feature,
          priority: testCase.priority,
          platform: testCase.platform,
          prerequisites: asJson(testCase.prerequisites),
          tags: asJson(testCase.tags),
          steps: asJson(testCase.steps)
        }))
      }
    }
  });

  await prisma.testSuite.update({
    where: { id: suiteId },
    data: { summary: input.summary }
  });

  return getSuiteById(suiteId);
}

export async function createExecutionRun(projectId: string, suiteId: string, request: ExecutionRequest) {
  const runId = uid("run");
  const jobId = uid("job");
  const run = await prisma.executionRun.create({
    data: {
      id: runId,
      projectId,
      suiteId,
      suiteVersionId: request.suiteVersionId,
      provider: request.provider,
      environment: request.environment,
      status: "queued",
      matrix: asJson(request.matrix),
      executionMetadata: asJson({ queuedAt: new Date().toISOString() }),
      jobs: {
        create: {
          id: jobId,
          provider: request.provider,
          status: "queued",
          queueName: "execution-jobs"
        }
      }
    },
    include: {
      jobs: true,
      artifacts: true,
      stepEvents: true,
      healingProposals: true,
      bugReports: true
    }
  });

  return { run: mapRun(run), jobId };
}

export async function listExecutions(): Promise<ExecutionRun[]> {
  const runs = await prisma.executionRun.findMany({
    include: {
      artifacts: true,
      stepEvents: true,
      healingProposals: true,
      bugReports: true
    },
    orderBy: { createdAt: "desc" }
  });
  return runs.map(mapRun);
}

export async function getExecution(runId: string): Promise<ExecutionRun | null> {
  const run = await prisma.executionRun.findUnique({
    where: { id: runId },
    include: {
      artifacts: true,
      stepEvents: true,
      healingProposals: true,
      bugReports: true
    }
  });
  return run ? mapRun(run) : null;
}

export async function listHealingProposals(): Promise<HealingProposal[]> {
  const proposals = await prisma.healingProposal.findMany({ orderBy: { createdAt: "desc" } });
  return mapHealing(proposals);
}

export async function applyHealingProposal(healProposalId: string) {
  const proposal = await prisma.healingProposal.update({
    where: { id: healProposalId },
    data: { status: "applied" }
  });
  const run = await prisma.executionRun.findUnique({
    where: { id: proposal.executionId },
    include: {
      suiteVersion: {
        include: { testCases: true }
      },
      suite: true
    }
  });
  if (!run) {
    throw new Error("Unknown execution for healing proposal");
  }
  const nextVersion = await prisma.testVersion.aggregate({
    where: { suiteId: run.suiteId },
    _max: { versionNumber: true }
  });
  const versionNumber = (nextVersion._max.versionNumber ?? 0) + 1;
  const versionId = `${run.suiteId}_v${versionNumber}`;
  await prisma.testVersion.create({
    data: {
      id: versionId,
      suiteId: run.suiteId,
      versionNumber,
      status: "ready",
      notes: `Created from healing proposal ${proposal.id}`,
      testCases: {
        create: run.suiteVersion.testCases.map((testCase) => ({
          id: uid("case"),
          title: testCase.title,
          feature: testCase.feature,
          priority: testCase.priority,
          platform: testCase.platform,
          prerequisites: asJson(testCase.prerequisites),
          tags: asJson(testCase.tags),
          steps: asJson(testCase.steps)
        }))
      }
    }
  });
  return {
    id: proposal.id,
    executionId: proposal.executionId,
    testCaseId: proposal.testCaseId,
    status: "applied" as const,
    patch: proposal.patch,
    rationale: proposal.rationale,
    signals: proposal.signals as unknown as HealingProposal["signals"]
  };
}

export async function getExecutionContext(suiteVersionId: string) {
  const version = await prisma.testVersion.findUnique({
    where: { id: suiteVersionId },
    include: {
      suite: { include: { project: true } },
      testCases: true
    }
  });
  if (!version) {
    throw new Error(`Unknown suite version ${suiteVersionId}`);
  }
  return {
    projectId: version.suite.projectId,
    suiteId: version.suiteId,
    testCases: parseCases(version.testCases)
  };
}

export async function markRunStarted(runId: string) {
  await prisma.executionRun.update({
    where: { id: runId },
    data: { status: "running", startedAt: new Date() }
  });
}

export async function updateRunResult(
  runId: string,
  result: ExecutionRun,
  healingProposals: HealingProposal[],
  bugDrafts: BugDraft[]
) {
  await prisma.executionRun.update({
    where: { id: runId },
    data: {
      status: result.status,
      finishedAt: result.finishedAt ? new Date(result.finishedAt) : new Date(),
      errorMessage: result.errorMessage,
      externalSessionId: result.externalSessionId,
      externalSessionUrl: result.externalSessionUrl,
      executionMetadata: result.executionMetadata ? asJson(result.executionMetadata) : undefined,
      artifacts: {
        create: result.artifacts.map((artifact) => ({
          id: artifact.id,
          type: artifact.type,
          label: artifact.label,
          path: artifact.url
        }))
      },
      stepEvents: {
        create: result.stepEvents.map((event) => ({
          id: event.id,
          testCaseId: event.testCaseId,
          stepId: event.stepId,
          status: event.status,
          message: event.message
        }))
      },
      healingProposals: {
        create: healingProposals.map((proposal) => ({
          id: proposal.id,
          testCaseId: proposal.testCaseId,
          status: proposal.status,
          patch: proposal.patch,
          rationale: proposal.rationale,
          signals: asJson(proposal.signals)
        }))
      },
      bugReports: {
        create: bugDrafts.map((bug) => ({
          id: bug.id,
          title: bug.title,
          summary: bug.summary,
          severity: bug.severity,
          reproductionSteps: asJson(bug.reproductionSteps)
        }))
      },
      jobs: {
        updateMany: {
          where: { runId },
          data: { status: result.status }
        }
      }
    }
  });
}
