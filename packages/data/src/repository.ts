import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./index.js";
import type {
  ApiKey,
  ApiKeyScope,
  AuditLogEntry,
  BugDraft,
  CanonicalTestCase,
  CanonicalTestStep,
  ExecutionArtifact,
  ExecutionRequest,
  ExecutionRun,
  GeneratedSuiteResponse,
  GeneratedTestSuiteDraft,
  HealingProposal,
  Invoice,
  PersistedSuite,
  PersistedSuiteVersion,
  PlanTier,
  ProjectSummary,
  StepEvent,
  StudentProgressRecord,
  TestSuiteUpdateRequest,
  UsageQuota,
  WorkspaceSubscription
} from "@sonofcotester/sdk";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const asJson = (value: unknown) => value as Prisma.InputJsonValue;

const isDbAvailable = () => Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);

async function withFallback<T>(prismaFn: () => Promise<T>, memoryFn: () => Promise<T> | T): Promise<T> {
  if (isDbAvailable()) {
    try {
      return await prismaFn();
    } catch (err) {
      // Prisma error, fallback to memory
      return await memoryFn();
    }
  }
  return await memoryFn();
}

// ── In-Memory State for Standalone / Dev / Test Mode ──

class InMemoryStore {
  projects = new Map<string, ProjectSummary>([
    [
      "proj_demo",
      { id: "proj_demo", name: "Checkout Web", description: "Primary storefront regression pack" }
    ],
    [
      "proj_mobile",
      { id: "proj_mobile", name: "Companion App", description: "Mobile smoke coverage with Maestro & Appium" }
    ]
  ]);

  suites = new Map<string, PersistedSuite>([
    [
      "suite_demo",
      {
        id: "suite_demo",
        projectId: "proj_demo",
        sourceType: "story",
        summary: "Default E2E Regression Suite",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versions: [
          {
            id: "suite_demo_v1",
            suiteId: "suite_demo",
            versionNumber: 1,
            status: "ready",
            cases: [
              {
                id: "case_01",
                title: "Checkout Happy Path",
                feature: "Checkout",
                priority: "p1",
                platform: "web",
                prerequisites: ["User logged in"],
                tags: ["smoke", "web"],
                steps: [
                  { id: "step_1", action: "navigate", data: "http://localhost:3010", expectedOutcome: "Page loads" },
                  { id: "step_2", action: "fill", target: "[data-testid='email-input']", data: "qa@sonofcotester.dev", expectedOutcome: "Email filled" },
                  { id: "step_3", action: "click", target: "[data-testid='continue-button']", expectedOutcome: "Advanced to step 2" },
                  { id: "step_4", action: "assertText", target: "[data-testid='status']", data: "Ready for checkout", expectedOutcome: "Status visible" }
                ]
              }
            ]
          }
        ]
      }
    ]
  ]);

  runs = new Map<string, ExecutionRun>();
  healingProposals = new Map<string, HealingProposal>();
  auditLogs: AuditLogEntry[] = [
    {
      id: "log_init_01",
      workspaceId: "ws_internal",
      actorId: "user_owner",
      actorName: "Internal Owner",
      actorEmail: "owner@sonofcotester.local",
      action: "project.create",
      entityType: "project",
      entityId: "proj_demo",
      entityName: "Checkout Web",
      details: { description: "Primary storefront regression pack" },
      ipAddress: "127.0.0.1",
      userAgent: "sonofcotester-system",
      timestamp: new Date().toISOString()
    }
  ];

