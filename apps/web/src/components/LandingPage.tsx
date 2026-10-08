import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Lightning, Minus, Plus } from "@phosphor-icons/react";

interface LandingPageProps {
  onLaunch: () => void;
}

type Currency = "USD" | "EUR" | "GBP" | "JPY";

interface PricePlan {
  name: string;
  badge?: string;
  popular?: boolean;
  desc: string;
  priceMonthly: Record<Currency, string>;
  priceAnnual: Record<Currency, string>;
  runs: string;
  features: string[];
  cta: string;
}

const currencySymbols: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥"
};

const pricingPlans: PricePlan[] = [
  {
    name: "Student & OSS",
    badge: "Community",
    desc: "Free forever for students, educators, and open-source contributors.",
    priceMonthly: { USD: "0", EUR: "0", GBP: "0", JPY: "0" },
    priceAnnual: { USD: "0", EUR: "0", GBP: "0", JPY: "0" },
    runs: "50 runs / mo",
    features: [
      "Student Testing Academy access",
      "Playwright Local web runner",
      "Interactive Quiz & Linter",
      "Community Discord & Forum",
      "Verified Certificate of Mastery"
    ],
    cta: "Start Free Academy"
  },
  {
    name: "Pro",
    badge: "Solo & Fast Teams",
    popular: true,
    desc: "Autonomous self-healing testing for growing software squads.",
    priceMonthly: { USD: "29", EUR: "27", GBP: "23", JPY: "4,200" },
    priceAnnual: { USD: "23", EUR: "21", GBP: "18", JPY: "3,300" },
    runs: "2,500 runs / mo",
    features: [
      "Playwright & Maestro Declarative YAML",
      "Visual + DOM Self-Healing Engine",
      "Up to 10 team seats",
      "GitHub Actions & CI Webhooks",
      "Headless API keys (sct_live_...)",
      "Standard email support"
    ],
    cta: "Start 14-Day Free Pro"
  },
  {
    name: "Team",
    badge: "Production Ready",
    desc: "Multi-platform concurrency with 5-dimension health monitoring.",
    priceMonthly: { USD: "99", EUR: "92", GBP: "79", JPY: "14,500" },
    priceAnnual: { USD: "79", EUR: "73", GBP: "63", JPY: "11,600" },
    runs: "10,000 runs / mo",
    features: [
      "Parallel browser & device grid (8x)",
      "5-Dimension Health (Security, UI, DB, APM, Tests)",
      "Jira Bi-Directional Issue Sync",
      "Real-time Audit Trail CSV Export",
      "PagerDuty & Slack Alert Escalations",
      "Priority SLA support"
    ],
    cta: "Launch Team Plan"
  },
  {
    name: "Enterprise",
    badge: "Global Scale",
    desc: "Dedicated infrastructure, air-gapped runners, and bespoke SLAs.",
    priceMonthly: { USD: "499", EUR: "465", GBP: "399", JPY: "72,000" },
    priceAnnual: { USD: "399", EUR: "370", GBP: "319", JPY: "58,000" },
    runs: "Unlimited runs",
    features: [
      "Dedicated Private VPC Runners",
      "SAML / Okta / Azure AD SSO",
      "SOC 2 Type II & HIPAA Compliance Package",
      "Prometheus & Grafana APM Scraper",
      "Custom Test Generation AI Models",
      "24/7 Dedicated Support Engineer"
    ],
    cta: "Contact Enterprise Sales"
  }
];

