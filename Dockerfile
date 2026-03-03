# ──────────────────────────────────────────────
# Stage 1: Build Nuxt SPA (static output)
# ──────────────────────────────────────────────
FROM oven/bun:1-alpine AS web-builder
WORKDIR /app

# Workspace manifests for lockfile-aware install
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/
RUN bun install --frozen-lockfile

# Build static SPA (outputs to apps/web/.output/public/)
COPY apps/web/ ./apps/web/
ENV NUXT_PUBLIC_API_URL=""
RUN cd apps/web && bun run generate

# ──────────────────────────────────────────────
# Stage 2: Production image (server + static SPA)
# ──────────────────────────────────────────────
FROM oven/bun:1-alpine
WORKDIR /app

# Workspace manifests for lockfile-aware install
COPY package.json bun.lock ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile

# Server source
COPY apps/server/src ./apps/server/src
COPY apps/server/drizzle.config.ts ./apps/server/

# Nuxt static output → served by Hono at runtime
COPY --from=web-builder /app/apps/web/.output/public ./apps/server/public

WORKDIR /app/apps/server
USER bun
EXPOSE 3000
CMD ["bun", "src/index.ts"]
