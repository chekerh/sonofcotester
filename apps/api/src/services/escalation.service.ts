import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type {
  EscalationRule,
  EscalationStep,
  EscalationEvent,
  EscalationState,
  EscalationStats,
  CreateEscalationRuleRequest,
  UpdateEscalationRuleRequest,
  HealthAlert,
  HealthDimension,
  VulnerabilitySeverity,
  NotificationSeverity,
} from "@sonofcotester/sdk";
import { NotificationService } from "./notifications/notification.service.js";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Map VulnerabilitySeverity to NotificationSeverity.
 */
function toNotifSeverity(s: VulnerabilitySeverity): NotificationSeverity {
  if (s === "critical" || s === "high") return "critical";
  if (s === "medium" || s === "low") return "warning";
  return "info";
}

/**
 * Severity ranking for comparison.
 */
function severityRank(s: VulnerabilitySeverity): number {
  switch (s) {
    case "info": return 0;
    case "low": return 1;
    case "medium": return 2;
    case "high": return 3;
    case "critical": return 4;
    default: return 0;
  }
}

/**
 * Resolve a message template by replacing {{variable}} placeholders.
 */
function resolveTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/**
 * Service that monitors unresolved health alerts and applies escalation rules.
 *
 * When an alert is created, it is registered for escalation monitoring.
 * A background timer checks every 10 seconds for alerts that need to
 * escalate to the next step. Each step can notify channels, page on-call,
 * or fire webhooks with configurable delays.
 *
 * Escalation stops when:
 *   - The alert is acknowledged
 *   - The alert is resolved
 *   - All steps have been executed
 *   - maxEscalations limit is reached
 */
@Injectable()
export class EscalationService implements OnModuleDestroy {
  private readonly logger = new Logger(EscalationService.name);

  /** Registered escalation rules */
  private readonly rules = new Map<string, EscalationRule>();

  /** Active alert escalation states: alertId → state[] */
  private readonly states = new Map<string, EscalationState[]>();

  /** Escalation event history */
  private readonly events: EscalationEvent[] = [];

  /** Background timer that checks for escalations */
  private readonly CHECK_INTERVAL_MS = 10_000; // 10 seconds
  private checkTimer: ReturnType<typeof setInterval> | null = null;

  /** Max events to keep */
  private readonly MAX_EVENTS = 1000;

  constructor(private readonly notificationService: NotificationService) {
    // Start the escalation check loop
    this.checkTimer = setInterval(() => this.checkEscalations(), this.CHECK_INTERVAL_MS);
    this.logger.log("[Escalation] Background check started (every 10s)");
  }

  onModuleDestroy() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  // ── Rule Management ──

