import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import type {
  NotificationChannelType,
  NotificationSeverity,
  CreateNotificationChannelRequest,
  UpdateNotificationChannelRequest,
  SlackChannelConfig,
  PagerDutyChannelConfig,
  EmailChannelConfig,
  WebhookChannelConfig,
} from "@sonofcotester/sdk";
import { IsNumber, IsObject } from "class-validator";
import { NotificationService } from "./notification.service.js";

class CreateChannelDto {
  @IsString()
  name!: string;

  @IsIn(["slack", "pagerduty", "email", "webhook"])
  type!: NotificationChannelType;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(["info", "warning", "critical"])
  minSeverity?: NotificationSeverity;

  @IsOptional()
  @IsArray()
  dimensions?: string[];

  @IsOptional()
  @IsArray()
  projectIds?: string[];

  // Channel-specific config — validated by the adapter
  @IsObject()
  config!: SlackChannelConfig | PagerDutyChannelConfig | EmailChannelConfig | WebhookChannelConfig;
}

class UpdateChannelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(["info", "warning", "critical"])
  minSeverity?: NotificationSeverity;

  @IsOptional()
  @IsArray()
  dimensions?: string[];

  @IsOptional()
  @IsArray()
  projectIds?: string[];

  @IsOptional()
  @IsObject()
  config?: SlackChannelConfig | PagerDutyChannelConfig | EmailChannelConfig | WebhookChannelConfig;
}

class TestNotificationDto {
  @IsOptional()
  @IsString()
  message?: string;
}

@Controller("health/notifications")
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // ── Channel CRUD ──

  @Post("channels")
  createChannel(@Body() body: CreateChannelDto) {
    return this.notificationService.createChannel(body as CreateNotificationChannelRequest);
  }

  @Get("channels")
  listChannels() {
    return this.notificationService.listChannels();
  }

  @Get("channels/:id")
  getChannel(@Param("id") id: string) {
    return this.notificationService.getChannel(id);
  }

  @Put("channels/:id")
  updateChannel(@Param("id") id: string, @Body() body: UpdateChannelDto) {
    return this.notificationService.updateChannel(id, body as UpdateNotificationChannelRequest);
  }

  @Delete("channels/:id")
  deleteChannel(@Param("id") id: string) {
    const deleted = this.notificationService.deleteChannel(id);
    return { ok: deleted };
  }

  // ── Channel actions ──

  @Post("channels/:id/test")
  async sendTestNotification(
    @Param("id") id: string,
    @Body() body?: TestNotificationDto,
  ) {
    return this.notificationService.sendTestNotification(id, body?.message);
  }

  @Get("channels/:id/validate")
  async validateChannel(@Param("id") id: string) {
    return this.notificationService.validateChannel(id);
  }

  // ── Delivery log ──

  @Get("delivery-log")
  getDeliveryLog(
    @Query("channelId") channelId?: string,
    @Query("severity") severity?: NotificationSeverity,
    @Query("limit") limit?: string,
  ) {
    return this.notificationService.getDeliveryLog({
      channelId,
      severity,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  // ── Stats ──

  @Get("stats")
  getStats() {
    return this.notificationService.getStats();
  }

  // ── Deduplication ──

  @Get("dedup/stats")
  getDedupStats() {
    return this.notificationService.getDedupStats();
  }

  @Get("dedup/config")
  getDedupConfig() {
    return this.notificationService.getDedupConfig();
  }

  @Put("dedup/config")
  updateDedupConfig(@Body() body: Record<string, unknown>) {
    this.notificationService.updateDedupConfig(body as any);
    return { ok: true };
  }

  @Post("dedup/reset")
  resetDedup() {
    this.notificationService.resetDedup();
    return { ok: true };
  }
}
