# fa-mentoring

FA Mentoring workspace with:
- `frontend/`: React + Vite + TypeScript + MUI
- `api/`: Cloudflare Workers + TypeScript + Turso/libSQL

## Prerequisites

- Node.js 20+ (recommended)
- npm
- Cloudflare Wrangler CLI (installed via `api` dependencies)

## Quick Start

1. Install dependencies:
```bash
npm install
npm --prefix api install
npm --prefix frontend install
```

2. Configure API local environment:
- Create/update `api/.dev.vars` with required local secrets and bindings.

3. Run both API and frontend together:
```bash
npm run dev
```

Default local URLs:
- Frontend: `http://localhost:5173`
- API (Wrangler dev): `http://localhost:8787`

## Useful Commands

From repository root:

```bash
# Run API + frontend concurrently
npm run dev

# API tests + frontend production build
npm run build
```

API only:

```bash
npm --prefix api run dev
npm --prefix api run test
npm --prefix api run deploy
```

Frontend only:

```bash
npm --prefix frontend run dev
npm --prefix frontend run build
npm --prefix frontend run lint
```

## Deployment (Cloudflare)

Production targets:
- Frontend (Pages): `spris.eceklu.in` (project: `spris`)
- API (Worker): `spris-api.eceklu.in` (worker: `fa-mentoring-api`)

From repository root:

```bash
# Build frontend artifact
npm run build:frontend

# Redeploy API Worker
npm run deploy:worker

# Redeploy Pages frontend from frontend/dist
npm run deploy:pages

# Run all three in order
npm run deploy:all
```

Required for non-interactive/CI deploys:
- `CLOUDFLARE_API_TOKEN` (secret)

Optional (repo already pins worker account in `api/wrangler.jsonc`):
- `CLOUDFLARE_ACCOUNT_ID`

## Project Rules

- Contributor guardrails and product invariants are defined in `AGENTS.md`.
- Change tracking is mandatory in `CHANGELOG.md` for every file-changing task (including reverts).
- Security reporting guidance is in `SECURITY.md`.
- Licensing is in `LICENSE` (MIT).

## Notes

- Auth/account/session behavior, navigation standards, and table UX baselines are intentionally strict in this project.
- For schema/auth changes, follow the verification checklist and SQL checks documented in `AGENTS.md`.
