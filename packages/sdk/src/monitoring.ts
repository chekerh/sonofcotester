// ─── Security Scanning ────────────────────────────────────────────────

export type VulnerabilitySeverity = "info" | "low" | "medium" | "high" | "critical";
export type ScanStatus = "queued" | "running" | "completed" | "failed";
export type ScanCategory =
  | "owasp-top10"
  | "dependency-audit"
  | "secrets-detection"
  | "xss"
  | "sql-injection"
  | "authentication"
  | "authorization"
  | "input-validation"
  | "crypto-strength"
  | "configuration";

export interface SecurityVulnerability {
  id: string;
  scanId: string;
  category: ScanCategory;
  severity: VulnerabilitySeverity;
  title: string;
  description: string;
  file?: string;
  line?: number;
  recommendation: string;
  cweId?: string;
  cvssScore?: number;
  firstDetectedAt: string;
  status: "open" | "acknowledged" | "fixed" | "false-positive";
}

export interface SecurityScan {
  id: string;
  projectId: string;
  triggeredBy: "manual" | "ci" | "schedule" | "webhook";
  status: ScanStatus;
  categories: ScanCategory[];
  startedAt?: string;
  finishedAt?: string;
  duration?: number;
  totalFilesScanned: number;
  totalDependenciesAudited: number;
  vulnerabilities: SecurityVulnerability[];
  summary: SecuritySummary;
  metadata?: Record<string, unknown>;
}

export interface SecuritySummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  fixedSinceLastScan: number;
  newSinceLastScan: number;
  score: number; // 0-100 health score
}

// ─── UI/UX Health ─────────────────────────────────────────────────────

export type UICheckType =
  | "accessibility"
  | "contrast"
  | "responsive"
  | "performance"
  | "visual-regression"
  | "broken-elements"
  | "load-time"
  | "interaction";

export type UICheckSeverity = "pass" | "warning" | "fail" | "error";

export interface UICheck {
  id: string;
  sessionId: string;
  type: UICheckType;
  severity: UICheckSeverity;
  element?: string;
  selector?: string;
  page: string;
  description: string;
  screenshot?: string;
  wcagLevel?: "A" | "AA" | "AAA";
  impact?: "minor" | "moderate" | "serious" | "critical";
  recommendation?: string;
  detectedAt: string;
}

export interface UIHealthSession {
  id: string;
  projectId: string;
  url: string;
  status: ScanStatus;
  startedAt?: string;
  finishedAt?: string;
  checks: UICheck[];
  score: UIHealthScore;
  pagesScanned: number;
  screenshots: UIScreenshot[];
}

export interface UIHealthScore {
  overall: number; // 0-100
  accessibility: number;
  performance: number;
  bestPractices: number;
  seo: number;
}

export interface UIScreenshot {
  id: string;
  page: string;
  viewport: string;
  url: string;
  timestamp: string;
  diffPercent?: number;
  baselineId?: string;
}

// ─── Database Operations ──────────────────────────────────────────────

export type DBMetricType =
  | "query-latency"
  | "connection-pool"
  | "slow-query"
  | "deadlock"
  | "error-rate"
  | "replication-lag"
  | "storage-usage"
  | "index-usage"
  | "transaction-throughput"
  | "cache-hit-ratio";

export interface DBMetric {
  id: string;
  projectId: string;
  type: DBMetricType;
  value: number;
  unit: string;
  threshold?: number;
  status: "healthy" | "warning" | "critical";
  connectionName?: string;
  database?: string;
  table?: string;
  query?: string;
  recordedAt: string;
}

export interface DBHealthSnapshot {
  id: string;
  projectId: string;
  timestamp: string;
  connectionStatus: "connected" | "degraded" | "disconnected";
  activeConnections: number;
  maxConnections: number;
  queryLatencyP50: number;
  queryLatencyP95: number;
  queryLatencyP99: number;
  slowQueries: number;
  deadlocks: number;
  storageUsedBytes: number;
  storageTotalBytes: number;
  cacheHitRatio: number;
  replicationLagMs?: number;
  score: number; // 0-100
  metrics: DBMetric[];
  warnings: DBWarning[];
}

