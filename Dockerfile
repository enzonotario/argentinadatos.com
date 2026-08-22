# Static API — datos/ mounted at runtime; dynamic endpoints use PocketBase.
# Build: docker build -t argentinadatos-api .
#
# Coolify: para zero-downtime preferí Build Pack = Dockerfile (no Compose).
# Compose en Coolify detiene el stack entero antes de levantar el nuevo.
FROM node:22-alpine

WORKDIR /app

COPY apps/static-api ./

ENV STATIC_DIR=/app/datos
ENV HTTP_PORT=3000
ENV DYNAMIC_CACHE_TTL_MS=900000

EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.HTTP_PORT||3000)+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
