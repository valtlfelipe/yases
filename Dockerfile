# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1-alpine AS build
WORKDIR /app

COPY package.json bun.lock* ./

# use ignore-scripts to avoid building node modules like better-sqlite3
RUN bun install --frozen-lockfile --ignore-scripts

# Copy the entire project
COPY . .

RUN bun --bun run build

# copy production dependencies and source code into final image
FROM oven/bun:1-alpine AS production
WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile --ignore-scripts

# Only `.output` folder is needed from the build stage
COPY --from=build /app/.output /app

# Copy migrations, config, and schema needed for drizzle-kit
COPY --from=build /app/drizzle.config.ts /app
COPY --from=build /app/server/db/migrations /app/server/db/migrations
COPY --from=build /app/server/db/schema.ts /app/server/db/schema.ts

# run the app
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "--bun", "run", "/app/server/index.mjs" ]
