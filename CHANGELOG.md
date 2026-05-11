# Changelog

All notable changes to this project must be documented in this file.

This file is mandatory for all contributors and AI agents. Every task that modifies files must append one new entry before completion, including reverts and partial rollbacks.

## Entry Format (Mandatory)

Use this exact structure for each new entry:

```md
## YYYY-MM-DD HH:MM TZ | <agent-or-author> | <type>
- Summary: <one-line summary>
- Files: <comma-separated file paths>
- Details:
  - <change 1>
  - <change 2>
- Revert: <none | what was reverted and why>
```

Allowed `<type>` values:
- `add`
- `change`
- `fix`
- `revert`
- `docs`
- `chore`

---

## 2026-05-11 00:00 IST | codex | docs
- Summary: Added initial repository governance and project docs.
- Files: AGENTS.md, LICENSE, SECURITY.md, README.md, CHANGELOG.md
- Details:
  - Normalized identity guidance in `AGENTS.md` to use `(provider, subject)` and clarified email-linking and production approval rules.
  - Added `LICENSE` (MIT), `SECURITY.md`, and `README.md`.
  - Added mandatory changelog policy and entry template in `CHANGELOG.md`.
- Revert: none

## 2026-05-11 06:08 IST | codex | docs
- Summary: Added compulsory changelog governance and workflow enforcement.
- Files: AGENTS.md, README.md, CHANGELOG.md
- Details:
  - Added mandatory rule in `AGENTS.md` requiring changelog entries for every file-changing task, including reverts/rollbacks.
  - Added a compulsory changelog workflow section and acceptance checklist requirement in `AGENTS.md`.
  - Updated `README.md` project rules to surface changelog compliance to contributors.
- Revert: none

## 2026-05-11 06:09 IST | codex | fix
- Summary: Fixed ManageUsersTable pagination option typing to satisfy TypeScript.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Updated `muiPaginationProps.rowsPerPageOptions` to use object entries (`{ label, value }`) consistently, including `10`, `25`, `50`, and `All`.
  - Resolved TS2322 at `frontend/src/app/ManageUsersTable.tsx` line 327 where numeric options conflicted with expected typed option objects.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 06:12 IST | codex | fix
- Summary: Removed outer MRT shell border on Active Users and Login Activity pages to match Manage Users table styling.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced `Paper variant="outlined"` wrappers around `ActiveUsersTable` and `FailedLoginsTable` with borderless `Paper` styling.
  - Applied the same shell tweak as Manage Users: `border: "none"` and `boxShadow: "none"` while preserving spacing and radius.
- Revert: none

## 2026-05-11 06:21 IST | codex | chore
- Summary: Added a proper repository-level `.gitignore` for Node/TypeScript monorepo workflows.
- Files: .gitignore, CHANGELOG.md
- Details:
  - Added ignore rules for dependency folders, build artifacts, coverage outputs, TypeScript build info, and common cache/temp directories.
  - Added ignore patterns for environment/secret files, local logs, Cloudflare Wrangler state, OS artifacts, and IDE/editor metadata.
  - Included safe exceptions for example env files (`.env.example`, `.env.sample`) so template config can still be committed.
- Revert: none

## 2026-05-11 12:05 IST | codex | add
- Summary: Added Google Login with server-side token verification and session cookie sign-in.
- Files: api/src/core/types.ts, api/src/modules/auth/google-auth.service.ts, api/src/app/worker.ts, api/.dev.vars, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `POST /api/auth/google` in the API worker and integrated it with existing cookie-based session handling.
  - Implemented Google ID token verification against Google tokeninfo endpoint, including issuer, audience, expiry, and verified-email checks.
  - Added deterministic Google account linking/upsert into `user_accounts` by `(provider_subject)` first, then normalized email, while preserving existing role/super-admin flags on linked accounts.
  - Added Google sign-in UI on the login card (shown when `VITE_GOOGLE_CLIENT_ID` is configured) and wired successful Google auth into the same post-login app bootstrap flow.
  - Added `GOOGLE_CLIENT_ID` env support in API types and local `.dev.vars` template.
- Revert: none
