import { useEffect, useState } from "react";
import { Check, Lightning, Pause, Play, Stop, Warning } from "@phosphor-icons/react";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3101";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

interface SchedulerState {
  status: "stopped" | "running" | "paused";
  config: {
    intervalMs: number;
    projectIds: string[];
    targetUrl: string;
    dimensions: string[];
    maxConsecutiveFailures: number;
  };
  lastRunAt?: string;
  nextRunAt?: string;
  totalRuns: number;
  consecutiveFailures: number;
  runHistory: Array<{
    id: string;
    projectId: string;
    startedAt: string;
    finishedAt: string;
    duration: number;
    overallScore: number;
    status: "completed" | "failed";
    error?: string;
    alertCount: number;
  }>;
  startedAt?: string;
  uptimeSeconds: number;
}

const STATUS_STYLES: Record<string, string> = {
  running: "bg-emerald-100 text-emerald-700",
  stopped: "bg-slate-100 text-slate-600",
  paused: "bg-amber-100 text-amber-700",
};

const STATUS_DOTS: Record<string, string> = {
  running: "bg-emerald-500 animate-pulse",
  stopped: "bg-slate-400",
  paused: "bg-amber-500",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function SchedulerPanel() {
  const [state, setState] = useState<SchedulerState | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingInterval, setEditingInterval] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState("5");

  useEffect(() => {
    void loadState();
    const poll = setInterval(loadState, 5000);
    return () => clearInterval(poll);
  }, []);

  async function loadState() {
    try {
      const s = await api<SchedulerState>("/health/scheduler/status");
      setState(s);
      if (!editingInterval) {
        setIntervalMinutes(String(Math.round(s.config.intervalMs / 60_000)));
      }
    } catch {
      // scheduler endpoint may not be ready
    }
  }

  async function start() {
    setLoading(true);
    try { await api("/health/scheduler/start", { method: "POST" }); } finally {
      setLoading(false);
      await loadState();
    }
  }

  async function stop() {
    setLoading(true);
    try { await api("/health/scheduler/stop", { method: "POST" }); } finally {
      setLoading(false);
      await loadState();
    }
  }

  async function pause() {
    setLoading(true);
    try { await api("/health/scheduler/pause", { method: "POST" }); } finally {
      setLoading(false);
      await loadState();
    }
  }

  async function resume() {
    setLoading(true);
    try { await api("/health/scheduler/resume", { method: "POST" }); } finally {
      setLoading(false);
      await loadState();
    }
  }

  async function triggerImmediate() {
    setLoading(true);
    try {
      await api("/health/scheduler/trigger", { method: "POST" });
    } finally {
      setLoading(false);
      await loadState();
    }
  }

  async function saveInterval() {
    const ms = Math.max(10_000, Number(intervalMinutes) * 60_000);
    setLoading(true);
    try {
      await api("/health/scheduler/config", {
        method: "POST",
        body: JSON.stringify({ intervalMs: ms }),
      });
      setEditingInterval(false);
    } finally {
      setLoading(false);
      await loadState();
    }
  }

  if (!state) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm text-center">
        <p className="text-slate-500">Loading scheduler...</p>
      </div>
    );
  }

  const scoreColor = (score: number) =>
    score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-6">
      {/* Status & Controls */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${STATUS_DOTS[state.status]}`} />
            <h3 className="text-lg font-semibold text-slate-900">Scheduled Scans</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${STATUS_STYLES[state.status]}`}>
              {state.status}
            </span>
          </div>
          <div className="flex gap-2">
            {state.status === "stopped" ? (
              <button onClick={start} disabled={loading} className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                ▶ Start
              </button>
            ) : (
              <>
                {state.status === "running" ? (
                  <button onClick={pause} disabled={loading} className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50">
                    <Pause size={12} weight="fill" aria-hidden="true" /> Pause
                  </button>
                ) : (
                  <button onClick={resume} disabled={loading} className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                    <Play size={12} weight="fill" aria-hidden="true" /> Resume
                  </button>
                )}
                <button onClick={stop} disabled={loading} className="rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-50">
                  <Stop size={12} weight="fill" aria-hidden="true" /> Stop
                </button>
              </>
            )}
            <button onClick={triggerImmediate} disabled={loading} className="rounded-full bg-ocean px-4 py-2 text-xs font-semibold text-white transition hover:bg-ocean/90 disabled:opacity-50">
              <Lightning size={13} weight="fill" aria-hidden="true" /> Scan Now
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatBox label="Interval" value={
            editingInterval ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(e.target.value)}
                  className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  min={1}
                />
                <span className="text-xs text-slate-500">min</span>
                <button onClick={saveInterval} aria-label="Save interval" className="rounded bg-ocean px-1.5 py-0.5 text-[10px] text-white"><Check size={11} weight="bold" aria-hidden="true" /></button>
              </div>
            ) : (
              <span className="cursor-pointer hover:underline" onClick={() => setEditingInterval(true)}>
                {formatDuration(state.config.intervalMs)}
              </span>
            )
          } />
          <StatBox label="Total Runs" value={String(state.totalRuns)} />
          <StatBox label="Uptime" value={state.status === "running" ? formatUptime(state.uptimeSeconds) : "-"} />
          <StatBox label="Last Run" value={state.lastRunAt ? new Date(state.lastRunAt).toLocaleTimeString() : "Never"} />
          <StatBox label="Next Run" value={state.nextRunAt && state.status === "running" ? new Date(state.nextRunAt).toLocaleTimeString() : "-"} />
        </div>

        {state.consecutiveFailures > 0 && (
          <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            <Warning size={14} weight="fill" className="mr-1 inline align-[-2px]" aria-hidden="true" />{state.consecutiveFailures} consecutive failure{state.consecutiveFailures !== 1 ? "s" : ""}
            {state.status === "paused" && " - scheduler auto-paused"}
          </div>
        )}

        {/* Config Summary */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
          <div>
            <span className="text-xs text-slate-500">Projects</span>
            <p className="font-medium text-slate-800">{state.config.projectIds.join(", ") || "All"}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Target URL</span>
            <p className="font-mono text-xs text-slate-800">{state.config.targetUrl}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Dimensions</span>
            <p className="font-medium text-slate-800">{state.config.dimensions.join(", ")}</p>
          </div>
        </div>
      </div>

      {/* Run History */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">Run History (last {state.runHistory.length})</h3>
        {state.runHistory.length === 0 ? (
          <p className="text-sm text-slate-500">No scheduled runs yet. Start the scheduler to begin.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-4">Time</th>
                  <th className="pb-3 pr-4">Project</th>
                  <th className="pb-3 pr-4">Score</th>
                  <th className="pb-3 pr-4">Duration</th>
                  <th className="pb-3 pr-4">Alerts</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...state.runHistory].reverse().map((run) => (
                  <tr key={run.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-3 pr-4 text-xs text-slate-600">
                      {new Date(run.startedAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">{run.projectId}</td>
                    <td className="py-3 pr-4">
                      <span className={`font-bold ${scoreColor(run.overallScore)}`}>
                        {run.overallScore}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-600">{formatDuration(run.duration)}</td>
                    <td className="py-3 pr-4">
                      {run.alertCount > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          {run.alertCount}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        run.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}>
                        {run.status}
                      </span>
                      {run.error && (
                        <p className="mt-1 max-w-xs truncate text-[10px] text-red-500">{run.error}</p>
                      )}
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

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-[10px] text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