  subscription: WorkspaceSubscription = {
    id: "sub_internal",
    workspaceId: "ws_internal",
    tier: "student_free",
    status: "active",
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    cancelAtPeriodEnd: false,
    paymentMethod: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2028 },
    limits: {
      monthlyRuns: 500,
      concurrentWorkers: 3,
      aiGenerations: 50,
      maestroCloudMinutes: 120,
      maxProjects: 10,
      teamMembers: 5
    }
  };

  invoices: Invoice[] = [
    {
      id: "inv_welcome_001",
      workspaceId: "ws_internal",
      amountDue: 0,
      amountPaid: 0,
      currency: "usd",
      status: "paid",
      planName: "Student / Free Tier",
      createdAt: new Date().toISOString(),
      periodStart: new Date().toISOString(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  quota: UsageQuota = {
    workspaceId: "ws_internal",
    period: new Date().toISOString().slice(0, 7),
    runsExecuted: 14,
    aiGenerationsUsed: 5,
    cloudMinutesUsed: 20,
    activeProjectsCount: 2,
    teamMembersCount: 2,
    limits: {
      monthlyRuns: 500,
      aiGenerations: 50,
      maestroCloudMinutes: 120,
      maxProjects: 10,
      teamMembers: 5
    }
  };

  studentProgress = new Map<string, StudentProgressRecord>([
    [
      "user_student",
      {
        userId: "user_student",
        completedModules: ["module-1", "module-2"],
        moduleQuizScores: { "module-1": 100, "module-2": 90 },
        earnedBadges: [
          {
            id: "badge_pyramid_master",
            title: "Pyramid Architect",
            description: "Mastered test pyramid balance and test levels",
            earnedAt: new Date().toISOString(),
            icon: "🔺"
          },
          {
            id: "badge_selector_pro",
            title: "Selector Ninja",
            description: "Wrote resilient role-based accessible selectors",
            earnedAt: new Date().toISOString(),
            icon: "🎯"
          }
        ],
        totalTestsAnalyzed: 8,
        averageQualityScore: 92.5
      }
    ]
  ]);

  apiKeys = new Map<string, { key: ApiKey; hashedKey: string }>([
    [
      "key_demo_ci",
      {
        key: {
          id: "key_demo_ci",
          workspaceId: "ws_internal",
          name: "GitHub Actions CI Pipeline",
          keyPrefix: "sct_live_ci_429a",
          scopes: ["runs:read", "runs:write", "suites:read", "health:read"],
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString()
        },
        hashedKey: createHash("sha256").update("sct_live_ci_secret_token_123456").digest("hex")
      }
    ]
  ]);
}

const memory = new InMemoryStore();

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
  return withFallback(
    async () => {
      const workspace = await prisma.workspace.findFirst({
        include: { subscription: true }
      });
      if (workspace) {
        if (!workspace.subscription) {
          await prisma.subscription.create({
            data: {
              id: "sub_internal",
              workspaceId: workspace.id,
              tier: "student_free",
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              monthlyRunsLimit: 500,
              concurrentWorkers: 3,
              aiGenerationsLimit: 50,
              cloudMinutesLimit: 120,
              maxProjectsLimit: 10,
              teamMembersLimit: 5
            }
          });
        }

        const demoProject = await prisma.project.upsert({
          where: { id: "proj_demo" },
          update: {},
          create: {
            id: "proj_demo",
            workspaceId: workspace.id,
            name: "Checkout Web",
            description: "Primary storefront regression pack"
          }
        });

        const existingSuite = await prisma.testSuite.findUnique({
          where: { id: "suite_demo" }
        });
        if (!existingSuite) {
          await prisma.testSuite.create({
            data: {
              id: "suite_demo",
              projectId: demoProject.id,
              sourceType: "story",
              summary: "Default E2E Regression Suite",
              versions: {
                create: {
                  id: "suite_demo_v1",
                  versionNumber: 1,
                  status: "ready",
                  testCases: {
                    create: [
                      {
                        id: "case_01",
                        title: "Checkout Happy Path",
                        feature: "Checkout",
                        priority: "p1",
                        platform: "web",
                        prerequisites: asJson(["User logged in"]),
                        tags: asJson(["smoke", "web"]),
                        steps: asJson([
                          { id: "step_1", action: "navigate", data: "http://localhost:3010", expectedOutcome: "Page loads" },
                          { id: "step_2", action: "fill", target: "[data-testid='email-input']", data: "qa@sonofcotester.dev", expectedOutcome: "Email filled" },
                          { id: "step_3", action: "click", target: "[data-testid='continue-button']", expectedOutcome: "Advanced to step 2" },
                          { id: "step_4", action: "assertText", target: "[data-testid='status']", data: "Ready for checkout", expectedOutcome: "Status visible" }
                        ])
                      }
                    ]
                  }
                }
              }
            }
          });
        }

        return workspace;
      }

      const period = new Date().toISOString().slice(0, 7);
      return prisma.workspace.create({
        data: {
          id: "ws_internal",
          name: "sonofcotester internal",
          description: "Seeded workspace for internal alpha & production validation",
          users: {
            create: [
              { id: "user_owner", email: "owner@sonofcotester.local", name: "Internal Owner", role: "owner" },
              { id: "user_student", email: "student@university.edu", name: "QA Student", role: "tester" }
            ]
          },
          projects: {
            create: [
              { id: "proj_demo", name: "Checkout Web", description: "Primary storefront regression pack" },
              { id: "proj_mobile", name: "Companion App", description: "Mobile smoke coverage with Maestro & Appium" }
            ]
          },
          subscription: {
            create: {
              id: "sub_internal",
              tier: "student_free",
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              monthlyRunsLimit: 500,
              concurrentWorkers: 3,
              aiGenerationsLimit: 50,
              cloudMinutesLimit: 120,
              maxProjectsLimit: 10,
              teamMembersLimit: 5,
              paymentBrand: "visa",
              paymentLast4: "4242"
            }
          },
          usageQuotas: {
            create: {
              id: `quota_${period}`,
              period,
              runsExecuted: 12,
              aiGenerationsUsed: 4,
              cloudMinutesUsed: 15
            }
          },
          invoices: {
            create: [
              {
                id: "inv_welcome_001",
                amountDue: 0,
                amountPaid: 0,
                currency: "usd",
                status: "paid",
                planName: "Student / Free Tier",
                periodStart: new Date(),
                periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              }
            ]
          },
          auditLogs: {
            create: [
              {
                id: "log_init_01",
                actorId: "user_owner",
                actorName: "Internal Owner",
                actorEmail: "owner@sonofcotester.local",
                action: "project.create",
                entityType: "project",
                entityId: "proj_demo",
                entityName: "Checkout Web",
                details: asJson({ description: "Primary storefront regression pack" }),
                ipAddress: "127.0.0.1",
                userAgent: "sonofcotester-system"
              }
            ]
          }
        }
      });
    },
    () => ({
      id: "ws_internal",
      name: "sonofcotester internal",
      description: "Seeded workspace for internal alpha & production validation"
    })
  );
}

// ── Projects ──

export async function listProjects(): Promise<ProjectSummary[]> {
  return withFallback(
    async () => {
      const projects = await prisma.project.findMany({
        include: {
          executionRuns: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { artifacts: true, stepEvents: true, healingProposals: true, bugReports: true }
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
    },
    () => Array.from(memory.projects.values())
  );
}

export async function createProject(workspaceId: string, name: string, description: string): Promise<ProjectSummary> {
  const newProject: ProjectSummary = {
    id: uid("proj"),
    name,
    description
  };
  memory.projects.set(newProject.id, newProject);

  return withFallback(
    async () => {
      const p = await prisma.project.create({
        data: { id: newProject.id, workspaceId, name, description }
      });
      return { id: p.id, name: p.name, description: p.description };
    },
    () => newProject
  );
}

export async function getProjectById(projectId: string): Promise<ProjectSummary | null> {
  return withFallback(
    async () => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          executionRuns: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { artifacts: true, stepEvents: true, healingProposals: true, bugReports: true }
          }
        }
      });
      if (!project) return memory.projects.get(projectId) ?? null;
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        latestRun: project.executionRuns[0] ? mapRun(project.executionRuns[0]) : undefined
      };
    },
    () => memory.projects.get(projectId) ?? null
  );
}

