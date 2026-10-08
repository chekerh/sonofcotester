import { useCallback, useEffect, useState } from "react";
import { ChatCircleText, X, EnvelopeSimple, LinkSimple, PaperPlaneTilt, Siren } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

const TYPE_ICONS: Record<string, Icon> = {
  slack: ChatCircleText,
  pagerduty: Siren,
  email: EnvelopeSimple,
  webhook: LinkSimple,
};

const CHANNEL_FALLBACK = PaperPlaneTilt;

function ChannelIcon({ type, size = 14 }: { type: string; size?: number }) {
  const ChannelIconComponent = TYPE_ICONS[type] ?? CHANNEL_FALLBACK;
  return <ChannelIconComponent size={size} weight="bold" aria-hidden="true" />;
}


const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3101";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

interface NotificationChannel {
  id: string;
  name: string;
  type: "slack" | "pagerduty" | "email" | "webhook";
  enabled: boolean;
  minSeverity: "info" | "warning" | "critical";
  dimensions: string[];
  projectIds: string[];
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface NotificationStats {
  totalSent: number;
  totalFailed: number;
  byChannel: Array<{
    channelId: string;
    channelType: string;
    sent: number;
    failed: number;
  }>;
  bySeverity: Array<{ severity: string; count: number }>;
  lastSentAt?: string;
}


const TYPE_COLORS: Record<string, string> = {
  slack: "bg-purple-100 text-purple-700",
  pagerduty: "bg-green-100 text-green-700",
  email: "bg-blue-100 text-blue-700",
  webhook: "bg-orange-100 text-orange-700",
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

const ALL_DIMENSIONS = ["security", "ui-ux", "database", "performance", "testing"];

type FormMode = null | "slack" | "pagerduty" | "email" | "webhook";

export function NotificationsPanel() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    try {
      const [ch, st] = await Promise.all([
        api<NotificationChannel[]>("/health/notifications/channels"),
        api<NotificationStats>("/health/notifications/stats").catch(() => null),
      ]);
      setChannels(ch);
      setStats(st);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  async function deleteChannel(id: string) {
    if (!confirm("Delete this notification channel?")) return;
    await api(`/health/notifications/channels/${id}`, { method: "DELETE" });
    await loadChannels();
  }

  async function toggleChannel(id: string, enabled: boolean) {
    await api(`/health/notifications/channels/${id}`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
    await loadChannels();
  }

  async function testChannel(id: string) {
    setTesting(id);
    try {
      await api(`/health/notifications/channels/${id}/test`, { method: "POST", body: JSON.stringify({}) });
      alert("Test notification sent!");
    } catch {
      alert("Failed to send test notification.");
    } finally {
      setTesting(null);
    }
  }

  if (loading) {
    return <div className="rounded-3xl bg-white p-12 text-center text-sm text-slate-500 shadow-sm">Loading channels…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatBox label="Total Sent" value={stats.totalSent} color="text-emerald-600" />
          <StatBox label="Total Failed" value={stats.totalFailed} color="text-red-600" />
          <StatBox label="Channels" value={channels.length} color="text-slate-700" />
          <StatBox
            label="Last Sent"
            value={stats.lastSentAt ? new Date(stats.lastSentAt).toLocaleTimeString() : "-"}
            color="text-slate-500"
            isText
          />
        </div>
      )}

      {/* Channel list */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Notification Channels</h3>
          <div className="flex gap-2">
            {(["slack", "pagerduty", "email", "webhook"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFormMode(type)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                + {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {channels.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
            <p className="text-sm text-slate-500">No notification channels configured.</p>
            <p className="mt-1 text-xs text-slate-500">Add a Slack, PagerDuty, Email, or Webhook channel above to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {channels.map((ch) => (
              <div
                key={ch.id}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${
                  ch.enabled ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl"><ChannelIcon type={ch.type} size={20} /></span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{ch.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[ch.type]}`}>
                        {ch.type.toUpperCase()}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_COLORS[ch.minSeverity]}`}>
                        {ch.minSeverity}+
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {ch.dimensions.length > 0 ? ch.dimensions.join(", ") : "All dimensions"}
                      {ch.projectIds.length > 0 && ` • ${ch.projectIds.length} project(s)`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void testChannel(ch.id)}
                    disabled={testing === ch.id}
                    className="rounded-full px-3 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    {testing === ch.id ? "Sending…" : "Test"}
                  </button>
                  <button
                    onClick={() => void toggleChannel(ch.id, !ch.enabled)}
                    className={`relative h-5 w-9 rounded-full transition ${ch.enabled ? "bg-emerald-500" : "bg-slate-300"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                        ch.enabled ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => void deleteChannel(ch.id)}
                    aria-label="Delete channel"
                    className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-red-500"
                  >
                    <X size={13} weight="bold" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create form */}
      {formMode && <CreateChannelForm type={formMode} onClose={() => setFormMode(null)} onCreated={loadChannels} />}
    </div>
  );
}

function StatBox({ label, value, color, isText }: { label: string; value: number | string; color: string; isText?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color} ${isText ? "!text-base" : ""}`}>{value}</p>
    </div>
  );
}

// ── Create Channel Form ──

function CreateChannelForm({
  type,
  onClose,
  onCreated,
}: {
  type: "slack" | "pagerduty" | "email" | "webhook";
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [minSeverity, setMinSeverity] = useState<"info" | "warning" | "critical">("critical");
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Channel-specific fields
  const [slackUrl, setSlackUrl] = useState("");
  const [slackChannel, setSlackChannel] = useState("");
  const [pdKey, setPdKey] = useState("");
  const [emailRecipients, setEmailRecipients] = useState("");
  const [emailHost, setEmailHost] = useState("");
  const [emailPort, setEmailPort] = useState("587");
  const [emailUser, setEmailUser] = useState("");
  const [emailPass, setEmailPass] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookHeaders, setWebhookHeaders] = useState("");

  function toggleDimension(dim: string) {
    setDimensions((prev) => (prev.includes(dim) ? prev.filter((d) => d !== dim) : [...prev, dim]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    let config: Record<string, unknown>;
    switch (type) {
      case "slack":
        config = { webhookUrl: slackUrl, channel: slackChannel || undefined };
        break;
      case "pagerduty":
        config = { integrationKey: pdKey };
        break;
      case "email":
        config = {
          recipients: emailRecipients,
          smtpHost: emailHost,
          smtpPort: parseInt(emailPort, 10),
          smtpUser: emailUser || undefined,
          smtpPassword: emailPass || undefined,
          useTls: parseInt(emailPort, 10) === 465,
          fromAddress: emailFrom,
        };
        break;
      case "webhook":
        config = {
          url: webhookUrl,
          headers: webhookHeaders ? JSON.parse(webhookHeaders) : undefined,
        };
        break;
    }

    try {
      await api("/health/notifications/channels", {
        method: "POST",
        body: JSON.stringify({
          name: name || `${type} channel`,
          type,
          minSeverity,
          dimensions,
          config,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      alert(`Failed to create channel: ${err}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">
            Add {type.charAt(0).toUpperCase() + type.slice(1)} Channel
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-600">
            <X size={15} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <Field label="Channel Name" value={name} onChange={setName} placeholder="e.g. #ops-alerts" />

          {/* Min Severity */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Minimum Severity</label>
            <div className="flex gap-2">
              {(["info", "warning", "critical"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMinSeverity(s)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    minSeverity === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Dimensions (leave empty for all)</label>
            <div className="flex flex-wrap gap-2">
              {ALL_DIMENSIONS.map((dim) => (
                <button
                  key={dim}
                  type="button"
                  onClick={() => toggleDimension(dim)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    dimensions.includes(dim) ? "bg-ocean text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {dim}
                </button>
              ))}
            </div>
          </div>

          {/* Channel-specific fields */}
          {type === "slack" && (
            <>
              <Field label="Webhook URL" value={slackUrl} onChange={setSlackUrl} placeholder="https://hooks.slack.com/services/..." required />
              <Field label="Channel (optional)" value={slackChannel} onChange={setSlackChannel} placeholder="#alerts" />
            </>
          )}

          {type === "pagerduty" && (
            <Field label="Integration Key" value={pdKey} onChange={setPdKey} placeholder="32-character integration key" required />
          )}

          {type === "email" && (
            <>
              <Field label="Recipients" value={emailRecipients} onChange={setEmailRecipients} placeholder="ops@example.com, oncall@example.com" required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="SMTP Host" value={emailHost} onChange={setEmailHost} placeholder="smtp.gmail.com" required />
                <Field label="Port" value={emailPort} onChange={setEmailPort} placeholder="587" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SMTP User (optional)" value={emailUser} onChange={setEmailUser} placeholder="user@gmail.com" />
                <Field label="Password (optional)" value={emailPass} onChange={setEmailPass} placeholder="••••••" type="password" />
              </div>
              <Field label="From Address" value={emailFrom} onChange={setEmailFrom} placeholder="alerts@example.com" required />
            </>
          )}

          {type === "webhook" && (
            <>
              <Field label="URL" value={webhookUrl} onChange={setWebhookUrl} placeholder="https://your-api.com/webhook" required />
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Custom Headers (JSON, optional)</label>
                <textarea
                  value={webhookHeaders}
                  onChange={(e) => setWebhookHeaders(e.target.value)}
                  placeholder='{"Authorization": "Bearer ..."}'
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-ocean"
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-ocean px-5 py-2 text-sm font-semibold text-white transition hover:bg-ocean/90 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Channel"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-ocean"
      />
    </div>
  );
}
