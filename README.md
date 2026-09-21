# Alloc8

<p align="center">
  <strong>Agentic workforce scheduling</strong><br/>
  Plan capacity · Allocate people · Run standups · Ask the agent
</p>

<p align="center">
  <a href="#tech-stack"><img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Vercel-Hosting-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-private-6b961e?style=flat-square" alt="Private" />
  <img src="https://img.shields.io/badge/license-proprietary-86bc25?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/package-npm-CB3837?style=flat-square&logo=npm&logoColor=white" alt="npm" />
  <a href="https://github.com/sherryyar/alloc8"><img src="https://img.shields.io/badge/repo-sherryyar%2Falloc8-181717?style=flat-square&logo=github" alt="GitHub" /></a>
</p>

---

## Description

**Alloc8** is an internal **resource & capacity planning** product for delivery organizations. It replaces spreadsheet-heavy scheduling with a live timeline, a people/project registry, utilization reporting, standup workflows, and an optional **AI agent** that can explain the product and perform safe UI actions.

It is inspired by Float-class workforce tools, purpose-built for modern enterprise sign-in (Microsoft Entra / SAML-style SSO), Postgres-backed tenancy via Supabase, and Vercel deployment.

| | |
|---|---|
| **Problem** | Delivery leads need one place to see who is free, who is booked, and how to rebalance work — without drowning in filters and exports. |
| **Solution** | A schedule-first SPA with strong filters, placeholders, reporting, and conversational assistance. |
| **Users** | Delivery leads, resource managers, department heads, workspace admins. |
| **Deploy** | GitHub → Vercel; data & auth on Supabase. |

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Diagrams](#diagrams)
  - [System architecture](#1-system-architecture)
  - [Dependency graph](#2-dependency-graph)
  - [Frontend module map](#3-frontend-module-map)
  - [Domain ER diagram](#4-domain-er-diagram)
  - [Auth sequence](#5-auth-sequence)
  - [Schedule write path](#6-schedule-write-path)
  - [AI assistant sequence](#7-ai-assistant-sequence)
  - [CI / CD pipeline](#8-ci--cd-pipeline)
- [Repository layout](#repository-layout)
- [Domain model](#domain-model)
- [Auth & access](#auth--access)
- [Runtime flows](#runtime-flows)
- [AI assistant](#ai-assistant)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Quality](#quality)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| Area | Capabilities |
|------|----------------|
| **Schedule** | Virtualized people timeline, allocation bars, leave, public holidays, density modes, advanced filters |
| **People** | Directory, roles, departments, Employee / Contractor / **Placeholder** types |
| **Projects** | Registry, teams, rates, project-scoped planning |
| **Insights** | Reporting, department dashboard, capacity / utilization |
| **Standup** | Department order + guided walkthrough on the live schedule |
| **Security** | Work-email allowlist, workspace admin gates, RLS on Postgres |
| **Agent** | Contextual help + safe UI actions (admin-oriented) |
| **Auth** | Entra SSO (primary) + minimal workspace-password fallback |

---

## Tech stack

### At a glance

<p>
  <img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/React_Router-6-CA4245?style=flat-square&logo=reactrouter&logoColor=white" alt="React Router" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Zustand-5-000000?style=flat-square&logo=redux&logoColor=white" alt="Zustand" />
  <img src="https://img.shields.io/badge/Framer_Motion-12-0055FF?style=flat-square&logo=framer&logoColor=white" alt="Framer Motion" />
  <img src="https://img.shields.io/badge/TanStack_Virtual-3-FF4154?style=flat-square&logo=reactquery&logoColor=white" alt="TanStack Virtual" />
  <img src="https://img.shields.io/badge/Radix_UI-Dialog-161618?style=flat-square&logo=radixui&logoColor=white" alt="Radix" />
  <img src="https://img.shields.io/badge/Lucide-icons-F56565?style=flat-square&logo=lucide&logoColor=white" alt="Lucide" />
  <img src="https://img.shields.io/badge/Sonner-toasts-18181B?style=flat-square" alt="Sonner" />
</p>
<p>
  <img src="https://img.shields.io/badge/Supabase-JS_Client-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase JS" />
  <img src="https://img.shields.io/badge/PostgreSQL-RLS-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Auth-Microsoft_Entra-0078D4?style=flat-square&logo=microsoftazure&logoColor=white" alt="Entra" />
  <img src="https://img.shields.io/badge/OpenAI-Chat_API-412991?style=flat-square&logo=openai&logoColor=white" alt="OpenAI" />
  <img src="https://img.shields.io/badge/Vercel-SPA_%2B_Serverless-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/Playwright-E2E-2EAD33?style=flat-square&logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/Node_Test-unit-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node test" />
</p>

### By layer

| Layer | Technology | Role |
|:-----:|------------|------|
| <img src="https://img.shields.io/badge/-UI-61DAFB?style=flat-square&logoColor=black" alt="UI" /> | **React 18**, React Router 6, Framer Motion, Lucide, Radix Dialog, Sonner | Interactive SPA, routing, motion, feedback |
| <img src="https://img.shields.io/badge/-State-764ABC?style=flat-square" alt="State" /> | **Zustand** + React Context | Workspace store + cross-cutting providers |
| <img src="https://img.shields.io/badge/-Schedule-FF4154?style=flat-square" alt="Schedule" /> | **@tanstack/react-virtual** + custom layout engine | Large timelines without DOM blow-ups |
| <img src="https://img.shields.io/badge/-Build-646CFF?style=flat-square" alt="Build" /> | **Vite 5**, `@vitejs/plugin-react` | Dev server, HMR, production bundles |
| <img src="https://img.shields.io/badge/-Data-3ECF8E?style=flat-square" alt="Data" /> | **Supabase** (Postgres, Auth, RLS, RPCs) | Source of truth for people / projects / allocations |
| <img src="https://img.shields.io/badge/-Identity-0078D4?style=flat-square" alt="Identity" /> | **Microsoft Entra ID** via Supabase Azure provider | Enterprise SSO (primary entry) |
| <img src="https://img.shields.io/badge/-Edge-000000?style=flat-square" alt="Edge" /> | **Vercel** static + `/api/*` serverless | Hosting, SPA rewrites, assistant API |
| <img src="https://img.shields.io/badge/-AI-412991?style=flat-square" alt="AI" /> | **OpenAI** (server-only) + optional RAG docs | Streaming Alloc8 Agent |
| <img src="https://img.shields.io/badge/-QA-2EAD33?style=flat-square" alt="QA" /> | **Playwright** + `node --test` | E2E and unit smoke |

### Styling & design tokens

| Token | Value / approach |
|-------|------------------|
| Brand green | `#86bc25` / `#9fd43a` / `#6b961e` (enterprise green theme) |
| Typography | **Syne** (display), **DM Sans** (body), **JetBrains Mono** (meta) |
| CSS strategy | Design-system variables + page-colocated CSS (no Tailwind required) |

---

## Diagrams

GitHub renders the Mermaid graphs below automatically on the repository README.

### 1. System architecture

End-to-end runtime: browser SPA, Vercel edge, Supabase, Entra, OpenAI.

```mermaid
flowchart TB
  subgraph Clients["👤 Clients"]
    Browser["Browser<br/>Alloc8 SPA"]
  end

  subgraph Edge["⬛ Vercel"]
    CDN["Static assets<br/>dist/"]
    SPA["SPA rewrites<br/>vercel.json"]
    API["Serverless<br/>/api/alloc8-assistant"]
  end

  subgraph Identity["🔵 Microsoft Entra ID"]
    Entra["Azure AD / OIDC"]
  end

  subgraph Data["🟢 Supabase"]
    Auth["Auth"]
    PG["PostgreSQL<br/>+ RLS + RPCs"]
    Storage["Assistant knowledge"]
  end

  subgraph AI["🟣 OpenAI"]
    LLM["Chat Completions<br/>SSE stream"]
  end

  subgraph Source["⬛ GitHub"]
    Repo["sherryyar/alloc8"]
  end

  Repo -->|push main| Edge
  Browser --> CDN
  Browser --> SPA
  Browser -->|"@supabase/supabase-js<br/>anon key"| Auth
  Browser -->|"CRUD under RLS"| PG
  Browser -->|"SSO redirect"| Entra
  Entra -->|callback| Auth
  Browser -->|"POST /api/alloc8-assistant"| API
  API -->|"service role"| PG
  API --> Storage
  API --> LLM

  classDef client fill:#e8f4ff,stroke:#0088ff,color:#0b1220
  classDef edge fill:#111,stroke:#86bc25,color:#f8fafc
  classDef data fill:#e8fff0,stroke:#3ECF8E,color:#0b1220
  classDef id fill:#e8f1ff,stroke:#0078D4,color:#0b1220
  classDef ai fill:#f3e8ff,stroke:#412991,color:#0b1220
  class Browser client
  class CDN,SPA,API,Repo edge
  class Auth,PG,Storage data
  class Entra id
  class LLM ai
```

**Trust boundary:** browser only receives `VITE_*` public keys. `OPENAI_API_KEY` and Supabase **service role** stay on the server.

### 2. Dependency graph

Major runtime libraries and what they support.

```mermaid
flowchart LR
  subgraph App["Alloc8 application"]
    SPA["React SPA"]
    AgentAPI["api/alloc8-assistant"]
  end

  subgraph UI["UI & UX"]
    React["react / react-dom"]
    RR["react-router-dom"]
    FM["framer-motion"]
    Lucide["lucide-react"]
    Radix["@radix-ui/react-dialog"]
    Sonner["sonner"]
  end

  subgraph State["State & schedule"]
    Zustand["zustand"]
    Virtual["@tanstack/react-virtual"]
  end

  subgraph Platform["Platform"]
    Vite["vite"]
    SB["@supabase/supabase-js"]
    VA["@vercel/analytics"]
  end

  subgraph QA["Quality"]
    PW["@playwright/test"]
    NodeTest["node:test"]
  end

  SPA --> React
  SPA --> RR
  SPA --> FM
  SPA --> Lucide
  SPA --> Radix
  SPA --> Sonner
  SPA --> Zustand
  SPA --> Virtual
  SPA --> SB
  SPA --> VA
  SPA -.-> Vite
  AgentAPI --> SB
  SPA -.-> PW
  SPA -.-> NodeTest

  classDef app fill:#86bc25,stroke:#6b961e,color:#0b1220
  classDef ui fill:#61DAFB,stroke:#0891b2,color:#0b1220
  classDef st fill:#c4b5fd,stroke:#7c3aed,color:#0b1220
  classDef pl fill:#3ECF8E,stroke:#059669,color:#0b1220
  classDef qa fill:#86efac,stroke:#16a34a,color:#0b1220
  class SPA,AgentAPI app
  class React,RR,FM,Lucide,Radix,Sonner ui
  class Zustand,Virtual st
  class Vite,SB,VA pl
  class PW,NodeTest qa
```

### 3. Frontend module map

How source folders depend on each other (simplified).

```mermaid
flowchart TB
  main["main.jsx"] --> App["App.jsx"]
  App --> Pages["pages/*"]
  App --> Ctx["context/*"]
  App --> Comp["components/*"]

  Pages --> Comp
  Pages --> Ctx
  Pages --> Sched["schedule/*"]
  Pages --> Lib["lib/*"]
  Pages --> Utils["utils/*"]

  Comp --> Ctx
  Comp --> Lib
  Comp --> Utils

  Ctx --> Lib
  Lib --> SB["lib/supabase.js"]
  Sched --> Utils

  Pages --> Styles["styles/* + page CSS"]
  Comp --> Styles

  classDef entry fill:#86bc25,stroke:#6b961e,color:#0b1220
  classDef core fill:#dbeafe,stroke:#2563eb,color:#0b1220
  classDef leaf fill:#f1f5f9,stroke:#64748b,color:#0b1220
  class main,App entry
  class Pages,Ctx,Comp,Sched,Lib core
  class Utils,Styles,SB leaf
```

### 4. Domain ER diagram

Core scheduling entities (logical model).

```mermaid
erDiagram
  PEOPLE ||--o{ ALLOCATION_PEOPLE : assigned
  ALLOCATIONS ||--o{ ALLOCATION_PEOPLE : includes
  PROJECTS ||--o{ ALLOCATIONS : booked_on
  PEOPLE ||--o| USER_AVAILABILITY : has
  PEOPLE ||--o{ PERSON_PUBLIC_HOLIDAYS : observes
  WORKSPACE_SETTINGS ||--|| WORKSPACE : configures
  WORKSPACE_ACCESS ||--o{ PEOPLE : allowlists
  LOOKUP_ROLES ||--o{ PEOPLE : titles
  PEOPLE {
    uuid id PK
    text name
    text email
    text role
    text department
    text type "Employee|Contractor|Placeholder"
    boolean archived
  }
  PROJECTS {
    uuid id PK
    text name
    text client
    uuid[] teamIds
  }
  ALLOCATIONS {
    uuid id PK
    text project
    date startDate
    date endDate
    boolean isLeave
    numeric hours
  }
  ALLOCATION_PEOPLE {
    uuid allocation_id FK
    uuid person_id FK
  }
  USER_AVAILABILITY {
    uuid person_id FK
    text employment_type
    numeric weekly_hours
  }
  WORKSPACE_ACCESS {
    text email PK
    boolean is_admin
    boolean enabled
  }
```

### 5. Auth sequence

Primary SAML/OIDC path vs password fallback.

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant L as LoginPage
  participant SB as Supabase Auth
  participant E as Entra ID
  participant A as AuthContext
  participant W as Allowlist
  participant App as Workspace

  alt Continue with SAML
    U->>L: Click SAML
    L->>SB: signInWithOAuth(azure)
    SB->>E: OIDC redirect
    E-->>SB: Auth code / tokens
    SB-->>L: Session cookie / JWT
    L->>A: Session established
  else Workspace password
    U->>L: Enter password + Go
    L->>A: unlock(displayName)
  end

  A->>W: Check work email allowlist
  alt Not allowlisted
    W-->>U: AccessDeniedPage
  else Allowed
    W-->>App: WorkspaceReady
    App->>App: Load people / projects / allocations
  end
```

### 6. Schedule write path

Creating or updating an allocation from the timeline.

```mermaid
sequenceDiagram
  autonumber
  actor U as Scheduler
  participant UI as LandingPage / Modals
  participant Store as AppDataContext / Zustand
  participant API as lib/api/allocations
  participant DB as Supabase Postgres

  U->>UI: Create / edit allocation
  UI->>Store: Optimistic local update
  Store->>API: syncAllocationCreate / Update
  API->>DB: INSERT/UPDATE + allocation_people<br/>(or save RPC)
  DB-->>API: Row + RLS enforcement
  alt Success
    API-->>Store: Canonical row
    Store-->>UI: Reconcile UI
  else Failure
    API-->>Store: Error
    Store-->>UI: Toast + rollback / refetch
  end
```

### 7. AI assistant sequence

```mermaid
sequenceDiagram
  autonumber
  actor U as Admin user
  participant UI as Alloc8Assistant
  participant API as /api/alloc8-assistant
  participant AuthZ as authorizeAssistant
  participant DB as Supabase (service role)
  participant AI as OpenAI

  U->>UI: Ask question / request action
  UI->>API: POST { question, context, history }
  API->>AuthZ: Verify workspace admin
  alt Unauthorized
    AuthZ-->>UI: 401/403
  else Authorized
    API->>DB: Retrieve knowledge snippets
    alt OPENAI_API_KEY set
      API->>AI: Stream chat completion
      AI-->>API: SSE tokens
    else No key
      API->>API: localFallbackAnswer
    end
    API-->>UI: SSE answer + optional action payload
    UI->>UI: Render / execute safe UI action
  end
```

### 8. CI / CD pipeline

```mermaid
flowchart LR
  Dev["💻 Local<br/>npm run dev"] -->|git push| GH["GitHub<br/>sherryyar/alloc8"]
  GH -->|main| Vercel["Vercel Build<br/>npm run build"]
  Vercel --> Dist["dist/ SPA"]
  Vercel --> Fn["Serverless /api"]
  Dist --> Prod["🌐 Production URL"]
  Fn --> Prod
  Prod --> SB["Supabase project"]
  Prod --> OAI["OpenAI optional"]

  classDef local fill:#fef3c7,stroke:#d97706,color:#0b1220
  classDef git fill:#111,stroke:#86bc25,color:#f8fafc
  classDef host fill:#e0e7ff,stroke:#4f46e5,color:#0b1220
  classDef data fill:#d1fae5,stroke:#059669,color:#0b1220
  class Dev local
  class GH git
  class Vercel,Dist,Fn,Prod host
  class SB,OAI data
```

---

## Repository layout

```text
alloc8/
├── api/                 # Vercel serverless — Alloc8 Agent
├── docs/                # Product / assistant notes
├── public/              # Static assets
├── scripts/             # SSO, migrations, CSV import, Vite API plugin
├── src/
│   ├── App.jsx          # Providers, auth gate, routes
│   ├── pages/           # Route screens (+ CSS)
│   ├── components/      # UI, modals, assistant, nav
│   ├── context/         # Auth, data, theme, assistant, …
│   ├── schedule/        # Timeline virtualization & geometry
│   ├── lib/             # Supabase client + domain API
│   ├── utils/           # Pure helpers
│   └── styles/          # Design tokens
├── supabase/migrations/ # Ordered SQL schema
├── tests/               # Playwright
├── vercel.json
├── vite.config.js
└── .env.example
```

### Routes

| Path | Module |
|------|--------|
| `/` | Schedule (`LandingPage`) |
| `/people` | People |
| `/projects` | Projects |
| `/departments` | Departments |
| `/standup` | Standup setup |
| `/report` | Reporting |
| `/dept-dashboard` | Department dashboard |
| `/access` | Allowlist (admins) |
| `/settings` | Settings |

---

## Domain model

See the [ER diagram](#4-domain-er-diagram) above. Summary:

| Entity | Purpose |
|--------|---------|
| `people` | Roster; `type` ∈ Employee · Contractor · Placeholder |
| `projects` | Projects + team membership |
| `allocations` / `allocation_people` | Dated work & leave |
| Lookups | Roles, departments |
| `user_availability` | Weekly capacity patterns |
| Public holidays | Region/country calendars per person |
| `workspace_settings` | Workspace prefs |
| `workspace_access` | Email allowlist / admin |
| Assistant knowledge | RAG corpus for the agent |

Client mappers: `src/lib/api/*` (DB snake_case ↔ app camelCase).

---

## Auth & access

See the [auth sequence](#5-auth-sequence). Quick reference:

| Mode | Notes |
|------|--------|
| **SSO** | Intended production path; redirect URLs must include Vercel + localhost |
| **Password** | Local / break-glass; set `VITE_APP_ACCESS_PASSWORD` |
| **Allowlist** | Admins manage `/access`; failed sign-in prompts Slack support |

---

## Runtime flows

1. **Boot** — providers mount → auth gate → load workspace snapshot into Zustand.
2. **Schedule** — filter/sort people → virtualize rows → create/edit allocations via modals → persist through Supabase / RPCs.
3. **Placeholders** — plan work on diamond rows; reassign via drag/swap utilities.
4. **Reporting** — capacity & utilization over ranges (placeholders = zero capacity).
5. **Standup** — department order + walkthrough overlays on the live grid.

---

## AI assistant

| Piece | Location |
|-------|----------|
| UI | `src/components/assistant/*` |
| API | `POST /api/alloc8-assistant` (SSE) |
| Local dev | Vite plugin mirrors the same handler |
| Auth | Workspace-admin oriented |
| Knowledge | `npm run assistant:ingest` → Supabase |
| Fallback | Works without `OPENAI_API_KEY` (limited local answers) |

---

## Getting started

### Prerequisites

- **Node.js** ≥ 20 (LTS)
- **npm** 10+
- Optional: Docker + Supabase CLI, Vercel CLI

### Install

```bash
git clone https://github.com/sherryyar/alloc8.git
cd alloc8
npm install
cp .env.example .env.local
```

Fill at least:

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
```

### Develop

```bash
npm run dev
```

Open **http://127.0.0.1:5173/**

### Local database (optional)

```bash
npm run supabase:start
npm run supabase:db:reset
```

Copy URL + anon key from `npm run supabase:status` into `.env.local`.

---

## Configuration

Full annotated list: **[`.env.example`](.env.example)**.

| Variable | Runtime | Purpose |
|----------|---------|---------|
| `VITE_SUPABASE_URL` | Browser | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Public key (RLS applies) |
| `VITE_APP_ACCESS_PASSWORD` | Browser | Password fallback |
| `VITE_LOGIN_SKIP_AUTH` | Browser | Dev skip-login |
| `VITE_SSO_EMAIL_DOMAIN` | Browser | Entra `domain_hint` |
| `OPENAI_API_KEY` | Server | Agent streaming |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Privileged assistant / RAG |
| `ASSISTANT_DEV_BYPASS` | Server | Local assistant auth bypass |

> Never commit `.env.local`, service-role keys, or Azure client secrets.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite + local assistant API |
| `npm run build` | Production → `dist/` |
| `npm run preview` | Preview production build |
| `npm run test:e2e` | Playwright |
| `npm run test:agent-crud` | Unit smoke (`node --test`) |
| `npm run supabase:*` | Local / linked DB workflows |
| `npm run sso:configure` | Entra + Supabase helper |
| `npm run migrate:float-csv` | Float people CSV import |
| `npm run assistant:ingest` | Ingest agent knowledge |

---

## Deployment

### GitHub

Repository: **[github.com/sherryyar/alloc8](https://github.com/sherryyar/alloc8)**

```bash
git push -u origin main
```

### Vercel

1. Import `sherryyar/alloc8`.
2. Framework: **Vite** · Build: `npm run build` · Output: `dist`.
3. Set `VITE_*` (client) and server secrets (`OPENAI_*`, service role, …).
4. Production branch: **`main`**.
5. Confirm Auth redirect allowlists include production, previews, and `http://localhost:5173/**`.

`vercel.json` keeps `/api/*` on serverless functions and sends other routes to `index.html` for client-side routing.

---

## Quality

```bash
npm run test:agent-crud
npx playwright install   # once
npm run test:e2e
npm run build            # required before merge
```

---

## Contributing

1. Branch from `main` (`feat/…`, `fix/…`).
2. Match existing API/CSS patterns under `src/`.
3. Prefer ordered SQL migrations for schema changes.
4. Do not commit secrets, dumps, or large CSVs (see `.gitignore`).
5. Open PRs against `main` with a short summary + test notes.

---

## License

**Proprietary** — internal use only unless the repository owner states otherwise.

---

<p align="center">
  <sub>Made with ❤️ by Sheher</sub>
</p>
