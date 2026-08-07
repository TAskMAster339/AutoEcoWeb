# AutoEco

Receipt Management Platform — FastAPI backend (human-owned) + React frontend (AI-owned).

## Structure

- `backend/`  — FastAPI, SQLAlchemy, Alembic, PostgreSQL (developed manually)
- `frontend/` — React 19 + TypeScript strict + Vite + MUI + TanStack Query + Zustand + AG Grid

## Docker

Two compose files:

| File | Purpose | Services | Entry point |
|---|---|---|---|
| `docker-compose.dev.yml` | Local dev (`make up` / `make dev-up`) | backend (hot-reload), frontend (Vite HMR), postgres, adminer | backend :80, frontend :5173, adminer :8080 |
| `docker-compose.deploy.yml` | Production | nginx gateway, frontend (static build), backend, postgres | nginx :80 only |

### Environment (.env)

Root `.env` is the **single source** for container env: `backend` and
`postgres` load the whole file via `env_file: .env` — no per-variable
listing in the compose files. First run: `cp .env.example .env`.

- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB_NAME` — database
  credentials (postgres image + FastAPI backend)
- `POSTGRES_HOST` / `POSTGRES_PORT` — used by the backend
- `JWT_SECRET` — auth token signing key (backend)

Frontend vars (`VITE_*`) live in the same root `.env` — one place for the
whole stack (see below).

### Dev (local development)

```bash
# full stack with HMR
make up            # docker compose -f docker-compose.dev.yml up -d
# or explicitly rebuild
make dev-up        # docker compose -f docker-compose.dev.yml up -d --build
```

- Frontend: http://localhost:5173 (Vite HMR, proxies `/api` → backend :80)
- Backend API: http://localhost:80 — docs at http://localhost:80/docs
- DB UI: http://localhost:8080 (adminer)

### Deploy (production)

```bash
make deploy-up     # docker compose -f docker-compose.deploy.yml up -d --build
```

One domain — only port 80 is exposed (nginx gateway); the backend is never
published directly:

- `/` — frontend static build (SPA)
- `/api/*` — backend (proxied by nginx)
- `/docs`, `/redoc`, `/openapi.json` — backend OpenAPI docs
- `/health` — backend health check

Build-time env for the frontend image (Vite bakes these in; values come from
the root `.env`, override on the CLI if needed):

```bash
VITE_USE_MOCK_API=false make deploy-up   # real API (default)
VITE_USE_MOCK_API=true  make deploy-up   # mock data until backend endpoints land
```

### Frontend env

Also in the root `.env` (the frontend container loads them via `env_file`,
Vite exposes them to the client as `import.meta.env`):

- `VITE_API_URL` — backend base URL (empty = same origin; dev proxy → backend)
- `VITE_PROXY_TARGET` — dev-only, read by `vite.config.ts` (server-side):
  inside compose it is `http://backend:80` (the compose service name —
  `localhost` inside a container is the container itself); host dev without
  compose falls back to `http://localhost:80`.
- `VITE_USE_MOCK_API` — `true` serves transactions/summary/tags/rules/analytics
  from mock data until the backend endpoints exist (see `frontend/TODO.md`).
  Auth always uses the real API. Override for production builds on the CLI:
  `VITE_USE_MOCK_API=false make deploy-up`.

## Backend

- Generate requirements.txt

```bash
uv export --format requirements-txt --no-dev --no-emit-project --output-file requirements.txt
```

- Migrate local

```bash
cd backend && POSTGRES_HOST=localhost uv run alembic upgrade head
```

- Create migration local

```bash
cd backend && POSTGRES_HOST=localhost uv run alembic revision --autogenerate -m "init users"
```

- Admin setup

```bash
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d postgres -c "UPDATE users SET role = 'admin' WHERE email = 'test@example.com';"
```

- Status setup

```bash
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d postgres -c "UPDATE users SET status = 'active' WHERE email = 'test@example.com';"
```
