export * from "./monitoring.js";
export * from "./admin-subscriptions.js";
export * from "./student-academy.js";
export * from "./tools-integration.js";
export * from "./api-keys.js";
export * from "./benchmark.js";

export type UserRole = "owner" | "manager" | "tester" | "viewer";
export type SourceType = "jira" | "story" | "spec-upload" | "crawled_dom";
export type TargetPlatform = "web" | "mobile";
export type ProviderName =
  | "playwright-local"
  | "browserstack-web"
  | "browserstack-mobile"
  | "custom-appium"
  | "maestro-local"
  | "maestro-cloud";
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

export type ExecutionTarget = BrowserMatrixTarget | MobileMatrixTarget | MaestroMatrixTarget;

export interface MaestroMatrixTarget {
  platformName: "ios" | "android" | "web";
  deviceName?: string;
  osVersion?: string;
  appId?: string;
  /** Optional Maestro Cloud device config */
  cloudDeviceModel?: string;
  cloudDeviceOsVersion?: string;
}

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

export interface DiscoveredElement {
  id: string;
  type: "button" | "input" | "link" | "select" | "heading";
  tag: string;
  text?: string;
  selector: string;
  role?: string;
  placeholder?: string;
  inputType?: string;
  name?: string;
  isVisible?: boolean;
}

export interface CrawlResult {
  url: string;
  title: string;
  statusCode: number;
  screenshotBase64?: string;
  elements: DiscoveredElement[];
  formsCount: number;
  linksCount: number;
  buttonsCount: number;
  inputsCount: number;
  headings: string[];
  consoleErrors: string[];
  capturedAt: string;
  discoveredRoutes?: string[];
  a11yScore?: number;
  a11yViolationsCount?: number;
}

export interface TestGenerationRequest {
  sourceType: SourceType;
  sourcePayload: string;
  targetPlatform: TargetPlatform;
  browserOrDeviceScope: string[];
  targetUrl?: string;
  discoveredElements?: DiscoveredElement[];
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
  externalSessionId?: string;
  externalSessionUrl?: string;
  executionMetadata?: Record<string, unknown>;
  matrix: ExecutionTarget[];
  artifacts: ExecutionArtifact[];
  stepEvents: StepEvent[];
  healingProposals: HealingProposal[];
  bugDrafts: BugDraft[];
}

export type ExecutionEventType =
  | "queued"
  | "started"
  | "completed"
  | "failed"
  | "healing-ready";

export interface ExecutionStreamEvent {
  type: ExecutionEventType;
  runId: string;
  run: ExecutionRun;
  timestamp: string;
}

export const EXECUTION_STREAM_CHANNEL = "execution-stream";

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

// ── Maestro Flow Types ──

export interface MaestroFlowCommand {
  /** The Maestro command keyword, e.g. launchApp, tapOn, inputText */
  command: string;
  /** Value for the command (text argument or inline object) */
  value?: string | Record<string, unknown>;
  /** Optional comment to emit as YAML comment above this command */
  comment?: string;
}

export interface MaestroFlow {
  /** Maestro appId header (e.g. com.example.app) */
  appId: string;
  /** Human-readable name for the flow */
  name: string;
  /** Tags for filtering in Maestro CLI */
  tags?: string[];
  /** Environment variables available to the flow */
  env?: Record<string, string>;
  /** Ordered list of Maestro commands */
  commands: MaestroFlowCommand[];
}

export interface MaestroFlowResult {
  /** Whether the flow passed */
  passed: boolean;
  /** Raw stdout from maestro test */
  stdout: string;
  /** Raw stderr from maestro test */
  stderr: string;
  /** Exit code of the maestro CLI process */
  exitCode: number;
  /** Path to the generated YAML flow file */
  flowPath: string;
  /** Screenshot directory if maestro captured screenshots */
  screenshotsDir?: string;
  /** Video recording path if maestro captured a recording */
  recordingPath?: string;
  /** Parsed step results if available */
  steps?: MaestroStepResult[];
}

