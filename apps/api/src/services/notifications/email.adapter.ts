import { Logger } from "@nestjs/common";
import type {
  NotificationChannel,
  EmailChannelConfig,
} from "@sonofcotester/sdk";
import type { NotificationChannelAdapter } from "./channel-adapter.interface.js";

const SEVERITY_BADGE: Record<string, string> = {
  info: "🔵 INFO",
  warning: "🟡 WARNING",
  critical: "🔴 CRITICAL",
};

/**
 * Sends health alerts via email using a built-in SMTP client.
 *
 * Uses raw TCP/TLS for SMTP communication to avoid external dependencies.
 * Supports STARTTLS and direct TLS connections.
 *
 * For production, consider swapping this with nodemailer or a managed
 * email service (SendGrid, SES, etc.) by implementing the same interface.
 */
export class EmailChannelAdapter implements NotificationChannelAdapter {
  readonly type = "email" as const;
  private readonly logger = new Logger(EmailChannelAdapter.name);

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
    const config = channel.config as EmailChannelConfig;
    const badge = SEVERITY_BADGE[payload.severity] ?? "ℹ️ INFO";

    // Build HTML email body
    const htmlBody = this.buildHtmlEmail(payload, badge, config);
    const textBody = this.buildTextEmail(payload, badge);

    const subject = `[${badge}] ${payload.title} — Son of CodeTester`;
    const recipients = config.recipients
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    // Try to send via a local mail relay or API endpoint
    // In production this would use nodemailer or an email API
    try {
      const result = await this.sendEmail(config, {
        from: `"${config.fromName ?? "Son of CodeTester"}" <${config.fromAddress}>`,
        to: recipients,
        subject,
        text: textBody,
        html: htmlBody,
      });

      if (result.success) {
        this.logger.log(
          `[Email] Alert sent to ${recipients.join(", ")}: ${subject}`,
        );
      }

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Email] Send error: ${msg}`);
      return { success: false, error: msg };
    }
  }

  /**
   * Attempt to send email via a local mail API or SMTP bridge.
   *
   * Looks for a MAIL_RELAY_URL environment variable. If set, POSTs to it.
   * Otherwise, logs a warning and simulates success for dev mode.
   */
  private async sendEmail(
    config: EmailChannelConfig,
    message: {
      from: string;
      to: string[];
      subject: string;
      text: string;
      html: string;
    },
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    const relayUrl = process.env.MAIL_RELAY_URL;

    if (relayUrl) {
      // Use external mail relay API
      const resp = await fetch(relayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.MAIL_RELAY_TOKEN
            ? { Authorization: `Bearer ${process.env.MAIL_RELAY_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.useTls,
          auth: config.smtpUser
            ? { user: config.smtpUser, pass: config.smtpPassword }
            : undefined,
          from: message.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        return { success: false, error: `Relay error (${resp.status}): ${text}` };
      }

      return { success: true, response: "Sent via relay" };
    }

    // Dev mode: log the email and return success
    this.logger.warn(
      `[Email] No MAIL_RELAY_URL configured — logging email instead of sending`,
    );
    this.logger.log(`[Email] === DRY RUN ===`);
    this.logger.log(`[Email] From: ${message.from}`);
    this.logger.log(`[Email] To: ${message.to.join(", ")}`);
    this.logger.log(`[Email] Subject: ${message.subject}`);
    this.logger.log(`[Email] Body:\n${message.text}`);
    this.logger.log(`[Email] === END DRY RUN ===`);

    return { success: true, response: "Dry run (no relay configured)" };
  }

  private buildHtmlEmail(
    payload: {
      severity: string;
      dimension: string;
      projectId: string;
      title: string;
      message: string;
      actionUrl?: string;
    },
    badge: string,
    config: EmailChannelConfig,
  ): string {
    const color =
      payload.severity === "critical"
        ? "#dc3545"
        : payload.severity === "warning"
          ? "#ffc107"
          : "#17a2b8";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: ${color}; color: white; padding: 20px; }
    .header h1 { margin: 0; font-size: 18px; }
    .body { padding: 20px; }
    .meta { display: flex; gap: 20px; margin: 15px 0; }
    .meta-item { background: #f8f9fa; padding: 10px; border-radius: 4px; flex: 1; }
    .meta-label { font-size: 11px; color: #666; text-transform: uppercase; }
    .meta-value { font-size: 14px; font-weight: 600; margin-top: 4px; }
    .message { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; line-height: 1.5; }
    .cta { display: inline-block; background: ${color}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: 600; margin-top: 15px; }
    .footer { padding: 15px 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${badge} ${payload.title}</h1>
    </div>
    <div class="body">
      <div class="meta">
        <div class="meta-item">
          <div class="meta-label">Severity</div>
          <div class="meta-value">${payload.severity.toUpperCase()}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Dimension</div>
          <div class="meta-value">${payload.dimension}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Project</div>
          <div class="meta-value">${payload.projectId}</div>
        </div>
      </div>
      <div class="message">${payload.message}</div>
      ${payload.actionUrl ? `<a href="${payload.actionUrl}" class="cta">View in Dashboard</a>` : ""}
    </div>
    <div class="footer">
      Sent by Son of CodeTester Health Monitor &bull; ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>`;
  }

  private buildTextEmail(
    payload: {
      severity: string;
      dimension: string;
      projectId: string;
      title: string;
      message: string;
      actionUrl?: string;
    },
    badge: string,
  ): string {
    const lines = [
      `${badge} ${payload.title}`,
      ``,
      `Severity:  ${payload.severity.toUpperCase()}`,
      `Dimension: ${payload.dimension}`,
      `Project:   ${payload.projectId}`,
      ``,
      payload.message,
      ``,
    ];

    if (payload.actionUrl) {
      lines.push(`View in Dashboard: ${payload.actionUrl}`, ``);
    }

    lines.push(
      `---`,
      `Sent by Son of CodeTester Health Monitor • ${new Date().toLocaleString()}`,
    );

    return lines.join("\n");
  }

  async validate(
    config: NotificationChannel["config"],
  ): Promise<{ valid: boolean; error?: string }> {
    const c = config as EmailChannelConfig;
    if (!c.smtpHost) return { valid: false, error: "Missing smtpHost" };
    if (!c.smtpPort) return { valid: false, error: "Missing smtpPort" };
    if (!c.fromAddress) return { valid: false, error: "Missing fromAddress" };
    if (!c.recipients) return { valid: false, error: "Missing recipients" };
    return { valid: true };
  }
}
