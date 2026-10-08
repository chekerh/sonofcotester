import { Injectable, Logger } from "@nestjs/common";
import { HealthService } from "./health.service.js";
import { GitHubCheckService } from "./github-check.service.js";
import type {
  PRHealthSummaryRequest,
  PRHealthSummaryResult,
  PRDimensionResult,
  PRAnnotation,
  GitHubCheckConclusion,
  HealthDimension,
} from "@sonofcotester/sdk";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Orchestration service that runs all health scans against a PR branch,
 * aggregates results into a summary, and posts a GitHub Check Run.
 *
 * Flow:
 *   1. Receive PR webhook or manual trigger
 *   2. Run each configured dimension scan (security, ui-ux, db, performance)
 *   3. Aggregate scores and generate annotations
 *   4. Post results as a GitHub Check Run
 *   5. Store the summary for historical queries
 */
@Injectable()
export class PRHealthSummaryService {
  private readonly logger = new Logger(PRHealthSummaryService.name);

  /** In-memory store of PR summaries (replace with DB in production) */
  private readonly summaries = new Map<string, PRHealthSummaryResult>();

  constructor(
    private readonly healthService: HealthService,
    private readonly githubCheckService: GitHubCheckService,
  ) {}

  /**
   * Run all configured health scans for a PR and post results as a GitHub Check.
   */
  async runPRHealthSummary(
    request: PRHealthSummaryRequest,
  ): Promise<PRHealthSummaryResult> {
    const id = uid();
    const startedAt = new Date().toISOString();
    const dimensions = request.dimensions ?? [
      "security",
      "ui-ux",
      "database",
      "performance",
    ];

    this.logger.log(
      `[PRHealth] Starting scan for ${request.repository}#${request.pullRequestNumber} @ ${request.headSha.slice(0, 7)}`,
    );

    // Mark as in progress
    const partial: PRHealthSummaryResult = {
      id,
      repository: request.repository,
      pullRequestNumber: request.pullRequestNumber,
      headSha: request.headSha,
      branch: request.branch,
      baseBranch: request.baseBranch,
      projectId: request.projectId,
      status: "in_progress",
      overallScore: 0,
      dimensions: [],
      verdict: "neutral",
      summary: "Scanning in progress…",
      annotations: [],
      startedAt,
    };
    this.summaries.set(id, partial);

    // Run each dimension scan
    const dimensionResults: PRDimensionResult[] = [];
    const allAnnotations: PRAnnotation[] = [];

    for (const dimension of dimensions) {
      try {
        const result = await this.scanDimension(
          request.projectId,
          request.targetUrl,
          dimension,
        );
        dimensionResults.push(result);

        // Generate annotations from dimension issues
        const annotations = this.generateAnnotations(dimension, result);
        allAnnotations.push(...annotations);
      } catch (err) {
        this.logger.error(`[PRHealth] Dimension ${dimension} failed: ${err}`);
        dimensionResults.push({
          dimension,
          score: 0,
          status: "fail",
          issueCount: 1,
          criticalCount: 1,
          summary: `Scan failed: ${err instanceof Error ? err.message : String(err)}`,
        });
        allAnnotations.push({
          annotationLevel: "failure",
          title: `${dimension} scan failed`,
          message: `Error running ${dimension} scan: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    // Calculate overall score (weighted average)
    const weights: Record<HealthDimension, number> = {
      security: 0.3,
      "ui-ux": 0.15,
      database: 0.2,
      performance: 0.25,
      testing: 0.1,
    };
    let overallScore = 0;
    let totalWeight = 0;
    for (const dim of dimensionResults) {
      const w = weights[dim.dimension] ?? 0.1;
      overallScore += dim.score * w;
      totalWeight += w;
    }
    overallScore = totalWeight > 0 ? Math.round(overallScore / totalWeight) : 0;

    // Determine verdict
    const verdict = this.calculateVerdict(overallScore, dimensionResults);

    // Build summary text
    const summary = this.buildSummaryText(
      overallScore,
      verdict,
      dimensionResults,
      request,
    );

    const finishedAt = new Date().toISOString();
    const duration =
      new Date(finishedAt).getTime() - new Date(startedAt).getTime();

    const result: PRHealthSummaryResult = {
      ...partial,
      status: "completed",
      overallScore,
      dimensions: dimensionResults,
      verdict,
      summary,
      annotations: allAnnotations,
      finishedAt,
      duration,
    };

    // Post to GitHub
    const checkRun = await this.githubCheckService.postHealthSummary(
      request.repository,
      request.headSha,
      {
        overallScore,
        verdict,
        title: `CodeTester Health: ${overallScore}/100 — ${verdict}`,
        body: summary,
        annotations: allAnnotations.map((a) => ({
          path: a.path,
          startLine: a.startLine,
          endLine: a.endLine,
          level: a.annotationLevel,
          message: a.message,
          title: a.title,
        })),
      },
      request.githubToken,
    );

    if (checkRun) {
      result.checkRunId = checkRun.id;
      result.checkRunUrl = checkRun.url;
    }

    this.summaries.set(id, result);
    this.logger.log(
      `[PRHealth] Completed ${request.repository}#${request.pullRequestNumber}: score=${overallScore}, verdict=${verdict}, duration=${duration}ms`,
    );

    return result;
  }

  /**
   * Run a single dimension scan and return its result.
   */
  private async scanDimension(
    projectId: string,
    targetUrl: string,
    dimension: HealthDimension,
  ): Promise<PRDimensionResult> {
    switch (dimension) {
      case "security": {
        const scan = await this.healthService.runSecurityScan({ projectId });
        return {
          dimension: "security",
          score: scan.summary.score,
          status:
            scan.summary.critical > 0
              ? "fail"
              : scan.summary.high > 0
                ? "warn"
                : "pass",
          issueCount: scan.summary.total,
          criticalCount: scan.summary.critical,
          summary: `${scan.summary.total} vulnerabilities (${scan.summary.critical} critical, ${scan.summary.high} high)`,
          scanId: scan.id,
        };
      }
      case "ui-ux": {
        const session = await this.healthService.runUIHealthScan({
          projectId,
          url: targetUrl,
        });
        const failures = session.checks.filter((c) => c.severity === "fail");
        const warnings = session.checks.filter((c) => c.severity === "warning");
        return {
          dimension: "ui-ux",
          score: session.score.overall,
          status:
            failures.length > 0
              ? "fail"
              : warnings.length > 0
                ? "warn"
                : "pass",
          issueCount: failures.length + warnings.length,
          criticalCount: failures.filter((f) => f.impact === "critical").length,
          summary: `${session.pagesScanned} pages scanned, ${failures.length} failures, ${warnings.length} warnings`,
          scanId: session.id,
        };
      }
      case "database": {
        const snapshot = this.healthService.getDBHealthSnapshot(projectId);
        const critWarnings = snapshot.warnings.filter(
          (w) => w.severity === "critical",
        );
        return {
          dimension: "database",
          score: snapshot.score,
          status:
            critWarnings.length > 0
              ? "fail"
              : snapshot.warnings.length > 0
                ? "warn"
                : "pass",
          issueCount: snapshot.warnings.length,
          criticalCount: critWarnings.length,
          summary: `Score ${snapshot.score}/100, ${snapshot.warnings.length} warnings, ${snapshot.slowQueries} slow queries`,
          scanId: snapshot.id,
        };
      }
      case "performance": {
        const snapshot = await this.healthService.getPerformanceSnapshot(projectId);
        const downServices = snapshot.services.filter(
          (s) => s.status === "down",
        );
        const degradedServices = snapshot.services.filter(
          (s) => s.status === "degraded",
        );
        return {
          dimension: "performance",
          score: snapshot.overall.overall,
          status:
            downServices.length > 0
              ? "fail"
              : degradedServices.length > 0
                ? "warn"
                : "pass",
          issueCount: downServices.length + degradedServices.length,
          criticalCount: downServices.length,
          summary: `${snapshot.services.length} services checked, ${downServices.length} down, ${degradedServices.length} degraded`,
        };
      }
      default:
        return {
          dimension,
          score: 100,
          status: "pass",
          issueCount: 0,
          criticalCount: 0,
          summary: "Not scanned",
        };
    }
  }

  /**
   * Generate PR annotations from dimension scan results.
   */
  private generateAnnotations(
    dimension: HealthDimension,
    result: PRDimensionResult,
  ): PRAnnotation[] {
    const annotations: PRAnnotation[] = [];

    // Fail-level annotation for the dimension if it failed
    if (result.status === "fail") {
      annotations.push({
        annotationLevel: "failure",
        title: `${dimension.toUpperCase()} check failed`,
        message: `Score: ${result.score}/100 — ${result.summary}. ${result.criticalCount} critical issue(s) found.`,
      });
    } else if (result.status === "warn") {
      annotations.push({
        annotationLevel: "warning",
        title: `${dimension.toUpperCase()} warnings`,
        message: `Score: ${result.score}/100 — ${result.summary}`,
      });
    }

    return annotations;
  }

  /**
   * Determine the GitHub check conclusion from scores.
   */
  private calculateVerdict(
    overallScore: number,
    dimensions: PRDimensionResult[],
  ): GitHubCheckConclusion {
    const hasCritical = dimensions.some((d) => d.criticalCount > 0);
    const allFail = dimensions.every((d) => d.status === "fail");

    if (allFail) return "failure";
    if (hasCritical) return "failure";
    if (overallScore >= 80) return "success";
    if (overallScore >= 60) return "neutral";
    return "failure";
  }

  /**
   * Build a human-readable summary for the GitHub Check Run.
   */
  private buildSummaryText(
    overallScore: number,
    verdict: GitHubCheckConclusion,
    dimensions: PRDimensionResult[],
    request: PRHealthSummaryRequest,
  ): string {
    const lines: string[] = [];

    lines.push(
      `## Son of CodeTester — PR Health Summary`,
      ``,
      `**Repository:** ${request.repository}`,
      `**PR:** #${request.pullRequestNumber} \`${request.branch}\` → \`${request.baseBranch}\``,
      `**Commit:** \`${request.headSha.slice(0, 7)}\``,
      ``,
      `### Overall Score: ${overallScore}/100`,
      ``,
      `| Dimension | Score | Status | Issues | Critical |`,
      `|-----------|-------|--------|--------|----------|`,
    );

    for (const dim of dimensions) {
      const icon =
        dim.status === "pass" ? "✅" : dim.status === "warn" ? "⚠️" : "❌";
      lines.push(
        `| ${dim.dimension} | ${dim.score}/100 | ${icon} ${dim.status} | ${dim.issueCount} | ${dim.criticalCount} |`,
      );
    }

    lines.push(``);

    // Summary verdict
    switch (verdict) {
      case "success":
        lines.push(
          `**Verdict:** ✅ All health checks passed. This PR is ready for review.`,
        );
        break;
      case "failure":
        lines.push(
          `**Verdict:** ❌ Health checks found issues that need attention before merging.`,
        );
        break;
      case "neutral":
        lines.push(
          `**Verdict:** ⚠️ Some warnings detected. Review recommended before merging.`,
        );
        break;
      default:
        lines.push(`**Verdict:** ℹ️ Health check completed.`);
    }

    return lines.join("\n");
  }

  // ── Query methods ──

  getSummary(id: string): PRHealthSummaryResult | undefined {
    return this.summaries.get(id);
  }

  getSummariesForPR(
    repository: string,
    pullRequestNumber: number,
  ): PRHealthSummaryResult[] {
    return Array.from(this.summaries.values())
      .filter(
        (s) =>
          s.repository === repository &&
          s.pullRequestNumber === pullRequestNumber,
      )
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );
  }

  getSummariesForProject(projectId: string): PRHealthSummaryResult[] {
    return Array.from(this.summaries.values())
      .filter((s) => s.projectId === projectId)
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );
  }

  listRecent(limit = 20): PRHealthSummaryResult[] {
    return Array.from(this.summaries.values())
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
      .slice(0, limit);
  }
}