const simulationScenarios = [
  {
    id: "web-checkout",
    name: "E-Commerce Checkout (Playwright)",
    target: "Web · Chrome / Safari",
    steps: [
      { text: "Navigate to storefront checkout & select payment method", duration: "120ms", status: "ok" },
      { text: "Simulate cart discount application and tax recalculation", duration: "85ms", status: "ok" },
      { text: "Submit order with tokenized Stripe card payload", duration: "240ms", status: "healed", note: "Button selector shifted from #pay-btn to button[data-role=submit] (Remapped automatically)" },
      { text: "Verify receipt modal renders and confirmation email queued", duration: "90ms", status: "ok" }
    ]
  },
  {
    id: "mobile-maestro",
    name: "Biometric Login Flow (Maestro Mobile)",
    target: "Mobile · iOS / Android",
    steps: [
      { text: "Launch native bundle and bypass splash screen", duration: "310ms", status: "ok" },
      { text: "Invoke FaceID mock authentication trigger", duration: "180ms", status: "ok" },
      { text: "Assert push notification permission dialog handled", duration: "95ms", status: "ok" },
      { text: "Verify dashboard home view loaded with biometric token", duration: "140ms", status: "ok" }
    ]
  },
  {
    id: "a11y-audit",
    name: "WCAG 2.2 AA Accessibility & APM Scan",
    target: "Engine · Axe-core + K6",
    steps: [
      { text: "Analyze color contrast ratios across dark/light palettes", duration: "45ms", status: "ok" },
      { text: "Validate screen-reader ARIA traits and keyboard tab traps", duration: "60ms", status: "ok" },
      { text: "Run 50 virtual user concurrent stress latency benchmark", duration: "420ms", status: "ok" },
      { text: "Compile 5-dimension health report & pass readiness gate", duration: "50ms", status: "ok" }
    ]
  }
];

const testimonials = [
  {
    quote: "Son of CoTester eliminated 91% of our flaky test investigations. The visual self-healing pays for itself every single sprint.",
    author: "Elena Rostova",
    role: "VP of Engineering at FinScale Global (Berlin)"
  },
  {
    quote: "Generating declarative Maestro YAML for both Android and iOS saved us from maintaining two fragile Appium codebases.",
    author: "Kenji Sato",
    role: "Principal Mobile Architect at Monolith Pay (Tokyo)"
  },
  {
    quote: "The 5-dimension health monitor caught a silent database index failure before our Black Friday traffic spike.",
    author: "Marcus Vance",
    role: "Lead SRE at CartCraft (San Francisco)"
  }
];

const faqs = [
  {
    q: "How does the AI self-healing engine work?",
    a: "When a DOM element changes during deployment (class names, layout reshuffling, or new wrappers), Son of CoTester compares visual bounding boxes, accessibility tree semantics, and textual intent to generate a repaired locator proposal with a confidence score. You can auto-apply high-confidence proposals or review them in the inbox."
  },
  {
    q: "Can I run Son of CoTester completely offline or locally?",
    a: "Yes! Son of CoTester has zero required external cloud dependencies. You can run Playwright and Maestro locally on your machine, persist to Dockerized Postgres/Redis, or use the built-in standalone fallback store."
  },
  {
    q: "What platforms and browsers are supported?",
    a: "We support desktop and mobile web (Chromium, Firefox, WebKit), native mobile via Maestro (Android, iOS emulators and physical devices), and BrowserStack cloud device farms."
  },
  {
    q: "Is there educational access for universities and bootcamps?",
    a: "Yes! Our Student Testing Academy is free worldwide and includes 6 interactive curriculum modules, an AI test quality linter, a 3-way syntax translator, and verifiable Certificates of Mastery."
  }
];

const proofItems = [
  { label: "Generate", detail: "Intent becomes executable coverage" },
  { label: "Execute", detail: "Real browsers. Real devices. Live evidence." },
  { label: "Self-heal", detail: "UI changed. Test repaired. You approve." }
];

