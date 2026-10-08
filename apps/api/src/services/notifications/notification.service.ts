import { Injectable, Logger } from "@nestjs/common";
import type {
  NotificationChannel,
  NotificationChannelType,
  NotificationPayload,
  NotificationDeliveryLog,
  NotificationSeverity,
  NotificationStats,
  CreateNotificationChannelRequest,
  UpdateNotificationChannelRequest,
  HealthDimension,
  HealthAlert,
  VulnerabilitySeverity,
} from "@sonofcotester/sdk";
import type { NotificationChannelAdapter } from "./channel-adapter.interface.js";
import { shouldDeliver, severityRank } from "./channel-adapter.interface.js";
import { SlackChannelAdapter } from "./slack.adapter.js";
import { PagerDutyChannelAdapter } from "./pagerduty.adapter.js";
import { EmailChannelAdapter } from "./email.adapter.js";
import { WebhookChannelAdapter } from "./webhook.adapter.js";
import { NotificationDeduplicator, type DedupConfig } from "./deduplicator.js";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Map VulnerabilitySeverity (which has more granular levels) to
 * NotificationSeverity (the 3-level system used for channel filtering).
 */
function toNotificationSeverity(s: VulnerabilitySeverity): NotificationSeverity {
  if (s === "critical") return "critical";
  if (s === "high") return "critical";
  if (s === "medium") return "warning";
  if (s === "low") return "warning";
  return "info";
}

