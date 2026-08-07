# ---------- Stage 1: build the frontend ----------
FROM node:20-alpine AS build

WORKDIR /app

# Vite bakes env vars at build time. Defaults: same-origin API + real backend
# data (mock is a dev-only tool). Override via compose build args.
ARG VITE_API_URL=""
ARG VITE_USE_MOCK_API="false"
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_USE_MOCK_API=$VITE_USE_MOCK_API

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---------- Stage 2: serve static files ----------
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback + long-term caching for hashed assets + /api proxy to backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
