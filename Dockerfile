# Static API — datos/ mounted at runtime; dynamic endpoints use PocketBase.
# Build: docker build -t argentinadatos-api .
FROM node:22-alpine

WORKDIR /app

COPY apps/static-api ./

ENV STATIC_DIR=/app/datos
ENV HTTP_PORT=3000
ENV DYNAMIC_CACHE_TTL_MS=900000

EXPOSE 3000

CMD ["node", "index.js"]
