export type UserRole = "owner" | "manager" | "tester" | "viewer";
export type SourceType = "jira" | "story" | "spec-upload";
export type TargetPlatform = "web" | "mobile";
export type ProviderName =
  | "playwright-local"
  | "browserstack-web"
  | "browserstack-mobile"
  | "custom-appium";
export type RunStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "canceled"
  | "healing-required";
export type StepStatus = "pending" | "running" | "passed" | "failed";
export type Severity = "low" | "medium" | "high" | "critical";

export interface BrowserMatrixTarget {
  browserName: "chromium" | "firefox" | "webkit" | "chrome" | "edge";
  deviceProfile?: string;
  os?: string;
  baseUrl?: string;
}

export interface MobileMatrixTarget {
  platformName: "ios" | "android";
  deviceName: string;
  osVersion?: string;
  appId?: string;
}

export type ExecutionTarget = BrowserMatrixTarget | MobileMatrixTarget;

export interface CanonicalTestStep {
  id: string;
  action: "navigate" | "click" | "fill" | "assertText" | "assertVisible";
  target?: string;
  data?: string;
  expectedOutcome: string;
}

export interface CanonicalTestCase {
  id: string;
  title: string;
  feature: string;
  priority: "p0" | "p1" | "p2" | "p3";
  platform: TargetPlatform;
  prerequisites: string[];
  tags: string[];
  steps: CanonicalTestStep[];
}

export interface GeneratedTestSuiteDraft {
  id: string;
  sourceType: SourceType;
  summary: string;
  cases: CanonicalTestCase[];
}

export interface PersistedSuiteVersion {
  id: string;
  suiteId: string;
  versionNumber: number;
  status: "draft" | "ready" | "archived";
  notes?: string;
  cases: CanonicalTestCase[];
}

export interface PersistedSuite {
  id: string;
  projectId: string;
  sourceType: SourceType;
  summary: string;
  versions: PersistedSuiteVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionArtifact {
  id: string;
  type: "trace" | "screenshot" | "video" | "log" | "dom-snapshot";
  label: string;
  url: string;
  createdAt: string;
}

export interface StepEvent {
  id: string;
  testCaseId: string;
  stepId: string;
  status: StepStatus;
  message: string;
  createdAt: string;
}

export interface HealingSignal {
  type: "locator" | "dom-similarity" | "visual" | "vlm";
  confidence: number;
  description: string;
}

export interface HealingProposal {
  id: string;
  executionId?: string;
  testCaseId: string;
  status: "pending" | "approved" | "rejected" | "applied";
  patch: string;
  rationale: string;
  signals: HealingSignal[];
}

export interface BugDraft {
  id: string;
  title: string;
  summary: string;
  severity: Severity;
  reproductionSteps: string[];
  evidence: ExecutionArtifact[];
}

export interface IntegrationLink {
  id: string;
  provider: "jira" | "github-actions" | "jenkins" | "gitlab";
  externalId: string;
  metadata: Record<string, string>;
}

export interface TestGenerationRequest {
  sourceType: SourceType;
  sourcePayload: string;
  targetPlatform: TargetPlatform;
  browserOrDeviceScope: string[];
}

export interface TestSuiteUpdateRequest {
  summary: string;
  notes?: string;
  cases: CanonicalTestCase[];
}

export interface ExecutionRequest {
  suiteVersionId: string;
  environment: string;
  provider: ProviderName;
  matrix: ExecutionTarget[];
}

export interface ExecutionRun {
  id: string;
  suiteId: string;
  suiteVersionId: string;
  provider: ProviderName;
  environment: string;
  status: RunStatus;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  matrix: ExecutionTarget[];
  artifacts: ExecutionArtifact[];
  stepEvents: StepEvent[];
  healingProposals: HealingProposal[];
  bugDrafts: BugDraft[];
}

export interface JiraSyncRequest {
  projectKey: string;
  issueTypes: string[];
}

export interface GitHubActionsWebhookPayload {
  workflowName: string;
  repository: string;
  branch: string;
  conclusion?: string;
  sha: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  latestRun?: ExecutionRun;
}

export interface GeneratedSuiteResponse {
  suiteId: string;
  suiteVersionId: string;
  draft: GeneratedTestSuiteDraft;
}
