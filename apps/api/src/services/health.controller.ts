import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IsArray, IsOptional, IsString } from "class-validator";
import type { HealthDimension, ScanCategory, VulnerabilitySeverity } from "@sonofcotester/sdk";
import { HealthService } from "./health.service.js";

class TriggerScanDto {
  @IsString()
  projectId!: string;

  @IsOptional()
  @IsArray()
  categories?: ScanCategory[];

  @IsOptional()
  @IsString()
  targetUrl?: string;
}

class DispatchAlertDto {
  @IsString()
  projectId!: string;

  @IsString()
  dimension!: HealthDimension;

  @IsString()
  severity!: VulnerabilitySeverity;

  @IsString()
  title!: string;

  @IsString()
  message!: string;
}

class UIScanDto {
  @IsString()
  projectId!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsArray()
  pages?: string[];

  @IsOptional()
  @IsString()
  viewport?: string;
}

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get("overview/:projectId")
  getOverview(@Param("projectId") projectId: string) {
    return this.healthService.getHealthOverview(projectId);
  }

  @Post("scan")
  async runFullScan(@Body() body: TriggerScanDto) {
    return await this.healthService.runFullScan(body.projectId, body.targetUrl ?? "http://localhost:3010");
  }

  @Post("security/scan")
  async runSecurityScan(@Body() body: TriggerScanDto) {
    return await this.healthService.runSecurityScan(body);
  }

  @Get("security/:projectId")
  getSecurityScan(@Param("projectId") projectId: string) {
    return this.healthService.getLatestSecurityScan(projectId);
  }

  @Post("ui/scan")
  async runUIScan(@Body() body: UIScanDto) {
    return await this.healthService.runUIHealthScan(body);
  }

  @Get("ui/:projectId")
  getUISession(@Param("projectId") projectId: string) {
    return this.healthService.getLatestUISession(projectId);
  }

  @Get("db/:projectId")
  getDBSnapshot(@Param("projectId") projectId: string) {
    return this.healthService.getDBHealthSnapshot(projectId);
  }

  @Get("db/:projectId/slow-queries")
  getSlowQueries(@Param("projectId") projectId: string) {
    return this.healthService.getSlowQueries(projectId);
  }

  @Get("performance/:projectId")
  async getPerformanceSnapshot(@Param("projectId") projectId: string) {
    return await this.healthService.getPerformanceSnapshot(projectId);
  }

  @Get("performance/:projectId/service/:serviceName")
  async checkService(
    @Param("projectId") projectId: string,
    @Param("serviceName") serviceName: string,
  ) {
    return await this.healthService.checkService(projectId, serviceName);
  }

  @Get("alerts/:projectId")
  getAlerts(@Param("projectId") projectId: string) {
    return this.healthService.getAlerts(projectId);
  }

  @Post("alerts/:projectId/:alertId/acknowledge")
  acknowledgeAlert(
    @Param("projectId") projectId: string,
    @Param("alertId") alertId: string,
  ) {
    this.healthService.acknowledgeAlert(projectId, alertId);
    return { ok: true };
  }

  @Post("alerts/:projectId/:alertId/resolve")
  resolveAlert(
    @Param("projectId") projectId: string,
    @Param("alertId") alertId: string,
  ) {
    this.healthService.resolveAlert(projectId, alertId);
    return { ok: true };
  }

  @Post("alerts/dispatch")
  dispatchAlert(@Body() body: DispatchAlertDto) {
    this.healthService.addAlert(body.projectId, body.dimension, body.severity, body.title, body.message);
    return { ok: true };
  }

  @Get("trend/:projectId")
  getTrend(@Param("projectId") projectId: string) {
    return this.healthService.getTrend(projectId);
  }
}