export async function updateProject(projectId: string, name?: string, description?: string): Promise<ProjectSummary> {
  const existing = memory.projects.get(projectId) ?? { id: projectId, name: name ?? "", description: description ?? "" };
  const updated = {
    ...existing,
    ...(name ? { name } : {}),
    ...(description ? { description } : {})
  };
  memory.projects.set(projectId, updated);

  return withFallback(
    async () => {
      const project = await prisma.project.update({
        where: { id: projectId },
        data: { ...(name ? { name } : {}), ...(description ? { description } : {}) },
        include: {
          executionRuns: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { artifacts: true, stepEvents: true, healingProposals: true, bugReports: true }
          }
        }
      });
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        latestRun: project.executionRuns[0] ? mapRun(project.executionRuns[0]) : undefined
      };
    },
    () => updated
  );
}

export async function deleteProject(projectId: string): Promise<{ deleted: boolean }> {
  memory.projects.delete(projectId);
  return withFallback(
    async () => {
      await prisma.project.delete({ where: { id: projectId } });
      return { deleted: true };
    },
    () => ({ deleted: true })
  );
}

// ── Test Suites & Cases ──

export async function createGeneratedSuite(
  projectId: string,
  draft: GeneratedTestSuiteDraft
): Promise<GeneratedSuiteResponse> {
  const suiteId = draft.id;
  const versionId = `${suiteId}_v1`;

  const suiteObj: PersistedSuite = {
    id: suiteId,
    projectId,
    sourceType: draft.sourceType,
    summary: draft.summary,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    versions: [
      {
        id: versionId,
        suiteId,
        versionNumber: 1,
        status: "draft",
        cases: draft.cases
      }
    ]
  };
  memory.suites.set(suiteId, suiteObj);

  return withFallback(
    async () => {
      const proj = await prisma.project.findUnique({ where: { id: projectId } });
      if (!proj) {
        let ws = await prisma.workspace.findFirst();
        if (!ws) {
          ws = await prisma.workspace.create({
            data: { id: "ws_internal", name: "Default Workspace", description: "Default Workspace" }
          });
        }
        await prisma.project.create({
          data: {
            id: projectId,
            workspaceId: ws.id,
            name: `Project ${projectId}`,
            description: "Auto-created workspace project"
          }
        });
      }

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
                create: draft.cases.map((tc) => ({
                  id: tc.id,
                  title: tc.title,
                  feature: tc.feature,
                  priority: tc.priority,
                  platform: tc.platform,
                  prerequisites: asJson(tc.prerequisites),
                  tags: asJson(tc.tags),
                  steps: asJson(tc.steps)
                }))
              }
            }
          }
        }
      });
      return { suiteId, suiteVersionId: versionId, draft };
    },
    () => ({ suiteId, suiteVersionId: versionId, draft })
  );
}

export async function listSuites(): Promise<PersistedSuite[]> {
  return withFallback(
    async () => {
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
    },
    () => Array.from(memory.suites.values())
  );
}

export async function getSuiteById(suiteId: string): Promise<PersistedSuite | null> {
  const suites = await listSuites();
  return suites.find((s) => s.id === suiteId) ?? memory.suites.get(suiteId) ?? null;
}

export async function createTestSuite(
  projectId: string,
  summary: string,
  sourceType: string = "manual",
  cases: CanonicalTestCase[] = []
): Promise<PersistedSuite> {
  const suiteId = uid("suite");
  const versionId = `${suiteId}_v1`;

  const newSuite: PersistedSuite = {
    id: suiteId,
    projectId,
    sourceType: sourceType as PersistedSuite["sourceType"],
    summary,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    versions: [
      {
        id: versionId,
        suiteId,
        versionNumber: 1,
        status: "ready",
        cases: cases.map((c) => ({ ...c, id: c.id || uid("case") }))
      }
    ]
  };
  memory.suites.set(suiteId, newSuite);

  return withFallback(
    async () => {
      await prisma.testSuite.create({
        data: {
          id: suiteId,
          projectId,
          sourceType,
          summary,
          versions: {
            create: {
              id: versionId,
              versionNumber: 1,
              status: "ready",
              testCases: {
                create: cases.map((c) => ({
                  id: c.id || uid("case"),
                  title: c.title,
                  feature: c.feature || "Core",
                  priority: c.priority || "p1",
                  platform: c.platform || "web",
                  prerequisites: asJson(c.prerequisites || []),
                  tags: asJson(c.tags || []),
                  steps: asJson(c.steps || [])
                }))
              }
            }
          }
        }
      });
      return newSuite;
    },
    () => newSuite
  );
}

export async function updateSuiteVersion(suiteId: string, input: TestSuiteUpdateRequest) {
  const suite = memory.suites.get(suiteId);
  if (suite && suite.versions[0]) {
    const nextVersion = suite.versions[0].versionNumber + 1;
    const versionId = `${suiteId}_v${nextVersion}`;
    suite.summary = input.summary;
    suite.versions.unshift({
      id: versionId,
      suiteId,
      versionNumber: nextVersion,
      status: "ready",
      notes: input.notes,
      cases: input.cases
    });
  }

  return withFallback(
    async () => {
      const current = await prisma.testSuite.findUnique({
        where: { id: suiteId },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { testCases: true } } }
      });
      if (!current || !current.versions[0]) throw new Error(`Unknown suite ${suiteId}`);
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
    },
    () => getSuiteById(suiteId)
  );
}

