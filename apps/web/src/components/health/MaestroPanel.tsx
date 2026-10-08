import { useEffect, useState } from "react";
import { Check, CheckCircle, Cloud, DeviceMobile, LinkSimple, X, XCircle } from "@phosphor-icons/react";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3101";

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Types ──

interface MaestroStatus {
  installed: boolean;
  version?: string;
  devices: string[];
  ready: boolean;
}

interface GeneratedFlow {
  filename: string;
  yaml: string;
  flow: { appId: string; name: string; tags?: string[]; commands: unknown[] };
}

interface FlowResult {
  passed: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  flowPath: string;
  steps?: { command: string; passed: boolean; error?: string }[];
}

interface SpecGenResult {
  summary: string;
  sourceType: string;
  testCases: Array<{
    id: string;
    title: string;
    priority: string;
    tags: string[];
    steps: Array<{ action: string; target?: string; data?: string; expectedOutcome: string }>;
  }>;
  flows: GeneratedFlow[];
  yamlFiles: Array<{ filename: string; yaml: string }>;
  confidence: number;
  notes: string[];
}

interface CloudStatus {
  configured: boolean;
  hasApiKey: boolean;
  hasProjectId: boolean;
  hasAppFile: boolean;
}

interface CloudResult {
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  consoleUrl?: string;
  uploadName: string;
  flowResults: FlowResult[];
}

interface CloudDevice {
  name: string;
  os: string;
  osVersion: string;
  type: "android" | "ios";
}

// ── Component ──

