import { useState } from "react";
import type { HealthAlert } from "@sonofcotester/sdk";
import { ChartBar, Confetti, Flask, Lightning, Palette, ShieldCheck, Stack } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

const DIMENSION_ICONS: Record<string, Icon> = {
  security: ShieldCheck,
  "ui-ux": Palette,
  database: Stack,
  performance: Lightning,
  testing: Flask,
};

const DIMENSION_FALLBACK = ChartBar;

function DimensionIcon({ name, size = 22 }: { name: string; size?: number }) {
  const DimIcon = DIMENSION_ICONS[name] ?? DIMENSION_FALLBACK;
  return <DimIcon size={size} weight="bold" aria-hidden="true" />;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-50/60",
  high: "bg-orange-50/60",
  medium: "bg-amber-50/60",
  low: "bg-blue-50/60",
  info: "bg-slate-50/60",
};


export function AlertsPanel({
  alerts,
  onAcknowledge,
  onResolve,
}: {
  alerts: HealthAlert[];
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "unresolved" | "critical">("unresolved");

  const filtered = alerts.filter((a) => {
    if (filter === "unresolved") return !a.resolvedAt;
    if (filter === "critical") return !a.resolvedAt && a.severity === "critical";
    return true;
  });

  const unresolvedCount = alerts.filter((a) => !a.resolvedAt).length;
  const criticalCount = alerts.filter((a) => !a.resolvedAt && a.severity === "critical").length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-slate-900">{alerts.length}</p>
          <p className="text-xs text-slate-500">Total Alerts</p>
        </div>
        <div className="rounded-2xl bg-amber-50 p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-amber-700">{unresolvedCount}</p>
          <p className="text-xs text-slate-500">Unresolved</p>
        </div>
        <div className="rounded-2xl bg-red-50 p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
          <p className="text-xs text-slate-500">Critical</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(["unresolved", "critical", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === f ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <Confetti size={40} weight="fill" className="mx-auto mb-3 text-emerald-500" aria-hidden="true" />
            <p className="text-slate-500">No alerts matching this filter.</p>
          </div>
        ) : (
          filtered.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-2xl bg-white p-5 shadow-sm ${SEVERITY_STYLES[alert.severity]} ${
                alert.resolvedAt ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <DimensionIcon name={alert.dimension} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{alert.title}</h4>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        alert.severity === "critical"
                          ? "bg-red-100 text-red-700"
                          : alert.severity === "high"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-amber-100 text-amber-700"
                      }`}>
                        {alert.severity}
                      </span>
                      {alert.resolvedAt && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {alert.dimension} · {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {!alert.resolvedAt && (
                  <div className="flex gap-2 shrink-0">
                    {!alert.acknowledged && (
                      <button
                        onClick={() => onAcknowledge(alert.id)}
                        className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => onResolve(alert.id)}
                      className="rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-200"
                    >
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
