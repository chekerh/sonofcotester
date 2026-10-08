import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { BenchmarkService } from "./benchmark.service.js";
import type { FullShootoutConfig } from "@sonofcotester/sdk";

@Controller("benchmarks")
export class BenchmarkController {
  constructor(private readonly benchmarkService: BenchmarkService) {}

  @Get("presets")
  getPresets() {
    return this.benchmarkService.getPresets();
  }

  @Get("stacks")
  getStackProfiles() {
    return this.benchmarkService.getStackProfiles();
  }

  @Get("history")
  getHistory() {
    return this.benchmarkService.getHistory();
  }

  @Get(":id")
  getRunById(@Param("id") id: string) {
    return this.benchmarkService.getRunById(id);
  }

  @Post("run")
  runShootout(@Body() body: FullShootoutConfig) {
    return this.benchmarkService.runShootout(body);
  }

  @Post("parity-test")
  runParityTest(@Body() body?: { baseUrl?: string }) {
    return this.benchmarkService.runParityTest(body?.baseUrl);
  }

  @Post("k6-script")
  generateK6Script(@Body() body: FullShootoutConfig) {
    return this.benchmarkService.generateK6Script(body);
  }
}
