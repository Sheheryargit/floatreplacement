# Float (custom platform)

Internal rebuild of a Float-style **resource scheduling** and **project** platform: schedule shell, people directory, and project registry. This repo is the front-end SPA; behaviour and data are customised for our own use.

## Repository layout

| Path | Purpose |
|------|---------|
| `index.html` | Vite entry HTML |
| `src/main.jsx` | React bootstrap |
| `src/App.jsx` | `react-router-dom` routes |
| `src/pages/LandingPage.jsx` | Schedule landing (static mock; interactive timeline later) + `LandingPage.css` |
| `src/pages/PeoplePage.jsx` | People directory and person modal |
| `src/pages/ProjectsPage.jsx` | Projects table and project modal |
| `vite.config.js` | Vite + React; `@` → `src/` |
| `jsconfig.json` | Editor path hints for `@/` imports |

**Routes:** `/` schedule shell, `/people` people UI, `/projects` projects UI. Sidebar items use `NavLink` so Schedule / People / Projects stay in sync across pages.

## Scripts

```bash
npm install
npm run dev
```

Build: `npm run build`, preview: `npm run preview`.

## Deploy (GitHub + Vercel)

1. **Create a GitHub repository** (empty, no README required) at [github.com/new](https://github.com/new).

2. **Push this project** (from the repo folder):

```bash
git init
git add .
git commit -m "Initial commit: Float SPA"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

3. **Vercel**: Sign in at [vercel.com](https://vercel.com) → **Add New** → **Project** → **Import** your GitHub repo. Vercel detects **Vite**; leave defaults (`npm run build`, output `dist`). Deploy.

Client-side routes (`/people`, `/projects`) are handled via `vercel.json` rewrites so refreshes work in production.

## Note on `front-end/`

Earlier prototypes lived under `front-end/`. Source of truth is now `src/pages/`. Add new screens under `src/pages/` or `src/features/` as the app grows.
