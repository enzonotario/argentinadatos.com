# Build from repository root:
#   docker build -f apps/worker/Dockerfile -t argentinadatos-worker .
FROM node:22-bookworm-slim

WORKDIR /repo

RUN corepack enable \
  && corepack prepare pnpm@10.34.5 --activate \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker ./apps/worker
COPY packages/pocketbase ./packages/pocketbase

RUN pnpm install --frozen-lockfile --filter @argentinadatos/worker...

WORKDIR /repo/apps/worker

ENV WORKER_POLL_INTERVAL_MS=900000
ENV POCKETBASE_URL=http://10.0.0.2:8090

CMD ["pnpm", "start"]
