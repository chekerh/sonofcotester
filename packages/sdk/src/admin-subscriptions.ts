export type PlanTier = "student_free" | "pro" | "team" | "enterprise";

export interface PlanFeature {
  name: string;
  included: boolean;
  limit?: string | number;
}

export interface PlanLimits {
  monthlyRuns: number;
  concurrentWorkers: number;
  aiGenerations: number;
  maestroCloudMinutes: number;
  maxProjects: number;
  teamMembers: number;
}

export interface SubscriptionPlan {
  id: PlanTier;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  limits: PlanLimits;
  features: PlanFeature[];
}

export interface WorkspaceSubscription {
  id: string;
  workspaceId: string;
  tier: PlanTier;
  status: "active" | "trialing" | "past_due" | "canceled" | "unpaid";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  paymentMethod?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  limits: {
    monthlyRuns: number;
    concurrentWorkers: number;
    aiGenerations: number;
    maestroCloudMinutes: number;
    maxProjects: number;
    teamMembers: number;
  };
}

export interface UsageQuota {
  workspaceId: string;
  period: string; // e.g. "2026-08"
  runsExecuted: number;
  aiGenerationsUsed: number;
  cloudMinutesUsed: number;
  activeProjectsCount: number;
  teamMembersCount: number;
  limits: {
    monthlyRuns: number;
    aiGenerations: number;
    maestroCloudMinutes: number;
    maxProjects: number;
    teamMembers: number;
  };
}

export interface Invoice {
  id: string;
  workspaceId: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: "paid" | "open" | "void" | "uncollectible";
  invoicePdfUrl?: string;
  hostedInvoiceUrl?: string;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  planName: string;
}

export type AuditLogAction =
  | "user.login"
  | "user.invite"
  | "user.role_update"
  | "project.create"
  | "project.update"
  | "project.delete"
  | "suite.generate"
  | "suite.update"
  | "suite.delete"
  | "testcase.create"
  | "testcase.update"
  | "testcase.delete"
  | "execution.start"
  | "execution.cancel"
  | "healing.apply"
  | "healing.reject"
  | "scan.trigger"
  | "alert.acknowledge"
  | "alert.resolve"
  | "subscription.upgrade"
  | "subscription.cancel"
  | "maestro.execute";

export interface AuditLogEntry {
  id: string;
  workspaceId: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  action: AuditLogAction;
  entityType: "project" | "suite" | "testcase" | "execution" | "subscription" | "scan" | "alert" | "system";
  entityId: string;
  entityName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface SystemAPMOverview {
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  api: {
    status: "healthy" | "degraded" | "down";
    latencyP50Ms: number;
    latencyP95Ms: number;
    requestsPerMinute: number;
    errorRatePercent: number;
    memoryMb: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
  };
  redis: {
    status: "connected" | "disconnected" | "reconnecting";
    usedMemoryMb: number;
    connectedClients: number;
    opsPerSec: number;
  };
  database: {
    status: "connected" | "disconnected";
    activeConnections: number;
    idleConnections: number;
    poolSize: number;
    latencyMs: number;
  };
  workerQueue: {
    status: "active" | "paused" | "stalled";
    activeJobs: number;
    waitingJobs: number;
    completedJobs: number;
    failedJobs: number;
    delayedJobs: number;
    workerCount: number;
  };
}
