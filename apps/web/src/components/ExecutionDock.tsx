import React, { useState } from "react";
import type { ExecutionRun } from "@sonofcotester/sdk";
import { ArrowSquareOut, CaretDown, Lightning } from "@phosphor-icons/react";

interface ExecutionDockProps {
  latestRun: ExecutionRun | null;
  onOpenRunDetails: (runId: string) => void;
  onQuickSmoke: () => void;
  onAutoHeal?: (proposalId: string) => void;
}

export function ExecutionDock({
  latestRun,
  onOpenRunDetails,
  onQuickSmoke,
  onAutoHeal
}: ExecutionDockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!latestRun) {
    return null;
  }

  const isRunning = latestRun.status === "running";
  const isPassed = latestRun.status === "passed";
  const isFailed = latestRun.status === "failed";
  const isHealingReq = latestRun.status === "healing-required";

  const totalSteps = latestRun.stepEvents.length;
  const passedSteps = latestRun.stepEvents.filter((s) => s.status === "passed").length;
  const latestStep = latestRun.stepEvents[latestRun.stepEvents.length - 1];

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-md w-full transition-all duration-300">
      <div className="overflow-hidden rounded-2xl bg-slate-900/95 backdrop-blur-md text-white shadow-2xl border border-slate-700/60 transition">
        {/* Main Dock Header */}
        <div className="flex items-center justify-between p-3.5 px-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Status indicator */}
            <div className="relative flex items-center justify-center">
              {isRunning ? (
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-sky-500"></span>
                </span>
              ) : isPassed ? (
                <span className="h-3.5 w-3.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
              ) : isHealingReq ? (
                <span className="h-3.5 w-3.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.7)]" />
              ) : (
                <span className="h-3.5 w-3.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.7)]" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-display uppercase tracking-wider text-slate-300">
                  {latestRun.provider}
                </span>
                <span
                  className={`rounded-full px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                    isPassed
                      ? "bg-emerald-500/20 text-emerald-300"
                      : isRunning
                        ? "bg-sky-500/20 text-sky-300"
                        : isHealingReq
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-rose-500/20 text-rose-300"
                  }`}
                >
                  {latestRun.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                {latestStep ? latestStep.message : `Run: ${latestRun.id}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <button
              onClick={() => onOpenRunDetails(latestRun.id)}
              title="Open full execution stream in Test Console"
              className="rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 text-xs font-semibold text-slate-200 transition inline-flex items-center gap-1"
            >
              Trace
              <ArrowSquareOut size={11} weight="bold" aria-hidden="true" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="rounded-lg bg-white/10 hover:bg-white/20 p-1 text-xs text-slate-300 transition"
              title={isExpanded ? "Collapse" : "Expand telemetry"}
            >
              <CaretDown size={12} weight="bold" className={isExpanded ? "rotate-180" : ""} aria-hidden="true" />
              <span className="sr-only">{isExpanded ? "Collapse telemetry" : "Expand telemetry"}</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {totalSteps > 0 && (
          <div className="h-1 w-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isPassed ? "bg-emerald-500" : isFailed ? "bg-rose-500" : "bg-sky-500"
              }`}
              style={{ width: `${Math.min(100, (passedSteps / (totalSteps || 1)) * 100)}%` }}
            />
          </div>
        )}

        {/* Expanded Telemetry Drawer */}
        {isExpanded && (
          <div className="border-t border-slate-800 p-4 space-y-3 bg-slate-950/80 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Steps Executed: <strong className="text-white">{passedSteps} / {totalSteps}</strong></span>
              <span>Artifacts: <strong className="text-white">{latestRun.artifacts.length}</strong></span>
            </div>

            {latestRun.errorMessage && (
              <div className="rounded-xl bg-rose-950/50 border border-rose-800/40 p-2.5 text-xs text-rose-200 font-mono">
                {latestRun.errorMessage}
              </div>
            )}

            {/* Step list */}
            <div className="space-y-1">
              {latestRun.stepEvents.slice(-4).map((step) => (
                <div key={step.id} className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-white/5">
                  <span className="text-slate-300 truncate max-w-[280px]">{step.message}</span>
                  <span
                    className={`font-mono text-[9px] uppercase font-bold ${
                      step.status === "passed" ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {step.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Quick Actions in dock */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <button
                onClick={onQuickSmoke}
                className="text-xs font-semibold text-sky-400 hover:underline flex items-center gap-1"
              >
                <Lightning size={12} weight="fill" aria-hidden="true" /> Re-run Quick Smoke
              </button>

              {latestRun.healingProposals.length > 0 && latestRun.healingProposals[0] && onAutoHeal && (
                <button
                  onClick={() => onAutoHeal(latestRun.healingProposals[0]!.id)}
                  className="rounded-full bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-sm transition"
                >
                  <Lightning size={12} weight="fill" className="mr-1 inline" aria-hidden="true" />Auto-Apply Healing
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
