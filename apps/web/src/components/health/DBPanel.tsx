import type { DBHealthSnapshot, DBWarning } from "@sonofcotester/sdk";
import { HealthScoreRing } from "./HealthScoreRing.js";
import { ArrowRight } from "@phosphor-icons/react";

const WARNING_STYLES: Record<string, string> = {
  critical: "border-red-300 bg-red-50",
  warning: "border-amber-300 bg-amber-50",
  info: "border-blue-300 bg-blue-50",
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function DBPanel({ snapshot }: { snapshot: DBHealthSnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm text-center">
        <p className="text-slate-500">No database health snapshot available yet.</p>
      </div>
    );
  }

  const storagePct = snapshot.storageTotalBytes > 0
    ? Math.round((Number(snapshot.storageUsedBytes) / Number(snapshot.storageTotalBytes)) * 100)
    : 0;
  const connPct = snapshot.maxConnections > 0
    ? Math.round((snapshot.activeConnections / snapshot.maxConnections) * 100)
    : 0;

  const connectionStatusColors: Record<string, string> = {
    connected: "bg-emerald-100 text-emerald-700",
    degraded: "bg-amber-100 text-amber-700",
    disconnected: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      {/* Score + Connection Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-6 shadow-sm">
          <HealthScoreRing score={snapshot.score} size={160} />
          <p className="mt-3 text-sm font-medium text-slate-500">DB Health Score</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Connection Status</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${connectionStatusColors[snapshot.connectionStatus]}`}>
              {snapshot.connectionStatus}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricBox label="Active" value={`${snapshot.activeConnections}`} sub={`/ ${snapshot.maxConnections}`} />
            <MetricBox label="P50 Latency" value={`${snapshot.queryLatencyP50}`} sub="ms" />
            <MetricBox label="P95 Latency" value={`${snapshot.queryLatencyP95}`} sub="ms" />
            <MetricBox label="P99 Latency" value={`${snapshot.queryLatencyP99}`} sub="ms" />
          </div>
        </div>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <GaugeCard label="Connection Pool" value={connPct} max={100} suffix="%" status={connPct > 80 ? "critical" : connPct > 60 ? "warning" : "healthy"} />
        <GaugeCard label="Cache Hit Ratio" value={snapshot.cacheHitRatio} max={100} suffix="%" status={snapshot.cacheHitRatio < 70 ? "critical" : snapshot.cacheHitRatio < 85 ? "warning" : "healthy"} />
        <GaugeCard label="Storage Used" value={storagePct} max={100} suffix="%" status={storagePct > 80 ? "critical" : storagePct > 60 ? "warning" : "healthy"} />
      </div>

      {/* Key Metrics Grid */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">Detailed Metrics</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricBox label="Slow Queries" value={`${snapshot.slowQueries}`} sub="/ min" critical={snapshot.slowQueries > 10} />
          <MetricBox label="Deadlocks" value={`${snapshot.deadlocks}`} sub="/ hr" critical={snapshot.deadlocks > 2} />
          <MetricBox label="Storage Used" value={formatBytes(Number(snapshot.storageUsedBytes))} sub={`/ ${formatBytes(Number(snapshot.storageTotalBytes))}`} />
          <MetricBox label="Replication Lag" value={`${snapshot.replicationLagMs ?? 0}`} sub="ms" critical={(snapshot.replicationLagMs ?? 0) > 500} />
        </div>
      </div>

      {/* Warnings */}
      {snapshot.warnings.length > 0 && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-900">DB Warnings ({snapshot.warnings.length})</h3>
          <div className="space-y-3">
            {snapshot.warnings.map((warning) => (
              <WarningCard key={warning.id} warning={warning} />
            ))}
          </div>
        </div>
      )}

      {/* Raw Metrics Table */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">All Metrics</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Value</th>
                <th className="pb-3 pr-4">Unit</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Database</th>
                <th className="pb-3">Table</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.metrics.map((metric) => (
                <tr key={metric.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-3 pr-4 font-medium text-slate-900">{metric.type.replace(/-/g, " ")}</td>
                  <td className="py-3 pr-4 font-mono">{metric.value}</td>
                  <td className="py-3 pr-4 text-slate-500">{metric.unit}</td>
                  <td className="py-3 pr-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${metric.status === "healthy" ? "bg-emerald-50 text-emerald-700" : metric.status === "warning" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                      {metric.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{metric.database ?? "-"}</td>
                  <td className="py-3 text-xs text-slate-500">{metric.table ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, sub, critical }: { label: string; value: string; sub?: string; critical?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-xl font-bold ${critical ? "text-red-600" : "text-slate-900"}`}>{value}</span>
        {sub && <span className="text-xs text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

function GaugeCard({ label, value, max, suffix, status }: { label: string; value: number; max: number; suffix: string; status: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const barColor = status === "critical" ? "bg-red-500" : status === "warning" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <span className="text-lg font-bold text-slate-900">{value.toFixed(1)}{suffix}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function WarningCard({ warning }: { warning: DBWarning }) {
  return (
    <div className={`rounded-2xl border p-4 ${WARNING_STYLES[warning.severity] ?? "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">{warning.message}</p>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600"><ArrowRight size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" /><span>{warning.recommendation}</span></p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${warning.severity === "critical" ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800"}`}>
          {warning.severity}
        </span>
      </div>
    </div>
  );
}
