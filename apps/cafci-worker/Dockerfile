# Build from repository root:
#   docker build -f apps/cafci-worker/Dockerfile -t cafci-worker .
FROM node:22-bookworm-slim

WORKDIR /repo

RUN corepack enable \
  && corepack prepare pnpm@10.24.0 --activate \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/cafci-worker ./apps/cafci-worker
COPY datos/v1/finanzas/fci ./datos/v1/finanzas/fci

RUN pnpm install --frozen-lockfile --filter @argentinadatos/cafci-worker...

WORKDIR /repo/apps/cafci-worker

RUN mkdir -p /data

ENV CAFCI_WORKER_DB_PATH=/data/db.sqlite
ENV CAFCI_WORKER_POLL_INTERVAL_MS=1800000

CMD ["pnpm", "start"]
