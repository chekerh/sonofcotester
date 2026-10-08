import type {
  NotificationChannel,
  NotificationPayload,
  NotificationSeverity,
  HealthDimension,
} from "@sonofcotester/sdk";

/**
 * Common interface that all notification channel adapters implement.
 * Each adapter knows how to send a notification to its specific external service.
 */
export interface NotificationChannelAdapter {
  readonly type: NotificationChannel["type"];

  /**
   * Send a notification payload through this channel.
   * Returns the raw response from the external service.
   */
  send(
    channel: NotificationChannel,
    payload: Omit<NotificationPayload, "id" | "channelId" | "channelType" | "sentAt" | "success">,
  ): Promise<{ success: boolean; response?: string; error?: string }>;

  /**
   * Validate that the channel config is complete and the external service
   * is reachable (optional health check).
   */
  validate?(config: NotificationChannel["config"]): Promise<{ valid: boolean; error?: string }>;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Helper to build a notification payload from a HealthAlert.
 */
export function buildNotificationPayload(
  channel: NotificationChannel,
  alert: {
    id: string;
    projectId: string;
    dimension: HealthDimension;
    severity: NotificationSeverity;
    title: string;
    message: string;
    actionUrl?: string;
  },
): Omit<NotificationPayload, "id" | "channelId" | "channelType" | "sentAt" | "success"> {
  return {
    severity: alert.severity,
    dimension: alert.dimension,
    projectId: alert.projectId,
    title: alert.title,
    message: alert.message,
    actionUrl: alert.actionUrl,
  };
}

/**
 * Severity ranking for comparison (higher = more severe).
 */
export function severityRank(s: NotificationSeverity): number {
  switch (s) {
    case "info": return 0;
    case "warning": return 1;
    case "critical": return 2;
    default: return 0;
  }
}

/**
 * Check if an alert should be delivered to a channel based on its filters.
 */
export function shouldDeliver(
  channel: NotificationChannel,
  severity: NotificationSeverity,
  dimension: HealthDimension,
  projectId: string,
): boolean {
  if (!channel.enabled) return false;
  if (severityRank(severity) < severityRank(channel.minSeverity)) return false;
  if (channel.dimensions.length > 0 && !channel.dimensions.includes(dimension)) return false;
  if (channel.projectIds.length > 0 && !channel.projectIds.includes(projectId)) return false;
  return true;
}
