import { Body, Controller, Get, Post } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { IsOptional, IsString } from "class-validator";
import { defaultOllamaClient, TestGenerationService } from "@sonofcotester/ai";
import type { LocalAiStatus, OllamaModelInfo, TestGenerationRequest } from "@sonofcotester/sdk";

class SelectModelDto {
  @IsString()
  model!: string;
}

class GeneratePromptDto {
  @IsString()
  prompt!: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  format?: "json";
}

@Controller("ai")
export class AiController {
  private readonly generator = new TestGenerationService();

  @Get("status")
  @SkipThrottle()
  async getStatus(): Promise<LocalAiStatus> {
    return defaultOllamaClient.getStatus();
  }

  @Get("models")
  @SkipThrottle()
  async listModels(): Promise<{
    models: OllamaModelInfo[];
    activeModel: string | null;
    endpoint: string;
  }> {
    const status = await defaultOllamaClient.getStatus();
    return {
      models: status.installedModels,
      activeModel: status.activeModel,
      endpoint: status.endpoint
    };
  }

  @Post("models/select")
  async selectModel(@Body() body: SelectModelDto): Promise<{
    success: boolean;
    activeModel: string;
  }> {
    defaultOllamaClient.setActiveModel(body.model);
    return {
      success: true,
      activeModel: body.model
    };
  }

  @Post("generate")
  async generateText(@Body() body: GeneratePromptDto): Promise<{
    response: string;
    model: string;
  }> {
    const model = body.model || defaultOllamaClient.getActiveModel() || undefined;
    const response = await defaultOllamaClient.generate(body.prompt, {
      system: body.systemPrompt,
      model,
      format: body.format
    });

    return {
      response,
      model: model || "default"
    };
  }

  @Post("test-generation")
  async generateTests(
    @Body() body: TestGenerationRequest & { model?: string }
  ) {
    const model = body.model || defaultOllamaClient.getActiveModel() || undefined;
    return this.generator.generateWithModel(body, model);
  }
}
