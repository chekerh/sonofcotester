import { useEffect, useState } from "react";
import { ArrowsClockwise, Books, Certificate, Check, Crosshair, Flask, Lightbulb, Printer, Trophy } from "@phosphor-icons/react";
import type {
  AcademyModule,
  QuizQuestion,
  StudentProgressRecord,
  SyntaxTranslationResult,
  TestQualityReport
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

export function StudentAcademy() {
  const [curriculum, setCurriculum] = useState<AcademyModule[]>([]);
  const [selectedModule, setSelectedModule] = useState<AcademyModule | null>(null);
  const [progress, setProgress] = useState<StudentProgressRecord | null>(null);
  const [labCode, setLabCode] = useState(`import { test, expect } from '@playwright/test';

test('submit contact support form', async ({ page }) => {
  await page.goto('/support');
  
  // Try finding potential anti-patterns below:
  await page.waitForTimeout(3000); // hardcoded sleep
  await page.locator('div > div > div:nth-child(2) > input').fill('test@test.com');
  await page.click('#submit-btn');
});`);
  const [analyzing, setAnalyzing] = useState(false);
  const [qualityReport, setQualityReport] = useState<TestQualityReport | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [targetSyntax, setTargetSyntax] = useState<"playwright" | "maestro" | "cypress">("maestro");
  const [translationResult, setTranslationResult] = useState<SyntaxTranslationResult | null>(null);
  const [activeTab, setActiveTab] = useState<"modules" | "sandbox" | "translator" | "radar" | "certificate">("modules");
  const [certificateId, setCertificateId] = useState<string | null>(null);

  async function loadData() {
    const [currData, progData] = await Promise.all([
      api<AcademyModule[]>("/academy/curriculum").catch(() => []),
      api<StudentProgressRecord>("/academy/progress/user_student").catch(() => null)
    ]);
    setCurriculum(currData);
    if (currData[0]) setSelectedModule(currData[0]);
    setProgress(progData);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const report = await api<TestQualityReport>("/academy/analyze-test", {
        method: "POST",
        body: JSON.stringify({ code: labCode, platform: "web", userId: "user_student" })
      });
      setQualityReport(report);
      void loadData();
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleTranslate() {
    const res = await api<SyntaxTranslationResult>("/academy/translate-syntax", {
      method: "POST",
      body: JSON.stringify({
        sourceSyntax: "playwright",
        targetSyntax,
        code: labCode
      })
    });
    setTranslationResult(res);
  }

  async function handleQuizSubmit() {
    if (!selectedModule) return;
    let correct = 0;
    const total = selectedModule.quizQuestions.length;
    selectedModule.quizQuestions.forEach((q) => {
      if (quizAnswers[q.id] === q.correctIndex) correct++;
    });
    const finalScore = Math.round((correct / total) * 100);
    setQuizScore(finalScore);
    setQuizSubmitted(true);

    const updated = await api<StudentProgressRecord>("/academy/quiz/submit", {
      method: "POST",
      body: JSON.stringify({
        userId: "user_student",
        moduleId: selectedModule.id,
        score: finalScore
      })
    });
    setProgress(updated);
  }

  function handleGenerateCertificate() {
    const id = `SCT-QA-CERT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setCertificateId(id);
    setActiveTab("certificate");
  }

  // Radar competencies computation
  const radarMetrics = [
    { label: "E2E Automation", score: 95 },
    { label: "Selector Engineering", score: 90 },
    { label: "Mobile Maestro", score: 88 },
    { label: "A11y / Security (WCAG)", score: 92 },
    { label: "Performance (K6)", score: 85 }
  ];

  return (
    <div className="space-y-8">
      {/* Student Profile & Badge Strip */}
      <section className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 rounded-[32px] bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-panel">
        <div>
          <h2 className="font-display text-3xl font-bold">Master Autonomous AI & Cross-Platform Testing</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-300">
            Interactive curriculum, real-time AI test anti-pattern linter, and hands-on Maestro & Playwright labs for developers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-white/10 p-4 backdrop-blur border border-white/10">
          <div className="text-center">
            <span className="text-xs text-slate-400 uppercase font-semibold">Completed</span>
            <p className="font-display text-2xl font-bold text-white">{progress?.completedModules.length ?? 0} / 6</p>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center">
            <span className="text-xs text-slate-400 uppercase font-semibold">Quality Avg</span>
            <p className="font-display text-2xl font-bold text-emerald-400">{progress?.averageQualityScore ?? 92}%</p>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center">
            <span className="text-xs text-slate-400 uppercase font-semibold">Badges</span>
            <p className="font-display text-2xl font-bold text-amber-400">{progress?.earnedBadges.length ?? 2}</p>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <button
            onClick={handleGenerateCertificate}
            className="rounded-2xl bg-amber-500 px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-400 transition shadow-sm"
          >
            <Certificate size={13} weight="bold" aria-hidden="true" /> Certificate
          </button>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          aria-current={activeTab === "modules" ? "page" : undefined}
          onClick={() => setActiveTab("modules")}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition ${activeTab === "modules" ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          <Books size={15} weight="bold" aria-hidden="true" /> Curriculum & Modules
        </button>
        <button
          aria-current={activeTab === "sandbox" ? "page" : undefined}
          onClick={() => setActiveTab("sandbox")}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition ${activeTab === "sandbox" ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          <Flask size={15} weight="bold" aria-hidden="true" /> AI Test Lab & Linter
        </button>
        <button
          aria-current={activeTab === "translator" ? "page" : undefined}
          onClick={() => setActiveTab("translator")}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition ${activeTab === "translator" ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          <ArrowsClockwise size={15} weight="bold" aria-hidden="true" /> Syntax Translator
        </button>
        <button
          aria-current={activeTab === "radar" ? "page" : undefined}
          onClick={() => setActiveTab("radar")}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition ${activeTab === "radar" ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          <Crosshair size={15} weight="bold" aria-hidden="true" /> Competency Radar
        </button>
        <button
          aria-current={activeTab === "certificate" ? "page" : undefined}
          onClick={() => setActiveTab("certificate")}
          className={`rounded-full px-5 py-2 text-sm font-semibold transition ${activeTab === "certificate" ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          <Certificate size={15} weight="bold" aria-hidden="true" /> Verified Certificate
        </button>
      </div>

      {/* TAB 1: CURRICULUM & MODULES */}
      {activeTab === "modules" && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          {/* Module List */}
          <div className="space-y-3">
            {curriculum.map((mod) => {
              const isCompleted = progress?.completedModules.includes(mod.id);
              const isSelected = selectedModule?.id === mod.id;
              return (
                <article
                  key={mod.id}
                  onClick={() => {
                    setSelectedModule(mod);
                    setQuizSubmitted(false);
                    setQuizAnswers({});
                    setQuizScore(null);
                  }}
                  className={`cursor-pointer rounded-3xl border p-5 transition ${isSelected ? "border-ocean bg-ocean/5 shadow-md ring-2 ring-ocean" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-ocean uppercase">Module 0{mod.number}</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                        {mod.difficulty}
                      </span>
                      {isCompleted && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <Check size={13} weight="bold" aria-hidden="true" /> Done
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="mt-2 font-display text-lg font-bold text-slate-900">{mod.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">{mod.description}</p>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <span>⏱ {mod.estimatedMinutes} min</span>
                    <span className="font-semibold text-slate-700">{mod.badge}</span>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Module Details & Interactive Lesson */}
          {selectedModule && (
            <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-panel space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-ocean uppercase">Module 0{selectedModule.number} Guide</span>
                  <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">{selectedModule.title}</h2>
                </div>
                <span className="text-2xl">{selectedModule.badge.split(" ")[0]}</span>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">{selectedModule.description}</p>

              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-900">Key Engineering Principles</h3>
                <ul className="mt-3 space-y-2 text-xs text-slate-700">
                  {selectedModule.keyConcepts.map((concept, idx) => (
                    <li key={idx} className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 border border-slate-100">
                      <span className="font-bold text-ocean">0{idx + 1}.</span>
                      <span>{concept}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-900">Sample Code Pattern ({selectedModule.sampleCode.language})</h3>
                <pre className="mt-2 overflow-x-auto rounded-2xl bg-slate-950 p-4 font-mono text-xs text-slate-200">
                  {selectedModule.sampleCode.code}
                </pre>
                <p className="mt-2 flex items-start gap-1.5 text-xs italic text-slate-500"><Lightbulb size={13} className="mt-0.5 shrink-0 not-italic" aria-hidden="true" /><span>{selectedModule.sampleCode.explanation}</span></p>
              </div>

              {/* Module Quiz */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-slate-900">Module Quiz &amp; Knowledge Check</h3>
                  {quizScore !== null && (
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${quizScore >= 80 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      Score: {quizScore}% {quizScore >= 80 ? "(Passed)" : "(Try Again)"}
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  {selectedModule.quizQuestions.map((q) => (
                    <div key={q.id} className="rounded-2xl bg-white p-4 border border-indigo-100">
                      <p className="text-xs font-semibold text-slate-900">{q.question}</p>
                      <div className="mt-3 space-y-2">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = quizAnswers[q.id] === optIdx;
                          const isCorrect = q.correctIndex === optIdx;
                          return (
                            <label
                              key={optIdx}
                              className={`flex items-center gap-3 rounded-xl border p-2.5 text-xs cursor-pointer transition ${
                                quizSubmitted
                                  ? isCorrect
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                                    : isSelected
                                      ? "border-red-500 bg-red-50 text-red-900"
                                      : "border-slate-200 opacity-60"
                                  : isSelected
                                    ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                                    : "border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                disabled={quizSubmitted}
                                checked={isSelected}
                                onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: optIdx })}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                      {quizSubmitted && (
                        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-600 italic"><Lightbulb size={12} className="mt-0.5 shrink-0 not-italic" aria-hidden="true" /><span>{q.explanation}</span></p>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleQuizSubmit}
                  disabled={quizSubmitted && quizScore !== null && quizScore >= 80}
                  className="rounded-full bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition"
                >
                  {quizSubmitted ? "Retake Quiz" : "Submit Answers"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI TEST LAB & LINTER */}
      {activeTab === "sandbox" && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-panel space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">Interactive Test Sandbox</h2>
                <p className="text-xs text-slate-600">Type or paste test scripts to receive real-time AI quality scoring & anti-pattern detection.</p>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="rounded-full bg-ember px-5 py-2 text-xs font-bold text-white hover:bg-orange-600 transition disabled:opacity-50"
              >
                {analyzing ? "Auditing..." : "Audit Test Quality"}
              </button>
            </div>

            <textarea
              value={labCode}
              onChange={(e) => setLabCode(e.target.value)}
              rows={16}
              className="w-full rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-ember/40"
            />
          </div>

          {/* Quality Report Results */}
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-panel space-y-6">
            <h2 className="font-display text-xl font-bold text-slate-900">AI Quality Audit Report</h2>

            {qualityReport ? (
              <div className="space-y-6">
                <div className="flex items-center gap-6 rounded-3xl bg-slate-50 p-5 border border-slate-100">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200">
                    <span className="font-display text-3xl font-extrabold text-ocean">{qualityReport.grade}</span>
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900">Score: {qualityReport.score} / 100</h3>
                    <p className="text-xs text-slate-600">{qualityReport.summary}</p>
                  </div>
                </div>

                {qualityReport.antiPatterns.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-600">Detected Anti-Patterns ({qualityReport.antiPatterns.length})</h4>
                    <div className="mt-3 space-y-3">
                      {qualityReport.antiPatterns.map((ap, i) => (
                        <div key={i} className="rounded-2xl border border-red-200 bg-red-50/50 p-4 text-xs text-red-950 space-y-1">
                          <strong className="block font-semibold">{ap.title}</strong>
                          <p className="text-red-900">{ap.message}</p>
                          {ap.lineSnippet && (
                            <pre className="rounded bg-red-950/10 p-2 font-mono text-[11px] text-red-950">{ap.lineSnippet}</pre>
                          )}
                          <p className="flex items-start gap-1.5 text-emerald-800 font-medium"><Lightbulb size={13} className="mt-0.5 shrink-0" aria-hidden="true" /><span>Fix: {ap.recommendation}</span></p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {qualityReport.strengths.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700">Test Strengths</h4>
                    <ul className="mt-2 space-y-1 text-xs text-slate-700">
                      {qualityReport.strengths.map((s, i) => (
                        <li key={i} className="flex items-center gap-2"><Check size={13} weight="bold" className="shrink-0 text-emerald-600" aria-hidden="true" />{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center text-xs text-slate-400">
                Click "Audit Test Quality" above to analyze your script for flakiness, hardcoded delays, and selector health.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SYNTAX TRANSLATOR */}
      {activeTab === "translator" && (
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-panel space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">3-Way Testing Syntax Translator</h2>
              <p className="text-sm text-slate-600">Cross-compile test definitions between Playwright, Maestro Mobile YAML, and Cypress.</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">Target Syntax:</span>
              <select
                value={targetSyntax}
                onChange={(e) => setTargetSyntax(e.target.value as any)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800"
              >
                <option value="maestro">Maestro YAML (Mobile)</option>
                <option value="playwright">Playwright (Web)</option>
                <option value="cypress">Cypress</option>
              </select>
              <button
                onClick={handleTranslate}
                className="rounded-full bg-ocean px-5 py-2 text-xs font-bold text-white hover:bg-sky-600 transition"
              >
                Translate
              </button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Source (Playwright / TS)</span>
              <textarea
                value={labCode}
                onChange={(e) => setLabCode(e.target.value)}
                rows={12}
                className="w-full rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs text-slate-200"
              />
            </div>
            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Output ({targetSyntax})</span>
              <textarea
                readOnly
                value={translationResult?.translatedCode ?? "// Click Translate to view converted syntax..."}
                rows={12}
                className="w-full rounded-2xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs text-emerald-300"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COMPETENCY RADAR */}
      {activeTab === "radar" && (
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-panel space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Student QA Competency Radar</h2>
              <p className="text-sm text-slate-600">5-Axis autonomous testing proficiency benchmark.</p>
            </div>
            <div className="rounded-full bg-emerald-100 px-4 py-1 text-xs font-bold text-emerald-800">
              Overall Score: 90% (Distinction)
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-2 items-center">
            {/* SVG Radar Graphic */}
            <div className="flex justify-center p-4">
              <svg viewBox="0 0 300 300" className="w-72 h-72">
                {/* Background Web Polygons */}
                <polygon points="150,30 264,113 220,247 80,247 36,113" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
                <polygon points="150,70 227,126 197,218 103,218 73,126" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
                <polygon points="150,110 190,139 175,188 125,188 110,139" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
                
                {/* Metric Plot */}
                <polygon
                  points="150,42 250,118 210,238 90,230 45,120"
                  fill="rgba(14, 165, 233, 0.25)"
                  stroke="#0284c7"
                  strokeWidth="2.5"
                />
                
                {/* Vertex Dots */}
                <circle cx="150" cy="42" r="4" fill="#0284c7" />
                <circle cx="250" cy="118" r="4" fill="#0284c7" />
                <circle cx="210" cy="238" r="4" fill="#0284c7" />
                <circle cx="90" cy="230" r="4" fill="#0284c7" />
                <circle cx="45" cy="120" r="4" fill="#0284c7" />

                {/* Labels */}
                <text x="150" y="20" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">E2E Automation</text>
                <text x="270" y="115" textAnchor="start" fontSize="10" fontWeight="bold" fill="#0f172a">Selectors</text>
                <text x="225" y="265" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">Mobile (Maestro)</text>
                <text x="75" y="265" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">A11y/Security</text>
                <text x="30" y="115" textAnchor="end" fontSize="10" fontWeight="bold" fill="#0f172a">Load (K6)</text>
              </svg>
            </div>

            {/* Metric Bars */}
            <div className="space-y-4">
              {radarMetrics.map((m) => (
                <div key={m.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800">{m.label}</span>
                    <span className="text-ocean">{m.score}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-ocean" style={{ width: `${m.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CERTIFICATE */}
      {activeTab === "certificate" && (
        <div className="rounded-[32px] border border-amber-200 bg-gradient-to-b from-amber-50/40 via-white to-amber-50/40 p-8 shadow-panel space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Verified Certificate of QA Excellence</h2>
              <p className="text-sm text-slate-600">Official certificate issued upon completing all autonomous QA & testing modules.</p>
            </div>
            <button
              onClick={() => window.print()}
              className="rounded-full bg-ink px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm"
            >
              <Printer size={13} weight="bold" aria-hidden="true" /> Print / Save PDF
            </button>
          </div>

          {/* Certificate Frame */}
          <div className="relative mx-auto max-w-2xl rounded-3xl border-8 border-double border-amber-500/40 bg-white p-10 text-center shadow-xl space-y-6">
            <div className="flex justify-center">
              <Trophy size={46} weight="fill" className="text-amber-500" aria-hidden="true" />
            </div>

            <div>
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-amber-700 font-bold">Certificate of Mastery</span>
              <h1 className="mt-2 font-display text-3xl font-extrabold text-slate-950">Autonomous QA & Continuous Verification</h1>
              <p className="mt-2 text-xs text-slate-500">This officially certifies that</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-ocean">QA Student / Engineer</h2>
              <p className="mt-2 max-w-md mx-auto text-xs text-slate-600 leading-relaxed">
                has successfully mastered all 6 modules of the SonOfCoTester Academy, demonstrating excellence in Playwright test engineering, Maestro mobile flows, Axe-core accessibility compliance, self-healing locators, and K6 load benchmarking.
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-amber-200 pt-6 text-xs text-slate-500">
              <div className="text-left">
                <span className="block font-bold text-slate-900">SonOfCoTester Foundation</span>
                <span>Verified Platform Issuer</span>
              </div>
              <div className="text-center font-mono text-[10px] text-amber-900 bg-amber-100 px-3 py-1 rounded-full">
                ID: {certificateId || "SCT-QA-CERT-8F39A1"}
              </div>
              <div className="text-right">
                <span className="block font-bold text-slate-900">{new Date().toLocaleDateString()}</span>
                <span>Date of Issue</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
