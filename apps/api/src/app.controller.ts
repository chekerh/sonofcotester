import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, Res } from "@nestjs/common";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Response } from "express";
import { SkipThrottle } from "@nestjs/throttler";
import { IsArray, IsIn, IsOptional, IsString } from "class-validator";
import type {
  CanonicalTestCase,
  ExecutionTarget,
  GitHubActionsWebhookPayload,
  JiraSyncRequest,
  ProviderName,
  SourceType,
  TestSuiteUpdateRequest,
  TargetPlatform
} from "@sonofcotester/sdk";
import { AppService } from "./app.service.js";
import { OrchestrationService } from "./orchestration.service.js";

class CreateProjectDto {
  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;
}

class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class CrawlTargetDto {
  @IsString()
  url!: string;
}

class TestGenerationDto {
  @IsIn(["jira", "story", "spec-upload", "crawled_dom"])
  sourceType!: SourceType;

  @IsString()
  sourcePayload!: string;

  @IsIn(["web", "mobile"])
  targetPlatform!: TargetPlatform;

  @IsArray()
  browserOrDeviceScope!: string[];

  @IsOptional()
  @IsString()
  targetUrl?: string;

  @IsOptional()
  @IsArray()
  discoveredElements?: any[];
}

class ExecutionRequestDto {
  @IsString()
  suiteVersionId!: string;

  @IsString()
  environment!: string;

  @IsIn(["playwright-local", "browserstack-web", "browserstack-mobile", "custom-appium", "maestro-local", "maestro-cloud"])
  provider!: ProviderName;

  @IsArray()
  matrix!: ExecutionTarget[];
}

class JiraSyncDto {
  @IsString()
  projectKey!: string;

  @IsArray()
  issueTypes!: string[];
}

class CanonicalTestStepDto {
  @IsString()
  id!: string;

  @IsIn(["navigate", "click", "fill", "assertText", "assertVisible"])
  action!: CanonicalTestCase["steps"][number]["action"];

  @IsOptional()
  @IsString()
  target?: string;

  @IsOptional()
  @IsString()
  data?: string;

  @IsString()
  expectedOutcome!: string;
}

class CanonicalTestCaseDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  title!: string;

  @IsString()
  feature!: string;

  @IsIn(["p0", "p1", "p2", "p3"])
  priority!: CanonicalTestCase["priority"];

  @IsIn(["web", "mobile"])
  platform!: CanonicalTestCase["platform"];

  @IsArray()
  prerequisites!: string[];

  @IsArray()
  tags!: string[];

  @IsArray()
  steps!: CanonicalTestStepDto[];
}

class CreateTestSuiteDto {
  @IsString()
  summary!: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsArray()
  cases?: CanonicalTestCaseDto[];
}

class TestSuiteUpdateDto {
  @IsString()
  summary!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  cases!: CanonicalTestCaseDto[];
}

class GitHubActionsWebhookDto {
  @IsString()
  workflowName!: string;

  @IsString()
  repository!: string;

  @IsString()
  branch!: string;

  @IsString()
  sha!: string;
}

@Controller()
export class AppController {
  constructor(
    @Inject(AppService) private readonly appService: AppService,
    @Inject(OrchestrationService) private readonly orchestration: OrchestrationService
  ) {}

  @Get("health")
  @SkipThrottle()
  getHealth() {
    return { ok: true, service: "api", timestamp: new Date().toISOString() };
  }

  @Get("ready")
  @SkipThrottle()
  getReady() {
    return { ready: true, service: "api", timestamp: new Date().toISOString() };
  }

  // ── Project CRUD ──

  @Get("projects")
  listProjects() {
    return this.appService.listProjects();
  }

  @Post("projects")
  createProject(@Body() body: CreateProjectDto) {
    return this.appService.createProject(body.workspaceId || "ws_internal", body.name, body.description);
  }

  @Get("projects/:id")
  getProject(@Param("id") projectId: string) {
    return this.appService.getProject(projectId);
  }

  @Patch("projects/:id")
  updateProject(@Param("id") projectId: string, @Body() body: UpdateProjectDto) {
    return this.appService.updateProject(projectId, body.name, body.description);
  }

  @Delete("projects/:id")
  deleteProject(@Param("id") projectId: string) {
    return this.appService.deleteProject(projectId);
  }

  // ── Providers & System Health ──

  @Get("providers/capabilities")
  listProviderCapabilities() {
    return this.appService.listProviderCapabilities();
  }

  @SkipThrottle()
  @Get("health")
  health() {
    return {
      ok: true,
      service: "api",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV ?? "development",
    };
  }

