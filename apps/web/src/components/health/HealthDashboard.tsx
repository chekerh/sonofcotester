import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import type {
  HealthAlert,
  HealthDimensionScore,
  HealthOverview,
  HealthTrendPoint,
  SecurityScan,
  UIHealthSession,
  DBHealthSnapshot,
  PerformanceSnapshot,
} from "@sonofcotester/sdk";
import { HealthScoreRing } from "./HealthScoreRing.js";
import { DimensionCard } from "./DimensionCard.js";
import { AlertsPanel } from "./AlertsPanel.js";
import { TrendChart } from "./TrendChart.js";
import { SecurityPanel } from "./SecurityPanel.js";
import { UIPanel } from "./UIPanel.js";
import { DBPanel } from "./DBPanel.js";
import { PerformancePanel } from "./PerformancePanel.js";
import { SchedulerPanel } from "./SchedulerPanel.js";
import { NotificationsPanel } from "./NotificationsPanel.js";
import { DeliveryLogPanel } from "./DeliveryLogPanel.js";
import { EscalationPanel } from "./EscalationPanel.js";
import { NotificationSettings } from "./NotificationSettings.js";
import { notificationManager } from "../../lib/notification-manager.js";
import { PRHealthPanel } from "./PRHealthPanel.js";
import { MaestroPanel } from "./MaestroPanel.js";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3101";
const healthSocket = io(`${apiUrl}/health`, { autoConnect: false, transports: ["websocket"] });

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}/api${path}`, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

type ActiveTab = "overview" | "security" | "ui" | "database" | "performance" | "alerts" | "scheduler" | "notifications" | "escalation" | "pr-health" | "maestro";

const TABS: { id: ActiveTab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "◎" },
  { id: "security", label: "Security", icon: "shield" },
  { id: "ui", label: "UI/UX", icon: "layout" },
  { id: "database", label: "Database", icon: "database" },
  { id: "performance", label: "Performance", icon: "activity" },
  { id: "alerts", label: "Alerts", icon: "bell" },
  { id: "scheduler", label: "Scheduler", icon: "clock" },
  { id: "notifications", label: "Notifications", icon: "bell-ring" },
  { id: "escalation", label: "Escalation", icon: "alert-triangle" },
  { id: "pr-health", label: "PR Health", icon: "git-pull-request" },
  { id: "maestro", label: "Maestro", icon: "smartphone" },
];

export function HealthDashboard({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [targetUrl, setTargetUrl] = useState("http://localhost:3010");
  const [overview, setOverview] = useState<HealthOverview | null>(null);
  const [securityScan, setSecurityScan] = useState<SecurityScan | null>(null);
  const [uiSession, setUISession] = useState<UIHealthSession | null>(null);
  const [dbSnapshot, setDBSnapshot] = useState<DBHealthSnapshot | null>(null);
  const [perfSnapshot, setPerfSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [trend, setTrend] = useState<HealthTrendPoint[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [liveEvents, setLiveEvents] = useState<Array<{ summary: string; time: string }>>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    healthSocket.connect();
    healthSocket.emit("watch:project", { projectId });

    healthSocket.on("health:event", (event: { summary: string; timestamp: string; type?: string; dimension?: string }) => {
      setLiveEvents((prev) => [{ summary: event.summary, time: event.timestamp }, ...prev].slice(0, 20));

      // Trigger browser notification and audio alert for the event
      notificationManager.processHealthEvent({
        type: event.type ?? "health-score-changed",
        summary: event.summary,
        dimension: event.dimension,
      });
    });

    return () => {
      healthSocket.emit("unwatch:project", { projectId });
      healthSocket.disconnect();
    };
  }, [projectId]);

  useEffect(() => {
    void loadAll();
  }, [projectId]);

  async function loadAll() {
    try {
      const [ov, sec, ui, db, perf, trendData, alertsData] = await Promise.all([
        api<HealthOverview>(`/health/overview/${projectId}`),
        api<SecurityScan>(`/health/security/${projectId}`).catch(() => null),
        api<UIHealthSession>(`/health/ui/${projectId}`).catch(() => null),
        api<DBHealthSnapshot>(`/health/db/${projectId}`).catch(() => null),
        api<PerformanceSnapshot>(`/health/performance/${projectId}`).catch(() => null),
        api<HealthTrendPoint[]>(`/health/trend/${projectId}`).catch(() => []),
        api<HealthAlert[]>(`/health/alerts/${projectId}`).catch(() => []),
      ]);
      setOverview(ov);
      setSecurityScan(sec);
      setUISession(ui);
      setDBSnapshot(db);
      setPerfSnapshot(perf);
      setTrend(trendData);
      setAlerts(alertsData);
    } catch {
      // initial state - no scans yet
    }
  }

  async function runFullScan() {
    setScanning(true);
    try {
      const ov = await api<HealthOverview>(`/health/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, targetUrl }),
      });
      setOverview(ov);
      await loadAll();
    } catch (err) {
      console.error("Scan failed:", err);
    } finally {
      setScanning(false);
    }
  }

  const unresolvedAlerts = useMemo(() => alerts.filter((a) => !a.resolvedAt), [alerts]);
  const criticalCount = unresolvedAlerts.filter((a) => a.severity === "critical").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Production Health</h2>
          <p className="text-sm text-slate-500">Real-time monitoring across all dimensions</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {criticalCount > 0 && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
              {criticalCount} critical
            </span>
          )}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
            <span className="text-xs text-slate-400 mr-2">Target URL:</span>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="http://localhost:3010"
              className="w-56 text-xs text-slate-800 bg-transparent font-mono"
            />
          </div>
          <button
            onClick={runFullScan}
            disabled={scanning}
            className="rounded-full bg-ocean px-5 py-2 text-sm font-semibold text-white transition hover:bg-ocean/90 disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            {scanning && (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {scanning ? "Scanning..." : "Run Full Scan"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            {tab.id === "alerts" && unresolvedAlerts.length > 0 && (
              <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
                {unresolvedAlerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && overview && (
        <div className="space-y-6">
          {/* Score Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {overview.dimensions.map((dim) => (
              <DimensionCard key={dim.dimension} dimension={dim} />
            ))}
          </div>

          {/* Main Score + Trend */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-8 shadow-sm">
              <HealthScoreRing score={overview.overallScore} size={200} />
              <p className="mt-4 text-sm font-medium text-slate-500">Overall Health Score</p>
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-900">Health Trend</h3>
              <TrendChart data={trend.length > 0 ? trend : [{ timestamp: new Date().toISOString(), overallScore: overview.overallScore, securityScore: overview.dimensions[0]?.score ?? 0, uiScore: overview.dimensions[1]?.score ?? 0, dbScore: overview.dimensions[2]?.score ?? 0, performanceScore: overview.dimensions[3]?.score ?? 0 }]} />
            </div>
          </div>

          {/* Live Events Feed */}
          <div className="rounded-3xl bg-ink p-6 text-white shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="font-semibold">Live Health Events</h3>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {liveEvents.length === 0 ? (
                <p className="text-sm text-slate-400">Waiting for events... Run a scan to start monitoring.</p>
              ) : (
                liveEvents.map((event, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl bg-white/5 px-4 py-2.5 text-sm">
                    <span className="shrink-0 font-mono text-xs text-slate-500">
                      {new Date(event.time).toLocaleTimeString()}
                    </span>
                    <span className="text-slate-300">{event.summary}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <SecurityPanel scan={securityScan} onRescan={() => api<SecurityScan>(`/health/security/scan`, ).then(setSecurityScan)} />
      )}

      {activeTab === "ui" && (
        <UIPanel session={uiSession} />
      )}

      {activeTab === "database" && (
        <DBPanel snapshot={dbSnapshot} />
      )}

      {activeTab === "performance" && (
        <PerformancePanel snapshot={perfSnapshot} />
      )}

      {activeTab === "alerts" && (
        <AlertsPanel
          alerts={alerts}
          onAcknowledge={(id) => void api(`/health/alerts/${projectId}/${id}/acknowledge`).then(loadAll)}
          onResolve={(id) => void api(`/health/alerts/${projectId}/${id}/resolve`).then(loadAll)}
        />
      )}

      {activeTab === "scheduler" && (
        <SchedulerPanel />
      )}

      {activeTab === "notifications" && (
        <div className="space-y-6">
          <NotificationSettings />
          <NotificationsPanel />
          <DeliveryLogPanel />
        </div>
      )}

      {activeTab === "escalation" && (
        <EscalationPanel />
      )}

      {activeTab === "pr-health" && (
        <PRHealthPanel projectId={projectId} />
      )}

      {activeTab === "maestro" && (
        <MaestroPanel />
      )}
    </div>
  );
}