export async function deleteTestSuite(suiteId: string): Promise<{ deleted: boolean }> {
  memory.suites.delete(suiteId);
  return withFallback(
    async () => {
      await prisma.testSuite.delete({ where: { id: suiteId } });
      return { deleted: true };
    },
    () => ({ deleted: true })
  );
}

export async function addTestCase(versionId: string, testCase: CanonicalTestCase): Promise<CanonicalTestCase> {
  const caseObj = { ...testCase, id: testCase.id || uid("case") };
  for (const s of memory.suites.values()) {
    const v = s.versions.find((ver) => ver.id === versionId);
    if (v) {
      v.cases.push(caseObj);
      break;
    }
  }

  return withFallback(
    async () => {
      const created = await prisma.testCase.create({
        data: {
          id: caseObj.id,
          versionId,
          title: caseObj.title,
          feature: caseObj.feature,
          priority: caseObj.priority,
          platform: caseObj.platform,
          prerequisites: asJson(caseObj.prerequisites),
          tags: asJson(caseObj.tags),
          steps: asJson(caseObj.steps)
        }
      });
      return {
        id: created.id,
        title: created.title,
        feature: created.feature,
        priority: created.priority as CanonicalTestCase["priority"],
        platform: created.platform as CanonicalTestCase["platform"],
        prerequisites: created.prerequisites as string[],
        tags: created.tags as string[],
        steps: (created.steps as unknown) as CanonicalTestCase["steps"]
      };
    },
    () => caseObj
  );
}

export async function updateTestCase(testCaseId: string, updates: Partial<CanonicalTestCase>): Promise<CanonicalTestCase> {
  let updatedCase: CanonicalTestCase = {
    id: testCaseId,
    title: updates.title || "Updated Case",
    feature: updates.feature || "Core",
    priority: updates.priority || "p1",
    platform: updates.platform || "web",
    prerequisites: updates.prerequisites || [],
    tags: updates.tags || [],
    steps: updates.steps || []
  };

  for (const s of memory.suites.values()) {
    for (const v of s.versions) {
      const idx = v.cases.findIndex((c) => c.id === testCaseId);
      if (idx !== -1) {
        v.cases[idx] = { ...v.cases[idx], ...updates };
        updatedCase = v.cases[idx];
        break;
      }
    }
  }

  return withFallback(
    async () => {
      const updated = await prisma.testCase.update({
        where: { id: testCaseId },
        data: {
          ...(updates.title ? { title: updates.title } : {}),
          ...(updates.feature ? { feature: updates.feature } : {}),
          ...(updates.priority ? { priority: updates.priority } : {}),
          ...(updates.platform ? { platform: updates.platform } : {}),
          ...(updates.prerequisites ? { prerequisites: asJson(updates.prerequisites) } : {}),
          ...(updates.tags ? { tags: asJson(updates.tags) } : {}),
          ...(updates.steps ? { steps: asJson(updates.steps) } : {})
        }
      });
      return {
        id: updated.id,
        title: updated.title,
        feature: updated.feature,
        priority: updated.priority as CanonicalTestCase["priority"],
        platform: updated.platform as CanonicalTestCase["platform"],
        prerequisites: updated.prerequisites as string[],
        tags: updated.tags as string[],
        steps: (updated.steps as unknown) as CanonicalTestCase["steps"]
      };
    },
    () => updatedCase
  );
}

export async function deleteTestCase(testCaseId: string): Promise<{ deleted: boolean }> {
  for (const s of memory.suites.values()) {
    for (const v of s.versions) {
      v.cases = v.cases.filter((c) => c.id !== testCaseId);
    }
  }

  return withFallback(
    async () => {
      await prisma.testCase.delete({ where: { id: testCaseId } });
      return { deleted: true };
    },
    () => ({ deleted: true })
  );
}

// ── Executions ──

export async function createExecutionRun(projectId: string, suiteId: string, request: ExecutionRequest) {
  const runId = uid("run");
  const jobId = uid("job");
  const run: ExecutionRun = {
    id: runId,
    suiteId,
    suiteVersionId: request.suiteVersionId,
    provider: request.provider,
    environment: request.environment,
    status: "queued",
    matrix: request.matrix,
    artifacts: [],
    stepEvents: [],
    healingProposals: [],
    bugDrafts: []
  };
  memory.runs.set(runId, run);

  return withFallback(
    async () => {
      const existingVersion = await prisma.testVersion.findUnique({
        where: { id: request.suiteVersionId }
      });
      if (!existingVersion) {
        for (const s of memory.suites.values()) {
          const v = s.versions.find((ver) => ver.id === request.suiteVersionId);
          if (v) {
            let ws = await prisma.workspace.findFirst();
            if (!ws) {
              ws = await prisma.workspace.create({
                data: { id: "ws_internal", name: "Default Workspace", description: "Default Workspace" }
              });
            }
            await prisma.project.upsert({
              where: { id: s.projectId },
              update: {},
              create: { id: s.projectId, workspaceId: ws.id, name: `Project ${s.projectId}`, description: "Auto-synced project" }
            });
            await prisma.testSuite.upsert({
              where: { id: s.id },
              update: {},
              create: { id: s.id, projectId: s.projectId, sourceType: s.sourceType, summary: s.summary }
            });
            await prisma.testVersion.create({
              data: {
                id: v.id,
                suiteId: s.id,
                versionNumber: v.versionNumber,
                status: v.status,
                testCases: {
                  create: v.cases.map((tc) => ({
                    id: tc.id,
                    title: tc.title,
                    feature: tc.feature,
                    priority: tc.priority,
                    platform: tc.platform,
                    prerequisites: asJson(tc.prerequisites),
                    tags: asJson(tc.tags),
                    steps: asJson(tc.steps)
                  }))
                }
              }
            });
            break;
          }
        }
      }

      const created = await prisma.executionRun.create({
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
        include: { jobs: true, artifacts: true, stepEvents: true, healingProposals: true, bugReports: true }
      });
      return { run: mapRun(created), jobId };
    },
    () => ({ run, jobId })
  );
}

