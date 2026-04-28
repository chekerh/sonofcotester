import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  ExecutionRun,
  GeneratedSuiteResponse,
  HealingProposal,
  PersistedSuite,
  ProjectSummary
} from "@sonofcotester/sdk";
import { StatCard } from "./components/StatCard.js";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [suites, setSuites] = useState<PersistedSuite[]>([]);
  const [healing, setHealing] = useState<HealingProposal[]>([]);
  const [sourcePayload, setSourcePayload] = useState("As a buyer, I need to confirm the example homepage renders correctly.");
  const [selectedProjectId, setSelectedProjectId] = useState("proj_demo");
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>("");
  const [editorValue, setEditorValue] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready");

  async function loadAll() {
    const [projectData, runData, suiteData, healingData] = await Promise.all([
      request<ProjectSummary[]>("/projects"),
      request<ExecutionRun[]>("/executions"),
      request<PersistedSuite[]>("/test-suites"),
      request<HealingProposal[]>("/heal-proposals")
    ]);
    setProjects(projectData);
    setRuns(runData);
    setSuites(suiteData);
    setHealing(healingData);
    if (!selectedSuiteId && suiteData[0]) {
      setSelectedSuiteId(suiteData[0].id);
      setEditorValue(JSON.stringify(suiteData[0].versions[0]?.cases ?? [], null, 2));
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const selectedSuite = useMemo(
    () => suites.find((suite) => suite.id === selectedSuiteId) ?? suites[0],
    [selectedSuiteId, suites]
  );

  useEffect(() => {
    if (selectedSuite) {
      setEditorValue(JSON.stringify(selectedSuite.versions[0]?.cases ?? [], null, 2));
    }
  }, [selectedSuite?.id]);

  async function generateSuite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await request<GeneratedSuiteResponse>(`/projects/${selectedProjectId}/test-generation`, {
      method: "POST",
      body: JSON.stringify({
        sourceType: "story",
        sourcePayload,
        targetPlatform: "web",
        browserOrDeviceScope: ["chromium", "firefox", "webkit", "android", "ios"]
      })
    });
    setSelectedSuiteId(result.suiteId);
    setEditorValue(JSON.stringify(result.draft.cases, null, 2));
    setStatusMessage(`Generated suite ${result.suiteId}`);
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
    const run = await request<ExecutionRun>(`/test-suites/${selectedSuite.id}/executions`, {
      method: "POST",
      body: JSON.stringify({
        suiteVersionId: selectedSuite.versions[0].id,
        environment: "staging",
        provider: "playwright-local",
        matrix: [{ browserName: "chromium", os: "ubuntu-latest", baseUrl: "https://example.com" }]
      })
    });
    setStatusMessage(`Queued run ${run.id}`);
    await loadAll();
  }

  async function applyHealing(proposalId: string) {
    await request(`/heal-proposals/${proposalId}/apply`, { method: "POST" });
    setStatusMessage(`Applied healing proposal ${proposalId}`);
    await loadAll();
  }

  const bugCount = runs.reduce((count, run) => count + run.bugDrafts.length, 0);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_32%),linear-gradient(135deg,_#fff7ed,_#f8fafc_45%,_#e2e8f0)] text-ink">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10 flex flex-col gap-4 rounded-[32px] bg-white/75 p-8 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.35em] text-ocean">sonofcotester</p>
              <h1 className="mt-2 font-display text-5xl font-bold">Internal alpha control plane for AI-driven testing.</h1>
            </div>
            <div className="rounded-full border border-ink/10 bg-sand px-4 py-2 text-sm font-medium">{statusMessage}</div>
          </div>
          <p className="max-w-3xl text-lg text-slate-600">
            Generate canonical suites, edit them, queue real browser execution, and inspect persisted runs and healing proposals.
          </p>
        </header>

        <section className="mb-10 grid gap-4 md:grid-cols-4">
          <StatCard label="Projects" value={String(projects.length)} accent="ocean" />
          <StatCard label="Suites" value={String(suites.length)} accent="ember" />
          <StatCard label="Execution Runs" value={String(runs.length)} accent="ink" />
          <StatCard label="Bug Drafts" value={String(bugCount)} accent="ocean" />
        </section>

        <section className="mb-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[28px] bg-white/80 p-6 shadow-panel backdrop-blur">
            <h2 className="mb-5 font-display text-2xl font-semibold">Generate Suite</h2>
            <form className="space-y-4" onSubmit={generateSuite}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-600">Project</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-600">Story or spec</span>
                <textarea
                  className="min-h-40 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3"
                  value={sourcePayload}
                  onChange={(event) => setSourcePayload(event.target.value)}
                />
              </label>
              <button className="rounded-full bg-ember px-5 py-3 font-semibold text-white" type="submit">
                Generate persisted suite
              </button>
            </form>
          </div>

          <div className="rounded-[28px] bg-white/80 p-6 shadow-panel backdrop-blur">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold">Suite Editor</h2>
              <div className="flex gap-3">
                <button className="rounded-full bg-ocean px-4 py-2 text-sm font-semibold text-white" onClick={() => void saveSuite()} type="button">
                  Save version
                </button>
                <button className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white" onClick={() => void runSuite()} type="button">
                  Queue run
                </button>
              </div>
            </div>
            <label className="mb-3 block">
              <span className="mb-2 block text-sm font-medium text-slate-600">Suite</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                value={selectedSuite?.id ?? ""}
                onChange={(event) => setSelectedSuiteId(event.target.value)}
              >
                {suites.map((suite) => (
                  <option key={suite.id} value={suite.id}>
                    {suite.summary}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              className="min-h-[420px] w-full rounded-3xl border border-slate-200 bg-slate-950 p-4 font-mono text-sm text-slate-100"
              value={editorValue}
              onChange={(event) => setEditorValue(event.target.value)}
            />
          </div>
        </section>

        <section className="mb-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[28px] bg-white/80 p-6 shadow-panel backdrop-blur">
            <h2 className="mb-5 font-display text-2xl font-semibold">Healing Inbox</h2>
            <div className="space-y-4">
              {healing.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-500">No healing proposals yet.</div>
              ) : (
                healing.map((proposal) => (
                  <article key={proposal.id} className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-display text-lg font-semibold">{proposal.testCaseId}</h3>
                        <p className="mt-1 text-sm text-slate-600">{proposal.rationale}</p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                        {proposal.status}
                      </span>
                    </div>
                    <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{proposal.patch}</pre>
                    {proposal.status !== "applied" ? (
                      <button className="mt-3 rounded-full bg-ocean px-4 py-2 text-sm font-semibold text-white" onClick={() => void applyHealing(proposal.id)} type="button">
                        Apply proposal
                      </button>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[28px] bg-ink p-6 text-white shadow-panel">
            <h2 className="mb-5 font-display text-2xl font-semibold">Execution Feed</h2>
            <div className="space-y-4">
              {runs.map((run) => (
                <article key={run.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-display text-lg">{run.provider}</span>
                    <span className="text-sm uppercase tracking-[0.24em] text-amber-300">{run.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{run.environment}</p>
                  <p className="mt-2 text-sm text-slate-400">{run.stepEvents.length} steps, {run.artifacts.length} artifacts, {run.healingProposals.length} healing proposals</p>
                  {run.errorMessage ? <p className="mt-2 text-sm text-red-200">{run.errorMessage}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
