export interface A11yAuditRule {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical";
  tags: string[];
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    target: string[];
    html: string;
    failureSummary: string;
  }>;
}

export interface A11yAuditResult {
  url: string;
  timestamp: string;
  wcagLevel: "A" | "AA" | "AAA";
  score: number; // 0-100
  violations: A11yAuditRule[];
  passesCount: number;
  inapplicableCount: number;
}

export interface LoadTestScenario {
  name: string;
  targetUrl: string;
  durationSeconds: number;
  virtualUsers: number;
  rampUpSeconds?: number;
  thresholds?: {
    p95LatencyMs?: number;
    errorRatePercent?: number;
  };
}

export interface LoadTestResult {
  id: string;
  scenario: LoadTestScenario;
  startedAt: string;
  finishedAt: string;
  passed: boolean;
  metrics: {
    totalRequests: number;
    requestsPerSecond: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    latencyP99Ms: number;
    errorRatePercent: number;
  };
  stdout?: string;
}