/**
 * Central notification service that manages channels and dispatches
 * health alerts to all configured external services in real time.
 *
 * Flow:
 *   1. HealthService calls `dispatchAlert()` when an alert is created
 *   2. NotificationService finds all matching channels (by project, dimension, severity)
 *   3. Each matching channel's adapter sends the notification
 *   4. Delivery results are logged for the delivery history panel
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /** Registered notification channels */
  private readonly channels = new Map<string, NotificationChannel>();

  /** Delivery log (in-memory; replace with DB in production) */
  private readonly deliveryLog: NotificationDeliveryLog[] = [];

  /** Adapter instances by channel type */
  private readonly adapters: Record<NotificationChannelType, NotificationChannelAdapter>;

  /** Max log entries to keep */
  private readonly MAX_LOG_ENTRIES = 500;

  /** Deduplication engine */
  private readonly deduplicator = new NotificationDeduplicator();

  constructor() {
    this.adapters = {
      slack: new SlackChannelAdapter(),
      pagerduty: new PagerDutyChannelAdapter(),
      email: new EmailChannelAdapter(),
      webhook: new WebhookChannelAdapter(),
    };
  }

  // ── Channel Management ──

  createChannel(request: CreateNotificationChannelRequest): NotificationChannel {
    const now = new Date().toISOString();
    const channel: NotificationChannel = {
      id: uid(),
      name: request.name,
      type: request.type,
      enabled: request.enabled ?? true,
      minSeverity: request.minSeverity ?? "critical",
      dimensions: request.dimensions ?? [],
      projectIds: request.projectIds ?? [],
      config: request.config,
      createdAt: now,
      updatedAt: now,
    };

    this.channels.set(channel.id, channel);
    this.logger.log(
      `[Notification] Created channel "${channel.name}" (${channel.type}) — id=${channel.id}`,
    );

    return channel;
  }

  updateChannel(
    id: string,
    request: UpdateNotificationChannelRequest,
  ): NotificationChannel | undefined {
    const existing = this.channels.get(id);
    if (!existing) return undefined;

    const updated: NotificationChannel = {
      ...existing,
      ...request,
      config: request.config ?? existing.config,
      updatedAt: new Date().toISOString(),
    };

    this.channels.set(id, updated);
    this.logger.log(`[Notification] Updated channel "${updated.name}" (${updated.id})`);
    return updated;
  }

  deleteChannel(id: string): boolean {
    const existed = this.channels.delete(id);
    if (existed) {
      this.logger.log(`[Notification] Deleted channel ${id}`);
    }
    return existed;
  }

  getChannel(id: string): NotificationChannel | undefined {
    return this.channels.get(id);
  }

  listChannels(): NotificationChannel[] {
    return Array.from(this.channels.values());
  }

  listChannelsByType(type: NotificationChannelType): NotificationChannel[] {
    return this.listChannels().filter((c) => c.type === type);
  }

  // ── Alert Dispatch ──

  /**
   * Dispatch a health alert to all matching channels.
   * Called by HealthService.addAlert() after an alert is created.
   *
   * Delivery is async and fire-and-forget — failures are logged
   * but don't block the alert pipeline.
   */
  async dispatchAlert(alert: HealthAlert): Promise<NotificationPayload[]> {
    const notifSeverity = toNotificationSeverity(alert.severity);
    const channels = this.getMatchingChannels(
      notifSeverity,
      alert.dimension,
      alert.projectId,
    );

    if (channels.length === 0) {
      return [];
    }

    // Check dedup — if the alert is within cooldown, skip dispatch entirely
    if (!this.deduplicator.shouldAllow(alert)) {
      this.logger.log(
        `[Notification] Dedup: suppressed "${alert.title}" (global cooldown)`,
      );
      return [];
    }

    this.logger.log(
      `[Notification] Dispatching alert "${alert.title}" to ${channels.length} channel(s)`,
    );

    const results: NotificationPayload[] = [];

    // Dispatch to all matching channels concurrently
    const promises = channels.map(async (channel) => {
      // Per-channel dedup check
      if (!this.deduplicator.shouldAllow(alert, channel.id)) {
        this.logger.debug(
          `[Notification] Dedup: suppressed on channel ${channel.name} for "${alert.title}"`,
        );
        return;
      }

      const adapter = this.adapters[channel.type];
      const result = await adapter.send(channel, {
        severity: notifSeverity,
        dimension: alert.dimension,
        projectId: alert.projectId,
        title: alert.title,
        message: alert.message,
        actionUrl: alert.actionUrl,
      });

      // Record the send for dedup tracking
      if (result.success) {
        this.deduplicator.recordSend(alert, channel.id);
      }

      const logEntry: NotificationPayload = {
        id: uid(),
        channelId: channel.id,
        channelType: channel.type,
        severity: notifSeverity,
        dimension: alert.dimension,
        projectId: alert.projectId,
        title: alert.title,
        message: alert.message,
        actionUrl: alert.actionUrl,
        sentAt: new Date().toISOString(),
        success: result.success,
        error: result.error,
        externalResponse: result.response,
      };

      this.addToDeliveryLog({
        id: logEntry.id,
        alertId: alert.id,
        channelId: channel.id,
        channelType: channel.type,
        severity: notifSeverity,
        success: result.success,
        sentAt: logEntry.sentAt,
        error: result.error,
      });

      results.push(logEntry);
    });

    await Promise.allSettled(promises);

    return results;
  }

  /**
   * Send a test notification to a specific channel.
   */
  async sendTestNotification(
    channelId: string,
    message?: string,
  ): Promise<NotificationPayload | undefined> {
    const channel = this.channels.get(channelId);
    if (!channel) return undefined;

    const adapter = this.adapters[channel.type];
    const result = await adapter.send(channel, {
      severity: "info",
      dimension: "security",
      projectId: "test",
      title: "Test Notification",
      message: message ?? "This is a test notification from Son of CodeTester Health Monitor.",
    });

    return {
      id: uid(),
      channelId: channel.id,
      channelType: channel.type,
      severity: "info",
      dimension: "security",
      projectId: "test",
      title: "Test Notification",
      message: message ?? "This is a test notification from Son of CodeTester Health Monitor.",
      sentAt: new Date().toISOString(),
      success: result.success,
      error: result.error,
    };
  }

  // ── Channel Matching ──

  /**
   * Find all channels that should receive an alert with the given properties.
   */
  private getMatchingChannels(
    severity: NotificationSeverity,
    dimension: HealthDimension,
    projectId: string,
  ): NotificationChannel[] {
    return Array.from(this.channels.values()).filter((channel) =>
      shouldDeliver(channel, severity, dimension, projectId),
    );
  }

  // ── Delivery Log ──

  private addToDeliveryLog(entry: NotificationDeliveryLog): void {
    this.deliveryLog.push(entry);
    if (this.deliveryLog.length > this.MAX_LOG_ENTRIES) {
      this.deliveryLog.splice(0, this.deliveryLog.length - this.MAX_LOG_ENTRIES);
    }
  }

  getDeliveryLog(options?: {
    channelId?: string;
    severity?: NotificationSeverity;
    projectId?: string;
    limit?: number;
  }): NotificationDeliveryLog[] {
    let log = this.deliveryLog;

    if (options?.channelId) {
      log = log.filter((e) => e.channelId === options.channelId);
    }
    if (options?.severity) {
      log = log.filter((e) => e.severity === options.severity);
    }
    if (options?.projectId) {
      // We don't store projectId in the log entry, so filter by alert
      // In production, join with alerts table
    }

    return log
      .slice()
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
      .slice(0, options?.limit ?? 100);
  }

  // ── Stats ──

  getStats(): NotificationStats {
    const log = this.deliveryLog;
    const totalSent = log.filter((e) => e.success).length;
    const totalFailed = log.filter((e) => !e.success).length;

    // Group by channel
    const channelMap = new Map<string, { type: NotificationChannelType; sent: number; failed: number }>();
    for (const entry of log) {
      const existing = channelMap.get(entry.channelId);
      if (existing) {
        if (entry.success) existing.sent++;
        else existing.failed++;
      } else {
        channelMap.set(entry.channelId, {
          type: entry.channelType,
          sent: entry.success ? 1 : 0,
          failed: entry.success ? 0 : 1,
        });
      }
    }

    const byChannel = Array.from(channelMap.entries()).map(([channelId, data]) => ({
      channelId,
      channelType: data.type,
      sent: data.sent,
      failed: data.failed,
    }));

    // Group by severity
    const severityMap = new Map<string, number>();
    for (const entry of log) {
      severityMap.set(entry.severity, (severityMap.get(entry.severity) ?? 0) + 1);
    }
    const bySeverity = Array.from(severityMap.entries()).map(([severity, count]) => ({
      severity: severity as NotificationSeverity,
      count,
    }));

    const lastSentAt = log.length > 0 ? log[log.length - 1].sentAt : undefined;

    return { totalSent, totalFailed, byChannel, bySeverity, lastSentAt };
  }

  // ── Deduplication ──

  getDedupStats() {
    return this.deduplicator.getStats();
  }

  updateDedupConfig(update: Partial<DedupConfig>) {
    this.deduplicator.updateConfig(update);
  }

  getDedupConfig(): DedupConfig {
    return this.deduplicator.getConfig();
  }

  resetDedup(): void {
    this.deduplicator.resetAll();
  }

  // ── Validate Channel ──

  async validateChannel(channelId: string): Promise<{ valid: boolean; error?: string }> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return { valid: false, error: "Channel not found" };
    }

    const adapter = this.adapters[channel.type];
    if (adapter.validate) {
      return adapter.validate(channel.config);
    }

    return { valid: true };
  }
}