  @SkipThrottle()
  @Get("ready")
  ready() {
    return { ready: true, service: "api" };
  }

  // ── Test Suite CRUD ──

  @Get("test-suites")
  listSuites() {
    return this.appService.listSuites();
  }

  @Post("projects/:id/test-suites")
  createSuite(@Param("id") projectId: string, @Body() body: CreateTestSuiteDto) {
    return this.appService.createSuite(
      projectId,
      body.summary,
      body.sourceType || "manual",
      body.cases as CanonicalTestCase[] | undefined
    );
  }

  @Get("test-suites/:id")
  getSuite(@Param("id") suiteId: string) {
    return this.appService.getSuite(suiteId);
  }

  @Patch("test-suites/:id")
  updateSuite(@Param("id") suiteId: string, @Body() body: TestSuiteUpdateDto) {
    return this.appService.updateSuite(suiteId, body as TestSuiteUpdateRequest);
  }

  @Delete("test-suites/:id")
  deleteSuite(@Param("id") suiteId: string) {
    return this.appService.deleteSuite(suiteId);
  }

  // ── Standalone TestCase CRUD ──

  @Post("test-suites/:id/cases")
  addTestCase(@Param("id") suiteId: string, @Body() body: CanonicalTestCaseDto) {
    return this.appService.addTestCase(suiteId, body as CanonicalTestCase);
  }

  @Patch("test-cases/:caseId")
  updateTestCase(@Param("caseId") caseId: string, @Body() body: Partial<CanonicalTestCaseDto>) {
    return this.appService.updateTestCase(caseId, body as Partial<CanonicalTestCase>);
  }

  @Delete("test-cases/:caseId")
  deleteTestCase(@Param("caseId") caseId: string) {
    return this.appService.deleteTestCase(caseId);
  }

  // ── Target App Inspector & Test Generation ──

  @Post("inspector/crawl")
  crawlTargetApp(@Body() body: CrawlTargetDto) {
    return this.appService.crawlTargetApp(body.url);
  }

  @Post("projects/:id/test-generation")
  generateTests(@Param("id") projectId: string, @Body() body: TestGenerationDto) {
    return this.appService.generateTests(projectId, body);
  }

  @Get("executions")
  listExecutions() {
    return this.appService.listExecutions();
  }

  @Post("test-suites/:id/executions")
  async createExecution(@Param("id") suiteId: string, @Body() body: ExecutionRequestDto) {
    const run = await this.appService.createExecution(suiteId, body);
    await this.orchestration.publishRunById(run.id);
    return run;
  }

  @Get("executions/:id")
  getExecution(@Param("id") runId: string) {
    return this.appService.getExecution(runId);
  }

  @Post("executions/:id/cancel")
  cancelExecution(@Param("id") runId: string) {
    return this.appService.cancelExecution(runId);
  }

  @Delete("executions/:id")
  deleteExecution(@Param("id") runId: string) {
    return this.appService.deleteExecution(runId);
  }

  // ── Healing Proposals & Bug Drafts ──

  @Get("heal-proposals")
  listHealingProposals() {
    return this.appService.listHealingProposals();
  }

  @Post("heal-proposals/:id/apply")
  applyHealing(@Param("id") healProposalId: string) {
    return this.appService.applyHealing(healProposalId);
  }

  @Post("heal-proposals/:id/reject")
  rejectHealing(@Param("id") healProposalId: string) {
    return this.appService.rejectHealing(healProposalId);
  }

  // ── Integrations ──

  @Post("integrations/jira/sync")
  syncJira(@Body() body: JiraSyncDto) {
    return this.appService.syncJira(body as JiraSyncRequest);
  }

  @Post("integrations/ci/github-actions/webhook")
  githubActionsWebhook(@Body() body: GitHubActionsWebhookDto) {
    return this.appService.receiveGitHubActionsWebhook(body as GitHubActionsWebhookPayload);
  }

  // ── Execution Artifact Serving ──

  @Get("artifacts/:runId/:filename")
  getArtifact(
    @Param("runId") runId: string,
    @Param("filename") filename: string,
    @Res() res: Response
  ) {
    const safeRunId = runId.replace(/[^a-zA-Z0-9_-]/g, "");
    const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, "");
    const filePath = resolve(process.cwd(), "artifacts", safeRunId, safeFilename);
    if (!existsSync(filePath)) {
      throw new NotFoundException(`Artifact ${safeFilename} for run ${safeRunId} not found`);
    }
    return res.sendFile(filePath);
  }
}