export async function listExecutions(): Promise<ExecutionRun[]> {
  return withFallback(
    async () => {
      const runs = await prisma.executionRun.findMany({
        include: { artifacts: true, stepEvents: true, healingProposals: true, bugReports: true },
        orderBy: { createdAt: "desc" }
      });
      return runs.map(mapRun);
    },
    () => Array.from(memory.runs.values())
  );
}

export async function getExecution(runId: string): Promise<ExecutionRun | null> {
  return withFallback(
    async () => {
      const run = await prisma.executionRun.findUnique({
        where: { id: runId },
        include: { artifacts: true, stepEvents: true, healingProposals: true, bugReports: true }
      });
      return run ? mapRun(run) : (memory.runs.get(runId) ?? null);
    },
    () => memory.runs.get(runId) ?? null
  );
}

export async function cancelExecutionRun(runId: string): Promise<ExecutionRun | null> {
  const run = memory.runs.get(runId);
  if (run) {
    run.status = "canceled";
    run.finishedAt = new Date().toISOString();
  }

  return withFallback(
    async () => {
      await prisma.executionRun.update({
        where: { id: runId },
        data: { status: "canceled", finishedAt: new Date(), errorMessage: "Canceled by user" }
      });
      return getExecution(runId);
    },
    () => run ?? null
  );
}

export async function deleteExecutionRun(runId: string): Promise<{ deleted: boolean }> {
  memory.runs.delete(runId);
  return withFallback(
    async () => {
      await prisma.executionRun.delete({ where: { id: runId } });
      return { deleted: true };
    },
    () => ({ deleted: true })
  );
}

export async function getExecutionContext(suiteVersionId: string) {
  for (const s of memory.suites.values()) {
    const v = s.versions.find((ver) => ver.id === suiteVersionId);
    if (v) {
      return {
        projectId: s.projectId,
        suiteId: s.id,
        testCases: v.cases
      };
    }
  }

  return withFallback(
    async () => {
      const version = await prisma.testVersion.findUnique({
        where: { id: suiteVersionId },
        include: { suite: { include: { project: true } }, testCases: true }
      });
      if (!version) throw new Error(`Unknown suite version ${suiteVersionId}`);
      return {
        projectId: version.suite.projectId,
        suiteId: version.suiteId,
        testCases: parseCases(version.testCases)
      };
    },
    () => ({
      projectId: "proj_demo",
      suiteId: "suite_demo",
      testCases: []
    })
  );
}

export async function markRunStarted(runId: string) {
  const run = memory.runs.get(runId);
  if (run) {
    run.status = "running";
    run.startedAt = new Date().toISOString();
  }

  await withFallback(
    async () => {
      await prisma.executionRun.update({
        where: { id: runId },
        data: { status: "running", startedAt: new Date() }
      });
    },
    () => undefined
  );
}

export async function updateRunResult(
  runId: string,
  result: ExecutionRun,
  healingProposals: HealingProposal[],
  bugDrafts: BugDraft[]
) {
  memory.runs.set(runId, result);
  for (const p of healingProposals) {
    memory.healingProposals.set(p.id, p);
  }

  await withFallback(
    async () => {
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
            create: result.artifacts.map((a) => ({ id: a.id, type: a.type, label: a.label, path: a.url }))
          },
          stepEvents: {
            create: result.stepEvents.map((e) => ({ id: e.id, testCaseId: e.testCaseId, stepId: e.stepId, status: e.status, message: e.message }))
          },
          healingProposals: {
            create: healingProposals.map((p) => ({ id: p.id, testCaseId: p.testCaseId, status: p.status, patch: p.patch, rationale: p.rationale, signals: asJson(p.signals) }))
          },
          bugReports: {
            create: bugDrafts.map((b) => ({ id: b.id, title: b.title, summary: b.summary, severity: b.severity, reproductionSteps: asJson(b.reproductionSteps) }))
          }
        }
      });
    },
    () => undefined
  );
}

export async function listHealingProposals(): Promise<HealingProposal[]> {
  return withFallback(
    async () => {
      const proposals = await prisma.healingProposal.findMany({ orderBy: { createdAt: "desc" } });
      return mapHealing(proposals);
    },
    () => Array.from(memory.healingProposals.values())
  );
}

