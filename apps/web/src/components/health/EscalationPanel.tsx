import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, X } from "@phosphor-icons/react";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3101";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

interface EscalationStep {
  id: string;
  name: string;
  delayMs: number;
  action: string;
  targetSeverity: string;
  channelIds: string[];
  messageTemplate?: string;
  onceOnly: boolean;
}

interface EscalationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  dimensions: string[];
  minSeverity: string;
  projectIds: string[];
  steps: EscalationStep[];
  maxEscalations: number;
  autoResolveAfterMs: number;
  createdAt: string;
  updatedAt: string;
}

interface EscalationEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  alertId: string;
  alertTitle: string;
  dimension: string;
  stepName: string;
  action: string;
  executedAt: string;
  success: boolean;
  error?: string;
  escalationCount: number;
}

interface EscalationStats {
  activeEscalations: number;
  totalEscalations: number;
  byRule: Array<{ ruleId: string; ruleName: string; count: number }>;
  lastEscalationAt?: string;
}

const ACTION_BADGES: Record<string, string> = {
  notify: "bg-blue-100 text-blue-700",
  "page-oncall": "bg-red-100 text-red-700",
  "notify-slack": "bg-purple-100 text-purple-700",
  webhook: "bg-orange-100 text-orange-700",
};

const SEVERITY_BADGES: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

