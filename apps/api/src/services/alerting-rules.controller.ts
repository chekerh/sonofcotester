import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { AlertingRulesService } from "./alerting-rules.service.js";
import type { CreateAlertingRuleRequest, UpdateAlertingRuleRequest } from "@sonofcotester/sdk";

@Controller("health/alerting-rules")
export class AlertingRulesController {
  constructor(private readonly rulesService: AlertingRulesService) {}

  @Post()
  createRule(@Body() body: CreateAlertingRuleRequest) {
    return this.rulesService.createRule(body);
  }

  @Get()
  listRules() {
    return this.rulesService.listRules();
  }

  @Get("stats")
  getStats() {
    return this.rulesService.getStats();
  }

  @Get("history")
  getAllHistory() {
    return this.rulesService.getAllFireHistory();
  }

  @Get(":id")
  getRule(@Param("id") id: string) {
    return this.rulesService.getRule(id);
  }

  @Put(":id")
  updateRule(@Param("id") id: string, @Body() body: UpdateAlertingRuleRequest) {
    return this.rulesService.updateRule(id, body);
  }

  @Delete(":id")
  deleteRule(@Param("id") id: string) {
    return this.rulesService.deleteRule(id);
  }

  @Get(":id/history")
  getRuleHistory(@Param("id") id: string) {
    return this.rulesService.getFireHistoryForRule(id);
  }
}
