import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { IsArray, IsIn, IsString } from "class-validator";
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

class TestGenerationDto {
  @IsIn(["jira", "story", "spec-upload"])
  sourceType!: SourceType;

  @IsString()
  sourcePayload!: string;

  @IsIn(["web", "mobile"])
  targetPlatform!: TargetPlatform;

  @IsArray()
  browserOrDeviceScope!: string[];
}

class ExecutionRequestDto {
  @IsString()
  suiteVersionId!: string;

  @IsString()
  environment!: string;

  @IsIn(["playwright-local", "browserstack-web", "browserstack-mobile", "custom-appium"])
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

  @IsString()
  target?: string;

  @IsString()
  data?: string;

  @IsString()
  expectedOutcome!: string;
}

class CanonicalTestCaseDto {
  @IsString()
  id!: string;

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

class TestSuiteUpdateDto {
  @IsString()
  summary!: string;

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
    private readonly appService: AppService,
    private readonly orchestration: OrchestrationService
  ) {}

  @Get("projects")
  listProjects() {
    return this.appService.listProjects();
  }

  @Get("providers/capabilities")
  listProviderCapabilities() {
    return this.appService.listProviderCapabilities();
  }

  @Get("health")
  health() {
    return { ok: true, service: "api" };
  }

  @Get("test-suites")
  listSuites() {
    return this.appService.listSuites();
  }

  @Get("test-suites/:id")
  getSuite(@Param("id") suiteId: string) {
    return this.appService.getSuite(suiteId);
  }

  @Get("executions")
  listExecutions() {
    return this.appService.listExecutions();
  }

  @Post("projects/:id/test-generation")
  generateTests(@Param("id") projectId: string, @Body() body: TestGenerationDto) {
    return this.appService.generateTests(projectId, body);
  }

  @Patch("test-suites/:id")
  updateSuite(@Param("id") suiteId: string, @Body() body: TestSuiteUpdateDto) {
    return this.appService.updateSuite(suiteId, body as TestSuiteUpdateRequest);
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

  @Get("heal-proposals")
  listHealingProposals() {
    return this.appService.listHealingProposals();
  }

  @Post("heal-proposals/:id/apply")
  applyHealing(@Param("id") healProposalId: string) {
    return this.appService.applyHealing(healProposalId);
  }

  @Post("integrations/jira/sync")
  syncJira(@Body() body: JiraSyncDto) {
    return this.appService.syncJira(body as JiraSyncRequest);
  }

  @Post("integrations/ci/github-actions/webhook")
  githubActionsWebhook(@Body() body: GitHubActionsWebhookDto) {
    return this.appService.receiveGitHubActionsWebhook(body as GitHubActionsWebhookPayload);
  }
}
