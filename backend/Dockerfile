# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache netcat-openbsd

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY backend/migrations ./migrations
COPY backend/seed-data ./seed-data
COPY scripts/wait-for-db.sh /wait-for-db.sh
RUN sed -i 's/\r$//' /wait-for-db.sh
RUN chmod +x /wait-for-db.sh

ENV NODE_ENV=production
ENV API_PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3001)+'/api/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "/wait-for-db.sh sh -c 'node dist/migrate.js && node dist/seed.js && node dist/index.js'"]
