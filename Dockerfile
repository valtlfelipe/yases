FROM oven/bun:1-alpine

WORKDIR /app

# Dependencies layer (cached unless package.json changes)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Application source
COPY src ./src
COPY drizzle.config.ts ./

USER bun
EXPOSE 3000
