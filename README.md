# sonofcotester

AI-powered software testing platform scaffold inspired by CoTester.

## Stack

- `apps/api`: NestJS control plane
- `apps/worker`: queue worker for execution, healing, and analysis
- `apps/web`: React dashboard with Tailwind CSS
- `packages/sdk`: shared domain types and API helpers
- `packages/automation`: execution provider adapters
- `packages/ai`: test generation, healing, and bug summarization services

## Quick Start

```bash
pnpm install
pnpm dev
```

## Included v1 Vertical Slice

- Project-scoped AI test generation endpoint
- Test suite execution orchestration endpoint
- Healing proposal review/apply endpoint
- Jira sync and GitHub Actions webhook stubs
- Live execution stream gateway
- Dashboard for projects, runs, healing, and bug drafts

