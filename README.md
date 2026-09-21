# Alloc8

**Alloc8** is an agentic workforce scheduling platform — a modern Float-style system for planning capacity, allocating people to projects, and running delivery standups. Teams schedule work on a live timeline, manage people and projects, report on utilization, and can ask an in-app AI assistant to explain workflows or take safe UI actions.

> Primary repository: [github.com/sherryyar/alloc8](https://github.com/sherryyar/alloc8)

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Data model (high level)](#data-model-high-level)
- [Auth & access flow](#auth--access-flow)
- [Application flows](#application-flows)
- [AI assistant](#ai-assistant)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

| Layer | Responsibility |
|-------|----------------|
| **SPA (Vite + React)** | Schedule UI, people/projects, reporting, settings, assistant UI |
| **Supabase (Postgres + Auth)** | Source of truth for workspace data; Azure/Entra SSO; RLS |
| **Vercel** | Static hosting + serverless `/api/*` (assistant) |
| **OpenAI (optional)** | Streaming chat for Alloc8 Agent (server-side only) |

The client talks to Supabase directly for CRUD (with RLS). Privileged assistant traffic goes through Vercel/Vite API routes so API keys never ship to the browser.

```text
┌─────────────┐     HTTPS      ┌──────────────────┐
│   Browser   │ ─────────────► │  Vercel (SPA)    │
│  Alloc8 UI  │                │  dist/ + rewrites│
└──────┬──────┘                └────────┬─────────┘
       │                                │
       │ Supabase JS                    │ /api/alloc8-assistant
       ▼                                ▼
┌──────────────────┐           ┌──────────────────┐
│     Supabase     │◄──────────│ Serverless API   │
│ Auth · Postgres  │  admin    │ OpenAI + RAG     │
│ RLS · Realtime*  │           └──────────────────┘
└──────────────────┘
```

\*Realtime is available via Supabase; primary sync today is load-on-enter + optimistic client writes.

---

## Features

- **Schedule timeline** — people rows, allocation bars, leave, public holidays, filters, density modes, virtualized rows
- **People & projects** — directory, roles/departments, placeholders, project teams, rates
- **Reporting & dept dashboard** — capacity, utilization, department views
- **Standup mode** — department order setup and guided walkthrough
- **Access control** — work-email allowlist + workspace admin gates
- **Alloc8 Agent** — contextual help and safe UI actions (admin-oriented)
- **Auth** — SAML/OIDC via Microsoft Entra (Azure AD) through Supabase Auth, plus optional workspace password fallback

---

## Architecture

### Frontend

- **React 18** SPA bootstrapped by Vite (`src/main.jsx` → `src/App.jsx`)
- **React Router v6** with lazy-loaded pages and a shared shell (nav, toasts, providers)
- **State**
  - `AppDataContext` + Zustand store — workspace entities (people, projects, allocations, settings)
  - Context providers for auth, theme, assistant, standup walkthrough, dialogs, premium visuals
- **Schedule engine** — `src/schedule/` (virtualization, row height, allocation layouts) + `LandingPage`
- **Design system** — CSS variables in `src/styles/`; page-colocated CSS; Syne / DM Sans / JetBrains Mono

### Backend / data

- **Supabase Postgres** — schema owned by numbered SQL migrations under `supabase/migrations/`
- **Supabase Auth** — Azure provider for enterprise SSO; session consumed by `AuthContext`
- **RLS** — row-level security on workspace tables; access allowlist in dedicated migrations
- **RPCs** — e.g. allocation save helpers for atomic multi-table writes

### Edge / API

- `api/alloc8-assistant.js` — Vercel serverless handler (also mounted in Vite via `scripts/assistant-dev-api-plugin.mjs` for local `npm run dev`)
- Authorizes workspace admins, retrieves assistant knowledge from Supabase, streams OpenAI (or local fallback)

### Deploy shape

```text
GitHub (sherryyar/alloc8)
        │
        ▼ push main
     Vercel build
        │  npm run build → dist/
        │  vercel.json SPA rewrites + /api/*
        ▼
   Production URL
        │
        ├──► Supabase project (URL + anon key in VITE_*)
        └──► Server env: OPENAI_*, SUPABASE_SERVICE_ROLE_KEY
```

---

## Tech stack

| Area | Choice |
|------|--------|
| Language | JavaScript (ES modules), JSX |
| UI | React 18, Framer Motion, Lucide icons, Radix Dialog |
| Routing | `react-router-dom` v6 |
| Build | Vite 5 (`@vitejs/plugin-react`) |
| Client state | Zustand + React Context |
| Virtualization | `@tanstack/react-virtual` |
| Backend-as-a-service | Supabase (`@supabase/supabase-js`) |
| Auth | Supabase Auth + Microsoft Entra ID (Azure AD / SAML-style enterprise SSO) |
| Hosting | Vercel (static + serverless) |
| Analytics | `@vercel/analytics` |
| E2E | Playwright |
| Unit | Node.js built-in test runner (`node --test`) |
| Package manager | npm |

---

## Repository layout

```text
alloc8/
├── api/                      # Vercel serverless (assistant)
│   ├── alloc8-assistant.js
│   └── _lib/                 # auth, OpenAI, prompts, Supabase admin
├── docs/                     # Product/assistant notes
├── public/                   # Static assets (holidays JSON, etc.)
├── scripts/                  # SSO config, migrations, CSV import, Vite API plugin
├── src/
│   ├── App.jsx               # Providers, routes, auth gate
│   ├── main.jsx
│   ├── pages/                # Route screens (+ colocated CSS)
│   ├── components/           # Modals, nav, assistant, command palette, UI
│   ├── context/              # Auth, data, theme, assistant, …
│   ├── schedule/             # Timeline virtualization & layout
│   ├── lib/                  # Supabase client, API modules, assistant client
│   ├── utils/                # Pure helpers (filters, sort, capacity, …)
│   ├── data/                 # Seeds / static catalogs
│   ├── hooks/
│   ├── config/
│   └── styles/               # Design tokens & global CSS
├── supabase/
│   ├── migrations/           # Ordered SQL migrations
│   ├── config.toml
│   └── seed.sql
├── tests/                    # Playwright specs
├── vercel.json               # SPA + API rewrites
├── vite.config.js
├── package.json
└── .env.example              # Documented env template
```

### Primary routes

| Path | Screen |
|------|--------|
| `/` | Schedule (LandingPage) |
| `/people` | People directory |
| `/projects` | Projects |
| `/departments` | Departments |
| `/standup` | Standup setup |
| `/report` | Reporting |
| `/dept-dashboard` | Department dashboard |
| `/access` | Workspace access allowlist (admins) |
| `/settings` | Settings |

---

## Data model (high level)

Core tables (see migrations for authoritative schema):

| Entity | Role |
|--------|------|
| `people` | Roster; `type` = Employee / Contractor / Placeholder |
| `projects` | Project registry + team membership |
| `allocations` | Dated work/leave on people × projects |
| `allocation_people` | Many-to-many assignees |
| `lookup_roles` / departments | Catalogs for UI |
| `user_availability` | Weekly capacity patterns |
| `person_public_holidays*` | Region/country holidays |
| `workspace_settings` | Workspace prefs |
| `workspace_access` | Email allowlist / admin flags |
| Assistant knowledge | Docs for RAG (`032_assistant_knowledge.sql`) |

Client mapping lives under `src/lib/api/` (e.g. `people.js`, `allocations.js`) with snake_case ↔ camelCase conversion.

---

## Auth & access flow

```text
                  ┌─────────────────────┐
                  │     LoginPage       │
                  │  Primary: SAML SSO  │
                  │  Fallback: password │
                  └──────────┬──────────┘
                             │
           ┌─────────────────┼─────────────────┐
           ▼                                   ▼
  supabase.auth.signInWithOAuth          unlock() with
       (provider: azure)                 workspace password
           │                                   │
           ▼                                   ▼
   Entra → Supabase callback          local session flag
           │                                   │
           └─────────────┬─────────────────────┘
                         ▼
              AuthContext + allowlist check
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
      AccessDeniedPage          WorkspaceReady
                                   (load data)
                                      │
                                      ▼
                                 App routes
```

- **SAML / SSO** is the intended primary entry (Microsoft Entra via Supabase Azure provider).
- **Workspace password** is a minimal fallback (hidden lock icon on the login card).
- **Allowlist** gates which work emails may enter; admins manage `/access`.
- Never put `service_role` keys in client bundles except deliberate local-dev overrides documented in `.env.example`.

---

## Application flows

### Schedule

1. Load workspace snapshot (people, projects, allocations, settings).
2. Filter/sort people → virtualized timeline rows.
3. Create/edit allocations via modals; persist through Supabase API helpers / RPCs.
4. Placeholders support planning slots (diamond avatar, swap/reassign flows).

### People / projects

CRUD against Supabase tables; optimistic UI updates through `AppDataContext` sync helpers.

### Reporting

Derived metrics (capacity, scheduled, overtime) over date ranges; placeholders contribute zero capacity.

### Standup

Department order + walkthrough contexts guide live delivery reviews on the schedule.

---

## AI assistant

- UI: `Alloc8Assistant` + highlight/ghost-cursor takeover layers
- API: `POST /api/alloc8-assistant` (SSE stream)
- Auth: workspace-admin oriented (`authorizeAssistantRequest`)
- Knowledge: ingested docs (`npm run assistant:ingest`) stored in Supabase
- Local: Vite plugin serves the same handler without a separate API process
- Without `OPENAI_API_KEY`, a local fallback answer path is used

---

## Getting started

### Prerequisites

- Node.js **20+** (LTS recommended)
- npm 10+
- (Optional) Docker + [Supabase CLI](https://supabase.com/docs/guides/cli) for local Postgres
- (Optional) Vercel CLI for preview deploys

### Install & run

```bash
git clone https://github.com/sherryyar/alloc8.git
cd alloc8
npm install
cp .env.example .env.local
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or use password-only local gate)
npm run dev
```

App: [http://127.0.0.1:5173/](http://127.0.0.1:5173/)

### Local Supabase (optional)

```bash
npm run supabase:start
# Copy URL + anon key from `npm run supabase:status` into .env.local
npm run supabase:db:reset   # apply migrations + seed
```

---

## Environment variables

See **`.env.example`** for the full annotated list.

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SUPABASE_URL` | Client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Client | Public anon / publishable key |
| `VITE_APP_ACCESS_PASSWORD` | Client | Workspace password fallback |
| `VITE_LOGIN_SKIP_AUTH` | Client | Dev-only skip login |
| `VITE_SSO_EMAIL_DOMAIN` | Client | Optional Entra `domain_hint` |
| `OPENAI_API_KEY` | Server | Assistant streaming |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Server | Assistant RAG + privileged reads |
| `ASSISTANT_DEV_BYPASS` | Server | Local assistant auth bypass (dev) |

**Do not commit** `.env.local`, service role keys, or Azure client secrets.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server + local assistant API plugin |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm run test:e2e` | Playwright e2e |
| `npm run test:agent-crud` | Agent CRUD unit smoke tests |
| `npm run supabase:start` / `stop` / `status` | Local Supabase stack |
| `npm run supabase:db:reset` | Reset DB + migrations |
| `npm run supabase:db:push` | Push migrations (linked project) |
| `npm run sso:configure` | Entra + Supabase SSO helper |
| `npm run migrate:float-csv` | Import Float people CSV |
| `npm run assistant:ingest` | Ingest assistant knowledge docs |

---

## Deployment

### GitHub

Remote: **https://github.com/sherryyar/alloc8**

```bash
git remote add alloc8 https://github.com/sherryyar/alloc8.git   # if needed
git push -u alloc8 main
```

### Vercel

1. Import `sherryyar/alloc8` in the Vercel dashboard.
2. Framework preset: **Vite** — build `npm run build`, output `dist`.
3. Set client env (`VITE_*`) and server env (`OPENAI_*`, `SUPABASE_SERVICE_ROLE_KEY`, …).
4. Production branch: `main`.
5. `vercel.json` rewrites:
   - `/api/*` → serverless functions
   - all other non-asset routes → `index.html` (SPA)

Ensure Supabase Auth redirect allowlists include your Vercel production and preview URLs (and `http://localhost:5173/**` for local SSO testing).

---

## Testing

```bash
npm run test:agent-crud
npx playwright install    # once
npm run test:e2e
```

Playwright config: `playwright.config.mjs`. Specs under `tests/`.

---

## Contributing

1. Branch from `main` (`feat/…`, `fix/…`).
2. Keep changes focused; match existing patterns in `src/lib/api` and page CSS.
3. Run `npm run build` before opening a PR.
4. Never commit secrets, dumps, or large CSV exports (see `.gitignore`).
5. Prefer migrations for schema changes; keep them ordered and idempotent where possible.

---

## License

Private / internal use unless otherwise stated by the repository owner.

---

## Credits

Made with ❤️ by Sheher
