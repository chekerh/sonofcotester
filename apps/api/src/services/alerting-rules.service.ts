import { Injectable, Logger } from "@nestjs/common";
import type {
  AlertingRule,
  AlertingRuleCondition,
  AlertingRuleEvaluation,
  AlertingRuleStats,
  CreateAlertingRuleRequest,
  UpdateAlertingRuleRequest,
  HealthOverview,
  HealthDimension,
  ComparisonOperator,
} from "@sonofcotester/sdk";

const uid = () => Math.random().toString(36).slice(2, 10);

interface FireRecord {
  ruleId: string;
  projectId: string;
  firedAt: string;
  alertId?: string;
}

interface CooldownKey {
  ruleId: string;
  projectId: string;
}

@Injectable()
export class AlertingRulesService {
  private readonly logger = new Logger(AlertingRulesService.name);
  private readonly rules = new Map<string, AlertingRule>();
  private readonly fireHistory = new Map<string, FireRecord[]>(); // key: ruleId:projectId
  private readonly cooldowns = new Map<string, number>(); // key: ruleId:projectId -> lastFiredAt timestamp

  /** Reference to health service for creating alerts */
  private healthService: {
    addAlert(
      projectId: string,
      dimension: HealthDimension,
      severity: AlertingRule["severity"],
      title: string,
      message: string,
    ): void;
  } | null = null;

  /** Reference to notification service for targeted channel dispatch */
  private notificationService: {
    dispatchAlertToChannels(
      alert: { id: string; projectId: string; dimension: HealthDimension; severity: string; title: string; message: string; acknowledged: boolean; createdAt: string },
      channelIds: string[],
    ): Promise<void>;
  } | null = null;

  setHealthService(service: typeof this.healthService): void {
    this.healthService = service;
  }

  setNotificationService(service: typeof this.notificationService): void {
    this.notificationService = service;
  }

  // ── Rule CRUD ──

  createRule(request: CreateAlertingRuleRequest): AlertingRule {
    const now = new Date().toISOString();
    const rule: AlertingRule = {
      id: uid(),
      name: request.name,
      description: request.description ?? "",
      enabled: request.enabled ?? true,
      conditions: request.conditions.map((c) => ({
        dimension: c.dimension,
        metric: c.metric,
        operator: c.operator,
        threshold: c.threshold,
      })),
      severity: request.severity ?? "high",
      titleTemplate: request.titleTemplate ?? "{{dimension}} score dropped below threshold",
      messageTemplate: request.messageTemplate ?? "{{metric}} is {{value}} (threshold: {{threshold}})",
      cooldownMs: request.cooldownMs ?? 300_000, // 5 minutes default
      projectIds: request.projectIds ?? [],
      channelIds: request.channelIds ?? [],
      autoResolve: request.autoResolve ?? true,
      maxFiresPerProject: request.maxFiresPerProject ?? 10,
      createdAt: now,
      updatedAt: now,
    };
    this.rules.set(rule.id, rule);
    this.logger.log(`Created alerting rule: ${rule.name} (${rule.id})`);
    return rule;
  }

  getRule(id: string): AlertingRule | undefined {
    return this.rules.get(id);
  }

  listRules(): AlertingRule[] {
    return [...this.rules.values()];
  }

  listEnabledRules(): AlertingRule[] {
    return this.listRules().filter((r) => r.enabled);
  }

  updateRule(id: string, request: UpdateAlertingRuleRequest): AlertingRule | null {
    const rule = this.rules.get(id);
    if (!rule) return null;

    if (request.name !== undefined) rule.name = request.name;
    if (request.description !== undefined) rule.description = request.description;
    if (request.enabled !== undefined) rule.enabled = request.enabled;
    if (request.conditions !== undefined) {
      rule.conditions = request.conditions.map((c) => ({
        dimension: c.dimension,
        metric: c.metric,
        operator: c.operator,
        threshold: c.threshold,
      }));
    }
    if (request.severity !== undefined) rule.severity = request.severity;
    if (request.titleTemplate !== undefined) rule.titleTemplate = request.titleTemplate;
    if (request.messageTemplate !== undefined) rule.messageTemplate = request.messageTemplate;
    if (request.cooldownMs !== undefined) rule.cooldownMs = request.cooldownMs;
    if (request.projectIds !== undefined) rule.projectIds = request.projectIds;
    if (request.channelIds !== undefined) rule.channelIds = request.channelIds;
    if (request.autoResolve !== undefined) rule.autoResolve = request.autoResolve;
    if (request.maxFiresPerProject !== undefined) rule.maxFiresPerProject = request.maxFiresPerProject;
    rule.updatedAt = new Date().toISOString();

    this.rules.set(id, rule);
    this.logger.log(`Updated alerting rule: ${rule.name} (${id})`);
    return rule;
  }

