import { useEffect, useState } from "react";
import type { ExecutionRun, ProjectSummary } from "@sonofcotester/sdk";
import { StatCard } from "./components/StatCard.js";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [runs, setRuns] = useState<ExecutionRun[]>([]);

  useEffect(() => {
    void Promise.all([
      fetch(`${apiUrl}/projects`).then((res) => res.json()),
      fetch(`${apiUrl}/executions`).then((res) => res.json())
    ]).then(([projectData, runData]) => {
      setProjects(projectData);
      setRuns(runData);
    });
  }, []);

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
          <StatCard label="Healing Proposals" value={String(healingCount)} accent="ink" />
          <StatCard label="Bug Drafts" value={String(bugCount)} accent="ocean" />
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

