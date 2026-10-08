# SonOfCoTester: Complete Map to Production & Architecture Blueprint

**SonOfCoTester** is an autonomous, AI-driven software testing and quality-assurance platform inspired by CoTester, powered by **Maestro**, **Playwright**, **Axe-core**, and **K6**. It offers end-to-end multi-platform test generation, self-healing execution, real-time APM monitoring, subscription management, and a dedicated **Student Testing Academy**.

---

## 1. System Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │             React Web Dashboard              │
                               │  (Test Console • Health • Admin • Academy)   │
                               └──────────────────────┬───────────────────────┘
                                                      │ HTTP / WebSocket (Socket.io)
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │           NestJS API Control Plane           │
                               │  - Project / Suite / Case CRUD Controllers   │
                               │  - Multi-Dimensional Health Services         │
                               │  - Admin Subscriptions & Audit Stream        │
                               │  - Student Academy & AI Testing Tutor        │
                               │  - Maestro Flow Generator & Cloud Gateway    │
                               └──────┬───────────────────────┬───────────────┘
                                      │                       │
                     BullMQ Job Queue │                       │ Prisma Client (PostgreSQL)
                                      ▼                       ▼
                       ┌─────────────────────────┐  ┌───────────────────┐
                       │      Redis Cluster      │  │ PostgreSQL 16 DB  │
                       │  - Execution Queues     │  │ - Workspaces      │
                       │  - Event Streams (Pub/Sub)│ │ - Projects & Runs │
                       │  - Rate Limiting Cache  │  │ - Subscriptions   │
                       └──────────────┬──────────┘  │ - Audit Logs      │
                                      │             │ - Student Progress│
                                      ▼             └───────────────────┘
                       ┌─────────────────────────┐
                       │    BullMQ QA Worker     │
                       │ ┌─────────────────────┐ │
                       │ │ Playwright Local    │ │
                       │ │ Maestro Local/Cloud │ │
                       │ │ BrowserStack Mobile │ │
                       │ │ Axe-core & K6 APM   │ │
                       │ └─────────────────────┘ │
                       └─────────────────────────┘
```

---

## 2. Production Services & Monorepo Topology

| Package / App | Technology | Role in Production |
| :--- | :--- | :--- |
| `apps/api` | NestJS, TypeScript | Primary REST and WebSocket control plane, rate-limiting, authentication |
| `apps/worker` | BullMQ, Node.js | Asynchronous execution engine for Playwright, Maestro, and BrowserStack |
| `apps/web` | React 18, Vite, Tailwind | Multi-view UI (Test Console, Health Dashboard, Admin APM, Student Academy) |
| `apps/demo-target` | Express, Vite | Built-in app-under-test for local and staging smoke testing |
| `packages/sdk` | TypeScript | Shared domain contracts, Maestro types, DTOs, APM, and Academy types |
| `packages/data` | Prisma, PostgreSQL | Persistence layer, transactional repositories, audit logs, and subscriptions |
| `packages/automation` | Playwright, Maestro, Axe, K6 | Execution provider adapters, mobile YAML generators, and a11y engines |
| `packages/ai` | TypeScript Heuristics / LLM | Test generation, visual/DOM healing, bug draft summarizer, and AI Tutor |

---

## 3. CoTester vs SonOfCoTester Feature Matrix

| Capability | CoTester Baseline | SonOfCoTester Advantage |
| :--- | :--- | :--- |
| **Mobile Testing** | Appium / Cloud device farm only | Native **Maestro** local CLI + Maestro Cloud with declarative YAML |
| **Web Testing** | Standard browser execution | Playwright with video, DOM snapshots, and accessibility trees |
| **Self-Healing** | Locator fallback | Multi-signal visual diffing + accessible role auto-remapping + human approval |
| **Quality Dimensions** | Functional UI only | **5-Dimension Health**: Security, UI/UX (WCAG 2.2), DB Latency, Performance APM, Tests |
| **Admin & Governance** | Basic settings | **Real-Time Audit Trail** ("Follow Every Move") + BullMQ Queue Telemetry |
| **Subscriptions** | Fixed tier | **Multi-Tier Metering**: Student/Free ($0), Pro ($29), Team ($99), Enterprise ($499) |
| **Education & Learning** | None | **Student Testing Academy**: 6 interactive modules, AI test-quality linter, 3-way translator |

---

## 4. Production Deployment & Runbook

### Quick Production Launch

```bash
# 1. Start background infrastructure and services
docker compose -f docker-compose.production.yml up -d

