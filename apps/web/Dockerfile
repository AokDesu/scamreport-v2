FROM oven/bun:1.3.13 AS build
WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile
COPY apps/web apps/web
COPY packages/shared/src packages/shared/src
RUN bun run build

FROM oven/bun:1.3.13-slim AS runtime
WORKDIR /app
COPY --from=build --chown=bun:bun /app/apps/web/dist ./dist
COPY --chown=bun:bun apps/web/server.ts ./server.ts
USER bun
ENV NODE_ENV=production PORT=8080 API_INTERNAL_URL=http://api:3000
EXPOSE 8080
CMD ["bun", "server.ts"]
