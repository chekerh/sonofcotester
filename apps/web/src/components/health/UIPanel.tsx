import { useState } from "react";
import type { UIHealthSession, UICheck, UIScreenshot } from "@sonofcotester/sdk";
import { HealthScoreRing } from "./HealthScoreRing.js";
import { ArrowRight, CheckCircle, Lightning, MagnifyingGlass, Wheelchair, X } from "@phosphor-icons/react";

const SEVERITY_COLORS: Record<string, string> = {
  pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  fail: "bg-red-50 text-red-700 border-red-200",
  error: "bg-red-100 text-red-800 border-red-300",
};

const SEVERITY_DOTS: Record<string, string> = {
  pass: "bg-emerald-500",
  warning: "bg-amber-500",
  fail: "bg-red-500",
  error: "bg-red-700",
};

const WCAG_COLORS: Record<string, string> = {
  A: "bg-blue-100 text-blue-700",
  AA: "bg-indigo-100 text-indigo-700",
  AAA: "bg-violet-100 text-violet-700",
};

function groupByType(checks: UICheck[]) {
  const groups: Record<string, UICheck[]> = {};
  for (const check of checks) {
    const key = check.type;
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(check);
  }
  return groups;
}

export function UIPanel({ session }: { session: UIHealthSession | null }) {
  const [selectedScreenshot, setSelectedScreenshot] = useState<UIScreenshot | null>(null);

  if (!session) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm text-center">
        <p className="text-slate-500">No UI/UX health scan has been run yet. Click "Run Full Scan" to inspect live pages.</p>
      </div>
    );
  }

  const grouped = groupByType(session.checks);
  const passed = session.checks.filter((c) => c.severity === "pass").length;
  const failed = session.checks.filter((c) => c.severity === "fail").length;
  const warned = session.checks.filter((c) => c.severity === "warning").length;

  return (
    <div className="space-y-6">
      {/* Score Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-6 shadow-sm">
          <HealthScoreRing score={session.score.overall} size={160} />
          <p className="mt-3 text-sm font-medium text-slate-500">UI Health Score</p>
          <span className="mt-1 text-xs text-slate-500">Target: {session.url}</span>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-900">Score Breakdown</h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Accessibility (WCAG)", value: session.score.accessibility, icon: Wheelchair },
              { label: "Performance", value: session.score.performance, icon: Lightning },
              { label: "Best Practices", value: session.score.bestPractices, icon: CheckCircle },
              { label: "SEO", value: session.score.seo, icon: MagnifyingGlass },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-50 p-4 text-center">
                <item.icon size={22} weight="bold" aria-hidden="true" />
                <p className="mt-2 text-2xl font-bold text-slate-900">{item.value}</p>
                <p className="text-xs text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <p className="text-lg font-bold text-emerald-700">{passed}</p>
              <p className="text-xs text-slate-500">Passed</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-center">
              <p className="text-lg font-bold text-amber-600">{warned}</p>
              <p className="text-xs text-slate-500">Warnings</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3 text-center">
              <p className="text-lg font-bold text-red-600">{failed}</p>
              <p className="text-xs text-slate-500">Failed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Live Screenshots from Playwright */}
      {session.screenshots.length > 0 && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Live Screenshots ({session.screenshots.length})</h3>
              <p className="text-xs text-slate-500">Captured in real-time via Playwright across responsive viewports</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {session.screenshots.map((ss) => {
              const isBase64 = ss.url.startsWith("data:image/") || ss.url.startsWith("http");
              return (
                <div
                  key={ss.id}
                  onClick={() => isBase64 && setSelectedScreenshot(ss)}
                  className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-ocean hover:shadow-md ${
                    isBase64 ? "cursor-pointer" : ""
                  }`}
                >
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
                    {isBase64 ? (
                      <img
                        src={ss.url}
                        alt={`${ss.page} - ${ss.viewport}`}
                        className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        {ss.page}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10 flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition bg-black/75 text-white text-xs px-2.5 py-1 rounded-full font-medium shadow-sm">
                        Click to enlarge
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{ss.page}</p>
                      <p className="text-[11px] text-slate-500">{ss.viewport}</p>
                    </div>
                    {ss.diffPercent !== undefined && (
                      <span className={`text-xs font-semibold ${ss.diffPercent > 3 ? "text-red-500" : "text-emerald-600"}`}>
                        {ss.diffPercent}% diff
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Screenshot Lightbox Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h4 className="font-semibold text-slate-900">{selectedScreenshot.page}</h4>
                <p className="text-xs text-slate-500">Viewport: {selectedScreenshot.viewport}</p>
              </div>
              <button
                onClick={() => setSelectedScreenshot(null)}
                aria-label="Close screenshot"
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={15} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <div className="max-h-[calc(90vh-100px)] overflow-auto p-4 bg-slate-950 flex items-center justify-center">
              <img
                src={selectedScreenshot.url}
                alt={`${selectedScreenshot.page} - ${selectedScreenshot.viewport}`}
                className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Grouped Checks */}
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">
          Checks by Category ({session.checks.length} total, {session.pagesScanned} pages)
        </h3>
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, checks]) => (
            <div key={type}>
              <h4 className="mb-2 text-sm font-semibold capitalize text-slate-700">{type.replace(/-/g, " ")}</h4>
              <div className="space-y-2">
                {checks.map((check) => (
                  <div key={check.id} className={`flex items-start gap-3 rounded-xl border p-3 ${SEVERITY_COLORS[check.severity]}`}>
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOTS[check.severity]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{check.description}</p>
                        {check.wcagLevel && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${WCAG_COLORS[check.wcagLevel]}`}>
                            WCAG {check.wcagLevel}
                          </span>
                        )}
                        {check.impact && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            {check.impact}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs opacity-75">{check.page}</p>
                      {check.element && (
                        <p className="mt-1 text-xs font-mono bg-white/60 px-2 py-0.5 rounded inline-block text-slate-800">
                          {check.element}
                        </p>
                      )}
                      {check.recommendation && (
                        <p className="mt-1 flex items-start gap-1.5 text-xs italic opacity-80"><ArrowRight size={13} className="mt-0.5 shrink-0 not-italic" aria-hidden="true" /><span>{check.recommendation}</span></p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
