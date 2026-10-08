import { Controller, Get, Header } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { MetricsService } from "./metrics.service.js";

@Controller("metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @SkipThrottle()
  @Header("Content-Type", "text/plain; version=0.0.4")
  async getMetrics() {
    return this.metricsService.getPrometheusMetrics();
  }
}
