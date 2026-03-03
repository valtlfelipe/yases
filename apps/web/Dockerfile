FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
ENV NODE_ENV=production
RUN bun run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.output .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/index.mjs"]