export interface DBWarning {
  id: string;
  type: DBMetricType;
  message: string;
  severity: "info" | "warning" | "critical";
  recommendation: string;
  detectedAt: string;
}

// ─── Performance Metrics ──────────────────────────────────────────────

export type PerfMetricType =
  | "response-time"
  | "throughput"
  | "error-rate"
  | "cpu-usage"
  | "memory-usage"
  | "disk-io"
  | "network-io"
  | "gc-pause"
  | "event-loop-lag"
  | "heap-usage"
  | "active-handles"
  | "uptime";

export interface PerformanceMetric {
  id: string;
  projectId: string;
  serviceName: string;
  type: PerfMetricType;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  recordedAt: string;
}

export interface PerformanceSnapshot {
  id: string;
  projectId: string;
  timestamp: string;
  services: ServicePerformance[];
  overall: PerformanceScore;
}

export interface ServicePerformance {
  name: string;
  status: "healthy" | "degraded" | "down";
  uptime: number; // percentage
  responseTime: { p50: number; p95: number; p99: number };
  throughput: number; // requests/sec
  errorRate: number; // percentage
  cpu: number; // percentage
  memory: { used: number; total: number; percentage: number };
  gcPauses: number;
  eventLoopLag: number;
  metrics: PerformanceMetric[];
}

export interface PerformanceScore {
  overall: number; // 0-100
  availability: number;
  responsiveness: number;
  efficiency: number;
  reliability: number;
}

// ─── Health Dashboard ─────────────────────────────────────────────────

export type HealthDimension = "security" | "ui-ux" | "database" | "performance" | "testing";

export interface HealthOverview {
  projectId: string;
  timestamp: string;
  overallScore: number; // 0-100
  dimensions: HealthDimensionScore[];
  alerts: HealthAlert[];
  trend: HealthTrendPoint[];
  lastScanIds: {
    security?: string;
    ui?: string;
    db?: string;
    performance?: string;
  };
}

export interface HealthDimensionScore {
  dimension: HealthDimension;
  score: number; // 0-100
  status: "excellent" | "good" | "fair" | "poor" | "critical";
  trend: "improving" | "stable" | "degrading";
  lastChecked?: string;
  issueCount: number;
}