# 2. Run database migrations
pnpm prisma:generate
pnpm db:push

# 3. Verify health & readiness
curl -f http://localhost:3001/api/health
curl -f http://localhost:3001/api/ready
```

### Production Environment Variables (`.env.production`)

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://sonofcotester:secure_password@postgres:5432/sonofcotester?schema=public
REDIS_URL=redis://redis:6379
VITE_API_URL=http://localhost:3001
MAESTRO_API_KEY=your_maestro_cloud_key
MAESTRO_PROJECT_ID=your_maestro_project_id
BROWSERSTACK_USERNAME=your_bs_user
BROWSERSTACK_ACCESS_KEY=your_bs_key
```

---

## 5. Student Testing Academy Curriculum Guide

1. **Module 1: The QA Testing Pyramid & Multi-Level Strategy**
   - Unit vs Integration vs E2E vs Component.
   - Cost, speed, and confidence trade-offs. Avoiding the Ice Cream Cone anti-pattern.
2. **Module 2: Selector Engineering & Resilient Locators**
   - Accessible roles (`getByRole`) vs `data-testid` vs brittle absolute XPaths.
3. **Module 3: Declarative Mobile Testing with Maestro**
   - YAML syntax, smart auto-waiting, cross-platform Android & iOS parity, Maestro Cloud.
4. **Module 4: AI in Quality Engineering & Self-Healing**
   - Visual and DOM similarity diffing, confidence ranking, human-in-the-loop review.
5. **Module 5: Accessibility (WCAG 2.2 AA) & Security QA**
   - Axe-core automated scanning, keyboard focus, color contrast, OWASP Top 10.
6. **Module 6: API Performance & Stress Testing with K6**
   - P95/P99 latency thresholds, virtual users, and concurrency bottlenecks.

---

## 6. Programmatic API Keys & CI/CD Integration (`sct_live_...`)

- **Scoped Permissions**: `runs:read`, `runs:write`, `suites:read`, `suites:write`, `health:read`, `health:scan`, `admin:read`.
- **Hashed Secrets**: Keys displayed once upon creation and stored hashed with SHA-256.
- **CI/CD Integration**: Trigger test suites headlessly from GitHub Actions, GitLab CI, or Jenkins.

---

## 7. Prometheus APM & Compliance Auditing

- **Prometheus Metrics Scraper**: `GET /api/metrics` text endpoint formatted for Prometheus and Grafana dashboards.
- **Streaming Audit Trail CSV Export**: `GET /api/admin/audit-logs/export.csv` streams formatted activity logs for compliance audits.

---

---

## 8. QA Competency Radar & Verified Certificates

- **5-Axis Competency Radar Chart**: Visualizes student proficiencies across E2E Automation, Selectors, Maestro, A11y, and K6 Performance.
- **Verified Certificate of Mastery**: Issue verifiable certificates of achievement with unique IDs and printable layout.

---

## 9. Arbitrary Target App Inspection & Zero-Code Discovery Engine

- **Any App Target**: Point Son of CoTester to any URL or local dev server (e.g. `localhost:3000`, `localhost:5174`, `localhost:8080`, `myapp.com`).
- **DOM Element Discovery**: Automatically scans top interactive buttons, inputs, links, and headings with optimal CSS and accessible role selectors.
- **Live Visual Capture**: Captures real-time full-page / viewport base64 snapshots with fullscreen inspection modal.
- **Dynamic Test Synthesis**: AI test generation engine converts crawled elements into canonical Playwright and Maestro test suites with resilient auto-waiting locators and step events.
- **Immediate Execution**: Dispatches test jobs into BullMQ with the configured `baseUrl`, capturing logs, screenshot artifacts, and traces on actual user apps.

