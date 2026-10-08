import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { IsArray, IsNumber, IsOptional, IsString } from "class-validator";
import type { HealthDimension, PRHealthSummaryRequest } from "@sonofcotester/sdk";
import { PRHealthSummaryService } from "./pr-health-summary.service.js";
import { GitHubWebhookService } from "./github-webhook.service.js";

class PRHealthSummaryDto {
  @IsString()
  repository!: string;

  @IsNumber()
  pullRequestNumber!: number;

  @IsString()
  headSha!: string;

  @IsString()
  branch!: string;

  @IsString()
  baseBranch!: string;

  @IsString()
  projectId!: string;

  @IsString()
  targetUrl!: string;

  @IsOptional()
  @IsArray()
  dimensions?: HealthDimension[];

  @IsOptional()
  @IsString()
  githubToken?: string;
}

@Controller("health/pr")
export class PRHealthSummaryController {
  constructor(
    private readonly prHealthSummary: PRHealthSummaryService,
    private readonly webhookService: GitHubWebhookService,
  ) {}

  /**
   * Manually trigger a PR health summary scan.
   *
   * POST /health/pr/summary
   */
  @Post("summary")
  runPRHealthSummary(@Body() body: PRHealthSummaryDto) {
    return this.prHealthSummary.runPRHealthSummary(body as PRHealthSummaryRequest);
  }

  /**
   * Get a specific PR health summary by ID.
   *
   * GET /health/pr/summary/:id
   */
  @Get("summary/:id")
  getSummary(@Param("id") id: string) {
    return this.prHealthSummary.getSummary(id);
  }

  /**
   * Get all health summaries for a specific PR.
   *
   * GET /health/pr/:repository/:pullRequestNumber
   */
  @Get(":repository/:pullRequestNumber")
  getSummariesForPR(
    @Param("repository") repository: string,
    @Param("pullRequestNumber") pullRequestNumber: string,
  ) {
    return this.prHealthSummary.getSummariesForPR(
      repository,
      parseInt(pullRequestNumber, 10),
    );
  }

  /**
   * Get all PR health summaries for a project.
   *
   * GET /health/pr/project/:projectId
   */
  @Get("project/:projectId")
  getSummariesForProject(@Param("projectId") projectId: string) {
    return this.prHealthSummary.getSummariesForProject(projectId);
  }

  /**
   * List recent PR health summaries across all projects.
   *
   * GET /health/pr/recent?limit=20
   */
  @Get("recent")
  listRecent(@Query("limit") limit?: string) {
    return this.prHealthSummary.listRecent(limit ? parseInt(limit, 10) : 20);
  }

  // ── Webhook endpoint ──

  /**
   * GitHub webhook receiver. Configure your GitHub webhook to POST here.
   *
   * POST /health/pr/webhook/github
   */
  @Post("webhook/github")
  async handleGitHubWebhook(
    @Body() payload: Record<string, unknown>,
  ) {
    const eventType = (payload as { action?: string; ref?: string })
      .ref
      ? "push"
      : "pull_request";

    if (eventType === "pull_request") {
      return this.webhookService.handlePullRequestEvent(
        "pull_request",
        payload as unknown as Parameters<GitHubWebhookService["handlePullRequestEvent"]>[1],
      );
    }

    if (eventType === "push") {
      return this.webhookService.handlePushEvent(
        "push",
        payload as unknown as Parameters<GitHubWebhookService["handlePushEvent"]>[1],
      );
    }

    return { processed: false, reason: `Unsupported event type: ${eventType}` };
  }

  // ── Integration management ──

  /**
   * Register a GitHub webhook integration.
   *
   * POST /health/pr/integrations
   */
  @Post("integrations")
  registerIntegration(
    @Body()
    body: {
      repository: string;
      projectId: string;
      targetUrl: string;
      githubToken?: string;
      dimensions?: HealthDimension[];
      branchPatterns?: string[];
    },
  ) {
    this.webhookService.registerIntegration(body);
    return { ok: true, repository: body.repository };
  }

  /**
   * List all registered GitHub integrations.
   *
   * GET /health/pr/integrations
   */
  @Get("integrations")
  listIntegrations() {
    return this.webhookService.listIntegrations();
  }

  /**
   * Remove a GitHub integration.
   *
   * DELETE /health/pr/integrations/:repository
   */
  @Delete("integrations/:repository")
  removeIntegration(@Param("repository") repository: string) {
    const removed = this.webhookService.removeIntegration(repository);
    return { ok: removed };
  }
}