export function patchTestSteps(steps: CanonicalTestStep[], patch: string): CanonicalTestStep[] {
  if (!Array.isArray(steps)) return steps;
  const patchLower = patch.toLowerCase();

  // Pattern 1: change step action to click (checkbox/toggle)
  if (patchLower.includes("to \"click\"") || patchLower.includes("to 'click'") || patchLower.includes("checkbox toggle")) {
    const targetMatch = patch.match(/on\s+"([^"]+)"/i) || patch.match(/on\s+'([^']+)'/i);
    const targetSel = targetMatch ? targetMatch[1] : null;
    return steps.map((step) => {
      if (targetSel && (step.target === targetSel || step.target?.includes(targetSel))) {
        return { ...step, action: "click", data: undefined };
      }
      if (!targetSel && step.action === "fill" && (step.target?.includes("check") || step.target?.includes("radio") || step.target?.includes("agree"))) {
        return { ...step, action: "click", data: undefined };
      }
      return step;
    });
  }

  // Pattern 2: change step action to selectOption or click
  if (patchLower.includes("selectoption or click") || patchLower.includes("select dropdown")) {
    const targetMatch = patch.match(/on\s+"([^"]+)"/i) || patch.match(/on\s+'([^']+)'/i);
    const targetSel = targetMatch ? targetMatch[1] : null;
    return steps.map((step) => {
      if (targetSel && (step.target === targetSel || step.target?.includes(targetSel))) {
        return { ...step, action: "click" };
      }
      return step;
    });
  }

  // Pattern 3: replace page.locator('OLD') with NEW
  const replaceMatch = patch.match(/replace page\.locator\('([^']+)'\) with\s+(.+)$/i);
  if (replaceMatch) {
    const oldSel = replaceMatch[1];
    const newTarget = replaceMatch[2].trim();
    return steps.map((step) => {
      if (step.target === oldSel || (step.target && step.target.includes(oldSel))) {
        return { ...step, target: newTarget };
      }
      return step;
    });
  }

  // Pattern 4: increase waitFor timeout
  if (patchLower.includes("increase waitfor timeout")) {
    const targetMatch = patch.match(/for\s+"([^"]+)"/i) || patch.match(/for\s+'([^']+)'/i);
    const targetSel = targetMatch ? targetMatch[1] : null;
    return steps.map((step) => {
      if (targetSel && (step.target === targetSel || step.target?.includes(targetSel))) {
        return { ...step, expectedOutcome: `${step.expectedOutcome || ""} (auto-healed wait timeout)` };
      }
      return step;
    });
  }

  return steps;
}

export async function applyHealingProposal(healProposalId: string) {
  const proposal = memory.healingProposals.get(healProposalId);
  if (proposal) proposal.status = "applied";

  // Also patch in-memory test cases across memory suites
  const targetCaseId = proposal?.testCaseId;
  const targetPatch = proposal?.patch;
  if (targetCaseId && targetPatch) {
    for (const s of memory.suites.values()) {
      for (const v of s.versions) {
        const c = v.cases.find((item) => item.id === targetCaseId);
        if (c) {
          c.steps = patchTestSteps(c.steps, targetPatch);
        }
      }
    }
  }

  return withFallback(
    async () => {
      const p = await prisma.healingProposal.update({
        where: { id: healProposalId },
        data: { status: "applied" }
      });

      // Update the actual TestCase in PostgreSQL database if exists
      if (p.testCaseId && p.patch) {
        try {
          const tc = await prisma.testCase.findUnique({
            where: { id: p.testCaseId }
          });
          if (tc && Array.isArray(tc.steps)) {
            const healedSteps = patchTestSteps(tc.steps as unknown as CanonicalTestStep[], p.patch);
            await prisma.testCase.update({
              where: { id: p.testCaseId },
              data: { steps: healedSteps as unknown as Prisma.InputJsonValue }
            });
          }
        } catch (err) {
          console.warn(`[applyHealingProposal] Could not update testCase ${p.testCaseId}:`, err);
        }
      }

      return {
        id: p.id,
        executionId: p.executionId,
        testCaseId: p.testCaseId,
        status: "applied" as const,
        patch: p.patch,
        rationale: p.rationale,
        signals: p.signals as unknown as HealingProposal["signals"]
      };
    },
    () => proposal ?? {
      id: healProposalId,
      testCaseId: "case_01",
      status: "applied" as const,
      patch: "page.getByRole('button', { name: 'Submit' })",
      rationale: "Remapped selector to role button",
      signals: []
    }
  );
}

// ── Subscriptions & Billing ──

const TIER_LIMITS: Record<PlanTier, { monthlyRuns: number; concurrentWorkers: number; aiGenerations: number; cloudMinutes: number; maxProjects: number; teamMembers: number }> = {
  student_free: { monthlyRuns: 500, concurrentWorkers: 3, aiGenerations: 50, cloudMinutes: 120, maxProjects: 10, teamMembers: 5 },
  pro: { monthlyRuns: 2500, concurrentWorkers: 8, aiGenerations: 250, cloudMinutes: 600, maxProjects: 25, teamMembers: 15 },
  team: { monthlyRuns: 10000, concurrentWorkers: 20, aiGenerations: 1000, cloudMinutes: 2400, maxProjects: 100, teamMembers: 50 },
  enterprise: { monthlyRuns: 100000, concurrentWorkers: 50, aiGenerations: 10000, cloudMinutes: 10000, maxProjects: 500, teamMembers: 500 }
};

export async function getWorkspaceSubscription(workspaceId: string): Promise<WorkspaceSubscription | null> {
  return withFallback(
    async () => {
      const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
      if (!sub) return memory.subscription;
      const tier = sub.tier as PlanTier;
      return {
        id: sub.id,
        workspaceId: sub.workspaceId,
        tier,
        status: sub.status as WorkspaceSubscription["status"],
        currentPeriodStart: sub.currentPeriodStart.toISOString(),
        currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        limits: {
          monthlyRuns: sub.monthlyRunsLimit,
          concurrentWorkers: sub.concurrentWorkers,
          aiGenerations: sub.aiGenerationsLimit,
          maestroCloudMinutes: sub.cloudMinutesLimit,
          maxProjects: sub.maxProjectsLimit,
          teamMembers: sub.teamMembersLimit
        }
      };
    },
    () => memory.subscription
  );
}

