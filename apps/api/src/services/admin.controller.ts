import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { PlanTier } from "@sonofcotester/sdk";
import { AdminService } from "./admin.service.js";

class UpdateSubscriptionDto {
  @IsIn(["student_free", "pro", "team", "enterprise"])
  tier!: PlanTier;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  paymentBrand?: string;

  @IsOptional()
  @IsString()
  paymentLast4?: string;
}

@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("subscriptions")
  getSubscription(@Query("workspaceId") workspaceId?: string) {
    return this.adminService.getSubscription(workspaceId || "ws_internal");
  }

  @Post("subscriptions/upgrade")
  updateSubscription(@Body() body: UpdateSubscriptionDto) {
    return this.adminService.updateSubscription(
      body.workspaceId || "ws_internal",
      body.tier,
      body.paymentBrand,
      body.paymentLast4
    );
  }

  @Get("invoices")
  getInvoices(@Query("workspaceId") workspaceId?: string) {
    return this.adminService.getInvoices(workspaceId || "ws_internal");
  }

  @Get("usage")
  getUsage(@Query("workspaceId") workspaceId?: string) {
    return this.adminService.getQuota(workspaceId || "ws_internal");
  }

  @Get("audit-logs")
  getAuditLogs(@Query("workspaceId") workspaceId?: string, @Query("limit") limit?: string) {
    return this.adminService.getAuditLogs(
      workspaceId || "ws_internal",
      limit ? parseInt(limit, 10) : 50
    );
  }

  @Get("audit-logs/export.csv")
  async exportAuditLogsCsv(@Query("workspaceId") workspaceId?: string) {
    return this.adminService.exportAuditLogsCsv(workspaceId || "ws_internal");
  }

  @Get("system/overview")
  getSystemAPM() {
    return this.adminService.getSystemAPM();
  }

  @Post("queues/retry-failed")
  retryFailedJobs() {
    return this.adminService.retryFailedJobs();
  }

  @Post("queues/purge-completed")
  purgeCompleted() {
    return this.adminService.purgeCompletedJobs();
  }
}
