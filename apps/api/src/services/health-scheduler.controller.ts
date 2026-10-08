import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { IsArray, IsNumber, IsOptional, IsString, Min } from "class-validator";
import type { HealthDimension, SchedulerUpdateRequest } from "@sonofcotester/sdk";
import { HealthSchedulerService } from "./health-scheduler.service.js";

class SchedulerConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(10_000)
  intervalMs?: number;

  @IsOptional()
  @IsArray()
  projectIds?: string[];

  @IsOptional()
  @IsString()
  targetUrl?: string;

  @IsOptional()
  @IsArray()
  dimensions?: HealthDimension[];

  @IsOptional()
  @IsNumber()
  maxConsecutiveFailures?: number;
}

@Controller("health/scheduler")
export class HealthSchedulerController {
  constructor(private readonly scheduler: HealthSchedulerService) {}

  @Get("status")
  getStatus() {
    return this.scheduler.getState();
  }

  @Get("config")
  getConfig() {
    return this.scheduler.getConfig();
  }

  @Post("start")
  start() {
    return this.scheduler.start();
  }

  @Post("stop")
  stop() {
    return this.scheduler.stop();
  }

  @Post("pause")
  pause() {
    return this.scheduler.pause();
  }

  @Post("resume")
  resume() {
    return this.scheduler.resume();
  }

  @Post("config")
  updateConfig(@Body() body: SchedulerConfigDto) {
    return this.scheduler.updateConfig(body as SchedulerUpdateRequest);
  }

  @Post("trigger")
  async triggerImmediate(@Body() body: { projectId?: string }) {
    return await this.scheduler.triggerImmediate(body.projectId);
  }

  @Post("trigger/:projectId")
  async triggerForProject(@Param("projectId") projectId: string) {
    return await this.scheduler.triggerImmediate(projectId);
  }

  @Delete("history")
  clearHistory() {
    this.scheduler.clearHistory();
    return { ok: true };
  }
}
