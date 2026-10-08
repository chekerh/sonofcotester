import { Logger } from "@nestjs/common";
import type {
  NotificationChannel,
  PagerDutyChannelConfig,
} from "@sonofcotester/sdk";
import type { NotificationChannelAdapter } from "./channel-adapter.interface.js";

const PAGERDUTY_EVENTS_URL = "https://events.pagerduty.com/v2/enqueue";

const SEVERITY_MAP: Record<string, string> = {
  info: "info",
  warning: "warning",
  critical: "critical",
};

/**
 * Sends health alerts to PagerDuty via the Events API v2.
 *
 * Creates incidents for critical alerts and resolves them when the
 * condition clears. Uses dedup_key based on project+dimension+severity
 * to prevent alert storms.
 */
export class PagerDutyChannelAdapter implements NotificationChannelAdapter {
  readonly type = "pagerduty" as const;
  private readonly logger = new Logger(PagerDutyChannelAdapter.name);

  async send(
    channel: NotificationChannel,
    payload: {
      severity: string;
      dimension: string;
      projectId: string;
      title: string;
      message: string;
      actionUrl?: string;
    },
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    const config = channel.config as PagerDutyChannelConfig;

    // Map severity using custom map if provided
    const pdSeverity =
      config.severityMap?.[payload.severity as keyof typeof config.severityMap] ??
      SEVERITY_MAP[payload.severity] ??
      "warning";

    // Dedup key: same project + dimension + severity = same incident
    const dedupKey = `sct-${payload.projectId}-${payload.dimension}-${payload.severity}`;

    const eventAction = payload.severity === "critical" ? "trigger" : "trigger";

    const body: Record<string, unknown> = {
      routing_key: config.routingKey ?? config.integrationKey,
      event_action: eventAction,
      dedup_key: dedupKey,
      payload: {
        summary: `${payload.title}: ${payload.message}`,
        source: "son-of-cotester",
        severity: pdSeverity,
        component: payload.dimension,
        group: payload.projectId,
        class: "health-alert",
        custom_details: {
          projectId: payload.projectId,
          dimension: payload.dimension,
          severity: payload.severity,
          title: payload.title,
          message: payload.message,
          actionUrl: payload.actionUrl,
          timestamp: new Date().toISOString(),
        },
      },
      links: payload.actionUrl
        ? [{ href: payload.actionUrl, text: "View in Dashboard" }]
        : [],
      images: [],
    };

    try {
      const resp = await fetch(PAGERDUTY_EVENTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const text = await resp.text();

      if (!resp.ok) {
        this.logger.error(`[PagerDuty] Send failed (${resp.status}): ${text}`);
        return { success: false, error: `HTTP ${resp.status}: ${text}` };
      }

      const data = JSON.parse(text) as { message?: string; dedup_key?: string };
      this.logger.log(
        `[PagerDuty] Alert triggered: dedup=${data.dedup_key}, message=${data.message}`,
      );
      return { success: true, response: text };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[PagerDuty] Send error: ${msg}`);
      return { success: false, error: msg };
    }
  }

  /**
   * Send a resolve event to PagerDuty for a cleared alert.
   */
  async resolve(
    config: PagerDutyChannelConfig,
    projectId: string,
    dimension: string,
    severity: string,
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    const dedupKey = `sct-${projectId}-${dimension}-${severity}`;

    const body = {
      routing_key: config.routingKey ?? config.integrationKey,
      event_action: "resolve",
      dedup_key: dedupKey,
    };

    try {
      const resp = await fetch(PAGERDUTY_EVENTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const text = await resp.text();
      if (!resp.ok) {
        return { success: false, error: `HTTP ${resp.status}: ${text}` };
      }

      this.logger.log(`[PagerDuty] Incident resolved: dedup=${dedupKey}`);
      return { success: true, response: text };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  async validate(
    config: NotificationChannel["config"],
  ): Promise<{ valid: boolean; error?: string }> {
    const c = config as PagerDutyChannelConfig;
    if (!c.integrationKey) {
      return { valid: false, error: "Missing integrationKey" };
    }
    if (c.integrationKey.length !== 32) {
      return {
        valid: false,
        error: `Invalid integrationKey length (${c.integrationKey.length}, expected 32)`,
      };
    }
    return { valid: true };
  }
}