export interface HealthAlert {
  id: string;
  projectId: string;
  dimension: HealthDimension;
  severity: VulnerabilitySeverity;
  title: string;
  message: string;
  actionUrl?: string;
  acknowledged: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface HealthTrendPoint {
  timestamp: string;
  overallScore: number;
  securityScore: number;
  uiScore: number;
  dbScore: number;
  performanceScore: number;
}

// ─── Real-time Stream Events ──────────────────────────────────────────

export type HealthEventType =
  | "security-scan-completed"
  | "vulnerability-found"
  | "vulnerability-fixed"
  | "ui-check-completed"
  | "ui-score-changed"
  | "db-metric-recorded"
  | "db-alert-triggered"
  | "perf-metric-recorded"
  | "perf-alert-triggered"
  | "health-score-changed"
  | "service-status-changed";

export interface HealthStreamEvent {
  type: HealthEventType;
  projectId: string;
  dimension: HealthDimension;
  timestamp: string;
  data: Record<string, unknown>;
  summary: string;
}

// ─── API Request/Response Types ───────────────────────────────────────

export interface TriggerScanRequest {
  projectId: string;
  categories?: ScanCategory[];
  targetUrl?: string;
}

export interface HealthQueryParams {
  projectId: string;
  from?: string;
  to?: string;
  dimensions?: HealthDimension[];
}

export interface UIHealthScanRequest {
  projectId: string;
  url: string;
  pages?: string[];
  viewport?: string;
}

export interface DBHealthQueryRequest {
  projectId: string;
  connectionName?: string;
  duration?: number; // minutes
}

// ─── Scheduled Health Scans ───────────────────────────────────────────

export type SchedulerStatus = "stopped" | "running" | "paused";

export interface SchedulerConfig {
  /** Scan interval in milliseconds (default: 5 minutes) */
  intervalMs: number;
  /** Projects to scan (empty = all projects) */
  projectIds: string[];
  /** Target URL for UI scans */
  targetUrl: string;
  /** Which scan dimensions to run */
  dimensions: HealthDimension[];
  /** Max number of consecutive failures before auto-pausing */
  maxConsecutiveFailures: number;
}

export interface SchedulerState {
  status: SchedulerStatus;
  config: SchedulerConfig;
  /** ISO timestamp of last successful scan */
  lastRunAt?: string;
  /** ISO timestamp of next scheduled scan */
  nextRunAt?: string;
  /** Total scans completed since start */
  totalRuns: number;
  /** Current consecutive failure count */
  consecutiveFailures: number;
  /** Per-project scan history (last N runs) */
  runHistory: SchedulerRunRecord[];
  /** ISO timestamp when scheduler was started */
  startedAt?: string;
  /** Uptime in seconds since started */
  uptimeSeconds: number;
}

export interface SchedulerRunRecord {
  id: string;
  projectId: string;
  startedAt: string;
  finishedAt: string;
  duration: number;
  overallScore: number;
  status: "completed" | "failed";
  error?: string;
  dimensionsScanned: HealthDimension[];
  alertCount: number;
}

export interface SchedulerUpdateRequest {
  intervalMs?: number;
  projectIds?: string[];
  targetUrl?: string;
  dimensions?: HealthDimension[];
  maxConsecutiveFailures?: number;
}

// ─── PR Health Summary ────────────────────────────────────────────────

export type GitHubCheckConclusion =
  | "success"
  | "failure"
  | "neutral"
  | "cancelled"
  | "timed_out"
  | "action_required";

export type PRHealthCheckStatus = "queued" | "in_progress" | "completed";

export interface PRHealthSummaryRequest {
  /** Repository in "owner/repo" format */
  repository: string;
  /** Pull request number */
  pullRequestNumber: number;
  /** Git SHA of the PR head */
  headSha: string;
  /** Branch name */
  branch: string;
  /** Base branch the PR targets */
  baseBranch: string;
  /** Project ID in Son of CodeTester */
  projectId: string;
  /** Target URL to run UI/UX scans against */
  targetUrl: string;
  /** Which dimensions to scan (default: all) */
  dimensions?: HealthDimension[];
  /** GitHub token for posting checks */
  githubToken?: string;
}

export interface PRHealthSummaryResult {
  id: string;
  repository: string;
  pullRequestNumber: number;
  headSha: string;
  branch: string;
  baseBranch: string;
  projectId: string;
  status: PRHealthCheckStatus;
  overallScore: number;
  dimensions: PRDimensionResult[];
  verdict: GitHubCheckConclusion;
  summary: string;
  annotations: PRAnnotation[];
  startedAt: string;
  finishedAt?: string;
  duration?: number;
  checkRunId?: number;
  checkRunUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PRDimensionResult {
  dimension: HealthDimension;
  score: number;
  status: "pass" | "warn" | "fail";
  issueCount: number;
  criticalCount: number;
  summary: string;
  scanId?: string;
}

export interface PRAnnotation {
  path?: string;
  startLine?: number;
  endLine?: number;
  annotationLevel: "notice" | "warning" | "failure";
  message: string;
  title: string;
}

export interface GitHubCheckCreateRequest {
  name: string;
  headSha: string;
  status: PRHealthCheckStatus;
  output?: {
    title: string;
    summary: string;
    annotations?: Array<{
      path?: string;
      start_line?: number;
      end_line?: number;
      annotation_level: "notice" | "warning" | "failure";
      message: string;
      title: string;
    }>;
  };
  conclusion?: GitHubCheckConclusion;
}

export interface GitHubCheckUpdateRequest {
  checkRunId: number;
  status?: PRHealthCheckStatus;
  conclusion?: GitHubCheckConclusion;
  output?: {
    title: string;
    summary: string;
    annotations?: Array<{
      path?: string;
      start_line?: number;
      end_line?: number;
      annotation_level: "notice" | "warning" | "failure";
      message: string;
      title: string;
    }>;
  };
}

export interface GitHubWebhookPullRequest {
  number: number;
  head: { sha: string; ref: string };
  base: { ref: string };
  title: string;
  html_url: string;
}

export interface GitHubWebhookPush {
  ref: string;
  after: string;
  repository: { full_name: string };
}

export interface PRHealthSummaryQueryParams {
  repository?: string;
  pullRequestNumber?: number;
  projectId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

// ─── Alert Delivery / Notifications ───────────────────────────────────

export type NotificationChannelType = "slack" | "pagerduty" | "email" | "webhook";

export type NotificationSeverity = "info" | "warning" | "critical";

export interface NotificationChannel {
  id: string;
  name: string;
  type: NotificationChannelType;
  enabled: boolean;
  /** Minimum severity to deliver (info sends all, critical sends only critical) */
  minSeverity: NotificationSeverity;
  /** Filter to specific dimensions (empty = all) */
  dimensions: HealthDimension[];
  /** Filter to specific project IDs (empty = all) */
  projectIds: string[];
  /** Channel-specific config */
  config: SlackChannelConfig | PagerDutyChannelConfig | EmailChannelConfig | WebhookChannelConfig;
  createdAt: string;
  updatedAt: string;
}

export interface SlackChannelConfig {
  /** Slack webhook URL (https://hooks.slack.com/services/...) */
  webhookUrl: string;
  /** Channel to post to (optional, overrides webhook default) */
  channel?: string;
  /** Bot name */
  username?: string;
  /** Icon emoji */
  iconEmoji?: string;
}

export interface PagerDutyChannelConfig {
  /** PagerDuty Events API v2 integration key */
  integrationKey: string;
  /** Severity mapping override */
  severityMap?: {
    info?: "info" | "error" | "warning" | "critical";
    warning?: "info" | "error" | "warning" | "critical";
    critical?: "info" | "error" | "warning" | "critical";
  };
  /** Optional routing key override */
  routingKey?: string;
}

export interface EmailChannelConfig {
  /** Comma-separated recipient addresses */
  recipients: string;
  /** SMTP host */
  smtpHost: string;
  /** SMTP port */
  smtpPort: number;
  /** SMTP username (optional, for auth) */
  smtpUser?: string;
  /** SMTP password (optional, for auth) */
  smtpPassword?: string;
  /** Use TLS */
  useTls: boolean;
  /** From address */
  fromAddress: string;
  /** From display name */
  fromName?: string;
}

export interface WebhookChannelConfig {
  /** Target URL for generic webhook POST */
  url: string;
  /** Optional headers (e.g. Authorization) */
  headers?: Record<string, string>;
  /** HTTP method (default: POST) */
  method?: "POST" | "PUT";
}

export interface NotificationPayload {
  id: string;
  channelId: string;
  channelType: NotificationChannelType;
  severity: NotificationSeverity;
  dimension: HealthDimension;
  projectId: string;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  sentAt: string;
  success: boolean;
  error?: string;
  /** Raw response from the external service */
  externalResponse?: string;
}

export interface NotificationDeliveryLog {
  id: string;
  alertId: string;
  channelId: string;
  channelType: NotificationChannelType;
  severity: NotificationSeverity;
  success: boolean;
  sentAt: string;
  error?: string;
}

export interface CreateNotificationChannelRequest {
  name: string;
  type: NotificationChannelType;
  enabled?: boolean;
  minSeverity?: NotificationSeverity;
  dimensions?: HealthDimension[];
  projectIds?: string[];
  config: SlackChannelConfig | PagerDutyChannelConfig | EmailChannelConfig | WebhookChannelConfig;
}

export interface UpdateNotificationChannelRequest {
  name?: string;
  enabled?: boolean;
  minSeverity?: NotificationSeverity;
  dimensions?: HealthDimension[];
  projectIds?: string[];
  config?: SlackChannelConfig | PagerDutyChannelConfig | EmailChannelConfig | WebhookChannelConfig;
}

export interface SendTestNotificationRequest {
  channelId: string;
  message?: string;
}

export interface NotificationStats {
  totalSent: number;
  totalFailed: number;
  byChannel: Array<{
    channelId: string;
    channelType: NotificationChannelType;
    sent: number;
    failed: number;
  }>;
  bySeverity: Array<{
    severity: NotificationSeverity;
    count: number;
  }>;
  lastSentAt?: string;
}

// ─── Alert Deduplication ──────────────────────────────────────────────

export interface DedupConfig {
  globalCooldownMs: number;
  perChannelCooldownMs: number;
  severityCooldowns: {
    info: number;
    warning: number;
    critical: number;
  };
  maxFingerprints: number;
  enabled: boolean;
}

export interface DedupStats {
  totalFingerprints: number;
  totalSuppressed: number;
  totalSent: number;
  enabled: boolean;
  config: DedupConfig;
  topSuppressed: Array<{
    fingerprint: string;
    suppressedCount: number;
    sentCount: number;
    lastSentAt: string;
  }>;
}

export interface UpdateDedupConfigRequest {
  enabled?: boolean;
  globalCooldownMs?: number;
  perChannelCooldownMs?: number;
  severityCooldowns?: {
    info?: number;
    warning?: number;
    critical?: number;
  };
  maxFingerprints?: number;
}

// ─── Alert Escalation ─────────────────────────────────────────────────

export type EscalationStepAction =
  | "notify"           // Send notification to specified channels
  | "page-oncall"      // Trigger PagerDuty page
  | "notify-slack"     // Post to a specific Slack channel
  | "webhook";         // Fire a generic webhook

export interface EscalationStep {
  /** Unique step ID within the rule */
  id: string;
  /** Human-readable step name */
  name: string;
  /** Delay in milliseconds after the previous step (or after alert creation for step 0) */
  delayMs: number;
  /** What action to take */
  action: EscalationStepAction;
  /** Severity to use for this step's notification (overrides the alert's original severity) */
  targetSeverity: NotificationSeverity;
  /** Channel IDs to notify (for "notify" action) */
  channelIds: string[];
  /** Message template — supports {{alert.title}}, {{alert.message}}, {{alert.severity}}, {{alert.dimension}}, {{rule.name}}, {{step.name}} */
  messageTemplate?: string;
  /** Whether this step should only fire once per alert (no re-escalation after acknowledgment) */
  onceOnly: boolean;
}

export interface EscalationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  /** Which dimensions this rule applies to (empty = all) */
  dimensions: HealthDimension[];
  /** Minimum alert severity to trigger escalation (default: high) */
  minSeverity: VulnerabilitySeverity;
  /** Which project IDs to apply to (empty = all) */
  projectIds: string[];
  /** Ordered escalation steps */
  steps: EscalationStep[];
  /** Maximum number of times to escalate a single alert (0 = unlimited) */
  maxEscalations: number;
  /** Auto-resolve after this many ms (0 = never auto-resolve) */
  autoResolveAfterMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  alertId: string;
  alertTitle: string;
  projectId: string;
  dimension: HealthDimension;
  stepId: string;
  stepName: string;
  action: EscalationStepAction;
  executedAt: string;
  success: boolean;
  error?: string;
  /** Total escalation count for this alert so far */
  escalationCount: number;
}

export interface EscalationState {
  /** Alert ID being tracked */
  alertId: string;
  /** Rule ID that matched */
  ruleId: string;
  /** Current step index in the escalation chain */
  currentStepIndex: number;
  /** Number of times this alert has been escalated */
  escalationCount: number;
  /** ISO timestamp when this alert was first registered for escalation */
  registeredAt: string;
  /** ISO timestamp when the last escalation step was executed */
  lastEscalatedAt?: string;
  /** ISO timestamp when this alert was acknowledged (stops escalation) */
  acknowledgedAt?: string;
  /** ISO timestamp when this alert was resolved (stops escalation) */
  resolvedAt?: string;
  /** Whether all steps have been executed */
  completed: boolean;
}

export interface CreateEscalationRuleRequest {
  name: string;
  description?: string;
  enabled?: boolean;
  dimensions?: HealthDimension[];
  minSeverity?: VulnerabilitySeverity;
  projectIds?: string[];
  steps: Array<{
    name: string;
    delayMs: number;
    action: EscalationStepAction;
    targetSeverity?: NotificationSeverity;
    channelIds?: string[];
    messageTemplate?: string;
    onceOnly?: boolean;
  }>;
  maxEscalations?: number;
  autoResolveAfterMs?: number;
}

export interface UpdateEscalationRuleRequest {
  name?: string;
  description?: string;
  enabled?: boolean;
  dimensions?: HealthDimension[];
  minSeverity?: VulnerabilitySeverity;
  projectIds?: string[];
  steps?: Array<{
    name: string;
    delayMs: number;
    action: EscalationStepAction;
    targetSeverity?: NotificationSeverity;
    channelIds?: string[];
    messageTemplate?: string;
    onceOnly?: boolean;
  }>;
  maxEscalations?: number;
  autoResolveAfterMs?: number;
}

export interface EscalationStats {
  activeEscalations: number;
  totalEscalations: number;
  byRule: Array<{
    ruleId: string;
    ruleName: string;
    count: number;
  }>;
  byAction: Array<{
    action: EscalationStepAction;
    count: number;
  }>;
  lastEscalationAt?: string;
}

// ─── Alerting Rules Engine ───────────────────────────────────────────

export type ComparisonOperator = "lt" | "lte" | "gt" | "gte" | "eq" | "neq";

export type AlertingRuleSeverity = VulnerabilitySeverity;

export interface AlertingRuleCondition {
  /** Dimension to evaluate */
  dimension: HealthDimension;
  /** Score field to check (e.g. "overall", "accessibility", "responseTime.p95") */
  metric: string;
  /** Comparison operator */
  operator: ComparisonOperator;
  /** Threshold value */
  threshold: number;
}

export interface AlertingRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  /** All conditions must be true for the rule to fire (AND logic) */
  conditions: AlertingRuleCondition[];
  /** Severity of the alert when the rule fires */
  severity: AlertingRuleSeverity;
  /** Alert title template — supports {{dimension}}, {{metric}}, {{value}}, {{threshold}} */
  titleTemplate: string;
  /** Alert message template — same variables */
  messageTemplate: string;
  /** Cooldown in ms between re-firing the same rule for the same project */
  cooldownMs: number;
  /** Which project IDs to apply to (empty = all) */
  projectIds: string[];
  /** Notification channel IDs to notify when this rule fires */
  channelIds: string[];
  /** Auto-resolve alert when condition is no longer true */
  autoResolve: boolean;
  /** Maximum number of times this rule can fire per project (0 = unlimited) */
  maxFiresPerProject: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlertingRuleEvaluation {
  ruleId: string;
  projectId: string;
  fired: boolean;
  conditionsMet: Array<{
    dimension: string;
    metric: string;
    operator: string;
    threshold: number;
    actualValue: number;
  }>;
  evaluatedAt: string;
}

export interface AlertingRuleStats {
  totalRules: number;
  enabledRules: number;
  totalFires: number;
  byRule: Array<{
    ruleId: string;
    ruleName: string;
    fireCount: number;
    lastFiredAt?: string;
  }>;
  byDimension: Array<{
    dimension: HealthDimension;
    fireCount: number;
  }>;
}

export interface CreateAlertingRuleRequest {
  name: string;
  description?: string;
  enabled?: boolean;
  conditions: Array<{
    dimension: HealthDimension;
    metric: string;
    operator: ComparisonOperator;
    threshold: number;
  }>;
  severity?: AlertingRuleSeverity;
  titleTemplate?: string;
  messageTemplate?: string;
  cooldownMs?: number;
  projectIds?: string[];
  channelIds?: string[];
  autoResolve?: boolean;
  maxFiresPerProject?: number;
}

export interface UpdateAlertingRuleRequest {
  name?: string;
  description?: string;
  enabled?: boolean;
  conditions?: Array<{
    dimension: HealthDimension;
    metric: string;
    operator: ComparisonOperator;
    threshold: number;
  }>;
  severity?: AlertingRuleSeverity;
  titleTemplate?: string;
  messageTemplate?: string;
  cooldownMs?: number;
  projectIds?: string[];
  channelIds?: string[];
  autoResolve?: boolean;
  maxFiresPerProject?: number;
}