  deleteRule(id: string): boolean {
    const existed = this.rules.delete(id);
    if (existed) this.logger.log(`Deleted alerting rule: ${id}`);
    return existed;
  }

  // ── Evaluation Engine ──

  evaluateRules(overview: HealthOverview): AlertingRuleEvaluation[] {
    const results: AlertingRuleEvaluation[] = [];
    const enabledRules = this.listEnabledRules();

    for (const rule of enabledRules) {
      // Filter by project
      if (rule.projectIds.length > 0 && !rule.projectIds.includes(overview.projectId)) {
        continue;
      }

      const evaluation = this.evaluateRule(rule, overview);
      results.push(evaluation);

      if (evaluation.fired) {
        this.handleRuleFired(rule, overview, evaluation);
      } else if (rule.autoResolve) {
        this.handleRuleResolved(rule, overview);
      }
    }

    return results;
  }

  private evaluateRule(rule: AlertingRule, overview: HealthOverview): AlertingRuleEvaluation {
    const conditionsMet: AlertingRuleEvaluation["conditionsMet"] = [];
    let allConditionsMet = true;

    for (const condition of rule.conditions) {
      const actualValue = this.extractMetricValue(overview, condition);
      if (actualValue === null) {
        allConditionsMet = false;
        continue;
      }

      const met = this.compare(actualValue, condition.operator, condition.threshold);
      if (met) {
        conditionsMet.push({
          dimension: condition.dimension,
          metric: condition.metric,
          operator: condition.operator,
          threshold: condition.threshold,
          actualValue,
        });
      } else {
        allConditionsMet = false;
      }
    }

    return {
      ruleId: rule.id,
      projectId: overview.projectId,
      fired: allConditionsMet && conditionsMet.length > 0,
      conditionsMet,
      evaluatedAt: new Date().toISOString(),
    };
  }

  private extractMetricValue(overview: HealthOverview, condition: AlertingRuleCondition): number | null {
    const dimScore = overview.dimensions.find((d) => d.dimension === condition.dimension);
    if (!dimScore) return null;

    const metric = condition.metric.toLowerCase();

    // Standard dimension scores
    if (metric === "overall" || metric === "score" || metric === "") {
      return dimScore.score;
    }
    if (metric === "issuecount" || metric === "issues") {
      return dimScore.issueCount;
    }

    // Nested metric paths (e.g. "responseTime.p95")
    const parts = metric.split(".");
    if (parts.length > 1) {
      return this.resolveNestedMetric(dimScore as unknown, parts);
    }

    return dimScore.score;
  }

  private resolveNestedMetric(dimScore: unknown, path: string[]): number | null {
    let current: unknown = dimScore;
    for (const part of path) {
      if (current === null || current === undefined || typeof current !== "object") return null;
      current = (current as Record<string, unknown>)[part];
    }
    return typeof current === "number" ? current : null;
  }

  private compare(actual: number, operator: ComparisonOperator, threshold: number): boolean {
    switch (operator) {
      case "lt": return actual < threshold;
      case "lte": return actual <= threshold;
      case "gt": return actual > threshold;
      case "gte": return actual >= threshold;
      case "eq": return actual === threshold;
      case "neq": return actual !== threshold;
      default: return false;
    }
  }

