FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun --bun run build

FROM oven/bun:1-alpine
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY --from=build /app/.output /app
COPY --from=build /app/drizzle.config.ts /app
COPY --from=build /app/server/db/migrations /app/server/db/migrations
COPY --from=build /app/server/db/schema.ts /app/server/db/schema.ts
COPY --from=build /app/server /app/server

EXPOSE 3000/tcp

CMD ["bun", "--bun", "run", "/app/server/index.mjs"]