export interface MaestroStepResult {
  /** Maestro command name */
  command: string;
  /** Whether this step passed */
  passed: boolean;
  /** Error message if failed */
  error?: string;
}

export interface MaestroGenerateRequest {
  /** The canonical test cases to convert to Maestro flows */
  cases: CanonicalTestCase[];
  /** Target app ID (required for mobile) */
  appId: string;
  /** Optional env vars to inject */
  env?: Record<string, string>;
  /** Tags to apply to all generated flows */
  tags?: string[];
}

export interface MaestroExecuteRequest {
  /** The Maestro flow(s) to execute */
  flows: MaestroFlow[];
  /** Execution environment */
  environment?: string;
  /** Target device config */
  target?: MaestroMatrixTarget;
  /** Optional timeout in seconds (default: 300) */
  timeoutSeconds?: number;
}

// ── AI-powered spec-to-Maestro generation ──

export type SpecSource = "jira" | "story" | "spec-upload" | "freeform";

export interface MaestroSpecGenerateRequest {
  /** Source type of the input */
  sourceType: SpecSource;
  /** The raw spec text — Jira ticket content, user story, spec doc, or freeform description */
  sourcePayload: string;
  /** Target app ID for the Maestro flows */
  appId: string;
  /** Target platform */
  platform: TargetPlatform;
  /** Additional context: app URL, auth requirements, known test data */
  context?: {
    /** Base URL of the app (for web) */
    baseUrl?: string;
    /** Auth instructions (e.g. "login with test@test.com / password123") */
    authInstructions?: string;
    /** Any existing test data or seeds */
    testData?: string;
    /** App-specific selectors or accessibility labels the AI should know about */
    knownSelectors?: string[];
    /** Devices to target */
    devices?: string[];
  };
  /** Tags to apply to all generated flows */
  tags?: string[];
  /** Whether to include error-handling / negative test flows */
  includeNegativeTests?: boolean;
  /** Max number of test cases to generate (default: 10) */
  maxCases?: number;
}

export interface MaestroSpecGenerateResult {
  /** Summary of what was generated */
  summary: string;
  /** Source type used */
  sourceType: SpecSource;
  /** The AI-extracted test cases (canonical form) */
  testCases: CanonicalTestCase[];
  /** Generated Maestro flows (in-memory) */
  flows: MaestroFlow[];
  /** Serialized YAML files ready to save */
  yamlFiles: Array<{ filename: string; yaml: string }>;
  /** Confidence that the generation was accurate (0–1) */
  confidence: number;
  /** Any caveats or notes about the generation */
  notes: string[];
}

export interface ProviderCapability {
  provider: ProviderName;
  platform: TargetPlatform;
  mode: "local" | "cloud" | "custom";
  ready: boolean;
  status: "ready" | "configuration-required" | "planned";
  summary: string;
  requirements: string[];
}

// ── Maestro-specific capabilities ──
export interface MaestroProviderCapability extends ProviderCapability {
  provider: "maestro-local" | "maestro-cloud";
  /** Whether Maestro CLI is installed and accessible */
  cliInstalled: boolean;
  /** Detected Maestro CLI version */
  cliVersion?: string;
  /** Connected device count */
  connectedDevices: number;
  /** Supported platforms */
  supportedPlatforms: Array<"android" | "ios" | "web">;
}

// ── Local AI & Ollama Integration Types ──

export interface OllamaModelDetails {
  parent_model?: string;
  format?: string;
  family?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
  context_length?: number;
  embedding_length?: number;
}

export interface OllamaModelInfo {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: OllamaModelDetails;
  capabilities?: string[];
}

export interface LocalAiStatus {
  available: boolean;
  endpoint: string;
  activeModel: string | null;
  installedModels: OllamaModelInfo[];
  recommendedModel?: string;
  version?: string;
}

export interface LocalAiGenerateRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  format?: "json";
  temperature?: number;
}

export interface LocalAiGenerateResponse {
  response: string;
  model: string;
  totalDurationMs?: number;
  tokensEvaluated?: number;
}

