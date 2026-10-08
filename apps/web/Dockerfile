# ─── Stage 1: Install dependencies ───
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/sdk/package.json packages/sdk/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build web app ───
FROM deps AS build
COPY tsconfig.base.json ./
COPY turbo.json ./
COPY packages/sdk/ packages/sdk/
COPY apps/web/ apps/web/
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter @sonofcotester/web build

# ─── Stage 3: Serve with nginx ───
FROM nginx:alpine AS production
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

# Non-root for security
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
