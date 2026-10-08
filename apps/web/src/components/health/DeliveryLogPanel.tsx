import { useCallback, useEffect, useState } from "react";
import { Check, ChatCircleText, EnvelopeSimple, LinkSimple, PaperPlaneTilt, Siren, X } from "@phosphor-icons/react";
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

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${apiUrl}/api${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

interface DeliveryLogEntry {
  id: string;
  alertId: string;
  channelId: string;
  channelType: string;
  severity: string;
  success: boolean;
  sentAt: string;
  error?: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};


export function DeliveryLogPanel() {
  const [log, setLog] = useState<DeliveryLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");

  const loadLog = useCallback(async () => {
    try {
      const data = await api<DeliveryLogEntry[]>("/health/notifications/delivery-log?limit=100");
      setLog(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

  const filtered = log.filter((entry) => {
    if (filter === "success") return entry.success;
    if (filter === "failed") return !entry.success;
    return true;
  });

  const successCount = log.filter((e) => e.success).length;
  const failedCount = log.filter((e) => !e.success).length;

  if (loading) {
    return <div className="rounded-3xl bg-white p-12 text-center text-sm text-slate-500 shadow-sm">Loading delivery log…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Deliveries</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{log.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Successful</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{successCount}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Failed</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{failedCount}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "success", "failed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "success" && successCount > 0 && ` (${successCount})`}
            {f === "failed" && failedCount > 0 && ` (${failedCount})`}
          </button>
        ))}
      </div>

      {/* Log table */}
      <div className="rounded-3xl bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">No delivery log entries {filter !== "all" ? `(${filter})` : ""}.</div>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                          entry.success ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                        }`}
                      >
                        {entry.success ? (
                            <Check size={13} weight="bold" aria-hidden="true" />
                          ) : (
                            <X size={13} weight="bold" aria-hidden="true" />
                          )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">
                        <ChannelIcon type={entry.channelType} /> {entry.channelType}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">{entry.channelId.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_BADGE[entry.severity] ?? "bg-slate-100 text-slate-500"}`}>
                        {entry.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(entry.sentAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-red-500 max-w-[200px] truncate">
                      {entry.error ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