export async function updateWorkspaceSubscription(
  workspaceId: string,
  tier: PlanTier,
  paymentBrand?: string,
  paymentLast4?: string
): Promise<WorkspaceSubscription> {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.student_free;
  memory.subscription = {
    ...memory.subscription,
    tier,
    limits: {
      monthlyRuns: limits.monthlyRuns,
      concurrentWorkers: limits.concurrentWorkers,
      aiGenerations: limits.aiGenerations,
      maestroCloudMinutes: limits.cloudMinutes,
      maxProjects: limits.maxProjects,
      teamMembers: limits.teamMembers
    }
  };
  memory.quota.limits = {
    monthlyRuns: limits.monthlyRuns,
    aiGenerations: limits.aiGenerations,
    maestroCloudMinutes: limits.cloudMinutes,
    maxProjects: limits.maxProjects,
    teamMembers: limits.teamMembers
  };

  const invoice: Invoice = {
    id: uid("inv"),
    workspaceId,
    amountDue: tier === "pro" ? 2900 : tier === "team" ? 9900 : tier === "enterprise" ? 49900 : 0,
    amountPaid: tier === "pro" ? 2900 : tier === "team" ? 9900 : tier === "enterprise" ? 49900 : 0,
    currency: "usd",
    status: "paid",
    planName: `${tier.toUpperCase()} Plan Subscription`,
    createdAt: new Date().toISOString(),
    periodStart: new Date().toISOString(),
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };
  memory.invoices.unshift(invoice);

  return withFallback(
    async () => {
      await prisma.subscription.upsert({
        where: { workspaceId },
        create: {
          id: uid("sub"),
          workspaceId,
          tier,
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          monthlyRunsLimit: limits.monthlyRuns,
          concurrentWorkers: limits.concurrentWorkers,
          aiGenerationsLimit: limits.aiGenerations,
          cloudMinutesLimit: limits.cloudMinutes,
          maxProjectsLimit: limits.maxProjects,
          teamMembersLimit: limits.teamMembers
        },
        update: {
          tier,
          status: "active",
          monthlyRunsLimit: limits.monthlyRuns,
          concurrentWorkers: limits.concurrentWorkers,
          aiGenerationsLimit: limits.aiGenerations,
          cloudMinutesLimit: limits.cloudMinutes,
          maxProjectsLimit: limits.maxProjects,
          teamMembersLimit: limits.teamMembers
        }
      });
      return memory.subscription;
    },
    () => memory.subscription
  );
}

export async function listInvoices(workspaceId: string): Promise<Invoice[]> {
  return withFallback(
    async () => {
      const invoices = await prisma.invoice.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" }
      });
      if (invoices.length === 0) return memory.invoices;
      return invoices.map((inv) => ({
        id: inv.id,
        workspaceId: inv.workspaceId,
        amountDue: inv.amountDue,
        amountPaid: inv.amountPaid,
        currency: inv.currency,
        status: inv.status as Invoice["status"],
        createdAt: inv.createdAt.toISOString(),
        periodStart: inv.periodStart.toISOString(),
        periodEnd: inv.periodEnd.toISOString(),
        planName: inv.planName
      }));
    },
    () => memory.invoices
  );
}

export async function getUsageQuota(workspaceId: string): Promise<UsageQuota> {
  memory.quota.activeProjectsCount = memory.projects.size;
  return withFallback(
    async () => {
      const period = new Date().toISOString().slice(0, 7);
      const quota = await prisma.usageQuota.findUnique({
        where: { workspaceId_period: { workspaceId, period } }
      });
      if (!quota) return memory.quota;
      return {
        ...memory.quota,
        runsExecuted: quota.runsExecuted,
        aiGenerationsUsed: quota.aiGenerationsUsed,
        cloudMinutesUsed: quota.cloudMinutesUsed
      };
    },
    () => memory.quota
  );
}

export async function recordUsage(workspaceId: string, type: "run" | "ai" | "cloudMinutes", amount: number = 1): Promise<void> {
  if (type === "run") memory.quota.runsExecuted += amount;
  if (type === "ai") memory.quota.aiGenerationsUsed += amount;
  if (type === "cloudMinutes") memory.quota.cloudMinutesUsed += amount;

  await withFallback(
    async () => {
      const period = new Date().toISOString().slice(0, 7);
      await prisma.usageQuota.upsert({
        where: { workspaceId_period: { workspaceId, period } },
        create: {
          id: `quota_${period}_${workspaceId}`,
          workspaceId,
          period,
          runsExecuted: type === "run" ? amount : 0,
          aiGenerationsUsed: type === "ai" ? amount : 0,
          cloudMinutesUsed: type === "cloudMinutes" ? amount : 0
        },
        update: {
          ...(type === "run" ? { runsExecuted: { increment: amount } } : {}),
          ...(type === "ai" ? { aiGenerationsUsed: { increment: amount } } : {}),
          ...(type === "cloudMinutes" ? { cloudMinutesUsed: { increment: amount } } : {})
        }
      });
    },
    () => undefined
  );
}

// ── Audit Logs ──