export function MaestroPanel() {
  const [status, setStatus] = useState<MaestroStatus | null>(null);
  const [activeMode, setActiveMode] = useState<"local" | "cloud">("local");

  // ── Manual mode ──
  const [appId, setAppId] = useState("com.example.app");
  const [testTitle, setTestTitle] = useState("Login flow happy path");
  const [testSteps, setTestSteps] = useState(
    `navigate → http://localhost:3010\nfill [data-testid='email-input'] → user@test.com\nclick [data-testid='continue-button']\nassertVisible Welcome`
  );

  // ── AI spec mode ──
  const [specSource, setSpecSource] = useState<"jira" | "story" | "spec-upload" | "freeform">("freeform");
  const [specPayload, setSpecPayload] = useState("");
  const [specBaseUrl, setSpecBaseUrl] = useState("");
  const [specAuth, setSpecAuth] = useState("");
  const [specPlatform, setSpecPlatform] = useState<"mobile" | "web">("mobile");
  const [includeNegatives, setIncludeNegatives] = useState(true);
  const [specResult, setSpecResult] = useState<SpecGenResult | null>(null);

  // ── Cloud config ──
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [cloudApiKey, setCloudApiKey] = useState("");
  const [cloudProjectId, setCloudProjectId] = useState("");
  const [cloudUploadName, setCloudUploadName] = useState("");
  const [cloudAppFile, setCloudAppFile] = useState("");
  const [cloudDeviceOs, setCloudDeviceOs] = useState("");
  const [cloudDeviceModel, setCloudDeviceModel] = useState("");
  const [cloudDevices, setCloudDevices] = useState<CloudDevice[]>([]);
  const [cloudResult, setCloudResult] = useState<CloudResult | null>(null);

  // ── Shared ──
  const [generatedFlows, setGeneratedFlows] = useState<GeneratedFlow[]>([]);
  const [results, setResults] = useState<FlowResult[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [cloudExecuting, setCloudExecuting] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadStatus();
    void loadCloudStatus();
    void loadCloudDevices();
  }, []);

  async function loadStatus() {
    try {
      const s = await api<MaestroStatus>("/health/maestro/status");
      setStatus(s);
    } catch {
      setStatus({ installed: false, devices: [], ready: false });
    }
  }

  async function loadCloudStatus() {
    try {
      const s = await api<CloudStatus>("/health/maestro/cloud/status");
      setCloudStatus(s);
    } catch {
      setCloudStatus({ configured: false, hasApiKey: false, hasProjectId: false, hasAppFile: false });
    }
  }

  async function loadCloudDevices() {
    try {
      const data = await api<{ devices: CloudDevice[]; count: number }>("/health/maestro/cloud/devices");
      setCloudDevices(data.devices);
    } catch {
      setCloudDevices([]);
    }
  }

  function parseTestSteps(raw: string) {
    return raw
      .split("\n")
      .filter((l) => l.trim())
      .map((line, i) => {
        const [action, ...rest] = line.split("→").map((s) => s.trim());
        const parts = rest.join("→").trim();
        const [target, data] = parts.split("→").map((s) => s.trim());
        return {
          id: `step-${i}`,
          action: (action?.includes("fill") ? "fill" : action?.includes("click") ? "click" : action?.includes("assert") ? "assertVisible" : action?.includes("navigate") ? "navigate" : "click") as string,
          target: target || undefined,
          data: data || undefined,
          expectedOutcome: `Step ${i + 1}: ${action}`,
        };
      });
  }

  // ── Manual generate ──

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const steps = parseTestSteps(testSteps);
      const body = {
        cases: [{
          id: `tc-${Date.now()}`,
          title: testTitle,
          feature: "Maestro-generated",
          priority: "p1" as const,
          platform: "mobile" as const,
          prerequisites: [],
          tags: ["maestro-generated"],
          steps,
        }],
        appId,
        tags: ["maestro-generated"],
      };
      const data = await api<{ count: number; flows: GeneratedFlow[] }>("/health/maestro/generate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setGeneratedFlows(data.flows);
      setSelectedFlow(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  // ── AI spec generate ──

  async function handleSpecGenerate() {
    setGenerating(true);
    setError(null);
    setSpecResult(null);
    try {
      const body = {
        sourceType: specSource,
        sourcePayload: specPayload,
        appId,
        platform: specPlatform,
        context: {
          ...(specBaseUrl ? { baseUrl: specBaseUrl } : {}),
          ...(specAuth ? { authInstructions: specAuth } : {}),
        },
        includeNegativeTests: includeNegatives,
        maxCases: 10,
      };
      const result = await api<SpecGenResult>("/health/maestro/generate-from-spec", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSpecResult(result);
      if (result.yamlFiles && result.flows) {
        const merged = result.yamlFiles.map((f, i) => ({
          filename: f.filename,
          yaml: f.yaml,
          flow: result.flows[i]?.flow ?? result.flows[0]?.flow ?? { appId, name: "flow", commands: [] },
        }));
        setGeneratedFlows(merged);
        setSelectedFlow(0);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  // ── Local execute ──

  async function handleExecute() {
    if (generatedFlows.length === 0) return;
    setExecuting(true);
    setError(null);
    try {
      const data = await api<{ totalFlows: number; passed: number; failed: number; results: FlowResult[] }>(
        "/health/maestro/execute",
        {
          method: "POST",
          body: JSON.stringify({
            flows: generatedFlows.map((f) => f.flow),
            environment: "local",
            timeoutSeconds: 120,
          }),
        }
      );
      setResults(data.results);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Execution failed");
    } finally {
      setExecuting(false);
    }
  }

  // ── Cloud execute ──

  async function handleCloudExecute() {
    if (generatedFlows.length === 0) return;
    setCloudExecuting(true);
    setError(null);
    setCloudResult(null);
    try {
      const config: Record<string, string> = {
        ...(cloudApiKey ? { apiKey: cloudApiKey } : {}),
        ...(cloudProjectId ? { projectId: cloudProjectId } : {}),
        ...(cloudUploadName ? { uploadName: cloudUploadName } : {}),
        ...(cloudAppFile ? { appFile: cloudAppFile } : {}),
        ...(cloudDeviceOs ? { deviceOs: cloudDeviceOs } : {}),
        ...(cloudDeviceModel ? { deviceModel: cloudDeviceModel } : {}),
      };
      const result = await api<CloudResult>("/health/maestro/cloud/execute", {
        method: "POST",
        body: JSON.stringify({
          flows: generatedFlows.map((f) => f.flow),
          config,
        }),
      });
      setCloudResult(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Cloud execution failed");
    } finally {
      setCloudExecuting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Maestro Integration</h3>
            <p className="text-sm text-slate-500">Mobile & web UI testing - local devices or cloud device farm</p>
          </div>
          <button onClick={loadStatus} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200">
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <StatusPill label="CLI Installed" value={status?.installed ? `v${status.version ?? "?"}` : "No"} ok={status?.installed} />
          <StatusPill label="Local Devices" value={status?.devices.length ? status.devices.join(", ") : "None"} ok={(status?.devices.length ?? 0) > 0} />
          <StatusPill label="Local Ready" value={status?.ready ? "Yes" : "No"} ok={status?.ready} />
          <StatusPill label="Cloud Configured" value={cloudStatus?.configured ? "Yes" : "No"} ok={cloudStatus?.configured} />
          <StatusPill label="Cloud API Key" value={cloudStatus?.hasApiKey ? "Set" : "Not set"} ok={cloudStatus?.hasApiKey} />
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
        {(["local", "cloud"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setActiveMode(mode)}
            className={`flex-1 rounded-xl px-5 py-2.5 text-sm font-medium transition ${
              activeMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {mode === "local" ? (<><DeviceMobile size={15} weight="bold" aria-hidden="true" /> Local Device</>) : (<><Cloud size={15} weight="bold" aria-hidden="true" /> Maestro Cloud</>)}
          </button>
        ))}
      </div>

      {/* ── AI Spec Generator ── */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">AI</span>
          <h3 className="font-bold text-slate-900">Generate from Spec / Jira / Story</h3>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Paste a Jira ticket, user story, or spec doc - AI extracts test cases and generates Maestro flows automatically.
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Source Type</label>
            <select value={specSource} onChange={(e) => setSpecSource(e.target.value as typeof specSource)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition focus:border-ocean">
              <option value="freeform">Freeform Description</option>
              <option value="jira">Jira Ticket</option>
              <option value="story">User Story</option>
              <option value="spec-upload">Spec Document</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Target Platform</label>
            <select value={specPlatform} onChange={(e) => setSpecPlatform(e.target.value as "mobile" | "web")} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition focus:border-ocean">
              <option value="mobile">Mobile (Android / iOS)</option>
              <option value="web">Web Browser</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">App ID</label>
            <input value={appId} onChange={(e) => setAppId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono transition focus:border-ocean" placeholder="com.example.app" />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Spec / Story Content <span className="text-slate-400">(paste the full text)</span>
          </label>
          <textarea
            value={specPayload}
            onChange={(e) => setSpecPayload(e.target.value)}
            rows={6}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition focus:border-ocean"
            placeholder={`As a registered user, I want to log in to the mobile app so I can access my dashboard.\n\nAcceptance Criteria:\n- Given I am on the login screen, When I enter valid email and password, Then I should see my dashboard\n- Given I enter wrong credentials, When I tap Login, Then I should see an error message`}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Base URL <span className="text-slate-400">(optional)</span></label>
            <input value={specBaseUrl} onChange={(e) => setSpecBaseUrl(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition focus:border-ocean" placeholder="https://app.example.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Auth Instructions <span className="text-slate-400">(optional)</span></label>
            <input value={specAuth} onChange={(e) => setSpecAuth(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition focus:border-ocean" placeholder="login with test@test.com / password123" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={includeNegatives} onChange={(e) => setIncludeNegatives(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-ocean" />
            Include negative tests
          </label>
        </div>

        <button onClick={handleSpecGenerate} disabled={generating || !specPayload.trim()} className="mt-4 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50">
          {generating ? "Generating with AI..." : "Generate Flows from Spec"}
        </button>

        {error && <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

        {/* AI Results */}
        {specResult && (
          <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
            <div className="mb-3 flex items-center gap-3">
              <h4 className="font-semibold text-slate-900">AI Generation Result</h4>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${specResult.confidence >= 0.8 ? "bg-emerald-100 text-emerald-700" : specResult.confidence >= 0.6 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                {Math.round(specResult.confidence * 100)}% confidence
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{specResult.testCases.length} test case{specResult.testCases.length !== 1 ? "s" : ""}</span>
            </div>
            <p className="mb-3 text-sm text-slate-700">{specResult.summary}</p>
            <div className="space-y-2 mb-3">
              {specResult.testCases.map((tc) => (
                <div key={tc.id} className="rounded-xl bg-white p-3 border border-slate-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tc.priority === "p1" ? "bg-red-100 text-red-700" : tc.priority === "p2" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{tc.priority.toUpperCase()}</span>
                    <span className="text-sm font-medium text-slate-800">{tc.title}</span>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {tc.tags.map((tag) => (<span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{tag}</span>))}
                    <span className="text-[10px] text-slate-400">{tc.steps.length} steps</span>
                  </div>
                </div>
              ))}
            </div>
            {specResult.notes.length > 0 && (
              <div className="rounded-xl bg-white/60 p-3">
                <p className="mb-1 text-xs font-medium text-slate-500">Generation Notes</p>
                <ul className="space-y-1">{specResult.notes.map((note, i) => (<li key={i} className="text-xs text-slate-600">• {note}</li>))}</ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cloud Config (only in cloud mode) ── */}
      {activeMode === "cloud" && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-full bg-blue-100 p-1.5 text-blue-700"><Cloud size={13} weight="fill" aria-hidden="true" /></span>
            <h3 className="font-bold text-slate-900">Maestro Cloud Configuration</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">API Key</label>
              <input type="password" value={cloudApiKey} onChange={(e) => setCloudApiKey(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono transition focus:border-ocean" placeholder="msk_..." />
              <p className="mt-1 text-xs text-slate-400">Get from <a href="https://web.maestro.dev" target="_blank" rel="noreferrer" className="text-ocean underline">Maestro Dashboard</a></p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Project ID</label>
              <input value={cloudProjectId} onChange={(e) => setCloudProjectId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono transition focus:border-ocean" placeholder="proj_xxx" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Upload Name <span className="text-slate-400">(optional)</span></label>
              <input value={cloudUploadName} onChange={(e) => setCloudUploadName(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition focus:border-ocean" placeholder="my-test-run" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">App File Path <span className="text-slate-400">(optional)</span></label>
              <input value={cloudAppFile} onChange={(e) => setCloudAppFile(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono transition focus:border-ocean" placeholder="/path/to/app.apk" />
            </div>
          </div>

          {/* Device Selection */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Device OS <span className="text-slate-400">(e.g. android-34, ios-18.0)</span></label>
              <input value={cloudDeviceOs} onChange={(e) => setCloudDeviceOs(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono transition focus:border-ocean" placeholder="android-34" />
              {cloudDevices.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {cloudDevices.slice(0, 6).map((d) => (
                    <button key={`${d.name}-${d.osVersion}`} onClick={() => { setCloudDeviceOs(`${d.os}-${d.osVersion.replace(/\./g, "")}`); setCloudDeviceModel(d.name); }} className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] text-slate-600 transition hover:bg-slate-200">
                      {d.name} ({d.os} {d.osVersion})
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Device Model <span className="text-slate-400">(iOS only)</span></label>
              <input value={cloudDeviceModel} onChange={(e) => setCloudDeviceModel(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition focus:border-ocean" placeholder="iPhone 17 Pro" />
            </div>
          </div>
        </div>
      )}

      {/* ── Manual Flow Builder ── */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-bold text-slate-900">Manual Flow Builder</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">App ID</label>
            <input value={appId} onChange={(e) => setAppId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono transition focus:border-ocean" placeholder="com.example.app" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Test Name</label>
            <input value={testTitle} onChange={(e) => setTestTitle(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm transition focus:border-ocean" placeholder="Login flow happy path" />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Test Steps <span className="text-slate-500">(one per line: action → target → data)</span>
          </label>
          <textarea value={testSteps} onChange={(e) => setTestSteps(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm transition focus:border-ocean" />
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={handleGenerate} disabled={generating} className="rounded-xl bg-ocean px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ocean/90 disabled:opacity-50">
            {generating ? "Generating..." : "Generate YAML Flow"}
          </button>
          {generatedFlows.length > 0 && activeMode === "local" && (
            <button onClick={handleExecute} disabled={executing || !status?.ready} className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50">
              {executing ? "Executing..." : `Execute Locally (${generatedFlows.length})`}
            </button>
          )}
          {generatedFlows.length > 0 && activeMode === "cloud" && (
            <button onClick={handleCloudExecute} disabled={cloudExecuting || !cloudStatus?.configured} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
              {cloudExecuting ? "Uploading to Cloud..." : `Execute on Cloud (${generatedFlows.length})`}
            </button>
          )}
        </div>
        {activeMode === "cloud" && !cloudStatus?.configured && generatedFlows.length > 0 && (
          <p className="mt-2 text-xs text-amber-600">Cloud not configured. Set API Key and Project ID above.</p>
        )}
      </div>

      {/* ── Generated Flows Preview ── */}
      {generatedFlows.length > 0 && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Generated Flows ({generatedFlows.length})</h3>
            <div className="flex gap-1 overflow-x-auto">
              {generatedFlows.map((f, i) => (
                <button key={i} onClick={() => setSelectedFlow(i)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${selectedFlow === i ? "bg-ocean text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {f.filename?.slice(0, 25) ?? `Flow ${i + 1}`}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-slate-900 p-5 font-mono text-sm text-emerald-300 overflow-x-auto">
            <pre className="whitespace-pre">{generatedFlows[selectedFlow]?.yaml}</pre>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            {generatedFlows[selectedFlow]?.flow.tags?.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Cloud Results ── */}
      {cloudResult && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-4">
            <h3 className="font-bold text-slate-900">Cloud Execution Results</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cloudResult.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {cloudResult.passed ? "PASSED" : "FAILED"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Upload Name</p>
              <p className="text-sm font-semibold text-slate-800">{cloudResult.uploadName}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Exit Code</p>
              <p className="text-sm font-semibold text-slate-800">{cloudResult.exitCode}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Flows</p>
              <p className="text-sm font-semibold text-slate-800">{cloudResult.flowResults.length}</p>
            </div>
          </div>

          {cloudResult.consoleUrl && (
            <a
              href={cloudResult.consoleUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-4 flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
            >
              <LinkSimple size={17} weight="bold" className="text-blue-600" aria-hidden="true" />
              View results in Maestro Console
              <span className="ml-auto text-xs text-blue-500 truncate max-w-[300px]">{cloudResult.consoleUrl}</span>
            </a>
          )}

          {!cloudResult.passed && cloudResult.stderr && (
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-red-50 border border-red-200 p-4 font-mono text-xs text-red-800">
              {cloudResult.stderr}
            </pre>
          )}

          {!cloudResult.passed && cloudResult.stdout && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">Show full stdout</summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-50 p-4 font-mono text-xs text-slate-700">
                {cloudResult.stdout}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* ── Local Execution Results ── */}
      {results && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-4">
            <h3 className="font-bold text-slate-900">Local Execution Results</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${results.every((r) => r.passed) ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {results.filter((r) => r.passed).length}/{results.length} passed
            </span>
          </div>
          <div className="space-y-4">
            {results.map((result, i) => (
              <div key={i} className={`rounded-xl border p-4 ${result.passed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`text-lg ${result.passed ? "text-emerald-500" : "text-red-500"}`}>{result.passed ? <Check size={17} weight="bold" aria-hidden="true" /> : <X size={17} weight="bold" aria-hidden="true" />}</span>
                  <span className="font-medium text-slate-900">Flow {i + 1}</span>
                  <span className="text-xs text-slate-500">exit code: {result.exitCode}</span>
                </div>
                {result.steps && result.steps.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {result.steps.map((step, j) => (
                      <div key={j} className="flex items-center gap-2 text-sm">
                        <span className={step.passed ? "text-emerald-500" : "text-red-500"}>{step.passed ? <CheckCircle size={15} weight="fill" aria-hidden="true" /> : <XCircle size={15} weight="fill" aria-hidden="true" />}</span>
                        <span className="text-slate-700">{step.command}</span>
                        {step.error && <span className="text-xs text-red-500">{step.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {!result.passed && result.stderr && (
                  <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-red-100 p-3 font-mono text-xs text-red-800">{result.stderr}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-slate-300"}`} />
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