  private handleRuleFired(rule: AlertingRule, overview: HealthOverview, evaluation: AlertingRuleEvaluation): void {
    const cooldownKey = `${rule.id}:${overview.projectId}`;
    const lastFired = this.cooldowns.get(cooldownKey);

    // Check cooldown
    if (lastFired && Date.now() - lastFired < rule.cooldownMs) {
      return; // Still in cooldown
    }

    // Check max fires per project
    if (rule.maxFiresPerProject > 0) {
      const fires = this.getFireHistory(rule.id, overview.projectId);
      if (fires.length >= rule.maxFiresPerProject) {
        return; // Max fires reached
      }
    }

    // Build title and message from templates
    const metrics = evaluation.conditionsMet.map((c) => `${c.dimension}/${c.metric}: ${c.actualValue}`);
    const title = this.interpolateTemplate(rule.titleTemplate, {
      dimension: evaluation.conditionsMet[0]?.dimension ?? "unknown",
      metric: evaluation.conditionsMet[0]?.metric ?? "score",
      value: String(evaluation.conditionsMet[0]?.actualValue ?? "N/A"),
      threshold: String(evaluation.conditionsMet[0]?.threshold ?? "N/A"),
      metrics: metrics.join(", "),
      rule: rule.name,
    });
    const message = this.interpolateTemplate(rule.messageTemplate, {
      dimension: evaluation.conditionsMet.map((c) => c.dimension).join(", "),
      metric: metrics.join("; "),
      value: evaluation.conditionsMet.map((c) => String(c.actualValue)).join(", "),
      threshold: evaluation.conditionsMet.map((c) => String(c.threshold)).join(", "),
      metrics: metrics.join(", "),
      rule: rule.name,
    });

    // Record fire
    this.recordFire(rule.id, overview.projectId);

    // Update cooldown
    this.cooldowns.set(cooldownKey, Date.now());

    // Create alert via health service
    if (this.healthService) {
      const primaryCondition = evaluation.conditionsMet[0];
      const dimension = (primaryCondition?.dimension as HealthDimension) ?? "security";

      this.healthService.addAlert(
        overview.projectId,
        dimension,
        rule.severity,
        title,
        message,
      );
    }

    this.logger.warn(
      `Alerting rule "${rule.name}" fired for project ${overview.projectId}: ` +
      evaluation.conditionsMet.map((c) => `${c.dimension}/${c.metric} ${c.actualValue} ${c.operator} ${c.threshold}`).join(", "),
    );
  }

  private handleRuleResolved(rule: AlertingRule, overview: HealthOverview): void {
    // No resolution logic needed for now — auto-resolve is handled by the alert lifecycle
    // When the condition is no longer met, the alert just doesn't re-fire
  }

  // ── Template Interpolation ──

  private interpolateTemplate(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    return result;
  }

  // ── Fire History ──

  private recordFire(ruleId: string, projectId: string): void {
    const key = `${ruleId}:${projectId}`;
    const history = this.fireHistory.get(key) ?? [];
    history.push({
      ruleId,
      projectId,
      firedAt: new Date().toISOString(),
    });
    // Keep last 100 fires per rule/project
    if (history.length > 100) history.shift();
    this.fireHistory.set(key, history);
  }

  private getFireHistory(ruleId: string, projectId: string): FireRecord[] {
    return this.fireHistory.get(`${ruleId}:${projectId}`) ?? [];
  }

  // ── Statistics ──

  getStats(): AlertingRuleStats {
    const rules = this.listRules();
    const byRule: AlertingRuleStats["byRule"] = [];
    const byDimensionMap = new Map<string, number>();
    let totalFires = 0;

    for (const rule of rules) {
      let ruleFireCount = 0;
      let lastFiredAt: string | undefined;

      for (const [key, history] of this.fireHistory) {
        if (key.startsWith(`${rule.id}:`)) {
          ruleFireCount += history.length;
          if (history.length > 0) {
            const latest = history[history.length - 1].firedAt;
            if (!lastFiredAt || latest > lastFiredAt) lastFiredAt = latest;
          }
        }
      }

      totalFires += ruleFireCount;
      byRule.push({
        ruleId: rule.id,
        ruleName: rule.name,
        fireCount: ruleFireCount,
        lastFiredAt,
      });

      // Aggregate by dimension from conditions
      for (const condition of rule.conditions) {
        const dim = condition.dimension;
        const existing = byDimensionMap.get(dim) ?? 0;
        byDimensionMap.set(dim, existing + ruleFireCount);
      }
    }

    return {
      totalRules: rules.length,
      enabledRules: rules.filter((r) => r.enabled).length,
      totalFires,
      byRule,
      byDimension: [...byDimensionMap.entries()].map(([dimension, fireCount]) => ({
        dimension: dimension as HealthDimension,
        fireCount,
      })),
    };
  }

  // ── Manual evaluation ──

  manuallyEvaluate(projectId: string, overview: HealthOverview): AlertingRuleEvaluation[] {
    return this.evaluateRules(overview);
  }

  // ── History ──

  getFireHistoryForRule(ruleId: string): FireRecord[] {
    const all: FireRecord[] = [];
    for (const [key, history] of this.fireHistory) {
      if (key.startsWith(`${ruleId}:`)) {
        all.push(...history);
      }
    }
    return all.sort((a, b) => b.firedAt.localeCompare(a.firedAt));
  }

  getAllFireHistory(): FireRecord[] {
    const all: FireRecord[] = [];
    for (const history of this.fireHistory.values()) {
      all.push(...history);
    }
    return all.sort((a, b) => b.firedAt.localeCompare(a.firedAt));
  }
}
