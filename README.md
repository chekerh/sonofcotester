# sonofcotester

AI-powered software testing platform scaffold inspired by CoTester.

## Stack

- `apps/api`: NestJS control plane
- `apps/worker`: queue worker for execution, healing, and analysis
- `apps/web`: React dashboard with Tailwind CSS
- `packages/sdk`: shared domain types and API helpers
- `packages/automation`: execution provider adapters
- `packages/ai`: test generation, healing, and bug summarization services
- `packages/data`: Prisma client and persistence repository layer

## Quick Start

```bash
docker compose up -d
pnpm install
pnpm prisma:generate
pnpm db:push
pnpm dev:alpha
```

## Included v1 Vertical Slice

- Project-scoped AI test generation endpoint
- Test suite execution orchestration endpoint
- Healing proposal review/apply endpoint
- Jira sync and GitHub Actions webhook stubs
- Live execution stream gateway
- Dashboard for projects, runs, healing, and bug drafts

## Internal Alpha Foundation

- PostgreSQL schema and Prisma client live in [packages/data/prisma/schema.prisma](/Users/mac/Documents/New project/packages/data/prisma/schema.prisma).
- The API persists suites, suite versions, runs, jobs, artifacts, and healing proposals in Postgres.
- Redis and BullMQ are used for queued execution dispatch between the API and worker.
- `playwright-local` now executes basic canonical test steps for web targets; mobile providers remain contract-backed placeholders for the next slice.
- `apps/demo-target` provides a built-in app-under-test at `http://localhost:3010` so the internal alpha can exercise a known web target locally.
