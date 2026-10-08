import type { PerformanceSnapshot, ServicePerformance } from "@sonofcotester/sdk";
import { HealthScoreRing } from "./HealthScoreRing.js";

const STATUS_STYLES: Record<string, string> = {
  healthy: "bg-emerald-100 text-emerald-700",
  degraded: "bg-amber-100 text-amber-700",
  down: "bg-red-100 text-red-700",
};

const STATUS_DOTS: Record<string, string> = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-red-500 animate-pulse",
};

export function PerformancePanel({ snapshot }: { snapshot: PerformanceSnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm text-center">
        <p className="text-slate-500">No performance snapshot available yet.</p>
      </div>
    );
  }

  const { overall, services } = snapshot;

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-6 shadow-sm">
          <HealthScoreRing score={overall.overall} size={160} />
          <p className="mt-3 text-sm font-medium text-slate-500">Performance Score</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-900">Score Breakdown</h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Availability", value: overall.availability },
              { label: "Responsiveness", value: overall.responsiveness },
              { label: "Efficiency", value: overall.efficiency },
              { label: "Reliability", value: overall.reliability },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-50 p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                <p className="text-xs text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Service Cards */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">Services ({services.length})</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((svc) => (
            <ServiceCard key={svc.name} service={svc} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: ServicePerformance }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOTS[service.status]}`} />
          <h4 className="font-semibold text-slate-900">{service.name}</h4>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[service.status]}`}>
          {service.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniStat label="Uptime" value={`${service.uptime.toFixed(2)}%`} />
        <MiniStat label="Error Rate" value={`${service.errorRate.toFixed(2)}%`} critical={service.errorRate > 1} />
        <MiniStat label="P50" value={`${service.responseTime.p50.toFixed(1)}ms`} />
        <MiniStat label="P95" value={`${service.responseTime.p95.toFixed(1)}ms`} />
        <MiniStat label="Throughput" value={`${service.throughput.toFixed(0)} req/s`} />
        <MiniStat label="CPU" value={`${service.cpu.toFixed(1)}%`} critical={service.cpu > 80} />
      </div>

      {/* Memory Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Memory</span>
          <span className="text-slate-700">{service.memory.used.toFixed(0)} / {service.memory.total} MB</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${service.memory.percentage > 80 ? "bg-red-500" : service.memory.percentage > 60 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(100, service.memory.percentage)}%` }}
          />
        </div>
      </div>

      {/* Event Loop & GC */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
        <span>Event Loop: {service.eventLoopLag.toFixed(2)}ms</span>
        <span>GC Pauses: {service.gcPauses}</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value, critical }: { label: string; value: string; critical?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${critical ? "text-red-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
