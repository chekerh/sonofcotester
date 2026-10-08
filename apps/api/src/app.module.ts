import { Inject, Module, OnModuleInit, forwardRef } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { ExecutionGateway } from "./execution.gateway.js";
import { OrchestrationService } from "./orchestration.service.js";
import { RunEventsService } from "./run-events.service.js";
import { HealthController } from "./services/health.controller.js";
import { HealthService } from "./services/health.service.js";
import { HealthGateway } from "./gateways/health.gateway.js";
import { HealthSchedulerService } from "./services/health-scheduler.service.js";
import { HealthSchedulerController } from "./services/health-scheduler.controller.js";
import { GitHubCheckService } from "./services/github-check.service.js";
import { PRHealthSummaryService } from "./services/pr-health-summary.service.js";
import { PRHealthSummaryController } from "./services/pr-health-summary.controller.js";
import { GitHubWebhookService } from "./services/github-webhook.service.js";
import { NotificationService } from "./services/notifications/notification.service.js";
import { NotificationController } from "./services/notifications/notification.controller.js";
import { EscalationService } from "./services/escalation.service.js";
import { EscalationController } from "./services/escalation.controller.js";
import { AlertingRulesService } from "./services/alerting-rules.service.js";
import { AlertingRulesController } from "./services/alerting-rules.controller.js";
import { MaestroController } from "./services/maestro.controller.js";
import { AdminService } from "./services/admin.service.js";
import { AdminController } from "./services/admin.controller.js";
import { AcademyService } from "./services/academy.service.js";
import { AcademyController } from "./services/academy.controller.js";
import { ApiKeysService } from "./services/api-keys.service.js";
import { ApiKeysController } from "./services/api-keys.controller.js";
import { MetricsService } from "./services/metrics.service.js";
import { MetricsController } from "./services/metrics.controller.js";
import { AuthService } from "./services/auth.service.js";
import { AuthController } from "./services/auth.controller.js";
import { BillingService } from "./services/billing.service.js";
import { BillingController } from "./services/billing.controller.js";
import { AiController } from "./services/ai.controller.js";
import { BenchmarkService } from "./services/benchmark.service.js";
import { BenchmarkController } from "./services/benchmark.controller.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: process.env.NODE_ENV === "production" ? 100 : 1000,
      },
      {
        ttl: 1_000,
        limit: process.env.NODE_ENV === "production" ? 10 : 50,
      },
    ]),
  ],
  controllers: [
    AppController,
    HealthController,
    HealthSchedulerController,
    PRHealthSummaryController,
    NotificationController,
    EscalationController,
    AlertingRulesController,
    MaestroController,
    AdminController,
    AcademyController,
    ApiKeysController,
    MetricsController,
    AuthController,
    BillingController,
    AiController,
    BenchmarkController,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppService,
    OrchestrationService,
    ExecutionGateway,
    RunEventsService,
    HealthService,
    HealthGateway,
    HealthSchedulerService,
    GitHubCheckService,
    PRHealthSummaryService,
    GitHubWebhookService,
    NotificationService,
    EscalationService,
    AlertingRulesService,
    AdminService,
    AcademyService,
    ApiKeysService,
    MetricsService,
    AuthService,
    BillingService,
    BenchmarkService,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    @Inject(forwardRef(() => HealthService)) private readonly healthService: HealthService,
    @Inject(forwardRef(() => NotificationService)) private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => EscalationService)) private readonly escalationService: EscalationService,
    @Inject(forwardRef(() => AlertingRulesService)) private readonly alertingRulesService: AlertingRulesService,
  ) {}

  onModuleInit() {
    // Wire services into health service for real-time alert delivery and escalation
    if (this.healthService) {
      if (this.notificationService) this.healthService.setNotificationService(this.notificationService);
      if (this.escalationService) this.healthService.setEscalationService(this.escalationService);
      if (this.alertingRulesService) this.healthService.setAlertingRulesService(this.alertingRulesService);
    }

    // Wire health service into alerting rules so rules can create alerts
    if (this.alertingRulesService && this.healthService) {
      this.alertingRulesService.setHealthService({
        addAlert: (
          projectId: string,
          dimension: import("@sonofcotester/sdk").HealthDimension,
          severity: import("@sonofcotester/sdk").VulnerabilitySeverity,
          title: string,
          message: string,
        ) => {
          this.healthService.addAlert(projectId, dimension, severity, title, message);
        },
      });
    }
  }
}
