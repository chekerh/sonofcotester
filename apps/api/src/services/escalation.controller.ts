import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString } from "class-validator";
import type {
  HealthDimension,
  NotificationSeverity,
  VulnerabilitySeverity,
  CreateEscalationRuleRequest,
  UpdateEscalationRuleRequest,
} from "@sonofcotester/sdk";
import { EscalationService } from "./escalation.service.js";

class EscalationStepDto {
  @IsString()
  name!: string;

  @IsNumber()
  delayMs!: number;

  @IsIn(["notify", "page-oncall", "notify-slack", "webhook"])
  action!: "notify" | "page-oncall" | "notify-slack" | "webhook";

  @IsOptional()
  @IsIn(["info", "warning", "critical"])
  targetSeverity?: NotificationSeverity;

  @IsOptional()
  @IsArray()
  channelIds?: string[];

  @IsOptional()
  @IsString()
  messageTemplate?: string;

  @IsOptional()
  @IsBoolean()
  onceOnly?: boolean;
}

class CreateEscalationRuleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  dimensions?: HealthDimension[];

  @IsOptional()
  @IsIn(["info", "low", "medium", "high", "critical"])
  minSeverity?: VulnerabilitySeverity;

  @IsOptional()
  @IsArray()
  projectIds?: string[];

  @IsArray()
  steps!: EscalationStepDto[];

  @IsOptional()
  @IsNumber()
  maxEscalations?: number;

  @IsOptional()
  @IsNumber()
  autoResolveAfterMs?: number;
}

class UpdateEscalationRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  dimensions?: HealthDimension[];

  @IsOptional()
  @IsIn(["info", "low", "medium", "high", "critical"])
  minSeverity?: VulnerabilitySeverity;

  @IsOptional()
  @IsArray()
  projectIds?: string[];

  @IsOptional()
  @IsArray()
  steps?: EscalationStepDto[];

  @IsOptional()
  @IsNumber()
  maxEscalations?: number;

  @IsOptional()
  @IsNumber()
  autoResolveAfterMs?: number;
}

@Controller("health/escalation")
export class EscalationController {
  constructor(private readonly escalationService: EscalationService) {}

  // ── Rule CRUD ──

  @Post("rules")
  createRule(@Body() body: CreateEscalationRuleDto) {
    return this.escalationService.createRule(body as CreateEscalationRuleRequest);
  }

  @Get("rules")
  listRules() {
    return this.escalationService.listRules();
  }

  @Get("rules/:id")
  getRule(@Param("id") id: string) {
    return this.escalationService.getRule(id);
  }

  @Put("rules/:id")
  updateRule(@Param("id") id: string, @Body() body: UpdateEscalationRuleDto) {
    return this.escalationService.updateRule(id, body as UpdateEscalationRuleRequest);
  }

  @Delete("rules/:id")
  deleteRule(@Param("id") id: string) {
    return this.escalationService.deleteRule(id);
  }

  // ── Active escalations ──

  @Get("active")
  getActiveEscalations() {
    return this.escalationService.getActiveStates();
  }

  @Get("active/:alertId")
  getEscalationState(@Param("alertId") alertId: string) {
    return this.escalationService.getStatesForAlert(alertId);
  }

  // ── Event history ──

  @Get("events")
  getEvents(
    @Query("alertId") alertId?: string,
    @Query("ruleId") ruleId?: string,
    @Query("limit") limit?: string,
  ) {
    return this.escalationService.getEvents({
      alertId,
      ruleId,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  // ── Stats ──

  @Get("stats")
  getStats() {
    return this.escalationService.getStats();
  }
}
