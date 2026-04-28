import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IsArray, IsIn, IsString } from "class-validator";
import type {
  ExecutionTarget,
  GitHubActionsWebhookPayload,
  JiraSyncRequest,
  ProviderName,
  SourceType,
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

  @Get("executions")
  listExecutions() {
    return this.appService.listExecutions();
  }

  @Post("projects/:id/test-generation")
  generateTests(@Param("id") projectId: string, @Body() body: TestGenerationDto) {
    return this.appService.generateTests(projectId, body);
  }

  @Post("test-suites/:id/executions")
  async createExecution(@Param("id") suiteId: string, @Body() body: ExecutionRequestDto) {
    const run = await this.appService.createExecution(suiteId, body);
    this.orchestration.publishRun(run);
    return run;
  }

  @Get("executions/:id")
  getExecution(@Param("id") runId: string) {
    return this.appService.getExecution(runId);
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

