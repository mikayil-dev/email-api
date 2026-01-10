FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src

FROM oven/bun:1-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src

USER bun
EXPOSE 3000

CMD ["bun", "src/index.ts"]