export async function createAuditLog(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<AuditLogEntry> {
  const newLog: AuditLogEntry = {
    id: uid("log"),
    workspaceId: entry.workspaceId,
    actorId: entry.actorId,
    actorName: entry.actorName,
    actorEmail: entry.actorEmail,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityName: entry.entityName,
    details: entry.details,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    timestamp: new Date().toISOString()
  };
  memory.auditLogs.unshift(newLog);

  return withFallback(
    async () => {
      const created = await prisma.auditLog.create({
        data: {
          id: newLog.id,
          workspaceId: entry.workspaceId,
          actorId: entry.actorId,
          actorName: entry.actorName,
          actorEmail: entry.actorEmail,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          entityName: entry.entityName,
          details: entry.details ? asJson(entry.details) : undefined,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent
        }
      });
      return newLog;
    },
    () => newLog
  );
}

export async function listAuditLogs(workspaceId: string, limit: number = 50): Promise<AuditLogEntry[]> {
  return withFallback(
    async () => {
      const logs = await prisma.auditLog.findMany({
        where: { workspaceId },
        orderBy: { timestamp: "desc" },
        take: limit
      });
      if (logs.length === 0) return memory.auditLogs.slice(0, limit);
      return logs.map((log) => ({
        id: log.id,
        workspaceId: log.workspaceId,
        actorId: log.actorId,
        actorName: log.actorName,
        actorEmail: log.actorEmail,
        action: log.action as AuditLogEntry["action"],
        entityType: log.entityType as AuditLogEntry["entityType"],
        entityId: log.entityId,
        entityName: log.entityName || undefined,
        details: (log.details as Record<string, unknown> | null) || undefined,
        ipAddress: log.ipAddress || undefined,
        userAgent: log.userAgent || undefined,
        timestamp: log.timestamp.toISOString()
      }));
    },
    () => memory.auditLogs.slice(0, limit)
  );
}

// ── Student Academy Progress ──

export async function getStudentProgress(userId: string): Promise<StudentProgressRecord | null> {
  return withFallback(
    async () => {
      const record = await prisma.studentProgress.findUnique({ where: { userId } });
      if (!record) return memory.studentProgress.get(userId) ?? null;
      return {
        userId: record.userId,
        completedModules: (record.completedModules as string[]) || [],
        moduleQuizScores: (record.moduleQuizScores as Record<string, number>) || {},
        earnedBadges: (record.earnedBadges as StudentProgressRecord["earnedBadges"]) || [],
        totalTestsAnalyzed: record.totalTestsAnalyzed,
        averageQualityScore: record.averageQualityScore
      };
    },
    () => memory.studentProgress.get(userId) ?? null
  );
}

export async function saveStudentProgress(userId: string, updates: Partial<StudentProgressRecord>): Promise<StudentProgressRecord> {
  const current = memory.studentProgress.get(userId) ?? {
    userId,
    completedModules: [],
    moduleQuizScores: {},
    earnedBadges: [],
    totalTestsAnalyzed: 0,
    averageQualityScore: 0
  };
  const updated: StudentProgressRecord = {
    ...current,
    ...(updates.completedModules ? { completedModules: updates.completedModules } : {}),
    ...(updates.moduleQuizScores ? { moduleQuizScores: updates.moduleQuizScores } : {}),
    ...(updates.earnedBadges ? { earnedBadges: updates.earnedBadges } : {}),
    ...(updates.totalTestsAnalyzed !== undefined ? { totalTestsAnalyzed: updates.totalTestsAnalyzed } : {}),
    ...(updates.averageQualityScore !== undefined ? { averageQualityScore: updates.averageQualityScore } : {})
  };
  memory.studentProgress.set(userId, updated);

  return withFallback(
    async () => {
      await prisma.studentProgress.upsert({
        where: { userId },
        create: {
          id: uid("prog"),
          userId,
          completedModules: asJson(updated.completedModules),
          moduleQuizScores: asJson(updated.moduleQuizScores),
          earnedBadges: asJson(updated.earnedBadges),
          totalTestsAnalyzed: updated.totalTestsAnalyzed,
          averageQualityScore: updated.averageQualityScore
        },
        update: {
          completedModules: asJson(updated.completedModules),
          moduleQuizScores: asJson(updated.moduleQuizScores),
          earnedBadges: asJson(updated.earnedBadges),
          totalTestsAnalyzed: updated.totalTestsAnalyzed,
          averageQualityScore: updated.averageQualityScore
        }
      });
      return updated;
    },
    () => updated
  );
}

// ── API Key Management ──

export async function createApiKey(
  workspaceId: string,
  name: string,
  scopes: ApiKeyScope[],
  expiresInDays?: number
): Promise<{ apiKey: ApiKey; rawSecretKey: string }> {
  const id = uid("key");
  const randomHex = randomBytes(24).toString("hex");
  const keyPrefix = `sct_live_${randomHex.slice(0, 8)}`;
  const rawSecretKey = `sct_live_${randomHex}`;
  const hashedKey = createHash("sha256").update(rawSecretKey).digest("hex");

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const apiKey: ApiKey = {
    id,
    workspaceId,
    name,
    keyPrefix,
    scopes,
    createdAt: new Date().toISOString(),
    expiresAt
  };

  memory.apiKeys.set(id, { key: apiKey, hashedKey });
  return { apiKey, rawSecretKey };
}

export async function listApiKeys(workspaceId: string): Promise<ApiKey[]> {
  const list: ApiKey[] = [];
  for (const item of memory.apiKeys.values()) {
    if (item.key.workspaceId === workspaceId) {
      list.push(item.key);
    }
  }
  return list;
}

export async function validateApiKey(rawKey: string): Promise<{ valid: boolean; apiKey?: ApiKey }> {
  const hashed = createHash("sha256").update(rawKey).digest("hex");
  for (const item of memory.apiKeys.values()) {
    if (item.hashedKey === hashed) {
      if (item.key.expiresAt && new Date(item.key.expiresAt) < new Date()) {
        return { valid: false };
      }
      item.key.lastUsedAt = new Date().toISOString();
      return { valid: true, apiKey: item.key };
    }
  }
  return { valid: false };
}

export async function deleteApiKey(apiKeyId: string): Promise<{ deleted: boolean }> {
  memory.apiKeys.delete(apiKeyId);
  return { deleted: true };
}
