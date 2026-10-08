import { FormEvent, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowLeft,
  ArrowSquareOut,
  Crown,
  Flask,
  Globe,
  GraduationCap,
  Lightning,
  MagnifyingGlass,
  MapPin,
  Plus,
  Robot,
  ShieldCheck,
  Sparkle,
  TrendUp,
  Warning
} from "@phosphor-icons/react";
import type {
  CanonicalTestCase,
  CrawlResult,
  ExecutionRun,
  ExecutionStreamEvent,
  GeneratedSuiteResponse,
  HealingProposal,
  LocalAiStatus,
  PersistedSuite,
  ProviderCapability,
  ProjectSummary
} from "@sonofcotester/sdk";
import { LandingPage } from "./components/LandingPage.js";
import { StatCard } from "./components/StatCard.js";
import { HealthDashboard } from "./components/health/HealthDashboard.js";
import { AdminDashboard } from "./components/admin/AdminDashboard.js";
import { StudentAcademy } from "./components/academy/StudentAcademy.js";
import { MaestroPanel } from "./components/health/MaestroPanel.js";
import { ProjectModal } from "./components/ProjectModal.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { ExecutionDock } from "./components/ExecutionDock.js";
import { VisualSuiteEditor } from "./components/VisualSuiteEditor.js";
import { BenchmarkDashboard } from "./components/benchmark/BenchmarkDashboard.js";
import { ToastContainer, type ToastMessage } from "./components/Toast.js";
import { UserAuthModal, type UserProfile } from "./components/UserAuthModal.js";
import { translations, type SupportedLanguage } from "./lib/i18n.js";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3101";
const socket = io(`${apiUrl}/executions`, {
  autoConnect: false,
  transports: ["websocket"]
});

function upsertRun(runs: ExecutionRun[], incoming: ExecutionRun) {
  const existing = runs.find((run) => run.id === incoming.id);
  if (!existing) {
    return [incoming, ...runs];
  }
  return runs.map((run) => (run.id === incoming.id ? incoming : run));
}

