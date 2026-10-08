import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { IsIn, IsNumber, IsOptional, IsString } from "class-validator";
import type { SyntaxTranslationRequest } from "@sonofcotester/sdk";
import { AcademyService } from "./academy.service.js";

class AnalyzeTestDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsIn(["web", "mobile"])
  platform?: "web" | "mobile";

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  model?: string;
}

class TranslateSyntaxDto implements SyntaxTranslationRequest {
  @IsIn(["playwright", "maestro", "cypress", "natural_language"])
  sourceSyntax!: "playwright" | "maestro" | "cypress" | "natural_language";

  @IsIn(["playwright", "maestro", "cypress"])
  targetSyntax!: "playwright" | "maestro" | "cypress";

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  model?: string;
}

class SubmitQuizDto {
  @IsString()
  moduleId!: string;

  @IsNumber()
  score!: number;

  @IsOptional()
  @IsString()
  userId?: string;
}

@Controller("academy")
export class AcademyController {
  constructor(private readonly academyService: AcademyService) {}

  @Get("curriculum")
  getCurriculum() {
    return this.academyService.getCurriculum();
  }

  @Post("analyze-test")
  async analyzeTest(@Body() body: AnalyzeTestDto) {
    const report = await this.academyService.analyzeTest(body.code, body.platform || "web", body.model);
    if (body.userId) {
      await this.academyService.recordTestAnalysis(body.userId, report.score);
    }
    return report;
  }

  @Post("translate-syntax")
  async translateSyntax(@Body() body: TranslateSyntaxDto) {
    return this.academyService.translateSyntax(body, body.model);
  }

  @Get("progress/:userId")
  getProgress(@Param("userId") userId: string) {
    return this.academyService.getProgress(userId);
  }

  @Post("quiz/submit")
  submitQuiz(@Body() body: SubmitQuizDto) {
    return this.academyService.submitQuiz(body.userId || "user_student", body.moduleId, body.score);
  }
}
