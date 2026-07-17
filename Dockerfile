# Static API only — datos/ is mounted at runtime (see docker-compose.yml).
# Build: docker build -t argentinadatos-api .
FROM node:22-alpine

WORKDIR /app

COPY apps/static-api/server.js apps/static-api/index.js ./

ENV STATIC_DIR=/app/datos
ENV HTTP_PORT=3000

EXPOSE 3000

CMD ["node", "index.js"]
