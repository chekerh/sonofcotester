import { useState, useId } from "react";
import { Code, Copy, DeviceMobile, Export, FileCode, Lightning, Trash, X } from "@phosphor-icons/react";
import type {
  CanonicalTestCase,
  CanonicalTestStep,
  PersistedSuite,
} from "@sonofcotester/sdk";
import {
  exportSuiteToPlaywright,
  exportSuiteToMaestroYaml,
  exportGitHubActionsWorkflow,
} from "../lib/code-exporter.js";

interface VisualSuiteEditorProps {
  suite: PersistedSuite | null;
  suites?: PersistedSuite[];
  selectedSuiteId?: string;
  onSelectSuiteId?: (id: string) => void;
  targetUrl: string;
  onSave: (cases: CanonicalTestCase[]) => Promise<void>;
  onRun: () => Promise<void>;
  onAddToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

const ACTION_STYLES: Record<CanonicalTestStep["action"], { label: string; color: string }> = {
  navigate: { label: "Navigate", color: "bg-sky-100 text-sky-800 border-sky-200" },
  click: { label: "Click", color: "bg-amber-100 text-amber-800 border-amber-200" },
  fill: { label: "Fill Input", color: "bg-purple-100 text-purple-800 border-purple-200" },
  assertVisible: { label: "Assert Visible", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  assertText: { label: "Assert Text", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
};

export function VisualSuiteEditor({
  suite,
  suites = [],
  selectedSuiteId,
  onSelectSuiteId,
  targetUrl,
  onSave,
  onRun,
  onAddToast,
}: VisualSuiteEditorProps) {
  const initialCases = suite?.versions[0]?.cases ?? [];
  const [cases, setCases] = useState<CanonicalTestCase[]>(initialCases);
  const [isSaving, setIsSaving] = useState(false);
  const [showJsonMode, setShowJsonMode] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTab, setExportTab] = useState<"playwright" | "maestro" | "github" | "json">("playwright");
  const [expandedCases, setExpandedCases] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    initialCases.forEach((c) => {
      map[c.id] = true;
    });
    return map;
  });

  // Keep in sync when suite changes
  if (suite && suite.versions[0]?.cases && suite.versions[0].cases !== cases && !isSaving) {
    // Only update if IDs differ
    const currentIds = cases.map((c) => c.id).join(",");
    const incomingIds = suite.versions[0].cases.map((c) => c.id).join(",");
    if (currentIds !== incomingIds) {
      setCases(suite.versions[0].cases);
    }
  }

