# ─── Stage 1: Install dependencies ───
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/sdk/package.json packages/sdk/
COPY packages/data/package.json packages/data/
COPY packages/ai/package.json packages/ai/
COPY packages/automation/package.json packages/automation/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build API + Worker packages only (skip web) ───
FROM deps AS build
COPY tsconfig.base.json ./
COPY turbo.json ./
COPY packages/ packages/
COPY apps/api/ apps/api/
COPY apps/worker/ apps/worker/
COPY packages/data/prisma/ packages/data/prisma/
COPY scripts/ scripts/
# Build only the packages needed for API/Worker (skip web, demo-target)
# Prisma client must be generated first so @sonofcotester/data compiles
RUN cd packages/data && npx prisma generate --schema prisma/schema.prisma
RUN pnpm --filter @sonofcotester/sdk build && \
    pnpm --filter @sonofcotester/data build && \
    pnpm --filter @sonofcotester/ai build && \
    pnpm --filter @sonofcotester/automation build && \
    pnpm --filter @sonofcotester/api build && \
    pnpm --filter @sonofcotester/worker build

# ─── Stage 3: Production image ───
FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy only what's needed to run
COPY --from=build /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=build /app/packages/sdk/package.json packages/sdk/
COPY --from=build /app/packages/sdk/dist packages/sdk/dist/
COPY --from=build /app/packages/data/package.json packages/data/
COPY --from=build /app/packages/data/dist packages/data/dist/
COPY --from=build /app/packages/data/prisma packages/data/prisma/
COPY --from=build /app/packages/data/node_modules packages/data/node_modules/
COPY --from=build /app/packages/ai/package.json packages/ai/
COPY --from=build /app/packages/ai/dist packages/ai/dist/
COPY --from=build /app/packages/automation/package.json packages/automation/
COPY --from=build /app/packages/automation/dist packages/automation/dist/
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist/
COPY --from=build /app/apps/worker/package.json apps/worker/
COPY --from=build /app/apps/worker/dist apps/worker/dist/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Generate Prisma client
RUN cd packages/data && npx prisma generate --schema prisma/schema.prisma

# Set ownership
RUN chown -R appuser:appgroup /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/main.js"]
