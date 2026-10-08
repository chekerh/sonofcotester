import { Logger } from "@nestjs/common";
import type {
  NotificationChannel,
  WebhookChannelConfig,
} from "@sonofcotester/sdk";
import type { NotificationChannelAdapter } from "./channel-adapter.interface.js";

/**
 * Generic webhook adapter that POSTs alert payloads to any URL.
 *
 * Useful for custom integrations, Zapier, n8n, or internal APIs.
 * The payload is a standard JSON object that the receiving endpoint
 * can parse and act on.
 */
export class WebhookChannelAdapter implements NotificationChannelAdapter {
  readonly type = "webhook" as const;
  private readonly logger = new Logger(WebhookChannelAdapter.name);

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
    const config = channel.config as WebhookChannelConfig;

    const body = {
      source: "son-of-cotester",
      event: "health-alert",
      timestamp: new Date().toISOString(),
      severity: payload.severity,
      dimension: payload.dimension,
      projectId: payload.projectId,
      title: payload.title,
      message: payload.message,
      actionUrl: payload.actionUrl,
    };

    const method = config.method ?? "POST";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "SonOfCodeTester/1.0",
      ...config.headers,
    };

    try {
      const resp = await fetch(config.url, {
        method,
        headers,
        body: JSON.stringify(body),
      });

      const text = await resp.text();

      if (!resp.ok) {
        this.logger.error(
          `[Webhook] Send failed (${resp.status}): ${text.slice(0, 200)}`,
        );
        return { success: false, error: `HTTP ${resp.status}: ${text.slice(0, 200)}` };
      }

      this.logger.log(`[Webhook] Alert sent to ${config.url}`);
      return { success: true, response: text.slice(0, 500) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Webhook] Send error: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async validate(
    config: NotificationChannel["config"],
  ): Promise<{ valid: boolean; error?: string }> {
    const c = config as WebhookChannelConfig;
    if (!c.url) return { valid: false, error: "Missing url" };
    try {
      new URL(c.url);
    } catch {
      return { valid: false, error: "Invalid URL format" };
    }
    return { valid: true };
  }
}
