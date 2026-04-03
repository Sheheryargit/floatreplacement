# Float (custom platform)

Internal rebuild of a Float-style **resource scheduling** and **project** platform: schedule shell, people directory, and project registry. This repo is the front-end SPA; behaviour and data are customised for our own use.

## Repository layout

| Path | Purpose |
|------|---------|
| `index.html` | Vite entry HTML |
| `vite.config.js` | Vite + React; `@` → `src/` |
| `jsconfig.json` | Editor path hints for `@/` imports |
| `vercel.json` | SPA rewrites for client-side routes |
| `src/main.jsx` | React bootstrap |
| `src/App.jsx` | `react-router-dom` routes, lazy pages, toasts |
| `src/pages/` | Route screens (`LandingPage`, `PeoplePage`, `ProjectsPage`, `LoginPage`, `SettingsPage`) + co-located CSS |
| `src/components/` | Shared UI (modals, command palette, nav, `ui/`) |
| `src/context/` | Theme, auth, app data (Zustand-backed workspace) |
| `src/lib/` | Supabase client + API modules |
| `src/utils/` | Pure helpers (sort, colors, filters, leave visuals) |
| `src/data/` | Seed / static data |
| `supabase/` | Migrations and local Supabase config |
| `scripts/` | Helper scripts (e.g. `push-github.sh`) |
| `docs/` | Extra notes (`TECH-STACK.md`) |
| `.vscode/floatreplacement.code-workspace` | Optional VS Code multi-root workspace (opens repo root) |

**Routes:** `/` schedule, `/people`, `/projects`, `/settings`. Sidebar uses `NavLink` across pages.

## Scripts

```bash
npm install
npm run dev
```

Build: `npm run build`, preview: `npm run preview`.

## Deploy (GitHub + Vercel)

Remote for this project: **`https://github.com/Sheheryargit/floatreplacement.git`** (SSH: `git@github.com:Sheheryargit/floatreplacement.git`).

### Push from this machine

**Why SSH might fail:** GitHub must trust an SSH key. A key was generated at `~/.ssh/id_ed25519_github` and `~/.ssh/config` points `github.com` to it. Add the **public** key once:

1. Copy the key: `cat ~/.ssh/id_ed25519_github.pub`
2. GitHub → **Settings** → **SSH and GPG keys** → **New SSH key** → paste → save.
3. Test: `ssh -T git@github.com` (should say “Hi sher…!”).
4. Push: `git push -u origin main`

**Or use HTTPS + token (no SSH key on GitHub):**

1. Create a [Personal Access Token (classic)](https://github.com/settings/tokens) with **`repo`** scope.
2. Run (do not commit the token):

```bash
export GITHUB_TOKEN=ghp_your_token_here
./scripts/push-github.sh
```

The script pushes and then resets the remote URL so the token is not left in `.git/config`.

### Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → **Import** `Sheheryargit/floatreplacement`.
2. Framework: **Vite**; build `npm run build`, output `dist`.

Client-side routes use `vercel.json` rewrites so `/people` and `/projects` work on refresh.
