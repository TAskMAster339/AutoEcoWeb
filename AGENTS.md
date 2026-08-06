# AGENTS.md

# Project

AutoEco

Receipt Management Platform

Backend is developed manually by the project owner.

Frontend is developed by AI.

The AI agent MUST NEVER modify backend code.

---

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

- React
- TypeScript
- Vite
- TanStack Query
- Zustand
- React Router
- Material UI
- AG Grid

The AI owns ONLY the frontend folder.

---

# Important

The AI MUST NEVER

- modify backend
- rename API endpoints
- change database models
- invent backend fields
- change authentication flow

If an endpoint is missing:

Create a TODO.

Never fake backend implementation.

---

# API

Backend is the source of truth.

The frontend MUST strictly follow OpenAPI.

If something is unavailable

Display mock data behind feature flags.

Never invent production API.

---

# Folder ownership

/frontend

Owned by AI.

/backend

Read-only.

---

# Coding style

React 19

TypeScript strict mode

Functional Components

Hooks

No Classes

No Redux

Use Zustand

No axios wrappers larger than necessary

No unnecessary abstractions.

---

# State Management

Remote state

TanStack Query

Local state

Zustand

Component state

React hooks

---

# Routing

React Router v7

Pages

/login

/dashboard

/transactions

/analytics

/settings

/tags

/rules

/admin

---

# UI

Minimalistic

Apple-like

Linear

Notion

Raycast

Soft shadows

Rounded corners

No gradients except CTA

White background

Purple accent

---

# Mobile First

The application is primarily mobile.

Desktop is secondary.

All pages must work from 360px.

Bottom navigation.

Floating Add button.

Bottom Sheets.

Swipe gestures.

---

# Components

Reusable.

Never duplicate.

Example

Button

Card

Dialog

Table

Tag

Badge

StatisticCard

ReceiptCard

NavigationBar

BottomSheet

PriceIndicator

---

# Transactions

Desktop

AG Grid

Mobile

Cards

Expandable

Swipe Actions

---

# Scanner

Uses html5-qrcode.

If unavailable

Gracefully fallback to manual input.

---

# API errors

Never crash.

Display

Loading

Empty

Error

Offline

states.

---

# Accessibility

Keyboard navigation.

ARIA labels.

Color contrast.

Large touch targets.

---

# Performance

Lazy loading.

Route splitting.

Memoization only when needed.

Avoid premature optimization.

---

# Communication

The AI should think like a senior frontend engineer.

When backend functionality is missing:

1. Create TODO.

2. Continue implementation.

3. Never modify backend.

---

# Pull Requests

Each task should modify as few files as possible.

Small commits.

No unrelated refactoring.

No formatting-only commits.

---

# Definition of Done

A task is complete only if

- responsive

- typed

- no TypeScript errors

- no ESLint errors

- loading state exists

- empty state exists

- error state exists

- works on desktop

- works on mobile

- reusable
