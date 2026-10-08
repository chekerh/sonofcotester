import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ChartBar, Check, Flask, Info, Lightning, Minus, Palette, ShieldCheck, Stack, Timer, Warning, X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3101";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

interface PRDimensionResult {
  dimension: string;
  score: number;
  status: "pass" | "warn" | "fail";
  issueCount: number;
  criticalCount: number;
  summary: string;
}

interface PRAnnotation {
  path?: string;
  startLine?: number;
  endLine?: number;
  annotationLevel: "notice" | "warning" | "failure";
  message: string;
  title: string;
}

interface PRHealthSummary {
  id: string;
  repository: string;
  pullRequestNumber: number;
  headSha: string;
  branch: string;
  baseBranch: string;
  projectId: string;
  status: string;
  overallScore: number;
  dimensions: PRDimensionResult[];
  verdict: string;
  summary: string;
  annotations: PRAnnotation[];
  startedAt: string;
  finishedAt?: string;
  duration?: number;
  checkRunId?: number;
  checkRunUrl?: string;
}

const VERDICT_CONFIG: Record<string, { icon: Icon; color: string; bg: string; label: string }> = {
  success: { icon: Check, color: "text-emerald-600", bg: "bg-emerald-100", label: "Passed" },
  failure: { icon: X, color: "text-red-600", bg: "bg-red-100", label: "Failed" },
  neutral: { icon: Warning, color: "text-amber-600", bg: "bg-amber-100", label: "Warning" },
  cancelled: { icon: Minus, color: "text-slate-500", bg: "bg-slate-100", label: "Cancelled" },
  timed_out: { icon: Timer, color: "text-orange-600", bg: "bg-orange-100", label: "Timed Out" },
  action_required: { icon: Lightning, color: "text-purple-600", bg: "bg-purple-100", label: "Action Required" },
};

const DIM_ICONS: Record<string, Icon> = {
  security: ShieldCheck,
  "ui-ux": Palette,
  database: Stack,
  performance: Lightning,
  testing: Flask,
};

const STATUS_COLORS: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-700",
  fail: "bg-red-100 text-red-700",
};

