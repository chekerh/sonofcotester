import { Injectable, Logger } from "@nestjs/common";
import { PRHealthSummaryService } from "./pr-health-summary.service.js";
import type {
  GitHubWebhookPullRequest,
  GitHubWebhookPush,
  HealthDimension,
} from "@sonofcotester/sdk";

/**
 * Configuration for a GitHub webhook integration.
 */
interface WebhookIntegration {
  /** Repository in "owner/repo" format */
  repository: string;
  /** Project ID in Son of CodeTester */
  projectId: string;
  /** Target URL for UI/UX scans */
  targetUrl: string;
  /** GitHub token with checks:write permission */
  githubToken?: string;
  /** Which dimensions to scan (default: all) */
  dimensions?: HealthDimension[];
  /** Branch patterns to trigger on (default: ["**"]) */
  branchPatterns?: string[];
}

/**
 * Handles incoming GitHub webhook events and triggers PR health scans
 * automatically when pull requests are opened, synchronized, or when
 * code is pushed to tracked branches.
 *
 * Webhook endpoint should be configured at:
 *   POST /health/pr/webhook/github
 *
 * Set the webhook secret in the environment as GITHUB_WEBHOOK_SECRET
 * for signature verification (optional but recommended).
 */
@Injectable()
export class GitHubWebhookService {
  private readonly logger = new Logger(GitHubWebhookService.name);

  /** Registered integrations (in-memory; replace with DB in production) */
  private readonly integrations = new Map<string, WebhookIntegration>();

  constructor(private readonly prHealthSummary: PRHealthSummaryService) {}

  /**
   * Register a GitHub webhook integration for a repository.
   */
  registerIntegration(integration: WebhookIntegration): void {
    this.integrations.set(integration.repository, integration);
    this.logger.log(
      `[Webhook] Registered integration for ${integration.repository}`,
    );
  }

  /**
   * Remove a webhook integration.
   */
  removeIntegration(repository: string): boolean {
    const existed = this.integrations.delete(repository);
    if (existed) {
      this.logger.log(`[Webhook] Removed integration for ${repository}`);
    }
    return existed;
  }

  /**
   * List all registered integrations.
   */
  listIntegrations(): WebhookIntegration[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Process a GitHub pull_request webhook event.
   *
   * Triggers a PR health scan when:
   *   - action is "opened" or "synchronize" (new commits pushed)
   *   - repository has a registered integration
   *   - branch matches configured patterns
   */
  async handlePullRequestEvent(
    event: string,
    payload: GitHubWebhookPullRequest & { repository: { full_name: string } },
  ): Promise<{ processed: boolean; reason?: string }> {
    if (event !== "pull_request") {
      return { processed: false, reason: `Ignoring event: ${event}` };
    }

    const repoName = payload.repository?.full_name;
    if (!repoName) {
      return { processed: false, reason: "Missing repository name" };
    }

    const integration = this.integrations.get(repoName);
    if (!integration) {
      return {
        processed: false,
        reason: `No integration registered for ${repoName}`,
      };
    }

    // Only trigger on opened or synchronize
    const action = (payload as unknown as { action?: string }).action;
    if (action !== "opened" && action !== "synchronize") {
      return {
        processed: false,
        reason: `Ignoring PR action: ${action}`,
      };
    }

    // Check branch patterns
    if (
      integration.branchPatterns &&
      integration.branchPatterns.length > 0
    ) {
      const branchMatch = integration.branchPatterns.some((pattern) =>
        this.matchBranchPattern(payload.head.ref, pattern),
      );
      if (!branchMatch) {
        return {
          processed: false,
          reason: `Branch ${payload.head.ref} does not match any pattern`,
        };
      }
    }

    this.logger.log(
      `[Webhook] Triggering PR health scan for ${repoName}#${payload.number}`,
    );

    // Trigger the scan
    const result = await this.prHealthSummary.runPRHealthSummary({
      repository: repoName,
      pullRequestNumber: payload.number,
      headSha: payload.head.sha,
      branch: payload.head.ref,
      baseBranch: payload.base.ref,
      projectId: integration.projectId,
      targetUrl: integration.targetUrl,
      dimensions: integration.dimensions,
      githubToken: integration.githubToken,
    });

    return { processed: true };
  }

  /**
   * Process a GitHub push webhook event.
   *
   * If the push is to a branch that has an open PR, trigger a health scan.
   * This catches force pushes and branch updates that don't fire pull_request events.
   */
  async handlePushEvent(
    event: string,
    payload: GitHubWebhookPush,
  ): Promise<{ processed: boolean; reason?: string }> {
    if (event !== "push") {
      return { processed: false, reason: `Ignoring event: ${event}` };
    }

    const repoName = payload.repository?.full_name;
    if (!repoName) {
      return { processed: false, reason: "Missing repository name" };
    }

    const integration = this.integrations.get(repoName);
    if (!integration) {
      return {
        processed: false,
        reason: `No integration registered for ${repoName}`,
      };
    }

    // Extract branch name from ref
    const branch = payload.ref.replace("refs/heads/", "");

    // Check branch patterns
    if (
      integration.branchPatterns &&
      integration.branchPatterns.length > 0
    ) {
      const branchMatch = integration.branchPatterns.some((pattern) =>
        this.matchBranchPattern(branch, pattern),
      );
      if (!branchMatch) {
        return {
          processed: false,
          reason: `Branch ${branch} does not match any pattern`,
        };
      }
    }

    this.logger.log(
      `[Webhook] Push to ${repoName}@${branch} — triggering health scan`,
    );

    // For push events we don't have PR context, so we create a synthetic one
    // In production, you'd look up the associated PR via the GitHub API
    const result = await this.prHealthSummary.runPRHealthSummary({
      repository: repoName,
      pullRequestNumber: 0, // Unknown from push event alone
      headSha: payload.after,
      branch,
      baseBranch: "main", // Default; could be configured
      projectId: integration.projectId,
      targetUrl: integration.targetUrl,
      dimensions: integration.dimensions,
      githubToken: integration.githubToken,
    });

    return { processed: true };
  }

  /**
   * Simple branch pattern matching with * and ** wildcards.
   */
  private matchBranchPattern(branch: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexStr = pattern
      .replace(/\*\*/g, "§DOUBLESTAR§")
      .replace(/\*/g, "[^/]*")
      .replace(/§DOUBLESTAR§/g, ".*");
    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(branch);
  }
}