  createRule(request: CreateEscalationRuleRequest): EscalationRule {
    const now = new Date().toISOString();
    const steps: EscalationStep[] = request.steps.map((s, i) => ({
      id: `step-${i + 1}`,
      name: s.name,
      delayMs: s.delayMs,
      action: s.action,
      targetSeverity: s.targetSeverity ?? "critical",
      channelIds: s.channelIds ?? [],
      messageTemplate: s.messageTemplate,
      onceOnly: s.onceOnly ?? false,
    }));

    const rule: EscalationRule = {
      id: uid(),
      name: request.name,
      description: request.description ?? "",
      enabled: request.enabled ?? true,
      dimensions: request.dimensions ?? [],
      minSeverity: request.minSeverity ?? "high",
      projectIds: request.projectIds ?? [],
      steps,
      maxEscalations: request.maxEscalations ?? 0,
      autoResolveAfterMs: request.autoResolveAfterMs ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    this.rules.set(rule.id, rule);
    this.logger.log(`[Escalation] Created rule "${rule.name}" with ${steps.length} steps — id=${rule.id}`);
    return rule;
  }

  updateRule(id: string, request: UpdateEscalationRuleRequest): EscalationRule | undefined {
    const existing = this.rules.get(id);
    if (!existing) return undefined;

    const updated: EscalationRule = {
      ...existing,
      ...request,
      steps: request.steps
        ? request.steps.map((s, i) => ({
            id: `step-${i + 1}`,
            name: s.name,
            delayMs: s.delayMs,
            action: s.action,
            targetSeverity: s.targetSeverity ?? "critical",
            channelIds: s.channelIds ?? [],
            messageTemplate: s.messageTemplate,
            onceOnly: s.onceOnly ?? false,
          }))
        : existing.steps,
      updatedAt: new Date().toISOString(),
    };

    this.rules.set(id, updated);
    this.logger.log(`[Escalation] Updated rule "${updated.name}" (${updated.id})`);
    return updated;
  }

  deleteRule(id: string): boolean {
    const existed = this.rules.delete(id);
    if (existed) this.logger.log(`[Escalation] Deleted rule ${id}`);
    return existed;
  }

  getRule(id: string): EscalationRule | undefined {
    return this.rules.get(id);
  }

  listRules(): EscalationRule[] {
    return Array.from(this.rules.values());
  }

  // ── Alert Registration ──

  /**
   * Register a new alert for escalation monitoring.
   * Called by HealthService.addAlert() to hand off alerts that match
   * any enabled escalation rule.
   */
  registerAlert(alert: HealthAlert): void {
    const matchingRules = this.findMatchingRules(alert);
    if (matchingRules.length === 0) return;

    const existingStates = this.states.get(alert.id) ?? [];

    for (const rule of matchingRules) {
      // Don't register twice for the same rule
      if (existingStates.some((s) => s.ruleId === rule.id)) continue;

      const state: EscalationState = {
        alertId: alert.id,
        ruleId: rule.id,
        currentStepIndex: 0,
        escalationCount: 0,
        registeredAt: new Date().toISOString(),
        completed: false,
      };

      existingStates.push(state);
      this.logger.log(
        `[Escalation] Registered alert "${alert.title}" for rule "${rule.name}" (step 0, delay ${rule.steps[0]?.delayMs ?? 0}ms)`,
      );
    }

    if (existingStates.length > 0) {
      this.states.set(alert.id, existingStates);
    }
  }

  /**
   * Notify the escalation service that an alert was acknowledged.
   * Stops further escalation for that alert.
   */
  onAlertAcknowledged(alertId: string): void {
    const stateList = this.states.get(alertId);
    if (!stateList) return;

    for (const state of stateList) {
      state.acknowledgedAt = new Date().toISOString();
      this.logger.log(`[Escalation] Alert ${alertId} acknowledged — escalation stopped (rule ${state.ruleId})`);
    }
  }

  /**
   * Notify the escalation service that an alert was resolved.
   * Stops further escalation and optionally auto-resolves.
   */
  onAlertResolved(alertId: string): void {
    const stateList = this.states.get(alertId);
    if (!stateList) return;

    for (const state of stateList) {
      state.resolvedAt = new Date().toISOString();
      this.logger.log(`[Escalation] Alert ${alertId} resolved — escalation stopped (rule ${state.ruleId})`);
    }
  }

  // ── Background Escalation Check ──

  /**
   * Called every 10 seconds to check if any alerts need escalation.
   */
  private async checkEscalations(): Promise<void> {
    const now = Date.now();

    for (const [alertId, stateList] of this.states) {
      for (const state of stateList) {
        if (this.shouldEscalate(state, now)) {
          await this.executeEscalationStep(alertId, state);
        }
      }
    }
  }

  /**
   * Determine whether a state should escalate to the next step.
   */
  private shouldEscalate(state: EscalationState, nowMs: number): boolean {
    // Already completed
    if (state.completed) return false;

    // Acknowledged or resolved
    if (state.acknowledgedAt || state.resolvedAt) return false;

    const rule = this.rules.get(state.ruleId);
    if (!rule || !rule.enabled) return false;

    // Max escalations reached
    if (rule.maxEscalations > 0 && state.escalationCount >= rule.maxEscalations) {
      return false;
    }

    // Check if we're past the current step's delay
    const step = rule.steps[state.currentStepIndex];
    if (!step) {
      state.completed = true;
      return false;
    }

    // Calculate when this step should fire
    const baseTime = new Date(state.registeredAt).getTime();
    const stepDelay = rule.steps.slice(0, state.currentStepIndex).reduce((sum, s) => sum + s.delayMs, 0);
    const stepFireTime = baseTime + step.delayMs + stepDelay;

    // Add the cumulative delay of previous steps
    let cumulativeDelay = 0;
    for (let i = 0; i <= state.currentStepIndex; i++) {
      cumulativeDelay += rule.steps[i].delayMs;
    }
    const fireAt = baseTime + cumulativeDelay;

    return nowMs >= fireAt;
  }

  /**
   * Execute an escalation step for an alert.
   */
  private async executeEscalationStep(alertId: string, state: EscalationState): Promise<void> {
    const rule = this.rules.get(state.ruleId);
    if (!rule) return;

    const step = rule.steps[state.currentStepIndex];
    if (!step) {
      state.completed = true;
      return;
    }

    // Find the original alert (we need it for template resolution)
    // In production, fetch from DB. For now, use a minimal representation.
    const alertTitle = `Alert ${alertId}`;
    const alertSeverity = "high" as VulnerabilitySeverity;
    const alertDimension = rule.dimensions[0] ?? "security";
    const alertMessage = "An alert requires your attention.";

    const templateVars: Record<string, string> = {
      "alert.title": alertTitle,
      "alert.message": alertMessage,
      "alert.severity": alertSeverity,
      "alert.dimension": alertDimension,
      "rule.name": rule.name,
      "step.name": step.name,
    };

    const message = step.messageTemplate
      ? resolveTemplate(step.messageTemplate, templateVars)
      : `[ESCALATION] ${rule.name} → ${step.name}: ${alertTitle}`;

    this.logger.log(
      `[Escalation] Executing step "${step.name}" (${step.action}) for alert ${alertId} (rule: ${rule.name})`,
    );

    let success = false;
    let error: string | undefined;

    try {
      switch (step.action) {
        case "notify":
          success = await this.executeNotify(step, alertId, alertDimension, alertSeverity, message);
          break;
        case "page-oncall":
          success = await this.executePageOnCall(step, alertId, alertDimension, alertSeverity, message);
          break;
        case "notify-slack":
          success = await this.executeNotifySlack(step, alertId, alertDimension, alertSeverity, message);
          break;
        case "webhook":
          success = await this.executeWebhook(step, alertId, alertDimension, alertSeverity, message);
          break;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Escalation] Step failed: ${error}`);
    }

    // Record the event
    state.escalationCount++;
    state.lastEscalatedAt = new Date().toISOString();

    const event: EscalationEvent = {
      id: uid(),
      ruleId: rule.id,
      ruleName: rule.name,
      alertId,
      alertTitle,
      projectId: "unknown",
      dimension: alertDimension as HealthDimension,
      stepId: step.id,
      stepName: step.name,
      action: step.action,
      executedAt: new Date().toISOString(),
      success,
      error,
      escalationCount: state.escalationCount,
    };

    this.events.push(event);
    if (this.events.length > this.MAX_EVENTS) {
      this.events.splice(0, this.events.length - this.MAX_EVENTS);
    }

    // Advance to next step or mark completed
    if (state.currentStepIndex < rule.steps.length - 1) {
      state.currentStepIndex++;
    } else {
      state.completed = true;
    }

    // Check auto-resolve
    if (rule.autoResolveAfterMs > 0) {
      const elapsed = Date.now() - new Date(state.registeredAt).getTime();
      if (elapsed >= rule.autoResolveAfterMs) {
        state.resolvedAt = new Date().toISOString();
        this.logger.log(`[Escalation] Auto-resolved alert ${alertId} after ${elapsed}ms (rule: ${rule.name})`);
      }
    }
  }

  // ── Step Actions ──

  private async executeNotify(
    step: EscalationStep,
    alertId: string,
    dimension: string,
    severity: VulnerabilitySeverity,
    message: string,
  ): Promise<boolean> {
    // Dispatch to specific channels or all matching channels
    const channels = step.channelIds.length > 0
      ? step.channelIds.map((id) => this.notificationService.getChannel(id)).filter(Boolean)
      : [];

    if (channels.length === 0) {
      // No specific channels — create a temporary alert and let the notification service route it
      const tempAlert: HealthAlert = {
        id: alertId,
        projectId: "unknown",
        dimension: dimension as HealthDimension,
        severity,
        title: `[ESCALATION] ${step.name}`,
        message,
        acknowledged: false,
        createdAt: new Date().toISOString(),
      };
      const results = await this.notificationService.dispatchAlert(tempAlert);
      return results.some((r) => r.success);
    }

    // Notify specific channels
    let allSuccess = true;
    for (const channel of channels) {
      if (!channel) continue;
      const adapter = (this.notificationService as unknown as { adapters: Record<string, { send: Function }> }).adapters[channel.type];
      if (!adapter) continue;

      const result = await adapter.send(channel, {
        severity: step.targetSeverity,
        dimension,
        projectId: "unknown",
        title: `[ESCALATION] ${step.name}`,
        message,
      });

      if (!result.success) allSuccess = false;
    }

    return allSuccess;
  }

  private async executePageOnCall(
    step: EscalationStep,
    alertId: string,
    dimension: string,
    severity: VulnerabilitySeverity,
    message: string,
  ): Promise<boolean> {
    // Page on-call via PagerDuty channels
    const pdChannels = this.notificationService.listChannels().filter((c) => c.type === "pagerduty");

    if (pdChannels.length === 0) {
      this.logger.warn("[Escalation] No PagerDuty channels configured for on-call paging");
      return false;
    }

    let allSuccess = true;
    for (const channel of pdChannels) {
      const adapter = (this.notificationService as unknown as { adapters: Record<string, { send: Function }> }).adapters.pagerduty;
      if (!adapter) continue;

      const result = await adapter.send(channel, {
        severity: "critical",
        dimension,
        projectId: "unknown",
        title: `[PAGE] ${step.name}`,
        message,
      });

      if (!result.success) allSuccess = false;
    }

    return allSuccess;
  }

  private async executeNotifySlack(
    step: EscalationStep,
    alertId: string,
    dimension: string,
    severity: VulnerabilitySeverity,
    message: string,
  ): Promise<boolean> {
    const slackChannels = this.notificationService.listChannels().filter((c) => c.type === "slack");

    if (slackChannels.length === 0) {
      this.logger.warn("[Escalation] No Slack channels configured");
      return false;
    }

    let allSuccess = true;
    for (const channel of slackChannels) {
      const adapter = (this.notificationService as unknown as { adapters: Record<string, { send: Function }> }).adapters.slack;
      if (!adapter) continue;

      const result = await adapter.send(channel, {
        severity: step.targetSeverity,
        dimension,
        projectId: "unknown",
        title: `[ESCALATION] ${step.name}`,
        message,
      });

      if (!result.success) allSuccess = false;
    }

    return allSuccess;
  }

  private async executeWebhook(
    step: EscalationStep,
    alertId: string,
    dimension: string,
    severity: VulnerabilitySeverity,
    message: string,
  ): Promise<boolean> {
    const webhookChannels = this.notificationService.listChannels().filter((c) => c.type === "webhook");

    if (webhookChannels.length === 0) {
      this.logger.warn("[Escalation] No webhook channels configured");
      return false;
    }

    let allSuccess = true;
    for (const channel of webhookChannels) {
      const adapter = (this.notificationService as unknown as { adapters: Record<string, { send: Function }> }).adapters.webhook;
      if (!adapter) continue;

      const result = await adapter.send(channel, {
        severity: step.targetSeverity,
        dimension,
        projectId: "unknown",
        title: `[ESCALATION] ${step.name}`,
        message,
      });

      if (!result.success) allSuccess = false;
    }

    return allSuccess;
  }

  // ── Rule Matching ──

  private findMatchingRules(alert: HealthAlert): EscalationRule[] {
    return Array.from(this.rules.values()).filter((rule) => {
      if (!rule.enabled) return false;
      if (rule.dimensions.length > 0 && !rule.dimensions.includes(alert.dimension)) return false;
      if (rule.projectIds.length > 0 && !rule.projectIds.includes(alert.projectId)) return false;
      if (severityRank(alert.severity) < severityRank(rule.minSeverity)) return false;
      return true;
    });
  }

  // ── Query Methods ──

  getStatesForAlert(alertId: string): EscalationState[] {
    return this.states.get(alertId) ?? [];
  }

  getActiveStates(): EscalationState[] {
    const active: EscalationState[] = [];
    for (const stateList of this.states.values()) {
      for (const state of stateList) {
        if (!state.completed && !state.acknowledgedAt && !state.resolvedAt) {
          active.push(state);
        }
      }
    }
    return active;
  }

  getEvents(options?: { alertId?: string; ruleId?: string; limit?: number }): EscalationEvent[] {
    let events = this.events;

    if (options?.alertId) {
      events = events.filter((e) => e.alertId === options.alertId);
    }
    if (options?.ruleId) {
      events = events.filter((e) => e.ruleId === options.ruleId);
    }

    return events
      .slice()
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
      .slice(0, options?.limit ?? 100);
  }

  getStats(): EscalationStats {
    const active = this.getActiveStates();
    const allEvents = this.events;

    const ruleMap = new Map<string, { name: string; count: number }>();
    for (const event of allEvents) {
      const existing = ruleMap.get(event.ruleId);
      if (existing) {
        existing.count++;
      } else {
        ruleMap.set(event.ruleId, { name: event.ruleName, count: 1 });
      }
    }

    const actionMap = new Map<string, number>();
    for (const event of allEvents) {
      actionMap.set(event.action, (actionMap.get(event.action) ?? 0) + 1);
    }

    return {
      activeEscalations: active.length,
      totalEscalations: allEvents.length,
      byRule: Array.from(ruleMap.entries()).map(([ruleId, data]) => ({
        ruleId,
        ruleName: data.name,
        count: data.count,
      })),
      byAction: Array.from(actionMap.entries()).map(([action, count]) => ({
        action: action as EscalationEvent["action"],
        count,
      })),
      lastEscalationAt: allEvents.length > 0 ? allEvents[allEvents.length - 1].executedAt : undefined,
    };
  }
}