function formatDelay(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

export function EscalationPanel() {
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [events, setEvents] = useState<EscalationEvent[]>([]);
  const [stats, setStats] = useState<EscalationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeView, setActiveView] = useState<"rules" | "history">("rules");

  const loadData = useCallback(async () => {
    try {
      const [r, e, s] = await Promise.all([
        api<EscalationRule[]>("/health/escalation/rules"),
        api<EscalationEvent[]>("/health/escalation/events?limit=50").catch(() => []),
        api<EscalationStats>("/health/escalation/stats").catch(() => null),
      ]);
      setRules(r);
      setEvents(e);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function deleteRule(id: string) {
    if (!confirm("Delete this escalation rule?")) return;
    await api(`/health/escalation/rules/${id}`, { method: "DELETE" });
    await loadData();
  }

  async function toggleRule(id: string, enabled: boolean) {
    await api(`/health/escalation/rules/${id}`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
    await loadData();
  }

  if (loading) {
    return <div className="rounded-3xl bg-white p-12 text-center text-sm text-slate-500 shadow-sm">Loading escalation rules…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Active Escalations</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{stats.activeEscalations}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total Rules</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{rules.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total Escalations</p>
            <p className="mt-1 text-2xl font-bold text-slate-700">{stats.totalEscalations}</p>
          </div>
        </div>
      )}

      {/* View tabs */}
      <div className="flex gap-2">
        {(["rules", "history"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              activeView === v ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {v === "rules" ? `Rules (${rules.length})` : `History (${events.length})`}
          </button>
        ))}
      </div>

      {/* Rules view */}
      {activeView === "rules" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowForm(true)}
              className="rounded-full bg-ocean px-4 py-2 text-sm font-semibold text-white transition hover:bg-ocean/90"
            >
              + New Rule
            </button>
          </div>

          {rules.length === 0 ? (
            <div className="rounded-3xl bg-white p-12 text-center shadow-sm">
              <p className="text-sm text-slate-500">No escalation rules configured.</p>
              <p className="mt-1 text-xs text-slate-500">Create a rule to automatically escalate unresolved critical alerts.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`rounded-3xl border bg-white p-5 shadow-sm transition ${
                    rule.enabled ? "border-slate-200" : "border-slate-100 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">{rule.name}</h4>
                        {rule.dimensions.length > 0 && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                            {rule.dimensions.join(", ")}
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_BADGES[rule.minSeverity] ?? "bg-slate-100 text-slate-500"}`}>
                          {rule.minSeverity}+
                        </span>
                      </div>
                      {rule.description && (
                        <p className="mt-1 text-xs text-slate-500">{rule.description}</p>
                      )}

                      {/* Steps visualization */}
                      <div className="mt-3 flex items-center gap-1">
                        {rule.steps.map((step, i) => (
                          <div key={step.id} className="flex items-center">
                            <div className="flex flex-col items-center">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ACTION_BADGES[step.action] ?? "bg-slate-100 text-slate-500"}`}>
                                {step.action}
                              </span>
                              <span className="mt-0.5 text-[9px] text-slate-500">
                                {i === 0 ? "after " : `+ `}{formatDelay(step.delayMs)}
                              </span>
                              <span className="text-[9px] text-slate-500">{step.name}</span>
                            </div>
                            {i < rule.steps.length - 1 && (
                              <ArrowRight size={12} className="mx-1 text-slate-500" aria-hidden="true" />
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 flex gap-3 text-[10px] text-slate-500">
                        {rule.maxEscalations > 0 && <span>Max: {rule.maxEscalations}x</span>}
                        {rule.autoResolveAfterMs > 0 && <span>Auto-resolve: {formatDelay(rule.autoResolveAfterMs)}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void toggleRule(rule.id, !rule.enabled)}
                        className={`relative h-5 w-9 rounded-full transition ${rule.enabled ? "bg-emerald-500" : "bg-slate-300"}`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                            rule.enabled ? "left-[18px]" : "left-0.5"
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => void deleteRule(rule.id)}
                        aria-label="Delete escalation rule"
                        className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-red-500"
                      >
                        <X size={13} weight="bold" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History view */}
      {activeView === "history" && (
        <div className="rounded-3xl bg-white shadow-sm">
          {events.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">No escalation events yet.</div>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Rule</th>
                    <th className="px-4 py-3">Step</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Alert</th>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                            event.success ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                          }`}
                        >
                          {event.success ? (
                            <Check size={13} weight="bold" aria-hidden="true" />
                          ) : (
                            <X size={13} weight="bold" aria-hidden="true" />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">{event.ruleName}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{event.stepName}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ACTION_BADGES[event.action] ?? "bg-slate-100 text-slate-500"}`}>
                          {event.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{event.alertTitle}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">#{event.escalationCount}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(event.executedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create form */}
      {showForm && <CreateRuleForm onClose={() => setShowForm(false)} onCreated={loadData} />}
    </div>
  );
}

// ── Create Rule Form ──

function CreateRuleForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [minSeverity, setMinSeverity] = useState<string>("high");
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [steps, setSteps] = useState<Array<{ name: string; delayMs: number; action: string; targetSeverity: string }>>([
    { name: "Notify", delayMs: 300_000, action: "notify", targetSeverity: "warning" },
    { name: "Page On-Call", delayMs: 900_000, action: "page-oncall", targetSeverity: "critical" },
  ]);
  const [maxEscalations, setMaxEscalations] = useState(3);
  const [saving, setSaving] = useState(false);

  const ALL_DIMS = ["security", "ui-ux", "database", "performance", "testing"];

  function toggleDim(dim: string) {
    setDimensions((p) => (p.includes(dim) ? p.filter((d) => d !== dim) : [...p, dim]));
  }

  function addStep() {
    setSteps((p) => [...p, { name: `Step ${p.length + 1}`, delayMs: 1_800_000, action: "webhook", targetSeverity: "critical" }]);
  }

  function removeStep(index: number) {
    setSteps((p) => p.filter((_, i) => i !== index));
  }

  function updateStep(index: number, field: string, value: string | number) {
    setSteps((p) => p.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/health/escalation/rules", {
        method: "POST",
        body: JSON.stringify({
          name: name || "Untitled Rule",
          description,
          dimensions,
          minSeverity,
          steps: steps.map((s, i) => ({ ...s, id: `step-${i + 1}`, onceOnly: false, channelIds: [] })),
          maxEscalations,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      alert(`Failed to create rule: ${err}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <form onSubmit={(e) => void handleSubmit(e)} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">New Escalation Rule</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-600"><X size={15} weight="bold" aria-hidden="true" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Critical Security Alert Escalation" required className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-ocean" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When to escalate..." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-ocean" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Minimum Severity</label>
            <div className="flex gap-2">
              {["info", "low", "medium", "high", "critical"].map((s) => (
                <button key={s} type="button" onClick={() => setMinSeverity(s)} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${minSeverity === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Dimensions</label>
            <div className="flex flex-wrap gap-2">
              {ALL_DIMS.map((d) => (
                <button key={d} type="button" onClick={() => toggleDim(d)} className={`rounded-full px-3 py-1 text-xs font-medium transition ${dimensions.includes(d) ? "bg-ocean text-white" : "bg-slate-100 text-slate-500"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500">Escalation Steps</label>
              <button type="button" onClick={addStep} className="text-xs font-semibold text-ocean hover:underline">+ Add Step</button>
            </div>
            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">Step {i + 1}</span>
                    {steps.length > 1 && (
                      <button type="button" onClick={() => removeStep(i)} className="text-[10px] text-red-400 hover:text-red-600">Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={step.name} onChange={(e) => updateStep(i, "name", e.target.value)} placeholder="Name" className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-ocean" />
                    <select value={step.action} onChange={(e) => updateStep(i, "action", e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-ocean">
                      <option value="notify">Notify</option>
                      <option value="page-oncall">Page On-Call</option>
                      <option value="notify-slack">Slack</option>
                      <option value="webhook">Webhook</option>
                    </select>
                    <select value={step.targetSeverity} onChange={(e) => updateStep(i, "targetSeverity", e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-ocean">
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="mt-2">
                    <label className="text-[10px] text-slate-500">Delay after previous step (ms)</label>
                    <input type="number" value={step.delayMs} onChange={(e) => updateStep(i, "delayMs", parseInt(e.target.value, 10) || 0)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-ocean" />
                    <span className="text-[10px] text-slate-500">= {formatDelay(step.delayMs)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Max Escalations (0 = unlimited)</label>
            <input type="number" value={maxEscalations} onChange={(e) => setMaxEscalations(parseInt(e.target.value, 10) || 0)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-ocean" />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-full bg-ocean px-5 py-2 text-sm font-semibold text-white transition hover:bg-ocean/90 disabled:opacity-50">
            {saving ? "Creating…" : "Create Rule"}
          </button>
        </div>
      </form>
    </div>
  );
}
