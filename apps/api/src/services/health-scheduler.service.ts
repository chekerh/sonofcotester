import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { HealthService } from "./health.service.js";
import { HealthGateway } from "../gateways/health.gateway.js";
import type {
  HealthDimension,
  HealthOverview,
  SchedulerConfig,
  SchedulerRunRecord,
  SchedulerState,
  SchedulerUpdateRequest,
} from "@sonofcotester/sdk";

const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_CONFIG: SchedulerConfig = {
  intervalMs: 5 * 60 * 1000, // 5 minutes
  projectIds: ["proj_demo"],
  targetUrl: "http://localhost:3010",
  dimensions: ["security", "ui-ux", "database", "performance"],
  maxConsecutiveFailures: 5,
};

@Injectable()
export class HealthSchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthSchedulerService.name);

  private config: SchedulerConfig = { ...DEFAULT_CONFIG };
  private timer: ReturnType<typeof setInterval> | null = null;
  private status: "stopped" | "running" | "paused" = "stopped";
  private lastRunAt: string | undefined;
  private nextRunAt: string | undefined;
  private totalRuns = 0;
  private consecutiveFailures = 0;
  private startedAt: string | undefined;
  private runHistory: SchedulerRunRecord[] = [];

  constructor(
    private readonly healthService: HealthService,
    private readonly healthGateway: HealthGateway,
  ) {}

  onModuleDestroy() {
    this.stop();
  }

  // ── Public API ──

  getState(): SchedulerState {
    return {
      status: this.status,
      config: this.config,
      lastRunAt: this.lastRunAt,
      nextRunAt: this.nextRunAt,
      totalRuns: this.totalRuns,
      consecutiveFailures: this.consecutiveFailures,
      runHistory: this.runHistory.slice(-50),
      startedAt: this.startedAt,
      uptimeSeconds: this.startedAt
        ? Math.floor((Date.now() - new Date(this.startedAt).getTime()) / 1000)
        : 0,
    };
  }

  start(): SchedulerState {
    if (this.status === "running") {
      this.logger.warn("Scheduler already running");
      return this.getState();
    }

    this.status = "running";
    this.startedAt = this.startedAt ?? new Date().toISOString();
    this.consecutiveFailures = 0;

    this.logger.log(
      `Health scheduler started — interval ${this.config.intervalMs / 1000}s, projects: [${this.config.projectIds.join(", ")}]`,
    );

    // Run immediately on start
    void this.runAllProjects();

    // Then set interval
    this.timer = setInterval(() => {
      void this.runAllProjects();
    }, this.config.intervalMs);

    this.nextRunAt = new Date(Date.now() + this.config.intervalMs).toISOString();

    this.healthGateway.pushEvent(
      this.config.projectIds[0] ?? "proj_demo",
      "health-score-changed",
      "security",
      { scheduler: "started", intervalMs: this.config.intervalMs },
      `Health scheduler started (every ${this.config.intervalMs / 1000}s)`,
    );

    return this.getState();
  }

  stop(): SchedulerState {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.status = "stopped";
    this.nextRunAt = undefined;

    this.logger.log("Health scheduler stopped");

    if (this.config.projectIds[0]) {
      this.healthGateway.pushEvent(
        this.config.projectIds[0],
        "health-score-changed",
        "security",
        { scheduler: "stopped" },
        "Health scheduler stopped",
      );
    }

    return this.getState();
  }

  pause(): SchedulerState {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.status = "paused";

    this.logger.log("Health scheduler paused");
    return this.getState();
  }

  resume(): SchedulerState {
    if (this.status !== "paused") {
      this.logger.warn("Cannot resume — scheduler is not paused");
      return this.getState();
    }

    this.status = "running";
    this.timer = setInterval(() => {
      void this.runAllProjects();
    }, this.config.intervalMs);

    this.nextRunAt = new Date(Date.now() + this.config.intervalMs).toISOString();

    this.logger.log("Health scheduler resumed");
    return this.getState();
  }

  updateConfig(update: SchedulerUpdateRequest): SchedulerState {
    const wasRunning = this.status === "running";

    if (wasRunning) {
      this.stop();
    }

    if (update.intervalMs !== undefined) {
      this.config.intervalMs = Math.max(10_000, update.intervalMs); // minimum 10s
    }
    if (update.projectIds !== undefined) {
      this.config.projectIds = update.projectIds;
    }
    if (update.targetUrl !== undefined) {
      this.config.targetUrl = update.targetUrl;
    }
    if (update.dimensions !== undefined) {
      this.config.dimensions = update.dimensions;
    }
    if (update.maxConsecutiveFailures !== undefined) {
      this.config.maxConsecutiveFailures = update.maxConsecutiveFailures;
    }

    this.logger.log(`Scheduler config updated: interval=${this.config.intervalMs}ms`);

    if (wasRunning) {
      return this.start();
    }

    return this.getState();
  }

  getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  clearHistory(): void {
    this.runHistory = [];
    this.totalRuns = 0;
    this.consecutiveFailures = 0;
  }

  /**
   * Trigger an immediate scan for all configured projects,
   * independent of the schedule.
   */
  async triggerImmediate(projectId?: string): Promise<SchedulerRunRecord[]> {
    const projects = projectId ? [projectId] : this.config.projectIds;
    const results: SchedulerRunRecord[] = [];

    for (const pid of projects) {
      const record = await this.runSingleProject(pid);
      results.push(record);
    }

    return results;
  }

  // ── Internal ──

  private async runAllProjects(): Promise<void> {
    this.logger.debug(`Running scheduled health scan for ${this.config.projectIds.length} project(s)`);

    let anyFailed = false;

    for (const projectId of this.config.projectIds) {
      try {
        await this.runSingleProject(projectId);
        this.consecutiveFailures = 0;
      } catch (error) {
        anyFailed = true;
        this.consecutiveFailures++;
        this.logger.error(
          `Scheduled scan failed for ${projectId}: ${error instanceof Error ? error.message : "unknown"}`,
        );

        this.healthGateway.pushEvent(
          projectId,
          "health-score-changed",
          "security",
          { scheduler: "scan-failed", error: String(error) },
          `Scheduled scan failed for ${projectId}`,
        );

        if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
          this.logger.error(
            `Max consecutive failures (${this.config.maxConsecutiveFailures}) reached — auto-pausing scheduler`,
          );
          this.pause();

          this.healthGateway.pushEvent(
            projectId,
            "health-score-changed",
            "security",
            { scheduler: "auto-paused", consecutiveFailures: this.consecutiveFailures },
            `Scheduler auto-paused after ${this.consecutiveFailures} consecutive failures`,
          );
          return;
        }
      }
    }

    if (!anyFailed) {
      this.lastRunAt = new Date().toISOString();
      this.totalRuns++;
      this.nextRunAt = new Date(Date.now() + this.config.intervalMs).toISOString();
    }
  }

  private async runSingleProject(projectId: string): Promise<SchedulerRunRecord> {
    const startTime = Date.now();
    const scanId = uid();

    this.logger.debug(`Scanning project ${projectId}`);

    try {
      // Run the dimensions that are configured
      const overview = await this.healthService.runFullScan(projectId, this.config.targetUrl);

      const duration = Date.now() - startTime;
      const finishedAt = new Date().toISOString();

      const record: SchedulerRunRecord = {
        id: scanId,
        projectId,
        startedAt: new Date(startTime).toISOString(),
        finishedAt,
        duration,
        overallScore: overview.overallScore,
        status: "completed",
        dimensionsScanned: this.config.dimensions,
        alertCount: overview.alerts.length,
      };

      this.runHistory.push(record);

      // Push real-time event
      this.healthGateway.pushEvent(
        projectId,
        "health-score-changed",
        "security",
        {
          scheduler: "scan-completed",
          overallScore: overview.overallScore,
          alertCount: overview.alerts.length,
          duration,
        },
        `Scheduled scan complete: ${projectId} scored ${overview.overallScore}/100 (${duration}ms)`,
      );

      // Push individual dimension events
      for (const dim of overview.dimensions) {
        if (dim.score < 50) {
          this.healthGateway.pushEvent(
            projectId,
            "health-score-changed",
            dim.dimension,
            { score: dim.score, status: dim.status },
            `${dim.dimension} score: ${dim.score}/100 (${dim.status})`,
          );
        }
      }

      this.logger.log(
        `Scan complete for ${projectId}: score=${overview.overallScore}, alerts=${overview.alerts.length}, duration=${duration}ms`,
      );

      return record;
    } catch (error) {
      const duration = Date.now() - startTime;
      const finishedAt = new Date().toISOString();
      const errorMsg = error instanceof Error ? error.message : "unknown error";

      const record: SchedulerRunRecord = {
        id: scanId,
        projectId,
        startedAt: new Date(startTime).toISOString(),
        finishedAt,
        duration,
        overallScore: 0,
        status: "failed",
        error: errorMsg,
        dimensionsScanned: this.config.dimensions,
        alertCount: 0,
      };

      this.runHistory.push(record);
      throw error;
    }
  }
}
