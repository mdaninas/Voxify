# syntax=docker/dockerfile:1

# --- Stage 1: build frontend (Vite) ---
FROM node:24-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Same-origin in production: backend serves the built files, so no API base URL needed.
ENV VITE_API_BASE_URL=""
RUN npm run build

# --- Stage 2: install backend production dependencies ---
FROM node:24-slim AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# --- Stage 3: runtime ---
FROM node:24-slim AS runtime
ENV NODE_ENV=production
ENV APP_ENV=production
ENV PORT=8080
ENV STATIC_DIR=/app/public
WORKDIR /app

COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/package.json ./package.json
COPY backend/src ./src
COPY --from=frontend-build /app/frontend/dist ./public

# Persisted at runtime via a volume; created here so the non-root user owns them.
RUN mkdir -p /app/data /app/storage && chown -R node:node /app

USER node
EXPOSE 8080
VOLUME ["/app/data", "/app/storage"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
