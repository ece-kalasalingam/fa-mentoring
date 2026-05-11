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

## Project Rules

- Contributor guardrails and product invariants are defined in `AGENTS.md`.
- Change tracking is mandatory in `CHANGELOG.md` for every file-changing task (including reverts).
- Security reporting guidance is in `SECURITY.md`.
- Licensing is in `LICENSE` (MIT).

## Notes

- Auth/account/session behavior, navigation standards, and table UX baselines are intentionally strict in this project.
- For schema/auth changes, follow the verification checklist and SQL checks documented in `AGENTS.md`.
