import { Logger } from "@nestjs/common";
import type {
  NotificationChannel,
  SlackChannelConfig,
} from "@sonofcotester/sdk";
import type { NotificationChannelAdapter } from "./channel-adapter.interface.js";

const SEVERITY_COLORS: Record<string, string> = {
  info: "#36a64f",
  warning: "#d99e1b",
  critical: "#cc0000",
};

const SEVERITY_EMOJI: Record<string, string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🚨",
};

/**
 * Sends health alerts to Slack via Incoming Webhooks.
 *
 * Uses the Slack Block Kit format for rich message rendering.
 * Falls back to simple attachment format if blocks fail.
 */
export class SlackChannelAdapter implements NotificationChannelAdapter {
  readonly type = "slack" as const;
  private readonly logger = new Logger(SlackChannelAdapter.name);

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
    const config = channel.config as SlackChannelConfig;

    const emoji = SEVERITY_EMOJI[payload.severity] ?? "ℹ️";
    const color = SEVERITY_COLORS[payload.severity] ?? "#999999";

    // Build Slack Block Kit message
    const blocks: unknown[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} ${payload.title}`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Severity:*\n${payload.severity.toUpperCase()}`,
          },
          {
            type: "mrkdwn",
            text: `*Dimension:*\n${payload.dimension}`,
          },
          {
            type: "mrkdwn",
            text: `*Project:*\n\`${payload.projectId}\``,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: payload.message,
        },
      },
    ];

    if (payload.actionUrl) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View in Dashboard",
              emoji: true,
            },
            url: payload.actionUrl,
            style: payload.severity === "critical" ? "danger" : "primary",
          },
        ],
      });
    }

    blocks.push({ type: "divider" });

    const body: Record<string, unknown> = {
      username: config.username ?? "Son of CodeTester",
      icon_emoji: config.iconEmoji ?? ":shield:",
      blocks,
      attachments: [
        {
          color,
          footer: "Son of CodeTester Health Monitor",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    if (config.channel) {
      body.channel = config.channel;
    }

    try {
      const resp = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const text = await resp.text();

      if (!resp.ok) {
        this.logger.error(`[Slack] Send failed (${resp.status}): ${text}`);
        return { success: false, error: `HTTP ${resp.status}: ${text}` };
      }

      this.logger.log(`[Slack] Alert sent to ${config.channel ?? "default channel"}`);
      return { success: true, response: text };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Slack] Send error: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async validate(
    config: NotificationChannel["config"],
  ): Promise<{ valid: boolean; error?: string }> {
    const c = config as SlackChannelConfig;
    if (!c.webhookUrl) {
      return { valid: false, error: "Missing webhookUrl" };
    }
    if (!c.webhookUrl.startsWith("https://hooks.slack.com/")) {
      return { valid: false, error: "Invalid Slack webhook URL format" };
    }
    return { valid: true };
  }
}
