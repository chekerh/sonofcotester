import { FormEvent, useEffect, useState } from "react";
import type { ExecutionRun, GeneratedTestSuiteDraft, HealingProposal, ProjectSummary } from "@sonofcotester/sdk";
import { StatCard } from "./components/StatCard.js";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [suites, setSuites] = useState<
    Array<{ id: string; projectId: string; versionId: string; draft: GeneratedTestSuiteDraft }>
  >([]);
  const [healing, setHealing] = useState<HealingProposal[]>([]);
  const [sourcePayload, setSourcePayload] = useState("As a buyer, I can complete checkout on web and mobile.");
  const [selectedProjectId, setSelectedProjectId] = useState("proj_demo");
  const [lastDraft, setLastDraft] = useState<GeneratedTestSuiteDraft | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch(`${apiUrl}/projects`).then((res) => res.json()),
      fetch(`${apiUrl}/executions`).then((res) => res.json()),
      fetch(`${apiUrl}/test-suites`).then((res) => res.json()),
      fetch(`${apiUrl}/heal-proposals`).then((res) => res.json())
    ]).then(([projectData, runData, suiteData, healingData]) => {
      setProjects(projectData);
      setRuns(runData);
      setSuites(suiteData);
      setHealing(healingData);
    });
  }, []);

  async function generateSuite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`${apiUrl}/projects/${selectedProjectId}/test-generation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceType: "story",
        sourcePayload,
        targetPlatform: "web",
        browserOrDeviceScope: ["chromium", "firefox", "webkit"]
      })
    });
    const draft = (await response.json()) as GeneratedTestSuiteDraft;
    setLastDraft(draft);
    const suiteResponse = await fetch(`${apiUrl}/test-suites`);
    setSuites(await suiteResponse.json());
  }

  async function runLatestSuite() {
    const suite = suites[0];
    if (!suite) {
      return;
    }
    const response = await fetch(`${apiUrl}/test-suites/${suite.id}/executions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suiteVersionId: suite.versionId,
        environment: "staging",
        provider: "playwright-local",
        matrix: [
          { browserName: "chromium", os: "ubuntu-latest" },
          { browserName: "firefox", os: "ubuntu-latest" }
        ]
      })
    });
    const run = (await response.json()) as ExecutionRun;
    setRuns((current) => [run, ...current]);
    setHealing((current) => [...run.healingProposals, ...current]);
  }

  async function applyHealing(proposalId: string) {
    await fetch(`${apiUrl}/heal-proposals/${proposalId}/apply`, { method: "POST" });
    const healingResponse = await fetch(`${apiUrl}/heal-proposals`);
    setHealing(await healingResponse.json());
  }

  const healingCount = runs.reduce((count, run) => count + run.healingProposals.length, 0);
  const bugCount = runs.reduce((count, run) => count + run.bugDrafts.length, 0);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_32%),linear-gradient(135deg,_#fff7ed,_#f8fafc_45%,_#e2e8f0)] text-ink">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10 flex flex-col gap-4 rounded-[32px] bg-white/75 p-8 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.35em] text-ocean">sonofcotester</p>
              <h1 className="mt-2 font-display text-5xl font-bold">AI testing control plane for browser and mobile quality.</h1>
            </div>
            <div className="rounded-full border border-ink/10 bg-sand px-4 py-2 text-sm font-medium">
              Approval-based healing enabled
            </div>
          </div>
          <p className="max-w-3xl text-lg text-slate-600">
            Generate suites from stories, run them across providers, review healing proposals, and push evidence-rich bugs
            back into delivery workflows.
          </p>
        </header>

        <section className="mb-10 grid gap-4 md:grid-cols-4">
          <StatCard label="Projects" value={String(projects.length)} accent="ocean" />
          <StatCard label="Execution Runs" value={String(runs.length)} accent="ember" />
          <StatCard label="Healing Proposals" value={String(healing.length || healingCount)} accent="ink" />
          <StatCard label="Bug Drafts" value={String(bugCount)} accent="ocean" />
        </section>

        <section className="mb-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] bg-white/80 p-6 shadow-panel backdrop-blur">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold">AI Test Generation</h2>
              <button
                className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
                onClick={() => void runLatestSuite()}
                type="button"
              >
                Run latest suite
              </button>
            </div>
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
                  className="min-h-36 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3"
                  value={sourcePayload}
                  onChange={(event) => setSourcePayload(event.target.value)}
                />
              </label>
              <button className="rounded-full bg-ember px-5 py-3 font-semibold text-white" type="submit">
                Generate canonical suite
              </button>
            </form>
            {lastDraft ? (
              <div className="mt-5 rounded-3xl bg-sand p-5">
                <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Latest draft</p>
                <h3 className="mt-2 font-display text-xl font-semibold">{lastDraft.summary}</h3>
                <p className="mt-2 text-slate-600">{lastDraft.cases[0]?.title}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] bg-white/80 p-6 shadow-panel backdrop-blur">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold">Healing Inbox</h2>
              <span className="text-sm text-slate-500">{healing.length} pending decisions</span>
            </div>
            <div className="space-y-4">
              {healing.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-500">
                  Failed executions will land here with approval-based fix suggestions.
                </div>
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
                    <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                      {proposal.patch}
                    </pre>
                    {proposal.status !== "applied" ? (
                      <button
                        className="mt-3 rounded-full bg-ocean px-4 py-2 text-sm font-semibold text-white"
                        onClick={() => void applyHealing(proposal.id)}
                        type="button"
                      >
                        Apply proposal
                      </button>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] bg-white/80 p-6 shadow-panel backdrop-blur">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold">Workspace Projects</h2>
              <span className="text-sm text-slate-500">Single-workspace team view</span>
            </div>
            <div className="space-y-4">
              {projects.map((project) => (
                <article key={project.id} className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-xl font-semibold">{project.name}</h3>
                      <p className="mt-1 text-slate-600">{project.description}</p>
                    </div>
                    <span className="rounded-full bg-ocean/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-ocean">
                      {project.latestRun?.status ?? "idle"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] bg-ink p-6 text-white shadow-panel">
            <div className="mb-5">
              <h2 className="font-display text-2xl font-semibold">Execution Feed</h2>
              <p className="mt-1 text-sm text-slate-300">Recent runs, healing, and defect drafting</p>
            </div>
            <div className="space-y-4">
              {runs.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-slate-300">
                  Trigger a test generation and execution run from the API to populate the dashboard.
                </div>
              ) : (
                runs.map((run) => (
                  <article key={run.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-display text-lg">{run.provider}</span>
                      <span className="text-sm uppercase tracking-[0.24em] text-amber-300">{run.status}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{run.environment}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      {run.artifacts.length} artifacts, {run.healingProposals.length} healing proposals, {run.bugDrafts.length} bug drafts
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