  const toggleCaseExpand = (id: string) => {
    setExpandedCases((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUpdateStep = (
    caseId: string,
    stepIndex: number,
    field: keyof CanonicalTestStep,
    value: string
  ) => {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== caseId) return c;
        const newSteps = [...c.steps];
        newSteps[stepIndex] = { ...newSteps[stepIndex], [field]: value };
        return { ...c, steps: newSteps };
      })
    );
  };

  const handleAddStep = (caseId: string) => {
    const newStep: CanonicalTestStep = {
      id: Math.random().toString(36).slice(2, 10),
      action: "click",
      target: "button",
      expectedOutcome: "Click target button",
    };
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== caseId) return c;
        return { ...c, steps: [...c.steps, newStep] };
      })
    );
  };

  const handleDeleteStep = (caseId: string, stepIndex: number) => {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== caseId) return c;
        const newSteps = c.steps.filter((_, idx) => idx !== stepIndex);
        return { ...c, steps: newSteps };
      })
    );
  };

  const handleMoveStep = (caseId: string, stepIndex: number, direction: "up" | "down") => {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== caseId) return c;
        const newSteps = [...c.steps];
        const targetIndex = direction === "up" ? stepIndex - 1 : stepIndex + 1;
        if (targetIndex < 0 || targetIndex >= newSteps.length) return c;
        const temp = newSteps[stepIndex];
        newSteps[stepIndex] = newSteps[targetIndex];
        newSteps[targetIndex] = temp;
        return { ...c, steps: newSteps };
      })
    );
  };

  const handleAddTestCase = () => {
    const newId = Math.random().toString(36).slice(2, 10);
    const newCase: CanonicalTestCase = {
      id: newId,
      title: "New Automated Test Case",
      feature: "Custom Flow",
      priority: "p1",
      platform: "web",
      prerequisites: [`App is accessible at ${targetUrl || "http://localhost:3010"}`],
      tags: ["e2e", "custom"],
      steps: [
        {
          id: Math.random().toString(36).slice(2, 10),
          action: "navigate",
          data: targetUrl || "http://localhost:3010",
          expectedOutcome: `Navigate to ${targetUrl || "http://localhost:3010"}`,
        },
        {
          id: Math.random().toString(36).slice(2, 10),
          action: "assertVisible",
          target: "body",
          expectedOutcome: "Verify page body is rendered",
        },
      ],
    };
    setCases((prev) => [...prev, newCase]);
    setExpandedCases((prev) => ({ ...prev, [newId]: true }));
    onAddToast("Added new test case", "info");
  };

  const handleDeleteCase = (caseId: string) => {
    setCases((prev) => prev.filter((c) => c.id !== caseId));
    onAddToast("Test case removed", "info");
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await onSave(cases);
      onAddToast("Test suite saved successfully!", "success");
    } catch (err) {
      onAddToast(`Failed to save: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    onAddToast(`Copied ${label} to clipboard!`, "success");
  };

  if (!suite) {
    return (
      <div className="rounded-[28px] bg-white/80 p-8 text-center text-slate-500 border border-white/60 shadow-panel backdrop-blur">
        <p className="text-base font-semibold text-slate-700">No Test Suite Selected</p>
        <p className="mt-1 text-xs">Crawl a target app or generate a suite above to start testing.</p>
      </div>
    );
  }

  const playwrightCode = exportSuiteToPlaywright(suite, targetUrl);
  const maestroYaml = exportSuiteToMaestroYaml(suite);
  const githubCiYaml = exportGitHubActionsWorkflow(suite.summary);
  const jsonCode = JSON.stringify(cases, null, 2);

  return (
    <div className="rounded-[28px] bg-white/85 p-6 shadow-panel backdrop-blur border border-white/60">
      {/* Header bar */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-ocean/10 text-ocean px-3 py-0.5 text-xs font-bold uppercase tracking-wider">
              Visual Test Studio
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {cases.length} {cases.length === 1 ? "case" : "cases"} • {cases.reduce((sum, c) => sum + c.steps.length, 0)} steps
            </span>
          </div>
          {suites.length > 1 ? (
            <div className="mt-1 flex items-center gap-2">
              <select
                value={selectedSuiteId || suite.id}
                onChange={(e) => onSelectSuiteId?.(e.target.value)}
                className="font-display text-xl font-bold text-slate-900 bg-transparent border-none cursor-pointer hover:text-ocean transition"
              >
                {suites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.summary} ({s.versions[0]?.cases.length ?? 0} cases)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">
              {suite.summary}
            </h2>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowJsonMode((prev) => !prev)}
            className="rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition flex items-center gap-1.5"
            title="Toggle between Visual Builder and Raw JSON"
          >
            <span>{showJsonMode ? "Visual Builder" : "View JSON"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="rounded-full border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3.5 py-1.5 text-xs font-semibold text-purple-900 shadow-2xs transition flex items-center gap-1.5"
            title="Export executable code in Playwright, Maestro, or CI format"
          >
            <Export size={13} weight="bold" aria-hidden="true" />
            <span>Export Code</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSaveAll()}
            className="rounded-full bg-ocean hover:bg-sky-600 disabled:opacity-50 px-4 py-1.5 text-xs font-semibold text-white shadow-2xs transition"
          >
            {isSaving ? "Saving..." : "Save Suite"}
          </button>

          <button
            type="button"
            onClick={() => void onRun()}
            className="rounded-full bg-slate-900 hover:bg-black px-4 py-1.5 text-xs font-bold text-white shadow-sm transition flex items-center gap-1.5"
          >
            <Lightning size={13} weight="fill" aria-hidden="true" />
            <span>Execute Suite</span>
          </button>
        </div>
      </div>

      {/* Raw JSON Mode */}
      {showJsonMode ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Edit or inspect the underlying canonical JSON specification:</p>
          <textarea
            value={JSON.stringify(cases, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) setCases(parsed);
              } catch {
                // Ignore while typing invalid JSON
              }
            }}
            className="w-full min-h-[420px] rounded-2xl bg-slate-950 p-4 font-mono text-xs text-emerald-400"
          />
        </div>
      ) : (
        /* Visual Studio Mode */
        <div className="space-y-6">
          {cases.map((testCase, caseIdx) => {
            const isExpanded = expandedCases[testCase.id] ?? true;
            return (
              <div
                key={testCase.id}
                className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/60 shadow-xs transition hover:border-slate-300"
              >
                {/* Case Header */}
                <div className="flex items-center justify-between bg-white px-5 py-3.5 border-b border-slate-200/60">
                  <div
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                    onClick={() => toggleCaseExpand(testCase.id)}
                  >
                    <span className="text-slate-500 text-xs transition">
                      {isExpanded ? "▼" : "▶"}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      {testCase.priority.toUpperCase()}
                    </span>
                    <span className="font-semibold text-sm text-slate-900 truncate">
                      {testCase.title}
                    </span>
                    <span className="text-xs text-slate-500 font-normal">
                      ({testCase.steps.length} {testCase.steps.length === 1 ? "step" : "steps"})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddStep(testCase.id)}
                      className="rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition"
                      title="Add step to this test case"
                    >
                      + Add Step
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCase(testCase.id)}
                      className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition"
                      title="Delete test case"
                    >
                      <Trash size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Case Step Cards */}
                {isExpanded && (
                  <div className="p-4 space-y-2.5">
                    {testCase.steps.map((step, stepIdx) => {
                      const meta = ACTION_STYLES[step.action] || ACTION_STYLES.click;
                      return (
                        <div
                          key={step.id || stepIdx}
                          className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:border-slate-300 transition"
                        >
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[11px] font-bold text-slate-500 w-5">
                              #{stepIdx + 1}
                            </span>
                            <select
                              value={step.action}
                              onChange={(e) =>
                                handleUpdateStep(
                                  testCase.id,
                                  stepIdx,
                                  "action",
                                  e.target.value as CanonicalTestStep["action"]
                                )
                              }
                              className={`rounded-lg border px-2.5 py-1 text-xs font-bold cursor-pointer ${meta.color}`}
                            >
                              <option value="navigate">Navigate</option>
                              <option value="click">Click</option>
                              <option value="fill">Fill Input</option>
                              <option value="assertVisible">Assert Visible</option>
                              <option value="assertText">Assert Text</option>
                            </select>
                          </div>

                          {/* Action Parameters */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 min-w-0">
                            {step.action === "navigate" ? (
                              <input
                                type="text"
                                value={step.data || ""}
                                onChange={(e) =>
                                  handleUpdateStep(testCase.id, stepIdx, "data", e.target.value)
                                }
                                placeholder="Target URL (e.g. http://localhost:3010/checkout)"
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-ocean/40"
                              />
                            ) : (
                              <input
                                type="text"
                                value={step.target || ""}
                                onChange={(e) =>
                                  handleUpdateStep(testCase.id, stepIdx, "target", e.target.value)
                                }
                                placeholder="Target Selector (e.g. button[type=submit], #email)"
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-ocean/40"
                              />
                            )}

                            {(step.action === "fill" || step.action === "assertText") && (
                              <input
                                type="text"
                                value={step.data || ""}
                                onChange={(e) =>
                                  handleUpdateStep(testCase.id, stepIdx, "data", e.target.value)
                                }
                                placeholder={step.action === "fill" ? "Value to type..." : "Expected text content..."}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-ocean/40"
                              />
                            )}

                            {step.action !== "fill" && step.action !== "assertText" && (
                              <input
                                type="text"
                                value={step.expectedOutcome || ""}
                                onChange={(e) =>
                                  handleUpdateStep(testCase.id, stepIdx, "expectedOutcome", e.target.value)
                                }
                                placeholder="Expected assertion description..."
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-ocean/40"
                              />
                            )}
                          </div>

                          {/* Step Actions */}
                          <div className="flex items-center gap-1 shrink-0 justify-end">
                            <button
                              type="button"
                              disabled={stepIdx === 0}
                              onClick={() => handleMoveStep(testCase.id, stepIdx, "up")}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 text-xs"
                              title="Move up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              disabled={stepIdx === testCase.steps.length - 1}
                              onClick={() => handleMoveStep(testCase.id, stepIdx, "down")}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 text-xs"
                              title="Move down"
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStep(testCase.id, stepIdx)}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-rose-600 text-xs ml-1"
                              title="Delete step"
                            >
                              <X size={13} weight="bold" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAddTestCase}
            className="w-full rounded-2xl border-2 border-dashed border-slate-300 hover:border-ocean hover:bg-sky-50/50 p-4 text-center text-xs font-bold text-slate-600 hover:text-ocean transition"
          >
            + Add New Test Case Scenario
          </button>
        </div>
      )}

      {/* Code Exporter Modal */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h3 className="font-display text-lg font-bold">Universal Code Exporter</h3>
                <p className="text-xs text-slate-500">Export your test suite as runnable code or CI pipeline configuration.</p>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-800 hover:text-white"
              >
                <X size={15} weight="bold" aria-hidden="true" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800 px-6 pt-3 gap-2">
              <button
                onClick={() => setExportTab("playwright")}
                className={`pb-3 text-xs font-semibold transition border-b-2 ${
                  exportTab === "playwright"
                    ? "border-ocean text-white"
                    : "border-transparent text-slate-500 hover:text-slate-200"
                }`}
              >
                <FileCode size={13} weight="bold" className="inline mr-1" aria-hidden="true" />Playwright (.spec.ts)
              </button>
              <button
                onClick={() => setExportTab("maestro")}
                className={`pb-3 text-xs font-semibold transition border-b-2 ${
                  exportTab === "maestro"
                    ? "border-ocean text-white"
                    : "border-transparent text-slate-500 hover:text-slate-200"
                }`}
              >
                <DeviceMobile size={13} weight="bold" className="inline mr-1" aria-hidden="true" />Maestro (.yaml)
              </button>
              <button
                onClick={() => setExportTab("github")}
                className={`pb-3 text-xs font-semibold transition border-b-2 ${
                  exportTab === "github"
                    ? "border-ocean text-white"
                    : "border-transparent text-slate-500 hover:text-slate-200"
                }`}
              >
                <Lightning size={13} weight="fill" className="inline mr-1" aria-hidden="true" />GitHub Actions CI
              </button>
              <button
                onClick={() => setExportTab("json")}
                className={`pb-3 text-xs font-semibold transition border-b-2 ${
                  exportTab === "json"
                    ? "border-ocean text-white"
                    : "border-transparent text-slate-500 hover:text-slate-200"
                }`}
              >
                <Code size={13} weight="bold" className="inline mr-1" aria-hidden="true" />Canonical JSON
              </button>
            </div>

            <div className="p-6">
              <div className="relative">
                <pre className="max-h-[50vh] overflow-auto rounded-2xl bg-slate-950 p-4 font-mono text-xs text-emerald-400 leading-relaxed border border-slate-800">
                  {exportTab === "playwright"
                    ? playwrightCode
                    : exportTab === "maestro"
                      ? maestroYaml
                      : exportTab === "github"
                        ? githubCiYaml
                        : jsonCode}
                </pre>
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    onClick={() => {
                      const content =
                        exportTab === "playwright"
                          ? playwrightCode
                          : exportTab === "maestro"
                            ? maestroYaml
                            : exportTab === "github"
                              ? githubCiYaml
                              : jsonCode;
                      copyToClipboard(content, exportTab);
                    }}
                    className="rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur px-3 py-1 text-xs font-semibold text-white transition flex items-center gap-1.5"
                  >
                    <Copy size={13} weight="bold" aria-hidden="true" /> Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
