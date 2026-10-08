export type BackendStackId =
  | "node-express"
  | "bun-express"
  | "python-fastapi"
  | "php-laravel"
  | "php-octane"
  | "php-bare"
  | "csharp-aspnet"
  | "java-springboot"
  | "go-nethttp"
  | "rust-axum"
  | "custom";

export type DatabaseEngine = "postgres" | "sqlite-wal" | "custom";

export type SpeedTier =
  | "Tier 1: High-Performance Compiled (Rust, Go)"
  | "Tier 2: Managed Runtime / JIT (Java, C#, Bun)"
  | "Tier 3: Asynchronous JS (Node.js)"
  | "Tier 4: Interpreted Async (Python FastAPI)"
  | "Tier 5: Process-Fork Framework (PHP Laravel)";

export interface ServerSpecs {
  vCpuCores: number;
  cpuGhz: number;
  ramMb: number;
  storageGb: number;
  monthlyCostUsd: number;
  provider: string;
}

export interface DatabaseConfig {
  engine: DatabaseEngine;
  poolSize: number;
  connectionTimeoutMs: number;
  discardAllOnReset: boolean;
  walMode: boolean;
  storagePath?: string;
  queryExecutionTimeMs: number;
}

export interface DatasetScale {
  userCount: number;
  postCount: number;
  likeCount: number;
  estimatedDbSizeMb: number;
  inMemoryPercent: number;
}

export interface WorkloadProfile {
  thinkTimeMinSec: number;
  thinkTimeMaxSec: number;
  feedWeight: number;
  viewPostWeight: number;
  likePostProbability: number;
  createPostProbability: number;
  avgRequestsPerUserPerSec: number;
}

export interface FailureThresholds {
  maxP95LatencyMs: number;
  maxP99LatencyMs: number;
  maxErrorRatePercent: number;
}

export interface StackBenchmarkProfile {
  id: BackendStackId;
  name: string;
  runtime: string;
  framework: string;
  concurrencyModel: string;
  processCount: number;
  workerCount: number;
  defaultDb: DatabaseEngine;
  description: string;
}

export interface ParityCheckItem {
  id: string;
  name: string;
  endpoint: string;
  method: "GET" | "POST";
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  message: string;
}

export interface ParityCheckResult {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  allPassed: boolean;
  checks: ParityCheckItem[];
}

export interface ThroughputResult {
  endpoint: string;
  rawFeedRps: number;
  durationSec: number;
  medianLatencyMs: number;
  p95LatencyMs: number;
}

export type FailureReason =
  | "p95_exceeded"
  | "p99_exceeded"
  | "error_rate_exceeded"
  | "pool_timeout"
  | "connection_reset";

export interface BinarySearchStep {
  stepNumber: number;
  virtualUsers: number;
  rps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRatePercent: number;
  passed: boolean;
  failReason?: FailureReason;
  durationSec: number;
}

export interface StackBenchmarkResult {
  stack: StackBenchmarkProfile;
  dbConfig: DatabaseConfig;
  maxSupportedUsers: number;
  peakRps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRatePercent: number;
  cpuUtilizationPercent: {
    app: number;
    db: number;
    system: number;
    idle: number;
  };
  memoryUsageMb: number;
  bottleneckType:
    | "app_cpu"
    | "db_cpu"
    | "db_pool_timeout"
    | "framework_boot"
    | "driver_discard_all"
    | "memory_saturation";
  bottleneckExplanation: string;
  tier: SpeedTier;
  parityCheck: ParityCheckResult;
  rawThroughput: ThroughputResult;
  binarySearchHistory: BinarySearchStep[];
  confirmedDurationSec: number;
  confirmationPassed: boolean;
}

export interface FullShootoutConfig {
  name?: string;
  specs: ServerSpecs;
  stacks: BackendStackId[];
  database: DatabaseConfig;
  dataset: DatasetScale;
  workload: WorkloadProfile;
  thresholds: FailureThresholds;
  binarySearchStartUsers?: number;
  searchDurationSec?: number;
  confirmationDurationSec?: number;
  targetUrl?: string;
}

export interface SqliteVsPostgresComparison {
  stackId: BackendStackId;
  stackName: string;
  postgresUsers: number;
  postgresRps: number;
  sqliteUsers: number;
  sqliteRps: number;
  improvementPercent: number;
  dbBottleneckResolved: boolean;
}

export interface FullShootoutRun {
  id: string;
  name: string;
  createdAt: string;
  specs: ServerSpecs;
  dataset: DatasetScale;
  workload: WorkloadProfile;
  thresholds: FailureThresholds;
  database: DatabaseConfig;
  results: StackBenchmarkResult[];
  sqliteVsPostgresImpact: SqliteVsPostgresComparison[];
  k6Script: string;
  summary: string;
}