export function PRHealthPanel({ projectId }: { projectId: string }) {
  const [summaries, setSummaries] = useState<PRHealthSummary[]>([]);
  const [selectedPR, setSelectedPR] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const loadSummaries = useCallback(async () => {
    try {
      const data = await api<PRHealthSummary[]>(`/health/pr/project/${projectId}`);
      setSummaries(data);
    } catch {
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  // Group summaries by PR
  const prGroups = useMemo(() => {
    const groups = new Map<string, PRHealthSummary[]>();
    for (const s of summaries) {
      const key = `${s.repository}#${s.pullRequestNumber}`;
      const existing = groups.get(key) ?? [];
      existing.push(s);
      groups.set(key, existing);
    }
    return Array.from(groups.entries()).sort((a, b) => {
      const latestA = a[1][0]?.startedAt ?? "";
      const latestB = b[1][0]?.startedAt ?? "";
      return new Date(latestB).getTime() - new Date(latestA).getTime();
    });
  }, [summaries]);

  const selectedSummaries = selectedPR ? prGroups.find(([key]) => key === selectedPR)?.[1] ?? [] : [];
  const latestSummary = selectedSummaries[0];

  if (loading) {
    return <div className="rounded-3xl bg-white p-12 text-center text-sm text-slate-500 shadow-sm">Loading PR health summaries…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with scan button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">PR Health Scans</h3>
          <p className="text-xs text-slate-500">{summaries.length} scan(s) across {prGroups.length} PR(s)</p>
        </div>
        <button
          onClick={() => void triggerScan(projectId, setScanning, loadSummaries)}
          disabled={scanning}
          className="rounded-full bg-ocean px-4 py-2 text-sm font-semibold text-white transition hover:bg-ocean/90 disabled:opacity-50"
        >
          {scanning ? "Scanning…" : "Run PR Scan"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* PR list sidebar */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Pull Requests</p>
          {prGroups.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-500">No PR scans yet.</p>
              <p className="mt-1 text-xs text-slate-500">Run a scan or configure GitHub webhooks to get started.</p>
            </div>
          ) : (
            <div className="max-h-[600px] space-y-1.5 overflow-y-auto">
              {prGroups.map(([prKey, prSummaries]) => {
                const latest = prSummaries[0];
                const vc = VERDICT_CONFIG[latest.verdict] ?? VERDICT_CONFIG.neutral;
                const isSelected = selectedPR === prKey;
                return (
                  <button
                    key={prKey}
                    onClick={() => setSelectedPR(prKey)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      isSelected
                        ? "border-ocean bg-ocean/5 ring-1 ring-ocean/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${vc.bg} ${vc.color}`}>
                          <vc.icon size={13} weight="bold" aria-hidden="true" />
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          #{latest.pullRequestNumber}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">{prSummaries.length} scan(s)</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="truncate max-w-[140px]">{latest.repository}</span>
                      <span>•</span>
                      <span className="font-mono">{latest.headSha.slice(0, 7)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <ScoreBar score={latest.overallScore} size="sm" />
                      <span className="text-[10px] text-slate-500">
                        {new Date(latest.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          {latestSummary ? (
            <>
              {/* PR Header */}
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-900">
                        PR #{latestSummary.pullRequestNumber}
                      </h3>
                      <VerdictBadge verdict={latestSummary.verdict} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{latestSummary.repository}</span>
                      <span>•</span>
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{latestSummary.headSha.slice(0, 7)}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 font-mono">{latestSummary.branch}<ArrowRight size={11} aria-hidden="true" />{latestSummary.baseBranch}</span>
                    </div>
                  </div>
                  {latestSummary.checkRunUrl && (
                    <a
                      href={latestSummary.checkRunUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                      </svg>
                      View Check Run
                    </a>
                  )}
                </div>

                {/* Score ring + dimensions */}
                <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
                  <div className="flex flex-col items-center">
                    <ScoreRing score={latestSummary.overallScore} />
                    <p className="mt-2 text-xs text-slate-500">Overall Score</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {latestSummary.dimensions.map((dim) => (
                      <DimensionMiniCard key={dim.dimension} dim={dim} />
                    ))}
                  </div>
                </div>

                {/* Scan metadata */}
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span>Status: <span className="font-medium text-slate-600">{latestSummary.status}</span></span>
                  {latestSummary.duration != null && (
                    <span>Duration: <span className="font-medium text-slate-600">{(latestSummary.duration / 1000).toFixed(1)}s</span></span>
                  )}
                  <span>Scanned: <span className="font-medium text-slate-600">{new Date(latestSummary.startedAt).toLocaleString()}</span></span>
                  {latestSummary.checkRunId && (
                    <span>Check Run: <span className="font-mono text-slate-600">#{latestSummary.checkRunId}</span></span>
                  )}
                </div>
              </div>

              {/* Annotations */}
              {latestSummary.annotations.length > 0 && (
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <h4 className="mb-3 font-semibold text-slate-900">Annotations ({latestSummary.annotations.length})</h4>
                  <div className="space-y-2">
                    {latestSummary.annotations.map((ann, i) => (
                      <div
                        key={i}
                        className={`rounded-xl border px-4 py-3 ${
                          ann.annotationLevel === "failure"
                            ? "border-red-200 bg-red-50"
                            : ann.annotationLevel === "warning"
                              ? "border-amber-200 bg-amber-50"
                              : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                              ann.annotationLevel === "failure"
                                ? "bg-red-100 text-red-600"
                                : ann.annotationLevel === "warning"
                                  ? "bg-amber-100 text-amber-600"
                                  : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {ann.annotationLevel === "failure" ? (
                                <X size={13} weight="bold" aria-hidden="true" />
                              ) : ann.annotationLevel === "warning" ? (
                                <Warning size={13} weight="bold" aria-hidden="true" />
                              ) : (
                                <Info size={13} weight="bold" aria-hidden="true" />
                              )}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">{ann.title}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{ann.message}</p>
                        {ann.path && (
                          <p className="mt-1 font-mono text-[10px] text-slate-500">
                            {ann.path}{ann.startLine ? `:${ann.startLine}` : ""}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scan history for this PR */}
              {selectedSummaries.length > 1 && (
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <h4 className="mb-3 font-semibold text-slate-900">Scan History ({selectedSummaries.length})</h4>
                  <div className="overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                          <th className="px-3 py-2">Verdict</th>
                          <th className="px-3 py-2">Score</th>
                          <th className="px-3 py-2">Commit</th>
                          <th className="px-3 py-2">Duration</th>
                          <th className="px-3 py-2">Time</th>
                          <th className="px-3 py-2">Check Run</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSummaries.map((s) => {
                          const vc = VERDICT_CONFIG[s.verdict] ?? VERDICT_CONFIG.neutral;
                          return (
                            <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                              <td className="px-3 py-2">
                                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${vc.bg} ${vc.color}`}>
                                  <vc.icon size={13} weight="bold" aria-hidden="true" />
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <ScoreBar score={s.overallScore} size="sm" />
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-slate-500">{s.headSha.slice(0, 7)}</td>
                              <td className="px-3 py-2 text-xs text-slate-500">
                                {s.duration != null ? `${(s.duration / 1000).toFixed(1)}s` : "-"}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-500">{new Date(s.startedAt).toLocaleString()}</td>
                              <td className="px-3 py-2">
                                {s.checkRunUrl ? (
                                  <a
                                    href={s.checkRunUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-medium text-ocean hover:underline"
                                  >
                                    #{s.checkRunId}
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-300">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl bg-white p-12 text-center shadow-sm">
              <p className="text-sm text-slate-500">Select a PR from the list to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function VerdictBadge({ verdict }: { verdict: string }) {
  const vc = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.neutral;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${vc.bg} ${vc.color}`}>
      <vc.icon size={13} weight="bold" aria-hidden="true" />
      {vc.label}
    </span>
  );
}

function DimensionMiniCard({ dim }: { dim: PRDimensionResult }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          {(() => { const DimIcon = DIM_ICONS[dim.dimension] ?? ChartBar; return <DimIcon size={14} weight="bold" aria-hidden="true" />; })()}
          {dim.dimension}
        </span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[dim.status] ?? "bg-slate-100 text-slate-500"}`}>
          {dim.status}
        </span>
      </div>
      <p className="mt-1 text-lg font-bold text-slate-900">{dim.score}<span className="text-xs font-normal text-slate-500">/100</span></p>
      <p className="text-[10px] text-slate-500">{dim.issueCount} issue{dim.issueCount !== 1 ? "s" : ""}{dim.criticalCount > 0 && `, ${dim.criticalCount} critical`}</p>
    </div>
  );
}

function ScoreBar({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const color =
    score >= 80 ? "bg-emerald-500" :
    score >= 60 ? "bg-amber-500" :
    "bg-red-500";
  const h = size === "sm" ? "h-1.5" : "h-2";
  const w = size === "sm" ? "w-16" : "w-24";

  return (
    <div className="flex items-center gap-2">
      <div className={`${w} ${h} overflow-hidden rounded-full bg-slate-100`}>
        <div className={`${h} rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-semibold ${score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600"}`}>
        {score}
      </span>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 70;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? "#10b981" :
    score >= 60 ? "#f59e0b" :
    "#ef4444";

  return (
    <div className="relative" style={{ width: 160, height: 160 }}>
      <svg width={160} height={160} className="-rotate-90">
        <circle cx={80} cy={80} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        <circle
          cx={80} cy={80} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-900">{score}</span>
        <span className="text-xs text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

// ── Helpers ──

async function triggerScan(
  projectId: string,
  setScanning: (v: boolean) => void,
  reload: () => void,
) {
  setScanning(true);
  try {
    await api("/health/pr/summary", {
      method: "POST",
      body: JSON.stringify({
        repository: "owner/repo",
        pullRequestNumber: 0,
        headSha: "HEAD",
        branch: "main",
        baseBranch: "main",
        projectId,
        targetUrl: "http://localhost:3010",
      }),
    });
    await reload();
  } catch {
    // ignore - no GitHub token configured yet
  } finally {
    setScanning(false);
  }
}
