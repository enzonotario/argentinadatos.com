FROM node:22-alpine

WORKDIR /app

COPY apps/static-api/server.js apps/static-api/index.js ./
COPY datos ./datos

ENV STATIC_DIR=/app/datos
ENV HTTP_PORT=3000

EXPOSE 3000

CMD ["node", "index.js"]