function upsertHealing(healing: HealingProposal[], incoming: HealingProposal[]) {
  const next = new Map(healing.map((proposal) => [proposal.id, proposal]));
  for (const proposal of incoming) {
    next.set(proposal.id, proposal);
  }
  return Array.from(next.values());
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

type ConsoleView = "testing" | "health" | "admin" | "academy" | "maestro" | "benchmark";

const tabIcons: Record<ConsoleView, typeof Flask> = {
  testing: Flask,
  health: ShieldCheck,
  maestro: Lightning,
  academy: GraduationCap,
  admin: Crown,
  benchmark: TrendUp
};

export function App() {
  const [showConsole, setShowConsole] = useState(true);
  const [consoleView, setConsoleView] = useState<ConsoleView>("testing");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [suites, setSuites] = useState<PersistedSuite[]>([]);
  const [healing, setHealing] = useState<HealingProposal[]>([]);
  const [sourcePayload, setSourcePayload] = useState("As a buyer, I need to confirm the example homepage renders correctly.");
  const [selectedProjectId, setSelectedProjectId] = useState("proj_demo");
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>("");
  const [editorValue, setEditorValue] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [executionMode, setExecutionMode] = useState<"web" | "mobile" | "maestro">("web");
  const [providerCapabilities, setProviderCapabilities] = useState<ProviderCapability[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectSummary | null>(null);

  // God UX state: Command Palette, Execution Dock, Toasts, Live Socket, Env, Auth & i18n
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<"local" | "staging" | "production">("local");
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>("en");
  const [isUserAuthModalOpen, setIsUserAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: "usr_admin",
    name: "DevOps Lead",
    email: "admin@sonofcotester.dev",
    role: "ADMIN",
    workspaceId: "ws_internal"
  });

  const t = translations[currentLanguage];

  const addToast = (message: string, type: ToastMessage["type"] = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Local AI (Ollama) Integration State
  const [localAiStatus, setLocalAiStatus] = useState<LocalAiStatus>({
    available: false,
    endpoint: "http://localhost:11434",
    activeModel: null,
    installedModels: []
  });
  const [selectedAiModel, setSelectedAiModel] = useState<string>("");

  async function fetchAiStatus() {
    try {
      const status = await request<LocalAiStatus>("/ai/status");
      setLocalAiStatus(status);
      if (status.activeModel) {
        setSelectedAiModel(status.activeModel);
      } else if (status.installedModels.length > 0) {
        setSelectedAiModel(status.installedModels[0].name);
      }
    } catch {
      // Ollama not reachable
    }
  }

  async function handleSelectAiModel(model: string) {
    setSelectedAiModel(model);
    try {
      await request("/ai/models/select", {
        method: "POST",
        body: JSON.stringify({ model })
      });
      addToast(`Switched local AI model to ${model}`, "success");
    } catch (err) {
      addToast(`Failed to select AI model: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }

  async function handleSwitchUser(email: string) {
    try {
      const session = await request<{ user: UserProfile }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setCurrentUser(session.user);
      addToast(`Switched user to ${session.user.name} (${session.user.role})`, "success");
    } catch {
      const role = email.includes("admin") ? "ADMIN" : email.includes("student") ? "STUDENT" : "ENGINEER";
      const name = email.includes("admin") ? "DevOps Lead" : email.includes("student") ? "Testing Student" : "Senior QA Engineer";
      setCurrentUser({
        id: `usr_${email.split("@")[0]}`,
        name,
        email,
        role,
        workspaceId: "ws_internal"
      });
      addToast(`Active role switched to ${role}`, "info");
    }
  }

  // Target App & Inspector state
  const [targetUrl, setTargetUrl] = useState("http://localhost:3010");
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [selectedArtifactImg, setSelectedArtifactImg] = useState<string | null>(null);

  async function loadAll() {
    const [projectData, runData, suiteData, healingData, capabilityData] = await Promise.all([
      request<ProjectSummary[]>("/projects"),
      request<ExecutionRun[]>("/executions"),
      request<PersistedSuite[]>("/test-suites"),
      request<HealingProposal[]>("/heal-proposals"),
      request<ProviderCapability[]>("/providers/capabilities")
    ]);
    setProjects(projectData);
    setRuns(runData);
    setSuites(suiteData);
    setHealing(healingData);
    setProviderCapabilities(capabilityData);
    if (!selectedProjectId && projectData[0]) {
      setSelectedProjectId(projectData[0].id);
    }
    if (!selectedSuiteId && suiteData[0]) {
      setSelectedSuiteId(suiteData[0].id);
      setEditorValue(JSON.stringify(suiteData[0].versions[0]?.cases ?? [], null, 2));
    }
    if (!selectedRunId && runData[0]) {
      setSelectedRunId(runData[0].id);
    }
    void fetchAiStatus();
  }

  useEffect(() => {
    if (!showConsole) {
      return;
    }

    function onConnect() {
      setSocketConnected(true);
      addToast("Live execution socket connected", "success");
    }

    function onDisconnect() {
      setSocketConnected(false);
      addToast("Execution socket disconnected. Reconnecting...", "warning");
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.connect();
    void loadAll();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.disconnect();
    };
  }, [showConsole]);

  useEffect(() => {
    if (!showConsole) return;

    function handleKeyDown(e: KeyboardEvent) {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          (activeEl as HTMLElement).isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void runQuickDemoSmoke();
        return;
      }

      const blocked =
        isTyping ||
        isCommandPaletteOpen ||
        isProjectModalOpen ||
        isUserAuthModalOpen ||
        showScreenshotModal;

      if (!blocked) {
        if (e.key === "1") setConsoleView("testing");
        else if (e.key === "2") setConsoleView("health");
        else if (e.key === "3") setConsoleView("maestro");
        else if (e.key === "4") setConsoleView("academy");
        else if (e.key === "5") setConsoleView("admin");
        else if (e.key === "6") setConsoleView("benchmark");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showConsole,
    isCommandPaletteOpen,
    isProjectModalOpen,
    isUserAuthModalOpen,
    showScreenshotModal
  ]);

  useEffect(() => {
    const handleRunEvent = (event: ExecutionStreamEvent) => {
      setRuns((current) => upsertRun(current, event.run));
      setHealing((current) => upsertHealing(current, event.run.healingProposals));
      setStatusMessage(`Run ${event.runId} ${event.type}`);
      if (!selectedRunId) {
        setSelectedRunId(event.runId);
      }
      if (event.type === "started") {
        addToast(`Execution run ${event.runId} started`, "info");
      } else if (event.type === "completed" && event.run.status === "passed") {
        addToast(`Execution run ${event.runId} passed!`, "success");
      } else if (event.type === "failed" || event.run.status === "failed") {
        addToast(`Execution run ${event.runId} failed!`, "error");
      } else if (event.type === "healing-ready") {
        addToast(`Self-healing proposal ready for run ${event.runId}`, "warning");
      }
    };

    socket.on("run:event", handleRunEvent);
    return () => {
      socket.off("run:event", handleRunEvent);
    };
  }, [selectedRunId]);

  const selectedSuite = useMemo(
    () => suites.find((suite) => suite.id === selectedSuiteId) ?? suites[0],
    [selectedSuiteId, suites]
  );
  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0],
    [runs, selectedRunId]
  );

  useEffect(() => {
    if (selectedSuite) {
      setEditorValue(JSON.stringify(selectedSuite.versions[0]?.cases ?? [], null, 2));
    }
  }, [selectedSuite?.id]);

  useEffect(() => {
    if (selectedRunId) {
      socket.emit("run:watch", { runId: selectedRunId });
    }
  }, [selectedRunId]);

  async function handleCrawlTarget(urlToCrawl?: string) {
    const url = urlToCrawl || targetUrl;
    if (!url) return;
    setCrawlLoading(true);
    setCrawlError(null);
    setStatusMessage(`Crawling target application at ${url}...`);
    try {
      const result = await request<CrawlResult>("/inspector/crawl", {
        method: "POST",
        body: JSON.stringify({ url })
      });
      setCrawlResult(result);
      setStatusMessage(`App crawled! Discovered ${result.elements.length} elements (${result.title})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCrawlError(msg);
      setStatusMessage(`Crawl failed: ${msg}`);
    } finally {
      setCrawlLoading(false);
    }
  }

  async function handleGenerateFromCrawl() {
    if (!selectedProjectId) return;
    const modelTag = selectedAiModel ? ` with ${selectedAiModel}` : "";
    setStatusMessage(`Generating dynamic tests for ${targetUrl}${modelTag}...`);
    try {
      const result = await request<GeneratedSuiteResponse>(`/projects/${selectedProjectId}/test-generation`, {
        method: "POST",
        body: JSON.stringify({
          sourceType: "story",
          sourcePayload: sourcePayload || `End-to-end verification for ${targetUrl}`,
          targetPlatform: executionMode === "maestro" ? "mobile" : executionMode,
          browserOrDeviceScope: ["chromium"],
          targetUrl,
          discoveredElements: crawlResult?.elements || [],
          model: selectedAiModel || undefined
        })
      });
      setSelectedSuiteId(result.suiteId);
      setEditorValue(JSON.stringify(result.draft.cases, null, 2));
      setStatusMessage(`Generated ${result.draft.cases.length} tests targeting ${targetUrl}${modelTag}!`);
      addToast(`Generated ${result.draft.cases.length} tests${modelTag}`, "success");
      await loadAll();
    } catch (err) {
      setStatusMessage(`Generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function generateSuite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const modelTag = selectedAiModel ? ` with ${selectedAiModel}` : "";
    const result = await request<GeneratedSuiteResponse>(`/projects/${selectedProjectId}/test-generation`, {
      method: "POST",
      body: JSON.stringify({
        sourceType: "story",
        sourcePayload,
        targetPlatform: executionMode === "maestro" ? "mobile" : executionMode,
        browserOrDeviceScope: ["chromium", "firefox", "webkit", "android", "ios"],
        targetUrl,
        discoveredElements: crawlResult?.elements || [],
        model: selectedAiModel || undefined
      })
    });
    setSelectedSuiteId(result.suiteId);
    setEditorValue(JSON.stringify(result.draft.cases, null, 2));
    setStatusMessage(`Generated suite ${result.suiteId}${modelTag}`);
    addToast(`Generated suite${modelTag}`, "success");
    await loadAll();
  }

  async function saveSuite() {
    if (!selectedSuite) {
      return;
    }
    const cases = JSON.parse(editorValue);
    await request(`/test-suites/${selectedSuite.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        summary: selectedSuite.summary,
        notes: "Saved from internal alpha editor",
        cases
      })
    });
    setStatusMessage(`Saved ${selectedSuite.id}`);
    await loadAll();
  }

  async function runSuite() {
    if (!selectedSuite?.versions[0]) {
      return;
    }
    const provider = executionMode === "web"
      ? "playwright-local"
      : executionMode === "maestro"
        ? "maestro-local"
        : "browserstack-mobile";

    const matrix = executionMode === "web"
      ? [{ browserName: "chromium", os: "local", baseUrl: targetUrl }]
      : executionMode === "maestro"
        ? [{ platformName: "android", appId: "com.example.app", deviceName: "Pixel 8" }]
        : [{ platformName: "android", deviceName: "Pixel 8", osVersion: "14" }];

    const run = await request<ExecutionRun>(`/test-suites/${selectedSuite.id}/executions`, {
      method: "POST",
      body: JSON.stringify({
        suiteVersionId: selectedSuite.versions[0].id,
        environment: "local",
        provider,
        matrix
      })
    });
    setStatusMessage(`Queued run ${run.id} against ${targetUrl} (${provider})`);
    setSelectedRunId(run.id);
    await loadAll();
  }

  async function handleSaveVisualCases(newCases: CanonicalTestCase[]) {
    if (!selectedSuite) return;
    await request(`/test-suites/${selectedSuite.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        summary: selectedSuite.summary,
        notes: "Saved from Visual Test Studio",
        cases: newCases
      })
    });
    setStatusMessage(`Saved ${selectedSuite.id}`);
    await loadAll();
  }

  async function applyHealing(proposalId: string) {
    await request(`/heal-proposals/${proposalId}/apply`, { method: "POST" });
    setStatusMessage(`Applied healing proposal ${proposalId}`);
    await loadAll();
  }

  async function rejectHealing(proposalId: string) {
    await request(`/heal-proposals/${proposalId}/reject`, { method: "POST" });
    setStatusMessage(`Rejected healing proposal ${proposalId}`);
    await loadAll();
  }

  async function handleSaveProject(projectData: { id?: string; name: string; description: string }) {
    if (projectData.id) {
      await request(`/projects/${projectData.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: projectData.name, description: projectData.description })
      });
      setStatusMessage(`Updated project ${projectData.name}`);
    } else {
      const created = await request<ProjectSummary>("/projects", {
        method: "POST",
        body: JSON.stringify({ name: projectData.name, description: projectData.description, workspaceId: "ws_internal" })
      });
      setSelectedProjectId(created.id);
      setStatusMessage(`Created project ${created.name}`);
    }
    await loadAll();
  }

  async function handleDeleteProject(projectId: string) {
    await request(`/projects/${projectId}`, { method: "DELETE" });
    setStatusMessage(`Deleted project ${projectId}`);
    await loadAll();
  }

  async function runQuickDemoSmoke() {
    const activeTarget = targetUrl || "http://localhost:3010";
    setStatusMessage(`Triggering instant smoke run against ${activeTarget}...`);
    try {
      const demoSuite = suites.find((s) => s.projectId === selectedProjectId) ?? suites[0];
      if (!demoSuite?.versions[0]) {
        setStatusMessage("No test suite available. Please generate or crawl a test suite first.");
        return;
      }
      setSelectedSuiteId(demoSuite.id);
      setExecutionMode("web");
      const run = await request<ExecutionRun>(`/test-suites/${demoSuite.id}/executions`, {
        method: "POST",
        body: JSON.stringify({
          suiteVersionId: demoSuite.versions[0].id,
          environment: "local",
          provider: "playwright-local",
          matrix: [{ browserName: "chromium", os: "local", baseUrl: activeTarget }]
        })
      });
      setStatusMessage(`Smoke run ${run.id} queued against ${activeTarget}! Streaming execution events...`);
      setSelectedRunId(run.id);
      await loadAll();
    } catch (err) {
      setStatusMessage(`Smoke run dispatch: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!showConsole) {
    return <LandingPage onLaunch={() => setShowConsole(true)} />;
  }

  const bugCount = runs.reduce((count, run) => count + run.bugDrafts.length, 0);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_32%),linear-gradient(135deg,_#fff7ed,_#f8fafc_45%,_#e2e8f0)] text-ink">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-6 flex flex-col gap-4 rounded-[32px] bg-white/85 p-6 md:p-8 shadow-panel backdrop-blur border border-white/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">{t.prodReady}</span>
                <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-mono font-medium text-slate-700">
                  {socketConnected ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                      <span>{t.liveStream}</span>
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span>{t.connecting}</span>
                    </>
                  )}
                </span>
                <select
                  aria-label="Active environment"
                  value={selectedEnv}
                  onChange={(e) => {
                    const nextEnv = e.target.value as "local" | "staging" | "production";
                    setSelectedEnv(nextEnv);
                    addToast(`Switched active environment to ${nextEnv}`, "info");
                  }}
                  className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700 cursor-pointer"
                >
                  <option value="local">Local Dev</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>

                {/* Local AI (Ollama) Model Selector */}
                <div
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition ${
                    localAiStatus.available
                      ? "border-purple-200 bg-purple-50 text-purple-900"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                  title={
                    localAiStatus.available
                      ? `Ollama connected at ${localAiStatus.endpoint} (${localAiStatus.installedModels.length} models installed)`
                      : "Ollama not detected on localhost:11434"
                  }
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      localAiStatus.available ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                    }`}
                  />
                  <span className="font-mono flex items-center gap-1">
                    <Robot size={12} weight="fill" aria-hidden="true" />
                    <span className="hidden sm:inline">Ollama:</span>
                  </span>
                  {localAiStatus.installedModels.length > 0 ? (
                    <select
                      value={selectedAiModel}
                      onChange={(e) => void handleSelectAiModel(e.target.value)}
                      className="bg-transparent font-mono text-purple-950 font-bold border-none cursor-pointer"
                    >
                      {localAiStatus.installedModels.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name} {m.details?.parameter_size ? `(${m.details.parameter_size})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-mono text-slate-500">Offline</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsUserAuthModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700 shadow-2xs transition"
                  title="Switch Role, Persona, or Language"
                >
                  <span className="font-mono" aria-label={`Interface language: ${currentLanguage.toUpperCase()}`}>
                    {currentLanguage.toUpperCase()}
                  </span>
                  <span className="font-medium text-slate-900">{currentUser.name}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold uppercase text-slate-600">
                    {currentUser.role}
                  </span>
                </button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl md:text-4xl font-bold text-slate-900">
                  {t.appName}
                  <span className="mt-1 block text-xl md:text-2xl font-semibold text-slate-500">
                    Autonomous QA &amp; Continuous Verification Engine
                  </span>
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition"
                title="Open Command Palette (⌘K)"
              >
                <span className="font-mono text-ocean font-bold">⌘K</span>
                <span className="hidden sm:inline text-slate-500 font-normal">{t.commandPalette}</span>
              </button>
              <div className="rounded-full border border-ink/10 bg-sand px-3 py-1.5 text-xs font-mono font-medium max-w-xs truncate">{statusMessage}</div>
              <button
                onClick={() => void runQuickDemoSmoke()}
                className="rounded-full bg-orange-600 hover:bg-orange-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition flex items-center gap-1.5"
                title="Run immediate smoke execution against local target (⌘↵)"
              >
                <Lightning size={13} weight="fill" aria-hidden="true" /> {t.runSmoke}
              </button>
              <button
                onClick={() => {
                  setEditingProject(null);
                  setIsProjectModalOpen(true);
                }}
                className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <Plus size={13} weight="bold" aria-hidden="true" /> {t.newProject}
              </button>
              <button
                onClick={() => setShowConsole(false)}
                className="rounded-full border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition flex items-center gap-1.5"
              >
                <ArrowLeft size={13} weight="bold" aria-hidden="true" /> {t.publicStorefront}
              </button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2 pt-2 border-t border-slate-100" aria-label="Console sections">
            {(
              [
                ["testing", t.tabs.testing],
                ["health", t.tabs.health],
                ["maestro", t.tabs.maestro],
                ["academy", t.tabs.academy],
                ["admin", t.tabs.admin],
                ["benchmark", t.tabs.benchmark]
              ] as [ConsoleView, string][]
            ).map(([view, label]) => {
              const Icon = tabIcons[view];
              const isActive = consoleView === view;
              return (
                <button
                  key={view}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setConsoleView(view)}
                  className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition ${
                    isActive
                      ? view === "benchmark"
                        ? "bg-orange-600 text-white shadow-sm"
                        : "bg-ink text-white shadow-sm"
                      : view === "benchmark"
                        ? "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Icon size={15} weight="bold" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </nav>
        </header>

        {consoleView === "health" ? (
          <HealthDashboard projectId={selectedProjectId} />
        ) : consoleView === "admin" ? (
          <AdminDashboard />
        ) : consoleView === "academy" ? (
          <StudentAcademy />
        ) : consoleView === "maestro" ? (
          <div className="rounded-[32px] bg-white p-6 shadow-panel">
            <MaestroPanel />
          </div>
        ) : consoleView === "benchmark" ? (
          <BenchmarkDashboard />
        ) : (
        <>
        <section className="mb-10 grid gap-4 md:grid-cols-4">
          <StatCard label="Projects" value={String(projects.length)} accent="ocean" />
          <StatCard label="Suites" value={String(suites.length)} accent="ember" />
          <StatCard label="Execution Runs" value={String(runs.length)} accent="ink" />
          <StatCard label="Bug Drafts" value={String(bugCount)} accent="ocean" />
        </section>

        {/* Target Application & Live Inspector Section */}
        <section className="mb-8 rounded-[32px] bg-white/90 p-6 md:p-8 shadow-panel backdrop-blur border border-white/80">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                {crawlResult && (
                  <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {crawlResult.statusCode} OK • {crawlResult.title}
                  </span>
                )}
              </div>
              <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">
                Target App Inspector & Zero-Code Discovery
              </h2>
              <p className="text-sm text-slate-500 max-w-2xl">
                Point Son of CoTester to any local dev server (e.g. localhost:3000, localhost:5174) or web URL. Playwright crawls interactive elements, captures a live snapshot, and generates resilient test flows.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Quick presets:</span>
              <button
                type="button"
                onClick={() => { setTargetUrl("http://localhost:3010"); void handleCrawlTarget("http://localhost:3010"); }}
                className="rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition"
              >
                :3010 Demo
              </button>
              <button
                type="button"
                onClick={() => { setTargetUrl("http://localhost:5174"); void handleCrawlTarget("http://localhost:5174"); }}
                className="rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition"
              >
                :5174 Portal
              </button>
              <button
                type="button"
                onClick={() => { setTargetUrl("http://localhost:3000"); void handleCrawlTarget("http://localhost:3000"); }}
                className="rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition"
              >
                :3000 React/Next
              </button>
              <button
                type="button"
                onClick={() => { setTargetUrl("http://localhost:8080"); void handleCrawlTarget("http://localhost:8080"); }}
                className="rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition"
              >
                :8080 Backend
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500 pointer-events-none text-base">
                <Globe size={16} aria-hidden="true" />
              </span>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="Enter target URL (e.g. http://localhost:3000 or https://myapp.com)"
                className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3.5 text-sm font-medium text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-ocean/30"
              />
            </div>
            <button
              type="button"
              disabled={crawlLoading || !targetUrl}
              onClick={() => void handleCrawlTarget()}
              className="rounded-2xl bg-ocean hover:bg-sky-600 disabled:opacity-50 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {crawlLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Crawling App...</span>
                </>
              ) : (
                <>
                  <MagnifyingGlass size={15} weight="bold" aria-hidden="true" />
                  <span>Inspect &amp; Crawl Target</span>
                </>
              )}
            </button>
          </div>

          {crawlError && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-start gap-3">
              <Warning size={17} weight="fill" className="text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Inspection Failed</p>
                <p className="mt-0.5 text-xs text-rose-700">{crawlError}</p>
                <p className="mt-1 text-xs text-slate-500">Make sure your app is running locally (e.g. <code className="bg-rose-100 px-1 rounded">npm run dev</code>) and listening on that port.</p>
              </div>
            </div>
          )}

          {crawlResult && (
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80">
              {/* Screenshot thumbnail */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Target screenshot</span>
                  <button
                    type="button"
                    onClick={() => setShowScreenshotModal(true)}
                    className="text-ocean hover:underline text-[11px] font-semibold inline-flex items-center gap-1"
                  >
                    View fullscreen
                    <ArrowSquareOut size={12} weight="bold" aria-hidden="true" />
                  </button>
                </div>
                {crawlResult.screenshotBase64 ? (
                  <div
                    onClick={() => setShowScreenshotModal(true)}
                    className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-300 shadow-sm bg-black/5 aspect-video"
                  >
                    <img
                      src={crawlResult.screenshotBase64}
                      alt="Crawled App View"
                      className="w-full h-full object-cover object-top transition duration-200 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold">
                      Click to expand
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">
                    No screenshot captured
                  </div>
                )}
                <div className="text-[11px] text-slate-500 font-mono truncate">
                  {crawlResult.url}
                </div>
              </div>

              {/* Elements & Synthesis */}
              <div className="flex flex-col justify-between">
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                    <div className="rounded-xl bg-white p-3 border border-slate-200 text-center">
                      <div className="text-xl font-bold text-slate-800">{crawlResult.buttonsCount}</div>
                      <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Buttons</div>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-200 text-center">
                      <div className="text-xl font-bold text-slate-800">{crawlResult.inputsCount}</div>
                      <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Inputs</div>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-200 text-center">
                      <div className="text-xl font-bold text-slate-800">{crawlResult.linksCount}</div>
                      <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Links</div>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-200 text-center">
                      <div className="text-xl font-bold text-slate-800">{crawlResult.headings.length}</div>
                      <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Headings</div>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-200 text-center col-span-2 sm:col-span-1">
                      <div className={`text-xl font-bold ${
                        (crawlResult.a11yScore ?? 100) >= 90 ? "text-emerald-600" :
                        (crawlResult.a11yScore ?? 100) >= 70 ? "text-amber-600" : "text-rose-600"
                      }`}>
                        {crawlResult.a11yScore ?? 100}%
                      </div>
                      <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">WCAG AA</div>
                    </div>
                  </div>

                  {crawlResult.discoveredRoutes && crawlResult.discoveredRoutes.length > 0 && (
                    <div className="mb-4">
                      <span className="text-xs font-semibold text-slate-600 block mb-1.5">Discovered App Routes</span>
                      <div className="flex flex-wrap gap-1.5">
                        {crawlResult.discoveredRoutes.map((route) => {
                          let fullUrl = route;
                          try {
                            fullUrl = new URL(route, targetUrl).toString();
                          } catch {}
                          return (
                            <button
                              key={route}
                              type="button"
                              onClick={() => {
                                setTargetUrl(fullUrl);
                                void handleCrawlTarget(fullUrl);
                              }}
                              className="rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 text-xs font-mono font-medium text-sky-800 transition flex items-center gap-1"
                              title={`Inspect route: ${fullUrl}`}
                            >
                              <MapPin size={12} weight="fill" aria-hidden="true" />
                              <span>{route}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-xs font-semibold text-slate-600 block mb-2">Discovered Interactive Elements & Selectors</span>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {crawlResult.elements.map((el) => (
                        <span
                          key={el.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-mono text-slate-700 shadow-xs"
                          title={`Selector: ${el.selector}`}
                        >
                          <span className={`px-1 rounded text-[10px] uppercase font-bold ${
                            el.type === "button" ? "bg-amber-100 text-amber-800" :
                            el.type === "input" ? "bg-blue-100 text-blue-800" :
                            el.type === "heading" ? "bg-purple-100 text-purple-800" :
                            "bg-slate-100 text-slate-700"
                          }`}>
                            {el.type}
                          </span>
                          <span className="truncate max-w-[140px]">{el.text || el.placeholder || el.selector}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    Synthesize real Playwright and Maestro tests directly from the crawled DOM tree.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleGenerateFromCrawl()}
                      className="rounded-full bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition flex items-center gap-1.5"
                    >
                      <Sparkle size={13} weight="fill" aria-hidden="true" />
                      <span>Generate Tests from Crawled Elements</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void runSuite()}
                      className="rounded-full bg-slate-900 hover:bg-black px-4 py-2 text-xs font-bold text-white shadow-sm transition flex items-center gap-1.5"
                    >
                      <Lightning size={13} weight="fill" aria-hidden="true" />
                      <span>Execute Suite on Target</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[28px] bg-white/80 p-6 shadow-panel backdrop-blur border border-white/60">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold">Generate Suite</h2>
              <button
                onClick={() => {
                  const curr = projects.find((p) => p.id === selectedProjectId);
                  setEditingProject(curr || null);
                  setIsProjectModalOpen(true);
                }}
                className="text-xs font-semibold text-ocean hover:underline"
              >
                Edit Project
              </button>
            </div>
            <form className="space-y-4" onSubmit={generateSuite}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-600">Project Scope</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/20"
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({project.description})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-600">Story, Spec or Jira Requirement</span>
                <textarea
                  className="min-h-36 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/20"
                  value={sourcePayload}
                  onChange={(event) => setSourcePayload(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-600">Execution Target Mode</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/20"
                  value={executionMode}
                  onChange={(event) => setExecutionMode(event.target.value as "web" | "mobile" | "maestro")}
                >
                  <option value="web">Web (Playwright Local / Chromium)</option>
                  <option value="maestro">Mobile (Maestro Declarative YAML)</option>
                  <option value="mobile">Mobile Cloud (BrowserStack / Appium)</option>
                </select>
              </label>
              <button className="rounded-full bg-ember px-6 py-3 font-semibold text-white hover:bg-orange-600 transition shadow-sm" type="submit">
                Generate Persisted Suite
              </button>
            </form>
            <div className="mt-6 rounded-3xl bg-sand p-5">
              <h3 className="font-display text-lg font-semibold">Provider Readiness Matrix</h3>
              <div className="mt-3 space-y-3">
                {providerCapabilities.map((capability) => (
                  <div key={capability.provider} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-slate-900">{capability.provider}</span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                          capability.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {capability.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{capability.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <VisualSuiteEditor
            suite={selectedSuite}
            suites={suites}
            selectedSuiteId={selectedSuiteId}
            onSelectSuiteId={(id) => {
              setSelectedSuiteId(id);
              const s = suites.find((x) => x.id === id);
              if (s) setEditorValue(JSON.stringify(s.versions[0]?.cases ?? [], null, 2));
            }}
            targetUrl={targetUrl}
            onSave={handleSaveVisualCases}
            onRun={() => runSuite()}
            onAddToast={addToast}
          />
        </section>

        <section className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[28px] bg-white/80 p-6 shadow-panel backdrop-blur border border-white/60">
            <h2 className="mb-5 font-display text-2xl font-semibold">Self-Healing Inbox</h2>
            <div className="space-y-4">
              {healing.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-500 text-sm">No healing proposals pending review.</div>
              ) : (
                healing.map((proposal) => (
                  <article key={proposal.id} className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-display text-base font-bold text-slate-900">{proposal.testCaseId}</h3>
                        <p className="mt-1 text-xs text-slate-600">{proposal.rationale}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                        proposal.status === "applied" ? "bg-emerald-100 text-emerald-800" : proposal.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-700"
                      }`}>
                        {proposal.status}
                      </span>
                    </div>
                    <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-emerald-300 font-mono">{proposal.patch}</pre>
                    {proposal.status === "pending" && (
                      <div className="flex gap-2 pt-2">
                        <button className="rounded-full bg-ocean px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-600" onClick={() => void applyHealing(proposal.id)} type="button">
                          Apply Patch
                        </button>
                        <button className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100" onClick={() => void rejectHealing(proposal.id)} type="button">
                          Reject
                        </button>
                      </div>
                    )}
                    {proposal.status === "applied" && (
                      <div className="flex gap-2 pt-2">
                        <button
                          className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 flex items-center gap-1.5"
                          onClick={() => void runSuite()}
                          type="button"
                        >
                          <Lightning size={13} weight="fill" aria-hidden="true" />
                          <span>Re-run Healed Suite</span>
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[28px] bg-ink p-6 text-white shadow-panel">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold">Live Execution Stream</h2>
              <select
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs text-white"
                value={selectedRun?.id ?? ""}
                onChange={(event) => setSelectedRunId(event.target.value)}
              >
                {runs.map((run) => (
                  <option key={run.id} value={run.id} className="text-slate-900">
                    {run.provider} • {run.id} ({run.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-4">
              {selectedRun ? (
                <>
                  <article className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-display text-lg font-bold">{selectedRun.provider}</span>
                      <span className={`text-xs uppercase font-bold tracking-wider ${
                        selectedRun.status === "passed" ? "text-emerald-400" : selectedRun.status === "failed" ? "text-red-400" : "text-amber-300"
                      }`}>{selectedRun.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">Environment: {selectedRun.environment} • Steps: {selectedRun.stepEvents.length}</p>
                    {selectedRun.errorMessage && <p className="mt-2 text-xs text-red-300 font-mono bg-red-950/40 p-2 rounded-xl">{selectedRun.errorMessage}</p>}
                    {selectedRun.externalSessionUrl && (
                      <a className="mt-2 inline-block text-xs text-amber-300 underline" href={selectedRun.externalSessionUrl} target="_blank" rel="noreferrer">
                        Open cloud device session
                      </a>
                    )}
                    {selectedRun.status === "failed" && (
                      <div className="mt-3 flex items-center justify-between rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-900 border border-indigo-500/30 p-3.5 text-xs text-slate-200">
                        <div className="flex items-center gap-2">
                          <GraduationCap size={17} weight="bold" className="text-sky-300 shrink-0" aria-hidden="true" />
                          <div>
                            <strong className="text-sky-300">Learn How to Fix This Failure</strong>
                            <p className="text-[11px] text-slate-300">Open interactive Academy lesson on selector resilience & flakiness.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setConsoleView("academy")}
                          className="rounded-full bg-ocean px-3.5 py-1.5 font-bold text-white hover:bg-sky-600 transition"
                        >
                          Open lesson
                        </button>
                      </div>
                    )}
                  </article>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-400">Step Telemetry Events</h3>
                    <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                      {selectedRun.stepEvents.map((event) => (
                        <div key={event.id} className="flex items-center justify-between rounded-xl bg-white/5 p-2.5 text-xs">
                          <span className="text-slate-200">{event.message}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${event.status === "passed" ? "text-emerald-400" : "text-amber-400"}`}>{event.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-400">Artifacts & Evidence</h3>
                    <div className="mt-3 space-y-3">
                      {selectedRun.artifacts.map((artifact) => {
                        const isScreenshot = artifact.type === "screenshot";
                        const imgUrl = artifact.url.startsWith("http")
                          ? artifact.url
                          : `${apiUrl}${artifact.url.startsWith("/") ? "" : "/"}${artifact.url}`;
                        return (
                          <div key={artifact.id} className="rounded-xl bg-white/5 p-3 text-xs border border-white/5">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-200 font-medium">{artifact.label}</span>
                              <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">{artifact.type}</span>
                            </div>
                            {isScreenshot && (
                              <div
                                onClick={() => setSelectedArtifactImg(imgUrl)}
                                className="mt-2.5 relative group cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-black/40 aspect-video max-h-48"
                              >
                                <img
                                  src={imgUrl}
                                  alt={artifact.label}
                                  className="w-full h-full object-cover object-top transition duration-200 group-hover:scale-105"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold">
                                  Click to enlarge
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-slate-300 text-xs">No runs recorded yet.</div>
              )}
            </div>
          </div>
        </section>
        </>
        )}
      </div>

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={handleSaveProject}
        onDelete={editingProject ? handleDeleteProject : undefined}
        initialProject={editingProject}
      />

      {showScreenshotModal && crawlResult?.screenshotBase64 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowScreenshotModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Screenshot of ${crawlResult.title}`}
            className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{crawlResult.title}</h3>
                <p className="text-xs text-slate-500 font-mono">{crawlResult.url}</p>
              </div>
              <button
                type="button"
                aria-label="Close screenshot"
                onClick={() => setShowScreenshotModal(false)}
                className="rounded-full bg-slate-100 hover:bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700"
              >
                Close
              </button>
            </div>
            <div className="max-h-[80vh] overflow-auto p-2 bg-slate-950 flex items-center justify-center">
              <img
                src={crawlResult.screenshotBase64}
                alt="Full Captured Page"
                className="max-h-[78vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* God UX: Floating Live Execution Telemetry Dock */}
      <ExecutionDock
        latestRun={selectedRun}
        onOpenRunDetails={(runId) => {
          setSelectedRunId(runId);
          setConsoleView("testing");
        }}
        onQuickSmoke={() => void runQuickDemoSmoke()}
        onAutoHeal={(propId) => void applyHealing(propId)}
      />

      {/* God UX: Omni Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(view) => setConsoleView(view)}
        onRunSmoke={() => void runQuickDemoSmoke()}
        onCrawlTarget={() => void handleCrawlTarget()}
        onGenerateTests={() => void handleGenerateFromCrawl()}
        onNewProject={() => {
          setEditingProject(null);
          setIsProjectModalOpen(true);
        }}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => {
          setSelectedProjectId(id);
          addToast(`Active project changed to ${projects.find((p) => p.id === id)?.name ?? id}`, "info");
        }}
        onOpenStorefront={() => setShowConsole(false)}
        installedAiModels={localAiStatus.installedModels.map((m) => ({
          name: m.name,
          parameterSize: m.details?.parameter_size
        }))}
        activeAiModel={selectedAiModel}
        onSelectAiModel={(model) => void handleSelectAiModel(model)}
      />

      {/* God UX: Multi-Tenant Role & Language Modal */}
      <UserAuthModal
        isOpen={isUserAuthModalOpen}
        onClose={() => setIsUserAuthModalOpen(false)}
        currentUser={currentUser}
        onSwitchUser={(email) => void handleSwitchUser(email)}
        currentLanguage={currentLanguage}
        onSelectLanguage={(lang) => {
          setCurrentLanguage(lang);
          addToast(`Interface language updated to ${lang.toUpperCase()}`, "info");
        }}
      />

      {/* God UX: System Feedback Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
