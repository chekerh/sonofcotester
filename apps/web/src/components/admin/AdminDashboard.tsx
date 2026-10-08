import { useEffect, useState } from "react";
import { Check, Download, Warning, X } from "@phosphor-icons/react";
import type {
  ApiKey,
  ApiKeyScope,
  AuditLogEntry,
  CreateApiKeyResponse,
  Invoice,
  PlanTier,
  SystemAPMOverview,
  UsageQuota,
  WorkspaceSubscription
} from "@sonofcotester/sdk";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3101";

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers }
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export function AdminDashboard() {
  const [sub, setSub] = useState<WorkspaceSubscription | null>(null);
  const [quota, setQuota] = useState<UsageQuota | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apm, setApm] = useState<SystemAPMOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchActor, setSearchActor] = useState("");
  const [upgradingTier, setUpgradingTier] = useState<PlanTier | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checkoutModalTier, setCheckoutModalTier] = useState<PlanTier | null>(null);
  const [checkoutCurrency, setCheckoutCurrency] = useState<"USD" | "EUR" | "GBP" | "JPY">("USD");
  const [cardDetails, setCardDetails] = useState({ number: "•••• •••• •••• 4242", exp: "12/28", cvc: "999", name: "Engineering Director" });

  // New API Key Modal state
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>(["runs:read", "runs:write", "suites:read", "health:read"]);
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null);

  async function loadData() {
    try {
      const [subData, quotaData, invData, logData, keyData, apmData] = await Promise.all([
        api<WorkspaceSubscription>("/admin/subscriptions").catch(() => null),
        api<UsageQuota>("/admin/usage").catch(() => null),
        api<Invoice[]>("/admin/invoices").catch(() => []),
        api<AuditLogEntry[]>("/admin/audit-logs").catch(() => []),
        api<ApiKey[]>("/workspace/api-keys").catch(() => []),
        api<SystemAPMOverview>("/admin/system/overview").catch(() => null)
      ]);
      setSub(subData);
      setQuota(quotaData);
      setInvoices(invData);
      setAuditLogs(logData);
      setApiKeys(keyData);
      setApm(apmData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleUpgrade(tier: PlanTier) {
    setUpgradingTier(tier);
    try {
      const updated = await api<WorkspaceSubscription>("/admin/subscriptions/upgrade", {
        method: "POST",
        body: JSON.stringify({ tier, workspaceId: "ws_internal" })
      });
      setSub(updated);
      setStatusMessage(`Successfully upgraded to ${tier.toUpperCase()} plan!`);
      await loadData();
    } catch {
      setStatusMessage("Failed to update subscription tier.");
    } finally {
      setUpgradingTier(null);
    }
  }

  async function handleRetryJobs() {
    const res = await api<{ retried: number }>("/admin/queues/retry-failed", { method: "POST" });
    setStatusMessage(`Retried ${res.retried} failed jobs.`);
    await loadData();
  }

  async function handlePurgeJobs() {
    await api<{ purged: boolean }>("/admin/queues/purge-completed", { method: "POST" });
    setStatusMessage("Purged completed queue jobs.");
    await loadData();
  }

  async function handleCreateApiKey() {
    if (!newKeyName.trim()) return;
    const res = await api<CreateApiKeyResponse>("/workspace/api-keys", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: "ws_internal",
        name: newKeyName,
        scopes: selectedScopes,
        expiresInDays: 90
      })
    });
    setCreatedKeySecret(res.rawSecretKey);
    setNewKeyName("");
    await loadData();
  }

  async function handleDeleteApiKey(id: string) {
    await api(`/workspace/api-keys/${id}`, { method: "DELETE" });
    setStatusMessage("API key revoked successfully.");
    await loadData();
  }

  function handleExportCsv() {
    window.open(`${apiUrl}/api/admin/audit-logs/export.csv`, "_blank");
  }

  const filteredLogs = auditLogs.filter((log) => {
    if (actionFilter !== "all" && !log.action.startsWith(actionFilter)) return false;
    if (searchActor && !log.actorName.toLowerCase().includes(searchActor.toLowerCase()) && !log.actorEmail.toLowerCase().includes(searchActor.toLowerCase())) {
      return false;
    }
    return true;
  });

  const runPercent = quota ? Math.min(100, Math.round((quota.runsExecuted / quota.limits.monthlyRuns) * 100)) : 0;
  const aiPercent = quota ? Math.min(100, Math.round((quota.aiGenerationsUsed / quota.limits.aiGenerations) * 100)) : 0;

  const ALL_SCOPES: Array<{ id: ApiKeyScope; label: string; desc: string }> = [
    { id: "runs:read", label: "Read Runs", desc: "Query execution runs & test artifacts" },
    { id: "runs:write", label: "Execute Runs", desc: "Dispatch tests to Playwright & Maestro workers" },
    { id: "suites:read", label: "Read Suites", desc: "Inspect test suites and cases" },
    { id: "suites:write", label: "Create/Edit Suites", desc: "Generate and save test specifications" },
    { id: "health:read", label: "Read Health", desc: "Query APM and quality scores" },
    { id: "health:scan", label: "Trigger Scans", desc: "Run Axe-core and security DAST audits" },
    { id: "admin:read", label: "Read Admin", desc: "View quotas and audit logs" }
  ];

  return (
    <div className="space-y-8">
      {statusMessage && (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-5 py-3 text-sm text-emerald-800">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} aria-label="Dismiss" className="font-semibold text-emerald-900"><X size={14} weight="bold" aria-hidden="true" /></button>
        </div>
      )}

      {/* Top Banner & Quick Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current Plan</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="font-display text-2xl font-bold text-slate-900 uppercase">{sub?.tier.replace("_", " ") ?? "Free"}</h3>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              {sub?.status ?? "active"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Renews on {sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "N/A"}</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly Runs</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="font-display text-2xl font-bold text-slate-900">{quota?.runsExecuted ?? 0} <span className="text-sm font-normal text-slate-500">/ {quota?.limits.monthlyRuns ?? 500}</span></h3>
            <span className="text-xs font-semibold text-slate-600">{runPercent}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-ocean transition-all" style={{ width: `${runPercent}%` }} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">AI Test Generations</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="font-display text-2xl font-bold text-slate-900">{quota?.aiGenerationsUsed ?? 0} <span className="text-sm font-normal text-slate-500">/ {quota?.limits.aiGenerations ?? 50}</span></h3>
            <span className="text-xs font-semibold text-slate-600">{aiPercent}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${aiPercent}%` }} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">System APM Status</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="font-display text-2xl font-bold text-emerald-600">{apm?.api.status.toUpperCase() ?? "HEALTHY"}</h3>
            <span className="text-xs font-mono text-slate-500">{apm?.api.latencyP50Ms ?? 14}ms p50</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Uptime: {Math.floor((apm?.uptimeSeconds ?? 100) / 60)} min • Workers: {apm?.workerQueue.workerCount ?? 3}</p>
        </div>
      </div>

      {/* Subscription & Tier Management */}
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-panel">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">Workspace Plans & Subscriptions</h2>
            <p className="text-sm text-slate-600">Select the plan matching your organization's testing volume and student needs.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs text-slate-600">
            <span>Payment: {sub?.paymentMethod ? `${sub.paymentMethod.brand.toUpperCase()} •••• ${sub.paymentMethod.last4}` : "Visa •••• 4242"}</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          {/* Student / Free */}
          <div className={`flex flex-col justify-between rounded-3xl border p-6 transition ${sub?.tier === "student_free" ? "border-ocean bg-ocean/5 ring-2 ring-ocean" : "border-slate-200 bg-white hover:border-slate-300"}`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-ocean">Student & Free</span>
                {sub?.tier === "student_free" && <span className="rounded-full bg-ocean px-2 py-0.5 text-[10px] font-bold text-white uppercase">Current</span>}
              </div>
              <h3 className="mt-2 font-display text-3xl font-bold text-slate-900">$0 <span className="text-sm font-normal text-slate-500">/mo</span></h3>
              <p className="mt-2 text-xs text-slate-600">Ideal for students, university labs, and open source exploration.</p>
              <ul className="mt-4 space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>500</strong> runs / month</li>
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>3</strong> concurrent workers</li>
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>50</strong> AI test generations</li>
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>Full Student Academy</strong> Access</li>
              </ul>
            </div>
            <button
              onClick={() => handleUpgrade("student_free")}
              disabled={sub?.tier === "student_free" || upgradingTier === "student_free"}
              className="mt-6 w-full rounded-2xl border border-slate-300 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              {sub?.tier === "student_free" ? "Active Tier" : "Switch to Free"}
            </button>
          </div>

          {/* Pro */}
          <div className={`flex flex-col justify-between rounded-3xl border p-6 transition ${sub?.tier === "pro" ? "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500" : "border-slate-200 bg-white hover:border-slate-300"}`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-600">Pro QA</span>
                {sub?.tier === "pro" && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase">Current</span>}
              </div>
              <h3 className="mt-2 font-display text-3xl font-bold text-slate-900">$29 <span className="text-sm font-normal text-slate-500">/mo</span></h3>
              <p className="mt-2 text-xs text-slate-600">For fast-moving engineers and professional QA leads.</p>
              <ul className="mt-4 space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>2,500</strong> runs / month</li>
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>8</strong> concurrent workers</li>
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>250</strong> AI test generations</li>
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>600</strong> Maestro Cloud min</li>
              </ul>
            </div>
            <button
              onClick={() => setCheckoutModalTier("pro")}
              disabled={sub?.tier === "pro" || upgradingTier === "pro"}
              className="mt-6 w-full rounded-2xl bg-amber-500 py-2.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-40"
            >
              {sub?.tier === "pro" ? "Active Tier" : upgradingTier === "pro" ? "Upgrading..." : "Checkout Pro Plan"}
            </button>
          </div>

          {/* Team */}
          <div className={`flex flex-col justify-between rounded-3xl border p-6 transition ${sub?.tier === "team" ? "border-indigo-600 bg-indigo-50/20 ring-2 ring-indigo-600" : "border-slate-200 bg-white hover:border-slate-300"}`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Team</span>
                {sub?.tier === "team" && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">Current</span>}
              </div>
              <h3 className="mt-2 font-display text-3xl font-bold text-slate-900">$99 <span className="text-sm font-normal text-slate-500">/mo</span></h3>
              <p className="mt-2 text-xs text-slate-600">High-volume parallel CI/CD test grids for agile teams.</p>
              <ul className="mt-4 space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>10,000</strong> runs / month</li>
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>20</strong> concurrent workers</li>
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>1,000</strong> AI test generations</li>
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>2,400</strong> Maestro Cloud min</li>
              </ul>
            </div>
            <button
              onClick={() => setCheckoutModalTier("team")}
              disabled={sub?.tier === "team" || upgradingTier === "team"}
              className="mt-6 w-full rounded-2xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              {sub?.tier === "team" ? "Active Tier" : upgradingTier === "team" ? "Upgrading..." : "Checkout Team Plan"}
            </button>
          </div>

          {/* Enterprise */}
          <div className={`flex flex-col justify-between rounded-3xl border p-6 transition ${sub?.tier === "enterprise" ? "border-slate-900 bg-slate-900/5 ring-2 ring-slate-900" : "border-slate-200 bg-white hover:border-slate-300"}`}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-900">Enterprise</span>
                {sub?.tier === "enterprise" && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white uppercase">Current</span>}
              </div>
              <h3 className="mt-2 font-display text-3xl font-bold text-slate-900">$499 <span className="text-sm font-normal text-slate-500">/mo</span></h3>
              <p className="mt-2 text-xs text-slate-600">Dedicated private device labs and custom enterprise SLAs.</p>
              <ul className="mt-4 space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>100,000+</strong> runs / month</li>
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>50+</strong> dedicated workers</li>
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>Unlimited</strong> AI generations</li>
                <li className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" /><strong>SSO & Audit Export</strong></li>
              </ul>
            </div>
            <button
              onClick={() => setCheckoutModalTier("enterprise")}
              disabled={sub?.tier === "enterprise" || upgradingTier === "enterprise"}
              className="mt-6 w-full rounded-2xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40"
            >
              {sub?.tier === "enterprise" ? "Active Tier" : upgradingTier === "enterprise" ? "Upgrading..." : "Checkout Enterprise"}
            </button>
          </div>
        </div>
      </section>

      {/* Programmatic API Keys Management */}
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-panel">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">Programmatic API Keys (CI/CD Integration)</h2>
            <p className="text-sm text-slate-600">Generate scoped API keys (sct_live_...) for GitHub Actions, GitLab CI, and CLI runners.</p>
          </div>
          <button
            onClick={() => {
              setCreatedKeySecret(null);
              setIsKeyModalOpen(true);
            }}
            className="rounded-full bg-ink px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm"
          >
            + Generate API Key
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-4 font-semibold">Key Identifier</th>
                <th className="py-3 px-4 font-semibold">Scopes</th>
                <th className="py-3 px-4 font-semibold">Created / Last Used</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">No active API keys found.</td>
                </tr>
              ) : (
                apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900">{key.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{key.keyPrefix}••••••••</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.map((s) => (
                          <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      <span>{new Date(key.createdAt).toLocaleDateString()}</span>
                      {key.lastUsedAt && <span className="block text-[10px] text-slate-500">Used: {new Date(key.lastUsedAt).toLocaleTimeString()}</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteApiKey(key.id)}
                        className="rounded-xl px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* System APM & Queue Operations */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">BullMQ Queue Engine APM</h2>
              <p className="text-xs text-slate-600">Live worker queue telemetry and job execution status.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRetryJobs}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Retry Failed
              </button>
              <button
                onClick={handlePurgeJobs}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Purge Done
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Active Jobs</span>
              <p className="mt-1 font-display text-2xl font-bold text-ocean">{apm?.workerQueue.activeJobs ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Waiting Queue</span>
              <p className="mt-1 font-display text-2xl font-bold text-amber-500">{apm?.workerQueue.waitingJobs ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Failed Jobs</span>
              <p className="mt-1 font-display text-2xl font-bold text-red-500">{apm?.workerQueue.failedJobs ?? 0}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-950 p-4 font-mono text-xs text-slate-200">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-500">Prometheus Scraper:</span>
              <span className="text-sky-400">/api/metrics (Ready)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-500">Postgres Pool:</span>
              <span>{apm?.database.activeConnections ?? 4} active / {apm?.database.poolSize ?? 20} max</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Node.js Heap Used:</span>
              <span>{apm?.api.memoryMb.heapUsed ?? 64} MB</span>
            </div>
          </div>
        </div>

        {/* Invoice & Billing History */}
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-panel">
          <h2 className="font-display text-xl font-bold text-slate-900">Billing & Invoice History</h2>
          <p className="text-xs text-slate-600">Past invoice receipts and payment history.</p>

          <div className="mt-4 space-y-3 max-h-[220px] overflow-y-auto">
            {invoices.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-500">
                No past invoices yet.
              </div>
            ) : (
              invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs">
                  <div>
                    <strong className="text-slate-900">{inv.planName}</strong>
                    <p className="text-slate-500">{new Date(inv.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900">${(inv.amountPaid / 100).toFixed(2)}</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold uppercase text-emerald-800">{inv.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Live Audit Log ("Follow Every Move") + CSV Export */}
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-panel">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="font-display text-2xl font-bold text-slate-900">Live Activity Stream (Audit Trail)</h2>
            </div>
            <p className="text-sm text-slate-600">Follow every move across tests, suites, users, subscriptions, and healing proposals in real-time.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportCsv}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              <Download size={13} weight="bold" aria-hidden="true" /> Export CSV
            </button>
            <input
              type="text"
              placeholder="Search user or email..."
              value={searchActor}
              onChange={(e) => setSearchActor(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-ocean/20"
            />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800"
            >
              <option value="all">All Actions</option>
              <option value="project">Projects</option>
              <option value="suite">Suites</option>
              <option value="execution">Executions</option>
              <option value="subscription">Subscriptions</option>
              <option value="healing">Healing</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Actor</th>
                <th className="py-3 px-4 font-semibold">Action</th>
                <th className="py-3 px-4 font-semibold">Entity</th>
                <th className="py-3 px-4 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">No matching activity log events found.</td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4">
                      <strong className="text-slate-900">{log.actorName}</strong>
                      <span className="block text-[11px] text-slate-500">{log.actorEmail}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900">{log.entityName || log.entityId}</span>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-500">{log.entityType}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Generate API Key Modal */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-slate-900">Generate Programmatic API Key</h3>
              <button onClick={() => setIsKeyModalOpen(false)} aria-label="Close" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X size={15} weight="bold" aria-hidden="true" /></button>
            </div>

            {createdKeySecret ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                  <Warning size={15} weight="fill" className="mr-1 inline align-[-2px] text-amber-600" aria-hidden="true" /><strong>Save this secret key now.</strong> You will not be able to view it again.
                </div>
                <div className="rounded-2xl bg-slate-950 p-4 font-mono text-xs text-emerald-400 break-all select-all">
                  {createdKeySecret}
                </div>
                <button
                  onClick={() => setIsKeyModalOpen(false)}
                  className="w-full rounded-2xl bg-ink py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  I have saved this key safely
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Key Name / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. GitHub Actions CI Grid"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-ocean/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-2">Select Scopes</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {ALL_SCOPES.map((sc) => {
                      const isChecked = selectedScopes.includes(sc.id);
                      return (
                        <label key={sc.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedScopes((prev) =>
                                isChecked ? prev.filter((s) => s !== sc.id) : [...prev, sc.id]
                              );
                            }}
                            className="mt-0.5 rounded text-ocean focus:ring-ocean"
                          />
                          <div>
                            <strong className="text-slate-900">{sc.label}</strong>
                            <p className="text-[11px] text-slate-500">{sc.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsKeyModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateApiKey}
                    disabled={!newKeyName.trim() || selectedScopes.length === 0}
                    className="rounded-xl bg-ink px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40"
                  >
                    Generate Key
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Interactive Checkout Modal */}
      {checkoutModalTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-display text-2xl font-bold text-slate-900">
                  Upgrade to {checkoutModalTier.toUpperCase()} Plan
                </h3>
              </div>
              <button onClick={() => setCheckoutModalTier(null)} aria-label="Close" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X size={15} weight="bold" aria-hidden="true" /></button>
            </div>

            {/* Currency selector */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-xs font-semibold text-slate-600">Billing Currency</span>
              <div className="flex gap-1">
                {(["USD", "EUR", "GBP", "JPY"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCheckoutCurrency(c)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      checkoutCurrency === c ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Price & Plan Summary */}
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-800">
                  {checkoutModalTier === "pro" ? "Pro Plan (2,500 runs/mo)" : checkoutModalTier === "team" ? "Team Grid (10,000 runs/mo)" : "Enterprise Dedicated"}
                </div>
                <div className="text-[11px] text-slate-600">Billed monthly · 30-day money-back guarantee</div>
              </div>
              <div className="text-right">
                <span className="font-display text-2xl font-black text-slate-900">
                  {checkoutCurrency === "USD" ? "$" : checkoutCurrency === "EUR" ? "€" : checkoutCurrency === "GBP" ? "£" : "¥"}
                  {checkoutModalTier === "pro" ? (checkoutCurrency === "JPY" ? "4,200" : checkoutCurrency === "GBP" ? "23" : checkoutCurrency === "EUR" ? "27" : "29")
                    : checkoutModalTier === "team" ? (checkoutCurrency === "JPY" ? "14,500" : checkoutCurrency === "GBP" ? "79" : checkoutCurrency === "EUR" ? "92" : "99")
                    : (checkoutCurrency === "JPY" ? "72,000" : checkoutCurrency === "GBP" ? "399" : checkoutCurrency === "EUR" ? "465" : "499")}
                </span>
                <span className="text-xs text-slate-500">/mo</span>
              </div>
            </div>

            {/* Payment Method Details */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Cardholder Name</label>
              <input
                type="text"
                value={cardDetails.name}
                onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-ocean/20 font-medium"
              />

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Card Number</label>
                  <input
                    type="text"
                    value={cardDetails.number}
                    onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ocean/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Expires</label>
                  <input
                    type="text"
                    value={cardDetails.exp}
                    onChange={(e) => setCardDetails({ ...cardDetails, exp: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 p-3 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-ocean/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                256-bit TLS Encrypted
              </span>
              <span>Instant Workspace Provisioning</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setCheckoutModalTier(null)}
                className="flex-1 rounded-2xl border border-slate-200 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const target = checkoutModalTier;
                  setCheckoutModalTier(null);
                  await handleUpgrade(target);
                }}
                disabled={upgradingTier !== null}
                className="flex-1 rounded-2xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800 transition shadow-lg disabled:opacity-50"
              >
                {upgradingTier ? "Activating..." : "Confirm & Activate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
