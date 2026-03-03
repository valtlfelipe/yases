FROM oven/bun:1-alpine
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY nuxt.config.ts ./
COPY drizzle.config.ts ./
COPY .env ./
COPY app ./app
COPY server ./server
COPY scripts ./scripts

ENV NUXT_PUBLIC_API_URL=""

RUN bun run build

USER bun
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
