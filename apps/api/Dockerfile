FROM oven/bun:1.3.13 AS build
WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile
COPY apps/api/src apps/api/src
COPY packages/shared/src packages/shared/src
RUN bun build apps/api/src/index.ts --target=bun --minify --outfile=server.js

FROM oven/bun:1.3.13-slim AS runtime
WORKDIR /app
COPY --from=build --chown=bun:bun /app/server.js ./server.js
USER bun
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["bun", "server.js"]
