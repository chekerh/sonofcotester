import { Injectable, Logger } from "@nestjs/common";
import type {
  GitHubCheckCreateRequest,
  GitHubCheckUpdateRequest,
  PRHealthCheckStatus,
  GitHubCheckConclusion,
} from "@sonofcotester/sdk";

const GITHUB_API = "https://api.github.com";

/**
 * Service for creating and updating GitHub Check Runs.
 *
 * Uses the GitHub REST API (Checks API) to post health summary results
 * directly on pull requests. Requires a token with `checks:write` and
 * `contents:read` permissions.
 *
 * When no token is provided (local dev), operations are logged but
 * skipped so the rest of the pipeline still works.
 */
@Injectable()
export class GitHubCheckService {
  private readonly logger = new Logger(GitHubCheckService.name);

  /**
   * Create a new Check Run on a commit SHA.
   * Returns the check run ID and URL, or null if the API is unavailable.
   */
  async createCheckRun(
    repository: string,
    request: GitHubCheckCreateRequest,
    githubToken?: string,
  ): Promise<{ id: number; url: string } | null> {
    if (!githubToken) {
      this.logger.warn(
        `[GitHubCheck] No token — skipping create for ${repository}@${request.headSha.slice(0, 7)}`,
      );
      return null;
    }

    const url = `${GITHUB_API}/repos/${repository}/check-runs`;
    const body: Record<string, unknown> = {
      name: request.name,
      head_sha: request.headSha,
      status: request.status,
    };

    if (request.output) {
      body.output = {
        title: request.output.title,
        summary: request.output.summary,
        annotations: request.output.annotations?.slice(0, 50), // API limit
      };
    }

    if (request.conclusion) {
      body.conclusion = request.conclusion;
    }

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const text = await resp.text();
        this.logger.error(`[GitHubCheck] Create failed (${resp.status}): ${text}`);
        return null;
      }

      const data = (await resp.json()) as { id: number; html_url: string };
      this.logger.log(
        `[GitHubCheck] Created check run #${data.id} for ${repository}@${request.headSha.slice(0, 7)}`,
      );
      return { id: data.id, url: data.html_url };
    } catch (err) {
      this.logger.error(`[GitHubCheck] Create error: ${err}`);
      return null;
    }
  }

  /**
   * Update an existing Check Run (transition to completed, add annotations, etc.)
   */
  async updateCheckRun(
    repository: string,
    request: GitHubCheckUpdateRequest,
    githubToken?: string,
  ): Promise<boolean> {
    if (!githubToken) {
      this.logger.warn(
        `[GitHubCheck] No token — skipping update for check run #${request.checkRunId}`,
      );
      return false;
    }

    const url = `${GITHUB_API}/repos/${repository}/check-runs/${request.checkRunId}`;
    const body: Record<string, unknown> = {};

    if (request.status) body.status = request.status;
    if (request.conclusion) body.conclusion = request.conclusion;
    if (request.output) {
      body.output = {
        title: request.output.title,
        summary: request.output.summary,
        annotations: request.output.annotations?.slice(0, 50),
      };
    }

    try {
      const resp = await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const text = await resp.text();
        this.logger.error(`[GitHubCheck] Update failed (${resp.status}): ${text}`);
        return false;
      }

      this.logger.log(`[GitHubCheck] Updated check run #${request.checkRunId}`);
      return true;
    } catch (err) {
      this.logger.error(`[GitHubCheck] Update error: ${err}`);
      return false;
    }
  }

  /**
   * Convenience: create in in_progress, then update to completed.
   */
  async postHealthSummary(
    repository: string,
    headSha: string,
    summary: {
      overallScore: number;
      verdict: GitHubCheckConclusion;
      title: string;
      body: string;
      annotations: Array<{
        path?: string;
        startLine?: number;
        endLine?: number;
        level: "notice" | "warning" | "failure";
        message: string;
        title: string;
      }>;
    },
    githubToken?: string,
  ): Promise<{ id: number; url: string } | null> {
    // Step 1: Create as in_progress
    const created = await this.createCheckRun(
      repository,
      {
        name: "Son of CodeTester — Health Summary",
        headSha,
        status: "in_progress",
        output: {
          title: `Health Score: ${summary.overallScore}/100`,
          summary: summary.body,
          annotations: summary.annotations.map((a) => ({
            path: a.path,
            start_line: a.startLine,
            end_line: a.endLine,
            annotation_level: a.level,
            message: a.message,
            title: a.title,
          })),
        },
      },
      githubToken,
    );

    if (!created) return null;

    // Step 2: Update to completed
    await this.updateCheckRun(
      repository,
      {
        checkRunId: created.id,
        status: "completed",
        conclusion: summary.verdict,
        output: {
          title: `Health Score: ${summary.overallScore}/100 — ${summary.verdict}`,
          summary: summary.body,
          annotations: summary.annotations.map((a) => ({
            path: a.path,
            start_line: a.startLine,
            end_line: a.endLine,
            annotation_level: a.level,
            message: a.message,
            title: a.title,
          })),
        },
      },
      githubToken,
    );

    return created;
  }
}
