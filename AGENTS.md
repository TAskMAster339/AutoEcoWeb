# AGENTS.md

# Project

AutoEco — Receipt Management Platform.

- Backend is developed manually by the project owner.
- Frontend is developed by AI.
- Root infra files (docker-compose.*, Makefile, README.md, AGENTS.md) are
  owned by the project owner; AI may edit them only when asked.

# Ownership

| Path | Owner | AI access |
|---|---|---|
| `/frontend` | AI | read/write |
| `/backend` | Human | **read-only — never modify** |
| `/deploy`, `/docker-compose.*.yml`, `Makefile`, `README.md`, `AGENTS.md` | Human | edit only on request |

# Responsibilities

Backend (Human)

- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- Authentication
- Business Logic
- Receipt Parsing
- Database
- Docker

Frontend (AI)

- React 19
- TypeScript (strict)
- Vite 8
- TanStack Query
- Zustand
- React Router v7
- Material UI v6 (pinned)
- AG Grid v32
- html5-qrcode (scanner; fallback to manual input)
- @fontsource/inter

# Important

The AI MUST NEVER

- modify backend
- rename API endpoints
- change database models
- invent backend fields
- change authentication flow
- fake backend implementation
- log into the app or do manual browser testing (login, navigation, clicks,
  form filling) — browser smoke checks only with explicit owner permission

If an endpoint is missing:

1. Add it to `frontend/TODO.md`.
2. Continue implementation with mock data behind the feature flag.
3. Never fake production API.

# API

Backend is the source of truth. The frontend MUST strictly follow OpenAPI.

- Auth always uses the real API.
- Transactions / summary / tags / rules / analytics may serve mock data while
  backend endpoints are missing, gated by `VITE_USE_MOCK_API` (see
  `frontend/TODO.md` for what is still mock).
- If something is unavailable: display loading / empty / error / offline states.
- Never invent production API.

# Environment & Workflow

- All env vars (POSTGRES_*, JWT_SECRET, VITE_*) live in the root `.env`
  (single source). Compose services load it via `env_file: .env`; Vite
  exposes VITE_* to the client as `import.meta.env`. `frontend/.env` is not
  used — the app runs inside compose.
- Deps: the user runs `npm install` (do not reinstall unless asked).
- Dev server: `npm run dev` (Vite, port 5173, proxies `/api` → backend :80).
- Verify: `npx tsc -b` must pass (TypeScript strict).
- ESLint is configured but too slow — skip it; rely on `tsc -b`.
- Docker runs via Docker Desktop (Windows side); `docker compose` works from
  WSL when the CLI is present. Dev stack: `docker compose -f
  docker-compose.dev.yml up -d` (backend :80, frontend :5173, adminer :8080).
  Deploy stack: `docker compose -f docker-compose.deploy.yml up -d` (nginx
  gateway :80 only, config in `/deploy/nginx.conf`). Makefile mirrors these.

# Coding style

- React 19, TypeScript strict mode
- Functional components, hooks only
- No classes, no Redux
- Zustand for local/UI state
- TanStack Query for remote state
- No axios wrappers larger than necessary
- No unnecessary abstractions
- Reusable components, never duplicate

# State Management

- Remote state → TanStack Query
- Local/UI state → Zustand
- Component state → React hooks

# Routing

React Router v7. Pages: /login, /dashboard, /transactions, /analytics,
/settings, /tags, /rules, /admin.

# UI

- Minimalistic: Apple-like, Linear, Notion, Raycast
- Soft shadows
- **Squared design: no circles** — every surface is a rectangle with a
  small corner radius (4–8px). This includes the logo tile, avatars,
  icon buttons, FAB, receipt cards, profile/theme windows, bottom sheets
  (12px top), dialogs (10px). Chips/tooltips: 6px. Small dot indicators
  (price status, tag markers) may stay round.
- No gradients except the logo
- White background, purple accent
- Dark theme supported (theme toggle in header; AG Grid dark palette must
  stay muted, not bright)

# Mobile First

- Primarily mobile; desktop secondary
- All pages work from 360px
- Bottom navigation
- Floating Add button
- Bottom sheets
- Swipe gestures
- Planned scrolling: the app is a fixed frame — header/footer pinned, only
  `<main>` scrolls (scrollbar gutter reserved). Tables must not stretch the
  page; they fill the remaining viewport height.

# Components

Reusable, never duplicated:

Button, Card, Dialog, Table, Tag, Badge, StatisticCard, ReceiptCard,
NavigationBar, BottomSheet, PriceIndicator.

# Transactions

- Desktop: AG Grid (fills remaining viewport height, internal scroll,
  pagination at bottom, «Показывать по: N»)
- Mobile: cards, expandable, swipe actions

# API errors

Never crash. Always render: Loading, Empty, Error, Offline states.

# Accessibility

Keyboard navigation, ARIA labels, color contrast, large touch targets.

# Performance

Lazy loading, route splitting, memoization only when needed, no premature
optimization.

# Pull Requests

- Each task: as few files as possible
- Small commits
- No unrelated refactoring
- No formatting-only commits

# Definition of Done

A task is complete only if:

- responsive
- typed
- no TypeScript errors (`npx tsc -b` clean)
- loading state exists
- empty state exists
- error state exists
- works on desktop
- works on mobile
- reusable