export function LandingPage({ onLaunch }: LandingPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const simIntervalRef = useRef<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(true);

  // Pricing state
  const [currency, setCurrency] = useState<Currency>("USD");
  const [annualBilling, setAnnualBilling] = useState(true);

  // Simulation state
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0);
  const [simRunning, setSimRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(4); // default all done

  // FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const scenario = simulationScenarios[selectedScenarioIndex];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => setMotionEnabled(!mediaQuery.matches);

    syncMotionPreference();
    mediaQuery.addEventListener("change", syncMotionPreference);
    return () => mediaQuery.removeEventListener("change", syncMotionPreference);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (motionEnabled) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [motionEnabled]);

  function replaySequence() {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
    setMotionEnabled(true);
    void video.play().catch(() => undefined);
  }

  useEffect(() => {
    return () => {
      if (simIntervalRef.current !== null) {
        window.clearInterval(simIntervalRef.current);
      }
    };
  }, []);

  function runSimulation() {
    if (simRunning) return;
    setSimRunning(true);
    setActiveStep(0);

    let step = 0;
    const interval = window.setInterval(() => {
      step++;
      if (step >= scenario.steps.length) {
        window.clearInterval(interval);
        simIntervalRef.current = null;
        setSimRunning(false);
        setActiveStep(scenario.steps.length);
      } else {
        setActiveStep(step);
      }
    }, 600);
    simIntervalRef.current = interval;
  }

  return (
    <div className={`landing ${menuOpen ? "landing--menu-open" : ""}`}>
      {/* Background cinematic media */}
      <div className="landing__media" aria-hidden="true">
        <video
          ref={videoRef}
          className="landing__video"
          autoPlay
          muted
          loop
          playsInline
          poster="/hero-sequence/cinematic-frame-01.png"
        >
          <source src="/hero-sequence/sonofcotester-cinematic.webm" type="video/webm" />
          <source src="/hero-sequence/sonofcotester-cinematic.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="landing__technical-grid" aria-hidden="true" />

      <div className="landing__page">
        {/* Navigation Header */}
        <header className="landing__header">
          <a className="landing__logo landing__appear landing__appear--one" href="#top" aria-label="Son of CoTester home">
            <span className="landing__mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" role="img">
                <circle className="landing__mark-orbit" cx="16" cy="16" r="11.5" />
                <path d="M7.5 16h17" />
                <circle className="landing__mark-core" cx="16" cy="16" r="3.25" />
                <circle className="landing__mark-node" cx="25.5" cy="9.5" r="1.7" />
              </svg>
            </span>
            <span className="landing__wordmark">
              son of co<span>tester</span>
            </span>
          </a>

          <nav className="landing__nav" aria-label="Primary navigation">
            <a href="#simulator" onClick={() => setMenuOpen(false)} className="landing__nav-link text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-white transition">
              Simulator
            </a>
            <a href="#pricing" onClick={() => setMenuOpen(false)} className="landing__nav-link text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-white transition">
              Pricing
            </a>
            <a href="#compliance" onClick={() => setMenuOpen(false)} className="landing__nav-link text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-white transition">
              Enterprise
            </a>
            <a href="#faq" onClick={() => setMenuOpen(false)} className="landing__nav-link text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-white transition">
              FAQ
            </a>
            <button
              className="landing__nav-link landing__nav-link--launch"
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onLaunch();
              }}
            >
              Launch Console
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button className="landing__header-cta landing__appear landing__appear--two" type="button" onClick={onLaunch}>
              Launch Console
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" /></svg>
            </button>

            <button
              className="landing__menu-toggle"
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
            >
              <span />
              <span />
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <main className="landing__hero" id="top">
          <div className="landing__copy">
            <h1 className="landing__headline">
              <span className="landing__headline-line"><span>Your QA team just got</span></span>
              <span className="landing__headline-line landing__headline-line--accent"><span>an unfair advantage.</span></span>
            </h1>

            <p className="landing__lede landing__appear landing__appear--four">
              Son of CoTester turns product intent into resilient web and mobile tests, runs every path, and repairs broken flows before they slow your release.
            </p>

            <div className="landing__actions landing__appear landing__appear--five">
              <button className="landing__button landing__button--primary" type="button" onClick={onLaunch}>
                Launch Console
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" /></svg>
              </button>
              <button className="landing__button landing__button--replay" type="button" onClick={replaySequence}>
                <span className="landing__replay-icon" aria-hidden="true">
                  <svg viewBox="0 0 18 18"><path d="M14.3 6.2A6 6 0 1 0 15 9M14.3 6.2V2.7m0 3.5h-3.5" /></svg>
                </span>
                Replay agent run
              </button>
            </div>
          </div>

          <aside className="landing__telemetry landing__appear landing__appear--seven" aria-label="Example run summary">
            <div className="landing__telemetry-head">
              <span className="landing__live"><i /> SAMPLE RUN</span>
              <span>EXAMPLE</span>
            </div>
            <div className="landing__telemetry-score">
              <div><strong>48</strong><span>/ 48 paths</span></div>
              <span className="landing__telemetry-state">1 healed</span>
            </div>
            <div className="landing__progress"><span /></div>
            <div className="landing__event landing__event--alert">
              <span>09:41:16</span><strong>DOM shift detected</strong><i>!</i>
            </div>
            <div className="landing__event">
              <span>09:41:17</span><strong>Selector remapped</strong><i>OK</i>
            </div>
            <div className="landing__event">
              <span>09:41:18</span><strong>Evidence captured</strong><i>OK</i>
            </div>
            <p className="landing__telemetry-note">Illustrative example, not a live run.</p>
          </aside>
        </main>

        {/* Proof Items Banner */}
        <div className="landing__proof" id="proof">
          {proofItems.map((item, index) => (
            <button
              className="landing__proof-item landing__appear"
              style={{ "--delay": `${660 + index * 80}ms` } as CSSProperties}
              type="button"
              onClick={onLaunch}
              key={item.label}
            >
              <span className="landing__proof-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
              <span className="landing__proof-arrow" aria-hidden="true">+</span>
            </button>
          ))}
        </div>

        {/* Interactive Live Testing Sandbox / Simulator */}
        <section id="simulator" className="mx-auto max-w-7xl px-6 py-16">
          <div className="rounded-[36px] border border-white/10 bg-slate-950/80 p-8 md:p-12 shadow-2xl backdrop-blur">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/10">
              <div>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-white">Experience Autonomous Verification in Real-Time</h2>
                <p className="mt-2 text-sm text-slate-400 max-w-2xl">
                  Select a live execution flow below to observe Son of CoTester generate, execute, and self-heal in under 1 second.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {simulationScenarios.map((s, idx) => (
                  <button
                    key={s.id}
                    aria-pressed={selectedScenarioIndex === idx}
                    onClick={() => {
                      setSelectedScenarioIndex(idx);
                      setActiveStep(s.steps.length);
                    }}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      selectedScenarioIndex === idx
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                        : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {s.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-start">
              {/* Step Sequence Display */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                    Target: <strong className="text-white">{scenario.target}</strong>
                  </span>
                  <button
                    onClick={runSimulation}
                    disabled={simRunning}
                    className="inline-flex items-center gap-2 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-5 py-2 text-xs font-bold text-white transition shadow-md"
                  >
                    <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    {simRunning ? "Executing Flow..." : "Run Live Simulation"}
                  </button>
                </div>

                <div className="space-y-3">
                  {scenario.steps.map((st, sIdx) => {
                    const isDone = activeStep > sIdx;
                    const isCurrent = activeStep === sIdx && simRunning;
                    return (
                      <div
                        key={st.text}
                        className={`rounded-2xl border p-4 transition-all duration-300 ${
                          isCurrent
                            ? "border-orange-500/50 bg-orange-500/10 shadow-lg"
                            : isDone
                            ? "border-white/10 bg-white/[0.03]"
                            : "border-white/5 bg-transparent opacity-40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-mono ${
                              isDone
                                ? "bg-emerald-500/20 text-emerald-400"
                                : isCurrent
                                ? "bg-orange-500 text-white animate-pulse"
                                : "bg-white/10 text-slate-400"
                            }`}>
                              {isDone ? <Check size={13} weight="bold" aria-label="Passed" /> : sIdx + 1}
                            </span>
                            <span className="text-sm font-medium text-slate-200">{st.text}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-mono text-slate-400">{st.duration}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                              st.status === "healed"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}>
                              {st.status === "healed" ? "Self-Healed" : "Passed"}
                            </span>
                          </div>
                        </div>

                        {st.note && isDone && (
                          <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-200/90 font-mono">
                            <Lightning size={12} weight="fill" aria-hidden="true" /> <strong>Auto-Remapped:</strong> {st.note}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Telemetry Card */}
              <div className="rounded-3xl border border-white/10 bg-black/60 p-6 font-mono text-xs text-slate-300">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    BULLMQ PIPELINE STREAM
                  </span>
                  <span className="text-slate-500">100% Deterministic</span>
                </div>

                <div className="mt-4 space-y-2 text-slate-400">
                  <p><span className="text-slate-600">&gt;</span> Provider: <span className="text-orange-400">playwright-local / maestro-cli</span></p>
                  <p><span className="text-slate-600">&gt;</span> Video stream: <span className="text-emerald-400">active (1080p WebM / MP4)</span></p>
                  <p><span className="text-slate-600">&gt;</span> DOM snapshot diff: <span className="text-cyan-400">0.02ms perceptual hash</span></p>
                  <p><span className="text-slate-600">&gt;</span> A11y tree validator: <span className="text-indigo-400">WCAG 2.2 AA compliant</span></p>
                  <p><span className="text-slate-600">&gt;</span> Result status: <span className="text-emerald-400 font-bold">ALL 4 GATES VERIFIED</span></p>
                </div>

                <div className="mt-6 rounded-2xl bg-white/5 p-4 border border-white/10">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">Local & Cloud Ready</div>
                  <p className="text-slate-400 text-xs font-sans">
                    Son of CoTester runs natively on macOS, Linux, and Windows with 100% offline self-healing, or scales to 1,000+ parallel workers in private cloud.
                  </p>
                </div>

                <button
                  onClick={onLaunch}
                  className="mt-6 w-full rounded-2xl bg-white text-black hover:bg-slate-200 py-3 text-xs font-bold font-sans transition flex items-center justify-center gap-2"
                >
                  Launch Console
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Global Multi-Currency Pricing Section */}
        <section id="pricing" className="mx-auto max-w-7xl px-6 py-16">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="font-display text-3xl md:text-5xl font-bold text-white">
              Predictable Plans for Every Stage of Engineering
            </h2>
            <p className="mt-3 text-base text-slate-400">
              From a single developer validating a side project to a global engineering org running thousands of runs a day.
            </p>

            {/* Currency Switcher & Annual Billing Toggle */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
              <div className="flex items-center rounded-full border border-white/10 bg-white/5 p-1" role="group" aria-label="Billing currency">
                {(["USD", "EUR", "GBP", "JPY"] as Currency[]).map((curr) => (
                  <button
                    key={curr}
                    aria-pressed={currency === curr}
                    onClick={() => setCurrency(curr)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      currency === curr ? "bg-white text-black shadow" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {curr} ({currencySymbols[curr]})
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <span id="billing-monthly" className={`text-xs font-semibold ${!annualBilling ? "text-white" : "text-slate-400"}`}>Monthly</span>
                <button
                  role="switch"
                  aria-checked={annualBilling}
                  aria-label="Annual billing"
                  onClick={() => setAnnualBilling((b) => !b)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-out ${
                    annualBilling ? "bg-orange-500" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      annualBilling ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className={`text-xs font-semibold flex items-center gap-1.5 ${annualBilling ? "text-white" : "text-slate-400"}`}>
                  Annual Billing
                  <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase">
                    Save 20%
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {pricingPlans.map((plan) => {
              const price = annualBilling ? plan.priceAnnual[currency] : plan.priceMonthly[currency];
              const symbol = currencySymbols[currency];
              return (
                <div
                  key={plan.name}
                  className={`relative flex flex-col justify-between rounded-[32px] border p-7 transition-all duration-200 ${
                    plan.popular
                      ? "border-orange-500 bg-gradient-to-b from-orange-500/10 via-slate-950/90 to-slate-950 shadow-2xl shadow-orange-500/10"
                      : "border-white/10 bg-slate-950/70 hover:border-white/20"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
                      Most Popular
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase tracking-wider text-slate-400">{plan.badge}</span>
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-mono text-slate-300">{plan.runs}</span>
                    </div>

                    <h3 className="mt-3 font-display text-2xl font-bold text-white">{plan.name}</h3>
                    <p className="mt-2 text-xs text-slate-400 min-h-[36px]">{plan.desc}</p>

                    <div className="mt-6 flex items-baseline gap-1">
                      <span className="font-display text-4xl font-extrabold text-white">
                        {symbol}{price}
                      </span>
                      <span className="text-xs text-slate-400">{price === "0" ? "forever" : "/ month"}</span>
                    </div>

                    <ul className="mt-6 space-y-2.5 border-t border-white/10 pt-6">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5 text-xs text-slate-300">
                          <Check size={14} weight="bold" className="text-orange-400 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={onLaunch}
                    className={`mt-8 w-full rounded-full py-3 text-xs font-bold transition shadow-sm ${
                      plan.popular
                        ? "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20"
                        : "bg-white/10 hover:bg-white/20 text-white"
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Enterprise Trust & Global Compliance Bar */}
        <section id="compliance" className="mx-auto max-w-7xl px-6 py-12">
          <div className="rounded-[32px] border border-white/10 bg-white/[0.02] p-8 md:p-10 backdrop-blur">
            <div className="grid gap-6 md:grid-cols-4 text-center">
              <div className="p-4">
                <div className="text-2xl font-bold text-white">SOC 2 Type II</div>
                <div className="text-xs text-slate-400 mt-1">Independently Audited & Certified</div>
              </div>
              <div className="p-4 border-slate-800 md:border-l">
                <div className="text-2xl font-bold text-white">GDPR & CCPA</div>
                <div className="text-xs text-slate-400 mt-1">EU Data Sovereignty & Zero PII Leaks</div>
              </div>
              <div className="p-4 border-slate-800 md:border-l">
                <div className="text-2xl font-bold text-white">ISO/IEC 27001</div>
                <div className="text-xs text-slate-400 mt-1">Information Security Standard</div>
              </div>
              <div className="p-4 border-slate-800 md:border-l">
                <div className="text-2xl font-bold text-white">99.99% SLA</div>
                <div className="text-xs text-slate-400 mt-1">High-Availability Redundant Clusters</div>
              </div>
            </div>

            {/* Testimonials */}
            <div className="mt-10 grid gap-6 md:grid-cols-3 border-t border-white/10 pt-10">
              {testimonials.map((t) => (
                <div key={t.author} className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 flex flex-col justify-between">
                  <p className="text-xs italic text-slate-300 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <strong className="block text-xs font-semibold text-white">{t.author}</strong>
                    <span className="text-[11px] text-slate-500">{t.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Global FAQ Section */}
        <section id="faq" className="mx-auto max-w-4xl px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white">
              Everything You Need to Know Before Shipping
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={faq.q}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 overflow-hidden transition"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${idx}`}
                    className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-white hover:text-orange-400 transition"
                  >
                    <span>{faq.q}</span>
                    <span className="text-slate-400">
                      {isOpen ? <Minus size={16} weight="bold" aria-hidden="true" /> : <Plus size={16} weight="bold" aria-hidden="true" />}
                    </span>
                  </button>
                  <div
                    id={`faq-panel-${idx}`}
                    hidden={!isOpen}
                    className="px-5 pb-5 text-xs text-slate-300 leading-relaxed border-t border-white/5 pt-4 font-sans"
                  >
                    {faq.a}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={onLaunch}
              className="rounded-full bg-orange-500 hover:bg-orange-600 px-8 py-3.5 text-sm font-bold text-white transition shadow-xl shadow-orange-500/20"
            >
              Launch Console
            </button>
          </div>
        </section>

        {/* Modern Footer */}
        <footer className="border-t border-white/10 bg-black/60 py-10 px-6">
          <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <span className="font-display font-bold text-white">Son of CoTester</span>
              <span>© {new Date().getFullYear()} Son of CoTester Technologies Inc. All rights reserved worldwide.</span>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <a href="#simulator" className="hover:text-white transition">Simulator</a>
              <a href="#pricing" className="hover:text-white transition">Pricing ({currency})</a>
              <a href="#compliance" className="hover:text-white transition">Compliance</a>
              <a href="#faq" className="hover:text-white transition">FAQ</a>
              <button onClick={onLaunch} className="text-orange-400 hover:text-orange-300 font-semibold">
                Launch Console
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
