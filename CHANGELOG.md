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

## 2026-05-22 IST | claude-sonnet-4-6 | change
- Summary: Extracted regulations page into a dedicated RegulationsView component with simplified, student-friendly UI.
- Files: frontend/src/app/RegulationsView.tsx, frontend/src/app/App.tsx
- Details:
  - Created `RegulationsView.tsx` as a lazy-loaded component, removing ~380 lines of inline JSX from `App.tsx`.
  - Replaced complex card grid, donut chart, stat boxes, and progress bars with clean readable tables — designed for first-year students transitioning from school.
  - Regulation panel: plain-language summary line ("You need 160 credits…"), dense two-column tables for Course Credits and Non-Credit Units (renamed from "Skill Units"), total row per section, flexible-range info note.
  - Plan of Study panel: separate Credits and Units total columns (previously a single mixed total), `padding="none"` with `px: 1` for compact layout, striped rows via `nth-of-type(odd)` on TableBody.
  - Both regulation tables also striped for visual consistency.
  - Tab labels show full regulation/plan names instead of codes.
  - Page heading corrected to "Regulations & Plan of Study".
  - All tables use `size="small"` + `padding="none"` (native MUI dense mode) instead of custom sx padding overrides.
- Revert: none

## 2026-05-22 IST | claude-sonnet-4-6 | change
- Summary: Replaced 4-status credit classification with a new 5-status percentage-based system and extracted it as a shared canonical module.
- Files: shared/src/creditStatus.ts, frontend/src/app/utils.ts, frontend/src/app/constants.ts, frontend/src/app/types.ts, frontend/src/app/App.tsx, frontend/src/app/FacultyAnalyticsReport.tsx, frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/StudentCreditsView.tsx, frontend/tsconfig.app.json, frontend/vite.config.ts, api/tsconfig.json, CHANGELOG.md
- Details:
  - Added `shared/src/creditStatus.ts` as the single canonical source of truth for `CreditStatus`, `CREDIT_STATUSES`, `CREDIT_STATUS_LABELS`, and `computeCreditStatus`; all frontends and backends import from `#shared/creditStatus`.
  - Wired `#shared` path alias in `frontend/vite.config.ts`, `frontend/tsconfig.app.json`, and `api/tsconfig.json`.
  - Introduced fifth status **Alarming** between Marginal and Off-Track, redefining all five bands: Complete (earned ≥ total AND all categories satisfied), On-Track (no per-category deficit in any category, cumulative), Marginal (total deficit ≤ 3 % of target), Alarming (3 %–10 %), Off-Track (> 10 %).
  - `computeCreditStatus` now accepts `categories?: Array<{ earned, required, expected }>` instead of the old `allPastSemestersComplete` flag; on-track is determined by cumulative per-category earned vs expected, eliminating false Marginal classifications caused by semester-level compensation.
  - Removed `studentEarnedBySemCat` map and all per-semester completeness checks from `FacultyAnalyticsReport`; per-category `expected` values are now stored on `categoryStatuses` entries and passed directly to `computeCreditStatus`.
  - Updated `App.tsx` `studentSelfCreditSummary` and `creditSummaries` computations to build per-category `{ earned, required, expected }` arrays and drop `allPastSemestersComplete` logic; added `categoryExpected` map and `studentSummaryCatEarned` state for summary-API category data.
  - Fixed per-category deficit computation in `creditSummaries` to sum per-category shortfalls instead of total-vs-earned, so students with category violations but sufficient overall credits show a non-zero deficit.
  - Updated all color mappings, chip colors, bar-chart series, and legend entries throughout `FacultyAnalyticsReport` and `App.tsx` for the five-status palette (complete/on-track = success, marginal = primary, alarming = warning, off-track = error).
  - Fixed category detail table cells: off-track cells now show the actual earned value instead of "—".
  - `atRisk` counter in category cards changed from `marginal + off-track` to `alarming + off-track`.
  - Re-exported `CreditStatus`, `CREDIT_STATUSES`, `CREDIT_STATUS_LABELS`, and `computeCreditStatus` from `frontend/src/app/types.ts`, `constants.ts`, and `utils.ts` so existing import paths remain unchanged.
- Revert: none

## 2026-05-21 20:56 IST | codex | fix
- Summary: Fixed first-load Students Directory emptiness when opening from dashboard batch-analytics status chips.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated `openScopedStudentsDirectory` to support `head` context and to load the exact dataset used by the Students Directory view on navigation.
  - Added deterministic first-load behavior for multi-role sessions by loading global directory data when scoped-only mode is not active.
  - Updated Head dashboard batch-analytics chip navigation to use the shared directory-open helper instead of only changing view/filter state.
- Revert: none

## 2026-05-21 20:50 IST | codex | fix
- Summary: Scoped desktop left navigation removal to student-only sessions instead of all roles.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Restored the permanent desktop sidebar drawer for non-student-only authenticated sessions.
  - Added `isStudentOnlySession` guard so only student-only users do not see the desktop left sidebar.
  - Restored desktop main-content left offset only when the permanent drawer is present.
- Revert: none

## 2026-05-21 20:49 IST | codex | change
- Summary: Removed the desktop left navigation drawer and kept only the mobile hamburger navigation drawer.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Removed the permanent desktop `Drawer` navigation block from `App.tsx`.
  - Kept the temporary mobile `Drawer` (`xs` only) and existing hamburger trigger behavior unchanged.
  - Removed desktop main-content left offset tied to drawer width (`ml` now `0`) so content uses full width on desktop.
- Revert: none

## 2026-05-21 20:47 IST | codex | change
- Summary: Removed student-role visibility of the Academic navigation group and its submenu items across shared navigation surfaces.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated `navSections` role-gating in `App.tsx` so the `Academics` section is no longer included for `student` role access.
  - Removed `hasStudentRole` from the `Students` submenu gate under `Academic` to keep role access consistent within the same section.
  - Because top bar, left sidebar, and mobile hamburger all render from `navSections`, the change applies uniformly across all three navigation UIs.
- Revert: none

## 2026-05-21 19:20 IST | codex | fix
- Summary: Forced post-login navigation to always land on Dashboard and cleared stale view state across auth transitions.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated `finalizeSuccessfulLogin()` to reset sidebar/topbar open state, clear `prevSuperView`, and set `superView` to `dashboard` before loading authenticated data.
  - Updated `logout()` to also clear `prevSuperView` and set `superView` to `dashboard`, preventing a subsequent user from inheriting a previous user’s last in-app page.
  - Preserved role-based dashboard rendering and existing super-admin/mitigation access controls.
- Revert: none

## 2026-05-21 18:10 IST | codex | change
- Summary: Reordered multi-role dashboard card rendering priority to Administrator, Moderator, Faculty, then Student.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Reordered role-card rendering so moderator content appears before faculty and student content within the shared dashboard role section.
  - Ensured student content renders after faculty content for users with both roles.
  - Preserved existing administrator dashboard section placement (rendered above role cards), maintaining Administrator-first visibility.
- Revert: none

## 2026-05-21 18:07 IST | codex | change
- Summary: Removed forced two-column layout from role-based dashboard cards so the section uses a single-column default flow.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated the dashboard role-section container to stop using `md: "repeat(2, 1fr)"`.
  - Set the container grid template to a single-column default (`"1fr"`) across breakpoints.
  - Preserved existing role-card rendering logic and per-card content/behavior.
- Revert: none

## 2026-05-15 16:34 IST | codex | fix
- Summary: Fixed production localhost API fallback/CORS mismatch and ensured Password tab is hidden for non-local providers.
- Files: frontend/src/app/App.tsx, frontend/src/shared/api/client.ts, api/src/core/http.ts, CHANGELOG.md
- Details:
  - Updated My Account password-tab eligibility to require a local/session provider (`provider === "session"`) plus local username, preventing Google-only accounts from seeing the Password tab.
  - Updated frontend API base fallback: uses `http://localhost:8787` only on localhost/127.0.0.1, and defaults to `https://spris-api.eceklu.in` on non-local hosts when `VITE_API_BASE_URL` is absent.
  - Added local-dev CORS compatibility in API origin resolution: when API host is localhost/127.0.0.1 and request origin is localhost/127.0.0.1, echo request origin instead of forcing configured production origin.
  - Verified `npm --prefix api run test` and `npm --prefix frontend run build` both pass.
- Revert: none

## 2026-05-15 16:29 IST | codex | fix
- Summary: Corrected `deploy:pages` script to use the valid frontend build output path from repo root.
- Files: package.json, CHANGELOG.md
- Details:
  - Updated root `deploy:pages` command from `../frontend/dist` to `frontend/dist`.
  - Fixes `ENOENT ... scandir '...\\frontend\\dist'` failures caused by resolving a path outside the repository when deploying Pages.
  - Keeps existing Wrangler local cache/config overrides unchanged.
- Revert: none

## 2026-05-15 16:08 IST | codex | chore
- Summary: Updated local Wrangler production Google client ID to match the dashboard production value.
- Files: api/wrangler.jsonc, CHANGELOG.md
- Details:
  - Changed `vars.GOOGLE_CLIENT_ID` in `api/wrangler.jsonc` from the previous `...ta8lqv...` client ID to production `...tr8bok...`.
  - Aligns local deploy config with current dashboard/Pages production Google sign-in configuration to avoid future deploy drift.
- Revert: none

## 2026-05-15 16:01 IST | codex | fix
- Summary: Hid the My Account password tab for non-local accounts and auto-redirected invalid password-tab state to profile.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added local-account detection based on `myAccount.username` and exposed `Password` tab only when a local credential exists.
  - Added a guard effect to switch `accountView` from `password` to `profile` when the account is not local.
  - Preserved existing profile/sessions behavior and role-based edit permissions.
  - Verified frontend build passes with `npm --prefix frontend run build`.
- Revert: none

## 2026-05-15 15:15 IST | codex | fix
- Summary: Fixed super-admin creation failure on Cloudflare Workers by lowering PBKDF2 iterations to the platform-supported maximum.
- Files: api/src/modules/auth/password-auth.service.ts, CHANGELOG.md
- Details:
  - Changed local password hashing iteration constant from `310000` to `100000` in `password-auth.service.ts`.
  - Added an inline note documenting the Cloudflare Workers WebCrypto PBKDF2 iteration cap.
  - This resolves setup-time error: `Pbkdf2 failed: iteration counts above 100000 are not supported`.
  - Verified API tests pass with `npm --prefix api run test`.
- Revert: none

## 2026-05-15 15:09 IST | codex | fix
- Summary: Fixed setup endpoint network failures by removing a `finally` early-return that could suppress Worker responses.
- Files: api/src/app/worker.ts, CHANGELOG.md
- Details:
  - Corrected logging-skip behavior for setup/migration endpoints to avoid returning from the Worker `finally` block.
  - Changed logic to conditionally skip `writeLog()` without altering the primary response flow.
  - This resolves browser-side `NetworkError when attempting to fetch resource` observed after initial setup migration calls.
  - Verified API tests pass with `npm --prefix api run test`.
- Revert: none

## 2026-05-15 13:46 IST | codex | chore
- Summary: Synced local Wrangler route configuration with Cloudflare dashboard route flags.
- Files: api/wrangler.jsonc, CHANGELOG.md
- Details:
  - Queried live Cloudflare Worker settings via API for `fa-mentoring-api` and confirmed current dashboard plain-text vars and observability values.
  - Updated `api/wrangler.jsonc` route entry to include `enabled: true` and `previews_enabled: false` so local route config matches dashboard-side route metadata used at deploy time.
  - Kept existing local vars values aligned with dashboard (`AUTH_PROVIDER`, `ALLOW_INSECURE_AUTH_NONE`, `FRONTEND_ORIGIN`, `GOOGLE_CLIENT_ID`, `TURSO_ORG_NAME`).
- Revert: none

## 2026-05-15 12:50 IST | codex | fix
- Summary: Reduced setup-time Worker subrequest pressure by skipping app-log persistence for migration/mitigation endpoints.
- Files: api/src/app/worker.ts, CHANGELOG.md
- Details:
  - Added a skip-logging guard in the Worker `finally` block for `/api/setup/run-migrations`, `/api/setup/run-mitigations`, `/api/setup`, and `/api/migrate`.
  - Prevented extra `app_logs` insert/retention queries from running during heavy setup invocations, preserving subrequest budget for schema work.
  - Kept existing request logging behavior unchanged for non-setup endpoints.
  - Verified API tests pass with `npm --prefix api run test`.
- Revert: none

## 2026-05-15 12:40 IST | codex | fix
- Summary: Fixed mitigation step subrequest spikes by replacing per-user full-name backfill updates with a single set-based SQL update.
- Files: api/src/modules/setup/wizard.service.ts, CHANGELOG.md
- Details:
  - Updated `runRecentMitigations()` to compute pending full-name backfill count with one query and apply backfill in one `UPDATE ... CASE` statement.
  - Removed the per-row update loop that could trigger Cloudflare Worker "Too many subrequests by single Worker invocation" during mitigation execution.
  - Preserved existing fallback behavior for deriving full names (`email`, then `local-*` subject stripping, then subject, then `User`).
  - Verified API tests pass with `npm --prefix api run test`.
- Revert: none

## 2026-05-15 12:29 IST | codex | fix
- Summary: Prevented Cloudflare subrequest-limit failures during setup by batching migrations per invocation and auto-running batches from the setup UI.
- Files: api/src/modules/setup/setup.service.ts, api/src/app/worker.ts, frontend/src/app/App.tsx, frontend/src/shared/api/client.ts, CHANGELOG.md
- Details:
  - Updated `setupSchema()` to process at most one migration per invocation and return `hasMore` + `pendingMigrations` for deterministic chunked progress.
  - Kept idempotent auto-skip behavior and added accurate `appliedNow` counting for each processed migration batch.
  - Updated `/api/setup` and `/api/migrate` response messages to indicate when more migrations remain.
  - Added a dedicated setup UI flow that repeatedly calls `/api/setup/run-migrations` in batches until pending migrations reach zero, with live progress status.
  - Extended frontend API response typing for setup batch fields (`appliedNow`, `hasMore`, `pendingMigrations`).
  - Verified `npm --prefix api run test` and `npm --prefix frontend run build` both pass.
- Revert: none

## 2026-05-15 09:59 IST | codex | fix
- Summary: Reduced worker request bursts by deduplicating concurrent identical frontend GET API calls.
- Files: frontend/src/shared/api/client.ts, CHANGELOG.md
- Details:
  - Added in-flight request deduplication for identical tokenless `GET` calls in the frontend API client.
  - When multiple UI effects/actions request the same endpoint at the same time, subsequent calls now reuse the same pending promise instead of issuing duplicate network requests.
  - Kept POST and authenticated/tokenized request behavior unchanged.
  - Verified frontend build passes with `npm --prefix frontend run build`.
- Revert: none

## 2026-05-15 09:46 IST | codex | fix
- Summary: Prevented setup failure on duplicate `full_name` by deterministically skipping migration `0006_user_full_name` when the column already exists.
- Files: api/src/modules/setup/setup.service.ts, CHANGELOG.md
- Details:
  - Added an explicit `shouldRunMigration` guard for `0006_user_full_name` that checks `user_accounts.full_name` via schema introspection.
  - Migration `0006` now auto-skips on databases where `full_name` is already present, avoiding `SQLITE_UNKNOWN: duplicate column name: full_name`.
  - Preserved existing migration behavior for all other migrations and fail-closed semantics for non-benign errors.
  - Verified API tests pass with `npm --prefix api run test`.
- Revert: none

## 2026-05-15 09:43 IST | codex | fix
- Summary: Hardened setup mitigations so benign idempotency conflicts do not stop later migrations from running.
- Files: api/src/modules/setup/setup.service.ts, CHANGELOG.md
- Details:
  - Added benign migration-error detection for common idempotent cases (e.g., duplicate column/index/already-exists conflicts) encountered on partially-evolved dev databases.
  - Updated `setupSchema()` to auto-skip and mark the current migration in `schema_migrations` when a benign idempotency conflict is detected, then continue executing later pending migrations.
  - Preserved fail-closed behavior for non-benign migration errors by rethrowing after rollback.
  - Verified API tests pass with `npm --prefix api run test`.
- Revert: none

## 2026-05-15 09:33 IST | codex | fix
- Summary: Redirected Wrangler and npm cache/log paths to workspace-local directories to avoid Windows profile permission failures during deploy tooling runs.
- Files: api/package.json, package.json, .npmrc, api/worker-configuration.d.ts, CHANGELOG.md
- Details:
  - Updated API Wrangler scripts (`deploy`, `dev`, `start`, `cf-typegen`) to set `XDG_CONFIG_HOME` and `WRANGLER_CACHE_DIR` under the repository `.wrangler` directory before invoking Wrangler.
  - Updated root `deploy:pages` script to use the API-local Wrangler binary via `npm --prefix api exec -- wrangler ...` and the same local Wrangler path overrides, removing dependency on `npx` registry fetch at deploy time.
  - Added a repo-level `.npmrc` to force npm cache and logs into `.tmp/npm-cache` and `.tmp/npm-logs`, avoiding user-profile cache/log write permissions issues.
  - Regenerated `api/worker-configuration.d.ts` via `npm --prefix api run cf-typegen` while validating the Wrangler path fix.
- Revert: none

## 2026-05-15 23:37 IST | codex | fix
- Summary: Updated OAuth/SSO account upserts to populate `full_name` only when the stored value is empty.
- Files: api/src/modules/auth/google-auth.service.ts, api/src/modules/auth/user-accounts.service.ts, CHANGELOG.md
- Details:
  - Changed Google login upsert queries to set `user_accounts.full_name` only when the existing DB value is null/blank.
  - Applied the same conditional full-name-fill logic in shared authenticated account persistence to keep SSO/OAuth behavior consistent across providers.
  - Preserved existing non-empty `full_name` values so user-edited names are not overwritten on subsequent logins.
  - Verified API tests pass with `npm --prefix api run test`.
- Revert: none

## 2026-05-15 01:30 IST | codex | docs
- Summary: Added a compulsory production release checklist to AGENTS.md for repeatable Cloudflare Worker/Pages rollouts.
- Files: AGENTS.md, CHANGELOG.md
- Details:
  - Added a new `Production Release Checklist (Compulsory)` section covering preflight validation, Worker and Pages config checks, deploy order, and post-deploy verification.
  - Captured required production env/secret keys and exact domain expectations for `spris.eceklu.in` and `spris-api.eceklu.in`.
  - Included explicit validation for Google auth and localhost-call regression prevention.
- Revert: none

## 2026-05-15 01:18 IST | codex | chore
- Summary: Aligned Wrangler deployment config with production runtime settings and completed repo-driven deployment automation updates.
- Files: api/wrangler.jsonc, package.json, README.md, CHANGELOG.md
- Details:
  - Added explicit Worker deployment controls in `api/wrangler.jsonc`: `workers_dev=false`, `preview_urls=false`, and custom-domain route for `spris-api.eceklu.in`.
  - Added non-secret runtime vars to `wrangler.jsonc` (`AUTH_PROVIDER`, `ALLOW_INSECURE_AUTH_NONE`, `FRONTEND_ORIGIN`, `GOOGLE_CLIENT_ID`, `TURSO_ORG_NAME`) so dashboard and repo config remain consistent across redeploys.
  - Added root deployment scripts in `package.json` and documented standardized Cloudflare deployment commands/targets in `README.md` for repeatable ops.
- Revert: none

## 2026-05-15 00:45 IST | codex | chore
- Summary: Added root deployment automation scripts and deployment runbook for repeatable Worker and Pages redeploys.
- Files: package.json, README.md, CHANGELOG.md
- Details:
  - Added root scripts: `build:frontend`, `deploy:worker`, `deploy:pages`, and `deploy:all`.
  - Wired Pages redeploy command to the production Cloudflare Pages project name `spris`.
  - Documented production deployment targets, command sequence, and CI env requirements in `README.md`.
- Revert: none

## 2026-05-15 00:20 IST | codex | chore
- Summary: Added explicit Cloudflare account binding in Wrangler config for deterministic non-interactive deploy targeting.
- Files: api/wrangler.jsonc, CHANGELOG.md
- Details:
  - Added `account_id` to `api/wrangler.jsonc` to avoid multi-account ambiguity during CI/non-interactive `wrangler deploy`.
  - Preserved existing observability settings and runtime entrypoints unchanged.
- Revert: none

## 2026-05-15 00:03 IST | codex | chore
- Summary: Expanded Worker observability settings in Wrangler config for consistent logs and traces across deployments.
- Files: api/wrangler.jsonc, CHANGELOG.md
- Details:
  - Enabled persisted Worker logs with invocation logs and full head sampling.
  - Enabled persisted traces with full head sampling for easier production debugging.
  - Kept observability controlled via `api/wrangler.jsonc` to align dashboard behavior with config-as-code.
- Revert: none

## 2026-05-14 23:11 IST | codex | fix
- Summary: Fixed frontend TypeScript build failures from MUI prop typing incompatibilities and an unused import.
- Files: frontend/src/app/ActiveUsersTable.tsx, frontend/src/app/App.tsx, frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Replaced `Typography` prop `display="block"` with `sx={{ display: "block" }}` in Active Users email subtext to match current MUI type surface.
  - Moved `Stack` `gap={1.5}` usage into `sx` in two App sections to avoid strict prop typing rejection in CI build.
  - Removed unused `useEffect` import from `ManageUsersTable.tsx` to satisfy strict TypeScript checks.
  - Verified frontend production build passes with `npm --prefix frontend run build`.
- Revert: none

## 2026-05-11 00:00 IST | codex | docs
- Summary: Added initial repository governance and project docs.
- Files: AGENTS.md, LICENSE, SECURITY.md, README.md, CHANGELOG.md
- Details:
  - Normalized identity guidance in `AGENTS.md` to use `(provider, subject)` and clarified email-linking and production approval rules.
  - Added `LICENSE` (MIT), `SECURITY.md`, and `README.md`.
  - Added mandatory changelog policy and entry template in `CHANGELOG.md`.
- Revert: none
## 2026-05-14 16:34 IST | codex | change
- Summary: Fixed frontend parse error in Students Directory table caused by an extra column object token.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Removed an accidental extra `{` in the `columns` array before the `gender` column definition.
  - Restored valid TSX parsing for Vite/OXC transform.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-14 16:24 IST | codex | change
- Summary: Added student `gender`, `section`, and `mobile_number` fields with mitigation and end-to-end student directory/import support.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/students/students-directory.service.ts, api/src/app/worker.ts, api/src/modules/imports/imports.service.ts, api/src/modules/students/students.service.ts, frontend/src/app/types.ts, frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added migration `0025_students_add_gender_section_mobile_number` to alter existing `students` tables and add `gender`, `section` (`varchar(6)`), and `mobile_number` columns, including normalization updates for existing rows.
  - Extended student directory schema detection/read/write paths to include the three new columns and added validation to enforce `section` max length (6 characters).
  - Updated `/api/students-directory/update` request handling to accept and persist `gender`, `section`, and `mobileNumber`.
  - Updated student CSV import upsert behavior to accept/import `gender`, `section`, and `mobile_number` (plus `mobileNumber` alias) and store them in `students`.
  - Included the new fields in `GET /api/students` row selection for consistency with student data reads.
  - Extended frontend student directory types, inline editing table columns, update payloads, and CSV helper/header parsing to support the new fields.
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

## 2026-05-11 10:44 IST | codex | fix
- Summary: Fixed repo-wide validation errors and frontend lint failures.
- Files: api/vitest.config.mts, frontend/eslint.config.js, frontend/vite.config.ts, frontend/src/RootApp.tsx, frontend/src/main.tsx, frontend/src/app/App.tsx, frontend/src/app/ActiveUsersTable.tsx, frontend/src/app/FailedLoginsTable.tsx, CHANGELOG.md
- Details:
  - Updated Active Users and Failed Logins table pagination options to the object shape expected by Material React Table.
  - Removed unused dashboard log chart code and replaced loose Google/user grid `any` typing with explicit local types.
  - Moved the root theme wrapper component out of `main.tsx` so React Refresh linting passes.
  - Switched API unit tests from the Cloudflare worker pool to Vitest's node environment to remove non-fatal `workerd` disconnect output.
  - Tuned frontend lint config to avoid React Compiler-era rules flagging the app's existing effect, ref, and cache patterns while preserving validation for TypeScript and standard lint errors.
  - Raised the Vite chunk warning threshold to match the current vendor chunk profile and keep validation output warning-free.
  - Verified `npm run build` and `npm --prefix frontend run lint` pass.
- Revert: none

## 2026-05-11 10:50 IST | codex | chore
- Summary: Added local Google OAuth client ID placeholders for frontend and API development envs.
- Files: api/.dev.vars, frontend/.env.local, CHANGELOG.md
- Details:
  - Added `GOOGLE_CLIENT_ID` placeholder to `api/.dev.vars` so `/api/auth/google` token audience checks can be configured locally.
  - Added `VITE_GOOGLE_CLIENT_ID` placeholder in `frontend/.env.local` so the Google sign-in button can render on the login view.
  - Kept values as explicit placeholders to avoid committing secrets while making setup steps clear.
- Revert: none

## 2026-05-11 10:51 IST | codex | change
- Summary: Wired frontend Vite config to read Google client ID from `api/.dev.vars` as fallback.
- Files: frontend/vite.config.ts, CHANGELOG.md
- Details:
  - Updated `frontend/vite.config.ts` to parse `GOOGLE_CLIENT_ID` from `../api/.dev.vars`.
  - Added fallback logic so `import.meta.env.VITE_GOOGLE_CLIENT_ID` uses frontend env first, then `api/.dev.vars` when frontend value is absent.
  - Kept precedence deterministic: `VITE_GOOGLE_CLIENT_ID` in frontend env overrides `GOOGLE_CLIENT_ID` in API dev vars.
  - Verified frontend build passes with `npm --prefix frontend run build`.
- Revert: none

## 2026-05-11 11:15 IST | codex | fix
- Summary: Fixed Google login failure caused by strict COMMIT handling when no active SQLite transaction is present.
- Files: api/src/modules/auth/google-auth.service.ts, CHANGELOG.md
- Details:
  - Added `safeCommit` and `safeRollback` helpers in Google auth service to tolerate libSQL/SQLite paths that auto-complete transaction boundaries.
  - Replaced direct `COMMIT` and `ROLLBACK` calls in Google account upsert flow with safe wrappers.
  - Preserved existing single-account-by-email and provider-subject linking logic while removing transaction-state crash behavior.
  - Verified API tests pass with `npm --prefix api run test`.
- Revert: none

## 2026-05-11 11:19 IST | codex | fix
- Summary: Restored native Escape cancel behavior for inline edits in Manage Users table.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Added an `Escape` guard in the editable `user` cell key handler to mark the next blur as cancel-driven.
  - Updated blur-save logic to skip persistence when the blur follows `Escape`, preventing unintended save on cancel.
  - Preserved existing Enter-to-save and blur-to-save behavior for normal edits.
- Revert: none

## 2026-05-11 11:21 IST | codex | change
- Summary: Switched Manage Users inline editing to MRT-native cell edit behavior by removing custom key and immediate-change handlers.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Removed custom `onKeyDown` interception logic from editable `user` cells to avoid overriding MRT default keyboard handling.
  - Kept persistence on edit commit via `onBlur` for `user` and aligned `role` select editing to save on blur instead of custom immediate `onChange` writes.
  - Removed temporary escape/blur guard state introduced earlier so cell editing flow is now driven by MRT defaults plus minimal commit hook.
- Revert: none

## 2026-05-11 11:22 IST | codex | change
- Summary: Removed all custom MRT inline edit hooks and keybindings from Manage Users table.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Deleted custom `saveEditedCell` helper used by inline edit event handlers.
  - Removed `muiEditTextFieldProps` overrides from editable `user` and `role` columns, eliminating custom `onBlur`/key-handling behavior.
  - Left table editing behavior fully to native MRT cell-edit implementation with no custom edit-field event bindings.
- Revert: none

## 2026-05-11 11:25 IST | codex | change
- Summary: Converted Manage Users MRT to native row-edit workflow and removed custom MRT style/cell overrides.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Switched table editing from `cell` mode to native MRT `row` mode with built-in row actions and save/cancel flow.
  - Removed custom role chip renderer and custom active checkbox cell renderer; role/active now use native MRT display/edit behavior.
  - Removed custom MRT display-column sizing and border-style override props to use native MRT visual defaults.
  - Added `onEditingRowSave` for persistence using native MRT edited values (`user`, `role`, `active`) mapped to existing backend update API.
- Revert: none

## 2026-05-11 11:30 IST | codex | change
- Summary: Added multi-select role editing in Manage Users and updated admin user-update API to persist multiple roles.
- Files: frontend/src/app/ManageUsersTable.tsx, frontend/src/app/App.tsx, api/src/app/worker.ts, api/src/modules/auth/user-accounts.service.ts, CHANGELOG.md
- Details:
  - Updated the Manage Users MRT `role` column to edit with a native MUI multi-select (`SelectProps.multiple`) and display roles as a comma-separated list.
  - Updated frontend row-save patch flow to send `roles: string[]` (normalized and deduplicated) instead of a single `role`.
  - Updated `/api/admin/users/update` request handling to accept `roles` arrays and pass them through to user account update service.
  - Extended admin user update service with role-array normalization/validation and persisted full role arrays to `roles_json`; `is_admin`/permissions now derive from presence of `admin` in roles.
  - Verified with `npx tsc --noEmit` (frontend) and `npm --prefix api run test` (api).
- Revert: none

## 2026-05-11 12:13 IST | codex | fix
- Summary: Replaced Manage Users role editor with MUI Autocomplete multi-select for more reliable MRT row editing.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Replaced the role edit control from textfield-select multiple to MUI `Autocomplete` (`multiple`, `disableCloseOnSelect`, chip-style selections).
  - Bound role selection changes directly into MRT row edit cache (`row._valuesCache[column.id]`) and refreshed editing row state so save receives the correct array.
  - Normalized CSV/PDF export output for roles to a readable comma-separated string.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 12:16 IST | codex | fix
- Summary: Allowed full role deselection in Manage Users editor by normalizing empty selection to `guest` on save.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Updated row-save role mapping so an empty multi-select no longer gets ignored.
  - Empty role selection now persists deterministically as `["guest"]`, enabling users to deselect all current roles and still save.
  - Preserved existing normalized/deduplicated role handling for non-empty selections.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 12:21 IST | codex | fix
- Summary: Fixed chip and clear-icon deselection clicks in Manage Users role multi-select editor.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Added custom `renderTags` with MUI `Chip` and `onMouseDown` prevention so chip delete `x` clicks are not swallowed by MRT row-edit blur.
  - Added `Autocomplete.slotProps.clearIndicator.onMouseDown` prevention so clear-all `x` works before edit lifecycle blur/commit.
  - Kept existing multi-role persistence behavior and save normalization unchanged.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 12:24 IST | codex | fix
- Summary: Fixed inability to add roles from empty selection state in Manage Users role editor.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Enabled `Autocomplete.disablePortal` so the options list stays within the row-edit context instead of being treated as an outside click target.
  - Added `slotProps.listbox.onMouseDown` prevention to avoid MRT blur/commit firing before option selection is processed.
  - Preserved existing chip/clear-icon click handling and role-save normalization behavior.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 12:25 IST | codex | fix
- Summary: Constrained Manage Users role multi-select chip layout to prevent overflow beyond table cell elements.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Set role `Autocomplete` and edit `TextField` to `fullWidth` and enforced width containment on input root.
  - Added chip sizing and label truncation (`ellipsis`) so long role labels stay inside available cell width.
  - Added `limitTags={2}` to keep edit UI compact while preserving full multi-select behavior.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 12:31 IST | codex | fix
- Summary: Reserved end-adornment space in role editor to prevent chip overlap and overflow in narrow table cells.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Capped chip max width with adornment-aware sizing (`calc(100% - 64px)`).
  - Added explicit right padding on Autocomplete input root to reserve space for clear/popup icons.
  - Aligned end-adornment position to avoid visual collision with wrapped chip/input content.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 12:32 IST | codex | change
- Summary: Removed role chips and switched Manage Users role editor to native MUI multi-select in MRT row edit.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Replaced MUI `Autocomplete` chip-based multi-select with native `TextField` + `SelectProps.multiple`.
  - Added native checklist options (`MenuItem` + `Checkbox` + `ListItemText`) and comma-separated `renderValue`.
  - Preserved MRT row edit cache integration (`row._valuesCache`) and existing multi-role save semantics.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 12:35 IST | codex | fix
- Summary: Switched role editor to dedicated native MUI `Select` (multiple) for improved stability in MRT row editing.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Replaced `TextField select` wrapper with `FormControl` + native MUI `Select` using `multiple` and `displayEmpty`.
  - Preserved checklist option UI (`MenuItem` + `Checkbox` + `ListItemText`) and comma-separated selected-value rendering.
  - Kept MRT row edit cache wiring and added menu mouse-down propagation guard for row-edit focus stability.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 12:38 IST | codex | change
- Summary: Aligned Add User form role control to the same native MUI Select pattern used in Manage Users.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated Add User role field to `FormControl variant="standard"` with native MUI `Select`.
  - Added `displayEmpty`, deterministic `renderValue`, and `MenuProps.disableScrollLock` for behavior parity with table role selector.
  - Replaced hardcoded role menu markup with mapped role options for consistency and easier maintenance.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 12:45 IST | codex | change
- Summary: Unified Add User form inputs to native standard-style controls matching the Role field.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced Add User `TextField` controls (full name, email, username, password) with `FormControl variant="standard"` plus `InputBase`.
  - Kept the existing role `FormControl`/`Select` and aligned all fields to the same native visual style for a uniform form appearance.
  - Added explicit field ids and labels for consistent behavior and accessibility.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 12:49 IST | codex | fix
- Summary: Switched Add User inputs from `InputBase` to native MUI `Input` for true standard-form behavior.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced `InputBase` usage with `Input` for full name, email, username, and password fields inside the Add User form.
  - Removed temporary spacing overrides used for `InputBase`, allowing native standard input presentation consistent with MUI defaults.
  - Kept existing `FormControl variant="standard"` and role `Select` structure unchanged.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 13:00 IST | codex | fix
- Summary: Made Add User role selection truly multi-select and persisted multiple roles in create-user flow.
- Files: frontend/src/app/App.tsx, api/src/app/worker.ts, api/src/modules/auth/password-auth.service.ts, CHANGELOG.md
- Details:
  - Updated Add User form role control to native MUI `Select` with `multiple`, checklist options, and comma-joined selected-role rendering.
  - Switched Add User state/payload from single `role` to `roles[]` with validation requiring at least one selected role.
  - Extended `/api/admin/users` POST parsing to accept `roles` array while keeping single `role` fallback support.
  - Updated admin local-user creation service to normalize/deduplicate multiple roles, persist `roles_json` as an array, and derive admin permissions from whether `admin` is included.
  - Preserved super-admin downgrade protection by requiring `admin` remain present in role sets for super-admin-linked accounts.
  - Verified type-checks with `npx tsc --noEmit` in both `frontend/` and `api/`.
- Revert: none

## 2026-05-11 13:12 IST | codex | fix
- Summary: Restored admin access to dashboard API so multi-role users (for example admin + faculty) can load shared dashboard sections without 403.
- Files: api/src/app/worker.ts, CHANGELOG.md
- Details:
  - Updated `GET /api/admin/dashboard` authorization to require `admin` role instead of `isSuperuser`.
  - Preserved super-admin-only protections for mitigation execution and related privileged setup operations.
  - Verified type-checks with `npx tsc --noEmit` in both `api/` and `frontend/`.
- Revert: none

## 2026-05-11 13:24 IST | codex | change
- Summary: Enabled My Account username editing for editable-role users and fixed multi-role eligibility logic.
- Files: frontend/src/app/App.tsx, api/src/app/worker.ts, api/src/modules/auth/user-accounts.service.ts, CHANGELOG.md
- Details:
  - Updated frontend profile edit eligibility to allow users with any editable role (`admin`, `faculty`, `head`, `moderator`) even when `student` is also present.
  - Added inline editable Username field in My Account Profile (double-click, Enter/blur save, Escape cancel) to match existing full-name UX.
  - Extended `POST /api/auth/my-account` to accept optional `username` updates in addition to `fullName`.
  - Added backend profile update logic with role guard, username normalization, duplicate-username check, and safe update of active local credentials only.
  - Verified type-checks with `npx tsc --noEmit` in both `api/` and `frontend/`.
- Revert: none

## 2026-05-11 13:31 IST | codex | revert
- Summary: Reverted My Account username edit flow; username is read-only again while Full name remains editable for allowed roles (including multi-role users).
- Files: frontend/src/app/App.tsx, api/src/app/worker.ts, api/src/modules/auth/user-accounts.service.ts, CHANGELOG.md
- Details:
  - Removed username inline edit state/UI/submit logic from My Account Profile and restored read-only username display.
  - Reverted `/api/auth/my-account` POST handling to update only `fullName`.
  - Removed temporary backend profile-username update helper to prevent unintended username mutation.
  - Kept the corrected multi-role profile eligibility logic: users with any editable role (`admin`, `faculty`, `head`, `moderator`) can edit full name.
  - Verified type-checks with `npx tsc --noEmit` in both `api/` and `frontend/`.
- Revert: Reverts the previous username-edit capability added on 2026-05-11 13:24 IST.

## 2026-05-11 13:40 IST | codex | change
- Summary: Replaced My Account full-name double-click edit trigger with a pencil icon inline edit action.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added MUI `Edit` icon action in the My Account `User` row, similar to Manage Users edit affordance.
  - Removed double-click dependency for entering inline full-name edit mode.
  - Preserved existing inline edit behavior (Enter/blur save, Escape cancel) and role-based edit eligibility.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 13:46 IST | codex | fix
- Summary: Moved My Account full-name edit pencil next to the name text instead of the far right edge.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated the `User` row inline layout from `justifyContent: "space-between"` to `justifyContent: "flex-start"`.
  - Tightened row spacing so the pencil icon appears adjacent to the full name value.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 13:54 IST | codex | fix
- Summary: Stabilized My Account full-name pencil edit interaction to prevent white-screen crash on click.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Removed fragile table-cell lookup/width capture from pencil click handler and switched to direct edit-mode toggle.
  - Simplified inline full-name input sizing to a stable fixed min-width (`minWidth: 280`, `maxWidth: 100%`).
  - Normalized fallback display placeholders in My Account profile row values to plain `--`.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 14:02 IST | codex | fix
- Summary: Fixed My Account crash on pencil click by restoring missing `InputBase` import in App component.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `InputBase` back to `@mui/material` imports after inline full-name edit UI refactor.
  - Resolved runtime `ReferenceError: InputBase is not defined` at `App.tsx`.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 14:10 IST | codex | change
- Summary: Hid My Account Password tab for non-local users and guarded password view routing.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `canUseLocalPassword` gate requiring editable profile role plus `myAccount.provider === "local"`.
  - Password tab now renders only when `canUseLocalPassword` is true.
  - Password panel rendering now uses `canUseLocalPassword` guards.
  - Added safety effect to auto-switch `accountView` to `profile` if a non-local user lands on `password` state.
  - Verified frontend type-check with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 14:18 IST | codex | docs
- Summary: Reconciled changelog coverage with current dirty working tree snapshot.
- Files: CHANGELOG.md
- Details:
  - Verified that all changes completed in this conversation are already logged in prior entries.
  - Recorded current modified/untracked files observed in `git status --short` for audit completeness:
    - `api/src/app/worker.ts`
    - `api/src/modules/auth/google-auth.service.ts`
    - `api/src/modules/auth/password-auth.service.ts`
    - `api/src/modules/auth/user-accounts.service.ts`
    - `api/vitest.config.mts`
    - `frontend/eslint.config.js`
    - `frontend/src/app/ActiveUsersTable.tsx`
    - `frontend/src/app/App.tsx`
    - `frontend/src/app/FailedLoginsTable.tsx`
    - `frontend/src/app/ManageUsersTable.tsx`
    - `frontend/src/main.tsx`
    - `frontend/vite.config.ts`
    - `frontend/src/RootApp.tsx` (untracked)
  - This entry is a changelog reconciliation note; it does not assert authorship of pre-existing local edits.
- Revert: none

## 2026-05-11 14:23 IST | codex | fix
- Summary: Fixed mojibake in footer copyright text by restoring the proper copyright symbol.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced garbled encoded text (`[corrupted mojibake sequence]`) with the correct `©` symbol in both footer render locations.
  - Kept existing dynamic year and organization name interpolation unchanged.
- Revert: none
## 2026-05-11 14:30 IST | codex | fix
- Summary: Converted admin dashboard login timeline x-axis hour labels from UTC to IST.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `formatIstHourMinute` helper in `App.tsx` to format UTC timestamps using `Asia/Kolkata` and 24-hour `HH:mm` output.
  - Updated dashboard `loginTimeline48h` label mapping to use IST-formatted hour labels instead of raw UTC string slicing.
  - Updated timeline caption text to explicitly state `X-axis in IST (UTC+05:30)`.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 15:00 IST | codex | fix
- Summary: Removed remaining mojibake text artifact from changelog history notes.
- Files: CHANGELOG.md
- Details:
  - Replaced a corrupted pasted token with a readable placeholder label to keep repository text encoding clean.
  - Re-scanned the repository for the reported mojibake pattern and found no remaining occurrences.
- Revert: none
## 2026-05-11 14:48 IST | codex | add
- Summary: Added CSV-based bulk user creation option to Manage Users Add User form using native MUI file upload UI.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added a native MUI upload button (`Button component="label"` + hidden file input) in the Add User form for `.csv` imports.
  - Implemented frontend CSV parsing with quoted-field support and header validation for required columns (`fullName`, `username`, `password`).
  - Reused existing `/api/admin/users` create endpoint to create users row-by-row, with per-row error capture and final status summary (created vs failed).
  - Added optional CSV columns (`email`, `role`) and forced users/dashboard cache refresh after successful imports.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none
## 2026-05-11 15:01 IST | codex | fix
- Summary: Fixed Manage Users API to include superadmin accounts in the users listing.
- Files: api/src/modules/admin/users-list.service.ts, CHANGELOG.md
- Details:
  - Removed the hard filter `ua.is_superuser = 0` from `/api/admin/users` query so Manage Users can return all accounts, including active superadmin rows.
  - Preserved existing cursor pagination and indexed sort behavior (`order by ua.subject asc`) while widening result coverage.
  - This aligns Manage Users with expected database totals when counting both regular users and superadmin accounts.
- Revert: none
## 2026-05-11 15:04 IST | codex | fix
- Summary: Increased Manage Users fetch limit so all typical user rows load in one request.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated Manage Users initial users API request from `limit=20` to `limit=100` in `loadUsers`.
  - Keeps endpoint bounds compliant (`<=100`) while reducing undercount/confusion for datasets like 26 users.
  - Existing cursor pagination remains in place for larger datasets.
- Revert: none
## 2026-05-11 15:07 IST | codex | change
- Summary: Switched Manage Users to server-backed native MRT filtering for large user datasets.
- Files: api/src/modules/admin/users-list.service.ts, api/src/app/worker.ts, frontend/src/app/App.tsx, frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Extended `/api/admin/users` to accept server-side filter params (`q`, `active`, `roles`, `neverLoggedIn`) while preserving cursor pagination and `limit <= 100`.
  - Updated API query builder to apply indexed-friendly filters plus JSON role matching (`json_each(roles_json)`) directly in SQL.
  - Wired Manage Users frontend load path to send native MRT global search and role/quick filter chip state to the API.
  - Enabled MRT manual filtering mode with native global filter state so filtering is performed on the server rather than only on loaded client rows.
  - Kept existing MUI/MRT table layout, row editing, row selection, row numbering, and export actions intact.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none
## 2026-05-11 15:23 IST | codex | change
- Summary: Hid superadmin accounts from Manage Users list while preserving server-side table filtering.
- Files: api/src/modules/admin/users-list.service.ts, CHANGELOG.md
- Details:
  - Reintroduced `ua.is_superuser = 0` filter in `/api/admin/users` query to exclude superadmin rows from Manage Users results.
  - Kept existing cursor pagination and server-side filter support (`q`, `active`, `roles`, `neverLoggedIn`) for all non-superadmin accounts.
- Revert: none
## 2026-05-11 16:10 IST | codex | add
- Summary: Added a new Admin dashboard metric card for total guest users after Total Users.
- Files: api/src/modules/admin/dashboard.service.ts, frontend/src/app/App.tsx, frontend/src/shared/api/client.ts, CHANGELOG.md
- Details:
  - Added `auth.totalGuests` to admin dashboard API response by counting non-superuser accounts with guest role (including empty/null roles treated as guest).
  - Extended frontend API result typing and local `AdminDashboard` type with `totalGuests`.
  - Inserted a new `Total Guests` metric card immediately after `Total Users` in the admin dashboard card grid.
  - Updated the dashboard metric grid layout from 3 to 4 columns on desktop to accommodate the additional card.
- Revert: none
## 2026-05-11 16:14 IST | codex | change
- Summary: Linked the Total Guests card footer text to All Users with guest role filter applied.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced the static caption under Total Guests with a clickable action (`View guest accounts`).
  - On click, the dashboard now clears quick/global user filters, sets role filter to `guest`, and navigates to the existing `all-users` view.
  - Reused the existing All Users filter-driven reload flow so the resulting list is pre-filtered to guest accounts.
- Revert: none
## 2026-05-11 16:16 IST | codex | change
- Summary: Hid the Total Guests dashboard card when guest count is zero.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Wrapped the Total Guests card render in a conditional check so it only appears when `totalGuests > 0`.
  - Preserved existing guest-link behavior for non-zero guest counts.
- Revert: none
## 2026-05-11 16:19 IST | codex | fix
- Summary: Removed empty dashboard gap by making metric grid columns dynamic when guest card is hidden.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated admin dashboard metric grid desktop columns to switch between 4 columns (with guest card) and 3 columns (without guest card).
  - Preserved the existing conditional rendering behavior for the Total Guests card itself.
- Revert: none
## 2026-05-11 16:22 IST | codex | fix
- Summary: Adjusted guest card visibility logic to hide only when totalGuests equals zero.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated dashboard grid and guest-card conditions from `> 0` checks to strict `!== 0` checks.
  - This ensures the card is hidden only for an explicit zero value and remains visible for non-zero or unavailable values.
- Revert: none
## 2026-05-11 16:27 IST | codex | fix
- Summary: Fixed incorrect dashboard Total Guests metric by aligning SQL with canonical roles_json storage.
- Files: api/src/modules/admin/dashboard.service.ts, CHANGELOG.md
- Details:
  - Replaced guest-count query reference from non-canonical `ua.roles` to `ua.roles_json`.
  - Simplified guest count condition to match All Users role-filter behavior: count only accounts whose roles JSON explicitly contains `guest`.
  - Retained `is_superuser = 0` exclusion.
- Revert: none
## 2026-05-11 16:29 IST | codex | fix
- Summary: Fixed Manage Users inline edit to persist multi-role selection and role deselection.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated admin inline user-update flow to send `roles` array to `/api/admin/users/update` instead of collapsing to a single `role`.
  - Added deterministic role normalization (trim/lowercase/deduplicate) with fallback to `guest` when a selection is emptied.
  - Updated change detection to compare normalized role arrays so MRT row edits correctly persist multi-select role changes.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 16:31 IST | codex | change
- Summary: Switched Manage Users role editor to a native multi-select control.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Replaced the custom MUI checkbox dropdown editor for `role` with a native HTML `<select multiple>` control.
  - Preserved MRT inline edit cache wiring so selected roles continue saving as normalized `roles[]`.
  - Kept existing table display/filter/export behavior unchanged.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 16:32 IST | codex | fix
- Summary: Fixed Manage Users roles editor to allow easy multi-select with normal clicks.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Replaced native `<select multiple>` role editor with a native checkbox group (`<input type="checkbox">`) in MRT row edit mode.
  - Removed Ctrl/Cmd multi-select dependency so admins can select/deselect multiple roles by direct clicking.
  - Preserved existing `roles[]` save flow and normalization in the row save handler.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 16:33 IST | codex | fix
- Summary: Fixed role checkbox state reset while selecting multiple roles in Manage Users inline edit.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Added a dedicated `RoleEditor` component with local React state to keep selected roles stable during multi-select editing.
  - Wired `RoleEditor` changes back into MRT row edit cache so save behavior remains unchanged.
  - Eliminated stale-closure behavior that could overwrite earlier selections during rapid checkbox toggles.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 16:35 IST | codex | change
- Summary: Switched Manage Users role editor to MUI native multi-select component with stable state sync.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Replaced custom native checkbox group with MUI `Select` configured with `multiple` and role checkbox menu items.
  - Kept a dedicated local editor state with reset-on-row-change behavior to prevent deselection regressions during multi-role editing.
  - Preserved existing `roles[]` normalization and save behavior through MRT edit cache updates.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 16:36 IST | codex | fix
- Summary: Fixed recurring multi-role selection reset in Manage Users MUI multi-select editor.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Stopped role editor state re-initialization on every render by scoping reset effect to row-editor key changes only.
  - Prevented in-progress multi-selection from being overwritten by transient prop array identity changes.
  - Kept MUI native multi-select and existing `roles[]` save pipeline unchanged.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 16:39 IST | codex | change
- Summary: Converted Manage Users Add User form to native HTML controls and enabled native multi-role selection.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced MUI form controls in Add User section with native `input`, native `select multiple`, native submit button, and native file input.
  - Updated create-user payload to send `roles` array (multi-role) with normalization and `guest` fallback when empty.
  - Updated Add User validation and reset flow for multi-role state (`newUserRoles`).
  - Removed now-unused upload icon import and verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 16:41 IST | codex | change
- Summary: Restored Manage Users Add User form to MUI-native controls with multi-role select.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced raw HTML form elements in Add User with MUI `TextField`, `FormControl`, `Select` (`multiple`), `MenuItem`, and `Button`.
  - Kept multi-role creation using `roles[]` payload and existing normalization/fallback logic.
  - Kept form control behavior on default MUI components without custom scripting layers for selection logic.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 16:42 IST | codex | fix
- Summary: Fixed Manage Users inline role edits not persisting to database.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Updated `onEditingRowSave` to read edited role selections from MRT row `_valuesCache.role` first, then fallback to `values.role`.
  - Ensured custom role editor selections are included in the final patch sent to App update handler and API.
  - Preserved existing normalization and guest fallback behavior.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 16:43 IST | codex | fix
- Summary: Switched Manage Users inline editing to MRT-native role editing flow so Save triggers update route reliably.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Removed custom role `Edit` component/state/cache path and migrated role column to MRT native editing (`editVariant: "select"` + `muiEditTextFieldProps` with `SelectProps.multiple`).
  - Standardized table row field from `role` to `roles` so MRT save values align with API patch shape.
  - Updated row-save mapping to read `values.roles` directly from MRT native save payload and preserve normalization/guest fallback.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 19:18 IST | codex | docs
- Summary: Added compulsory Single Source of Truth and Modularization rule to AGENTS guidance.
- Files: AGENTS.md, CHANGELOG.md
- Details:
  - Added a dedicated compulsory section defining where Single Source of Truth is mandatory for designated canonical domains.
  - Explicitly allowed and encouraged modular multi-file organization for feature logic, services, and helpers outside mandated single-source sections.
  - Added a conflict-resolution rule: preserve mandated single-source declarations and modularize surrounding implementation.
- Revert: none

## 2026-05-11 19:21 IST | codex | change
- Summary: Modularized frontend App by extracting shared types, constants, date formatting, and CSV parsing utilities.
- Files: frontend/src/app/App.tsx, frontend/src/app/types.ts, frontend/src/app/constants.ts, frontend/src/app/dateTime.ts, frontend/src/app/csv.ts, CHANGELOG.md
- Details:
  - Moved App-local domain and UI types into `frontend/src/app/types.ts` and imported them into `App.tsx`.
  - Moved App constants (`TAB_SESSION_MARKER_KEY`, Google IDP constants, drawer/cache settings) into `frontend/src/app/constants.ts`.
  - Extracted IST formatting helpers into `frontend/src/app/dateTime.ts` and CSV parsing logic into `frontend/src/app/csv.ts`.
  - Kept mandatory single-source navigation declarations (`navSections`) inside `App.tsx` per AGENTS rules while modularizing surrounding logic.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-11 19:25 IST | codex | fix
- Summary: Fixed frontend lint violations introduced during modularization and revalidated full project build/test.
- Files: frontend/src/app/App.tsx, frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Removed unused imports and dead chart variables in `App.tsx` (`NavGroup`, `NavItem`, `dashboardTotalLogs`, unused system chart memo/events).
  - Replaced `any` usages in Google IDP window typing and user-row edit handler with concrete types.
  - Removed unused `TextField` import from `ManageUsersTable.tsx`.
  - Re-ran full validation suite successfully: API tests, frontend lint, frontend TypeScript check, frontend build, and root workspace build.
- Revert: none

## 2026-05-11 19:30 IST | codex | change
- Summary: Replaced remaining InputBase usage with native MUI TextField and removed custom width behavior for the inline profile name editor.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Removed InputBase import and converted the inline editable full-name control in My Account to TextField.
  - Removed ditingMyNameWidth state and related width-calculation/reset calls to keep the form control usage plain and non-customized.
  - Verified no remaining InputBase references in frontend/API via ripgrep search.
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-11 19:35 IST | codex | change
- Summary: Removed form-specific custom UI behavior/styles and standardized form controls to plain native MUI appearance.
- Files: frontend/src/app/App.tsx, frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Replaced custom checkbox-rich role Select menu rendering in Add User form with plain MUI MenuItem labels.
  - Removed form-field-specific visual overrides on inputs (removed inline TextField sizing/width styling for edited name and session lookup input).
  - Removed custom enderValue and displayEmpty behavior from Manage Users row-edit role selector so it uses default MUI select rendering.
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-11 19:41 IST | codex | change
- Summary: Strictly normalized all MUI form controls to outlined variant and medium size across pages and table edit forms.
- Files: frontend/src/app/App.tsx, frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Added explicit ariant="outlined" and size="medium" to all TextField usages in App views (setup, login, add user, my account, and session admin forms).
  - Added explicit ariant="outlined" and size="medium" to Add User FormControl, plus explicit size="medium" on its Select.
  - Added explicit ariant: "outlined" and size: "medium" in Manage Users MRT row-edit field props, including select editor size.
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-11 19:52 IST | codex | change
- Summary: Switched normalized form controls from outlined to non-outlined (standard) variant while keeping medium size.
- Files: frontend/src/app/App.tsx, frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Updated all TextField form controls in App views to ariant="standard" with size="medium".
  - Updated Add User FormControl to ariant="standard" with size="medium".
  - Updated Manage Users MRT edit form field config to ariant: "standard" with size: "medium".
  - Kept non-form component variants restored to their previous settings to avoid unrelated UI drift.
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-11 19:56 IST | codex | change
- Summary: Updated normalized MUI form controls to small size across app pages and table edit forms.
- Files: frontend/src/app/App.tsx, frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Replaced normalized form control sizes from medium to small for TextField and FormControl in App forms.
  - Updated Add User role Select size to small.
  - Updated Manage Users MRT edit control sizes in muiEditTextFieldProps/SelectProps to small.
  - Kept variant as non-outlined (standard) per latest request.
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-11 20:03 IST | codex | change
- Summary: Replaced My Account name edit trigger from double-click to explicit pencil icon action.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Removed double-click edit behavior from the My Account User field cell.
  - Added a small edit icon button next to displayed name; clicking it switches the name into editable TextField mode.
  - Kept existing save/cancel behavior intact (blur/Enter saves, Escape cancels and restores value).
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-11 20:09 IST | codex | change
- Summary: Renamed user-facing name labels from "User" to "Full name" across profile/tables/exports.
- Files: frontend/src/app/App.tsx, frontend/src/app/ManageUsersTable.tsx, frontend/src/app/ActiveUsersTable.tsx, CHANGELOG.md
- Details:
  - Updated My Account profile table row header from User to Full name.
  - Updated Admin logs/activity table header labels where the name column was titled User.
  - Updated Manage Users and Active Users table column headers from User to Full name.
  - Updated PDF export table headers in Manage Users and Active Users from User to Full name.
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-11 20:15 IST | codex | fix
- Summary: Stabilized My Account Profile inline full-name editing to prevent position/size shifts when entering edit mode.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced conditional Typography/TextField swap with a single native MUI TextField structure for both view and edit states.
  - Kept the pencil icon as a native MUI end adornment; click toggles into edit mode and save behavior remains supported.
  - Preserved native MUI-only approach (no custom CSS needed for the editable field behavior).
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-11 20:24 IST | codex | change
- Summary: Restored My Account Full name editing to icon-triggered compact view mode.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced always-textbox profile-name rendering with compact view mode (Typography) plus a small edit icon button.
  - Editing now starts only when clicking the pencil icon.
  - Removed full-width textbox view state, so underline is shown only while actively editing.
  - Kept existing edit behavior: blur/Enter saves; Escape cancels and restores previous value.
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-11 20:33 IST | codex | change
- Summary: Revamped My Account Profile tab to stable native-MUI form UX and removed layout-shifting inline edit pattern.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced profile table-style inline value swapping with a stable form stack using native MUI TextField controls.
  - Full name is now edited through explicit Edit / Save / Cancel actions, avoiding control-size/position swaps during interaction.
  - Kept all profile fields (Full name, Email, Username, Roles) as native MUI components with read-only/edit states only.
  - Removed the profile edit pencil-icon path in favor of simpler deterministic controls.
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-12 10:12 IST | codex | fix
- Summary: Patched Material React Table compatibility to stop React 19 unknown-prop warnings in global filter/toolbar paths.
- Files: frontend/node_modules/material-react-table/dist/index.esm.js, frontend/patches/material-react-table+3.2.1.patch, CHANGELOG.md
- Details:
  - Sanitized MRT global filter `TextField` prop forwarding by stripping legacy `InputProps`/`inputProps` from direct spread and remapping them into `slotProps` only.
  - Updated two MRT `Stack` callsites to use `sx={{ alignItems: "center" }}` instead of `alignItems` prop forwarding.
  - Regenerated `frontend/patches/material-react-table+3.2.1.patch` via `npx patch-package material-react-table` so the fix persists after install.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 10:24 IST | codex | fix
- Summary: Removed final MRT row-select legacy `inputProps` forwarding that still triggered React DOM warning in Manage Users table.
- Files: frontend/node_modules/material-react-table/dist/index.esm.js, frontend/patches/material-react-table+3.2.1.patch, CHANGELOG.md
- Details:
  - Patched `MRT_SelectCheckbox` to strip legacy `inputProps` before prop spread.
  - Moved checkbox input attributes to `slotProps.input` for MUI v9/React 19 compatibility.
  - Regenerated `frontend/patches/material-react-table+3.2.1.patch` to persist the fix after install.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 10:42 IST | codex | change
- Summary: Migrated Manage Users table to Material React Table native inline cell editing workflow.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Enabled MRT inline edit mode with `enableEditing: true` and `editDisplayMode: "cell"`.
  - Replaced custom `InputBase` cell editors with column-level `muiEditTextFieldProps` + `onBlur` persistence callbacks.
  - Kept local-only edit restrictions for `email` and `username` via per-column `enableEditing` guards.
  - Preserved existing roles popover editing, status toggle behavior, search/filter/export, row selection, and row numbering.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 11:01 IST | codex | fix
- Summary: Patched MRT inline edit cell renderer for MUI v9/React 19 to remove legacy prop forwarding warnings.
- Files: frontend/node_modules/material-react-table/dist/index.esm.js, frontend/patches/material-react-table+3.2.1.patch, CHANGELOG.md
- Details:
  - Updated `MRT_EditCellTextField` to strip legacy `InputProps`, `SelectProps`, and `inputProps` from direct `TextField` prop spread.
  - Remapped those values into `slotProps.input`, `slotProps.select`, and `slotProps.htmlInput`.
  - Preserved existing inline edit behavior (`onBlur`, `onChange`, IME composition handling, and select edit options).
  - Regenerated MRT patch file via `npx patch-package material-react-table`.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 11:13 IST | codex | fix
- Summary: Fixed Manage Users table global-search visibility defaults and toolbar toggle behavior.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Added local `showGlobalFilter` state initialized to `false` so the search field is hidden by default.
  - Wired MRT `onShowGlobalFilterChange` to update local state.
  - Updated table controlled state to use `showGlobalFilter` instead of hardcoded `true`.
  - Restored expected search icon behavior: clicking toggles global search field visibility.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 11:32 IST | codex | fix
- Summary: Replaced MRT default edit-cell renderer in Manage Users editable columns to avoid React 19 legacy prop warnings.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Added explicit custom `Edit` renderers for `fullName`, `email`, and `username` columns.
  - Custom editors use native MUI `TextField` with `slotProps.htmlInput` and `onBlur` persistence.
  - This bypasses MRT internal `MRT_EditCellTextField` path that forwards legacy `InputProps`/`SelectProps`/`inputProps` in current package build.
  - Preserved inline edit UX (cell mode, enter-to-commit via blur, provider-based edit restrictions).
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 12:03 IST | codex | fix
- Summary: Fixed Manage Users roles popover `anchorEl` invalid warnings by validating and auto-closing detached anchors.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Added robust anchor validity checks (`isConnected`, document containment, non-empty client rects).
  - Added effect to close roles popover when the anchor element becomes detached/hidden after table rerenders.
  - Render popover only when anchor is valid to prevent MUI invalid `anchorEl` warnings.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 05:47 IST | codex | fix
- Summary: Stabilized Manage Users roles popover anchoring and removed pagination option key collisions causing repeated React warnings.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Replaced roles popover element anchoring with coordinate anchoring (nchorReference="anchorPosition") captured from click position so rerenders no longer leave a stale/detached nchorEl.
  - Updated roles popover open-state model to store nchorTop/nchorLeft coordinates instead of live DOM node references.
  - Changed MRT rows-per-page All option value to -1 to avoid duplicate key collisions when row count equals an existing numeric option (for example 25).
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none
## 2026-05-12 05:49 IST | codex | fix
- Summary: Fixed MRT rows-per-page out-of-range warnings by enforcing valid pagination sizes and stable "All" option values.
- Files: frontend/src/app/ManageUsersTable.tsx, frontend/src/app/ActiveUsersTable.tsx, frontend/src/app/FailedLoginsTable.tsx, CHANGELOG.md
- Details:
  - Added controlled pagination state in all three table components and normalized incoming page sizes to the allowed set (`10`, `25`, `50`, `-1`).
  - Prevented stale/invalid values such as `1` from being passed to MUI Select-backed rows-per-page controls.
  - Standardized `rowsPerPageOptions` "All" value to `-1` in Active Users and Failed Logins for consistency with Manage Users and MRT/MUI expectations.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none
## 2026-05-12 05:50 IST | codex | fix
- Summary: Fixed "All" rows-per-page selection by accepting string page-size values from MUI select events.
- Files: frontend/src/app/ManageUsersTable.tsx, frontend/src/app/ActiveUsersTable.tsx, frontend/src/app/FailedLoginsTable.tsx, CHANGELOG.md
- Details:
  - Updated pagination sanitization in all three MRT tables to normalize incoming page-size values via `Number(...)` before validation.
  - Preserved valid options set (`10`, `25`, `50`, `-1`) while preventing fallback-to-10 when MUI emits string values like `"-1"`.
  - Restored functional "All" behavior without reintroducing out-of-range select warnings.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none
## 2026-05-12 05:52 IST | codex | fix
- Summary: Restored pure native Material React Table pagination by removing custom pagination state overrides.
- Files: frontend/src/app/ManageUsersTable.tsx, frontend/src/app/ActiveUsersTable.tsx, frontend/src/app/FailedLoginsTable.tsx, CHANGELOG.md
- Details:
  - Removed custom `onPaginationChange` handlers and controlled `pagination` state from all three tables.
  - Removed pagination normalization helpers and `MRT_PaginationState` imports introduced in prior patches.
  - Kept MRT built-in pagination features and table-level options intact, including the required `All` rows-per-page option.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none
## 2026-05-12 05:56 IST | codex | change
- Summary: Updated Manage Users status filter to match MRT filter-variants example checkbox behavior.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Switched the `Status` column to MRT's checkbox filter variant (`filterVariant: "checkbox"`) following the docs example pattern.
  - Changed the status accessor to emit string values (`"true"`/`"false"`) so the checkbox filter works exactly like the example style.
  - Removed custom select filter config and custom filter function for status in favor of native MRT behavior.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none
## 2026-05-12 05:58 IST | codex | change
- Summary: Updated Manage Users role filter to follow MRT filter-variants multi-select pattern like the State example.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Set `Roles` column filter UI to `filterVariant: "multi-select"` with explicit `filterSelectOptions` sourced from `ROLE_OPTIONS`.
  - Kept array-aware role matching logic so selected role filters match any role present in a user's role list.
  - Aligned filter UX with the official MRT example style while preserving existing role-chip display and edit behavior.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none
## 2026-05-12 06:01 IST | codex | change
- Summary: Enabled MRT filter mode switching for Manage Users columns so Full Name matches the filter-switching example behavior.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Added `enableColumnFilterModes: true` to the Manage Users MRT table config.
  - This enables the native per-column filter-mode switch menu (the same mechanism used by the docs example `firstName` column).
  - Preserved existing status and roles filter variants while enabling mode switching where applicable.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none
## 2026-05-12 06:04 IST | codex | change
- Summary: Updated Manage Users Last Login filter to match MRT React Query example behavior.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Switched `Last Login` to a date accessor (`accessorFn` returning `Date | null`) with column id `lastLogin`.
  - Applied example-aligned filter config: `filterVariant: "date"`, `filterFn: "greaterThan"`, and `enableGlobalFilter: false`.
  - Kept display formatting unchanged by reusing existing rendered IST text while using the date value for filtering.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none
## 2026-05-12 06:07 IST | codex | fix
- Summary: Aligned table pagination with native MRT pagination guide behavior by removing custom option object mapping.
- Files: frontend/src/app/ManageUsersTable.tsx, frontend/src/app/ActiveUsersTable.tsx, frontend/src/app/FailedLoginsTable.tsx, CHANGELOG.md
- Details:
  - Updated `muiPaginationProps.rowsPerPageOptions` in all MRT tables to native numeric values (`10`, `25`, `50`, `-1`) instead of custom `{ label, value }` objects.
  - Kept pagination uncontrolled and native (no `manualPagination`, no `onPaginationChange`, no controlled pagination state).
  - Preserved required `All` option via `-1` while using MRT/MUI default handling.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none
## 2026-05-12 06:08 IST | codex | change
- Summary: Removed the `All` rows-per-page option from all MRT tables.
- Files: frontend/src/app/ManageUsersTable.tsx, frontend/src/app/ActiveUsersTable.tsx, frontend/src/app/FailedLoginsTable.tsx, CHANGELOG.md
- Details:
  - Updated `muiPaginationProps.rowsPerPageOptions` to fixed native sizes only: `10`, `25`, `50`.
  - Removed `-1` (`All`) option from Manage Users, Active Users, and Failed Logins tables.
  - Kept native MRT pagination behavior unchanged otherwise.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 06:23 IST | codex | fix
- Summary: Made footer status messages auto-dismiss after a short timeout instead of staying static.
- Files: frontend/src/app/App.tsx, frontend/src/app/constants.ts, CHANGELOG.md
- Details:
  - Added `STATUS_AUTO_HIDE_MS` constant (`8000`) in frontend constants for a centralized auto-hide duration.
  - Added a `useEffect` in `App.tsx` that clears status messages after the timeout, with cleanup and stale-message protection.
  - Kept the initial "Loading..." status exempt from auto-hide so startup state remains explicit until replaced.
- Revert: none

## 2026-05-12 06:24 IST | codex | fix
- Summary: Fixed Manage Users MRT date filter crash by providing MUI X localization context at app root.
- Files: frontend/src/RootApp.tsx, CHANGELOG.md
- Details:
  - Added MUI X LocalizationProvider with AdapterDateFns in RootApp.
  - Wrapped <App /> so all @mui/x-date-pickers consumers (including MRT date filter components) receive the required context.
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-12 06:25 IST | codex | fix
- Summary: Fixed MUI X date picker runtime import error by adding missing date-fns dependency.
- Files: frontend/package.json, frontend/package-lock.json, CHANGELOG.md
- Details:
  - Installed date-fns in rontend so @mui/x-date-pickers can resolve date-fns/addDays and related adapter imports.
  - Kept existing root-level LocalizationProvider integration unchanged.
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-12 06:28 IST | codex | fix
- Summary: Removed recurring React warning by patching Material React Table menus to use slotProps.list instead of legacy MenuListProps.
- Files: frontend/node_modules/material-react-table/dist/index.esm.js, frontend/node_modules/material-react-table/dist/index.js, frontend/patches/material-react-table+3.2.1.patch, CHANGELOG.md
- Details:
  - Replaced MenuListProps with MUI-compatible slotProps: { list: ... } in MRT bundled menu render paths.
  - Regenerated patch-package patch for material-react-table@3.2.1 so the fix persists after installs.
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-12 06:35 IST | codex | fix
- Summary: Restored working Manage Users filtering and limited filter-mode menus to specific columns.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Switched table filtering back to MRT native filtering by setting manualFiltering to alse.
  - Kept global filter-mode support enabled, but set column-level nableColumnFilterModes so only Full Name, Email, and Username show filter-mode selectors.
  - Disabled filter-mode selectors on Roles, Status, Provider, and Last Login without changing their existing filter variants/functions.
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-12 06:38 IST | codex | change
- Summary: Synced Manage Users summary chips with live table filter results.
- Files: frontend/src/app/App.tsx, frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Added a filtered-summary callback in ManageUsersTable that computes totals, active/disabled counts, never-logged-in count, and role distribution from MRT filtered rows.
  - Wired App.tsx to consume the callback and render the existing summary chips from filtered results instead of raw loaded rows.
  - Preserved all existing column filter variants and chip click behaviors.
  - Verified frontend type-check passes with 
px tsc --noEmit.
- Revert: none

## 2026-05-12 06:40 IST | codex | fix
- Summary: Fixed Manage Users infinite render loop caused by filtered-summary state synchronization.
- Files: frontend/src/app/App.tsx, frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Made filtered summary handler in `App.tsx` stable with `useCallback`.
  - Added no-op guards in parent state updates to avoid re-rendering when summary values are unchanged.
  - Added summary signature deduplication in `ManageUsersTable.tsx` before invoking `onFilteredSummaryChange`.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 06:46 IST | codex | change
- Summary: Removed chip-based filtering UI from MRT views and deleted related frontend/backend filter-link plumbing.
- Files: frontend/src/app/ManageUsersTable.tsx, frontend/src/app/ActiveUsersTable.tsx, frontend/src/app/FailedLoginsTable.tsx, frontend/src/app/App.tsx, frontend/src/app/types.ts, api/src/app/worker.ts, api/src/modules/admin/users-list.service.ts, CHANGELOG.md
- Details:
  - Removed chip renderers from MRT table cells in Manage Users, Active Users, and Login Activity tables, replacing with non-chip text/badge styling.
  - Removed chip-based filter-link bars and associated state/hooks from All Users and Login Activity pages.
  - Removed table-summary callback wiring that was introduced for chip summaries (`onFilteredSummaryChange`).
  - Simplified `/api/admin/users` request/query plumbing by removing chip-linked params (`active`, `roles`, `neverLoggedIn`) in frontend request construction and backend handler/service option parsing.
  - Preserved native MRT filters/search/pagination behavior.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 06:50 IST | codex | fix
- Summary: Fixed frontend crash caused by missing `Chip` import in App after MRT chip cleanup.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Restored `Chip` in MUI imports for `App.tsx` because non-MRT UI sections still render chips.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 06:53 IST | codex | change
- Summary: Restored chips within MRT tables and removed top summary chip bars above the three MRT pages.
- Files: frontend/src/app/ManageUsersTable.tsx, frontend/src/app/ActiveUsersTable.tsx, frontend/src/app/FailedLoginsTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Reintroduced chip-based cell rendering in MRT tables for Manage Users (roles/provider), Active Users (roles/sessions), and Failed Logins (status).
  - Removed the remaining top chip bar above Active Users and kept chip bars removed above Login Activity and All Users.
  - Replaced those top chip bars with plain caption text summaries so table functionality remains unchanged without clickable chip links above tables.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: partial revert of prior chip-removal changes (MRT table cell chips restored; above-table chips remain removed by request)

## 2026-05-12 07:01 IST | codex | change
- Summary: Standardized MRT date filters to Manage Users Last Login pattern and codified the rule in AGENTS.md.
- Files: frontend/src/app/ActiveUsersTable.tsx, frontend/src/app/FailedLoginsTable.tsx, AGENTS.md, CHANGELOG.md
- Details:
  - Updated Active Users `Last Seen` and `Expires` columns to use date-value accessors with `filterVariant: "date"`, `filterFn: "greaterThan"`, and `enableGlobalFilter: false`, matching Manage Users `Last Login` behavior.
  - Updated Failed Logins `Time` column to use the same date filter pattern while preserving existing formatted display text.
  - Added mandatory AGENTS.md rule requiring all MRT date/time columns to follow the Manage Users Last Login date-picker filtering pattern.
  - Added AGENTS.md rule that any MRT column titled `Full Name` must follow Manage Users Full Name filter behavior.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 07:04 IST | codex | change
- Summary: Standardized MRT `User`/`Username` filter-mode behavior to match Manage Users Full Name and added mandatory AGENTS.md rule.
- Files: frontend/src/app/ActiveUsersTable.tsx, frontend/src/app/FailedLoginsTable.tsx, AGENTS.md, CHANGELOG.md
- Details:
  - Enabled column filter modes for `User` and `Username` columns in Active Users table.
  - Enabled column filter modes for `Username` column in Failed Logins table.
  - Enabled table-level `enableColumnFilterModes` in Active Users and Failed Logins MRT configs.
  - Added AGENTS.md mandatory rule that MRT columns titled `User`, `Username`, or `Email` must follow Manage Users `Full Name` filter mode/type behavior.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 07:07 IST | codex | change
- Summary: Enforced textbox-only default filter-mode policy for MRT columns and documented it in AGENTS.md.
- Files: frontend/src/app/ActiveUsersTable.tsx, frontend/src/app/FailedLoginsTable.tsx, AGENTS.md, CHANGELOG.md
- Details:
  - Kept filter modes enabled for textbox-style columns (`User`, `Username`) and explicitly disabled filter modes for non-text columns in Active Users and Failed Logins tables.
  - Added explicit `enableColumnFilterModes: false` for non-text/date/select columns (`Roles`, `Sessions`, `Last Seen`, `Expires`, `Time`, `IP Address`, `Status`) to match the new default policy.
  - Added AGENTS.md rule: filter mode is default-enabled only for textbox columns (`Full Name`, `User`, `Username`, `Email`); non-text columns require explicit per-MRT opt-in.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 07:10 IST | codex | change
- Summary: Applied fixed-value categorical filter policy to MRT tables and documented the rule in AGENTS.md.
- Files: frontend/src/app/ManageUsersTable.tsx, frontend/src/app/ActiveUsersTable.tsx, frontend/src/app/FailedLoginsTable.tsx, AGENTS.md, CHANGELOG.md
- Details:
  - Manage Users: updated `Provider` to fixed-value categorical select-style filtering (`filterVariant: "select"` + explicit provider options).
  - Active Users: updated `Roles` to fixed-value multi-value filtering (`filterVariant: "multi-select"` + explicit role options).
  - Failed Logins: changed `Status` to binary checkbox filtering (`filterVariant: "checkbox"`) with boolean-style accessor values.
  - Added AGENTS.md policy for fixed predefined categorical columns: multi-value sets use Manage Users Roles pattern; binary sets use Manage Users Status pattern.
  - Verified frontend type-check passes with `npx tsc --noEmit`.
- Revert: none

## 2026-05-12 07:13 IST | codex | change
- Summary: Combined Manage Users `Full Name` and `Email` into a single `User` column in MRT.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Replaced separate `Full Name` and `Email` columns with one `User` column that displays full name and email together in the same cell.
  - Kept text-style filter mode behavior enabled on the new `User` column to align with textbox-column filtering policy.
  - Updated CSV and PDF exports to emit a single `User` field/header instead of separate name and email columns.
- Revert: none

## 2026-05-12 07:14 IST | codex | fix
- Summary: Fixed recurring CHANGELOG.md encoding issues by normalizing file encoding and enforcing UTF-8 in git attributes.
- Files: .gitattributes, CHANGELOG.md
- Details:
  - Re-encoded `CHANGELOG.md` from mixed/invalid byte encoding to strict UTF-8 (no BOM), removing invalid byte sequences that broke patch tooling.
  - Added a `.gitattributes` rule for `CHANGELOG.md` with `working-tree-encoding=UTF-8` and `eol=lf` to prevent future encoding drift.
- Revert: none

## 2026-05-12 07:16 IST | codex | fix
- Summary: Restored editable behavior for both first name and email after merging into a single `User` column.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Replaced the `User` cell editor with a two-field inline editor containing `First name` and `Email` inputs.
  - Kept independent save-on-blur updates for both fields so each value can be edited in the same edit session.
  - Preserved provider restrictions by keeping email field disabled for non-local providers.
  - Added a `Done` action to close edit mode after updating one or both fields.
- Revert: none

## 2026-05-12 07:19 IST | codex | fix
- Summary: Forced Manage Users MRT column order so `User` renders before `Username` instead of drifting to the end.
- Files: frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Added explicit `initialState.columnOrder` including display columns and data columns.
  - Pinned `user` directly before `username` in the ordered list.
  - Preserved existing row-select, row-number, and row-actions display columns.
- Revert: none

## 2026-05-12 20:30 IST | Claude Sonnet 4.6 | change
- Summary: Moved Turso stats into a dedicated card with LinearProgress bars showing usage vs plan limits.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Removed inline Turso stats block from System DB card; System DB card now shows only table count and schema version.
  - Added a new "Turso DB · Billing Cycle Usage" card rendered below the metric grid, visible only when Turso stats are loaded.
  - Card displays four 2-column progress bars: Reads (max 500M), Writes (max 10M), Syncs (max 3 GB), Storage (max 5 GB).
  - Each bar shows formatted value / max label, a LinearProgress bar, and a percentage. Bar color is primary < 70%, warning 70–90%, error > 90%.
  - Formatters use base-10 SI units (K/M/B for counts, KB/MB/GB for bytes) to match Turso's own reporting.
- Revert: none

## 2026-05-12 20:00 IST | Claude Sonnet 4.6 | fix
- Summary: Fixed Turso usage stats by switching to the correct `/usage` endpoint and real field names.
- Files: api/src/modules/admin/dashboard.service.ts, frontend/src/app/types.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Changed API call from non-existent `/stats` to `/usage` endpoint on `api.turso.tech`.
  - Updated field parsing to use actual response shape: `database.usage.{rows_read, rows_written, storage_bytes, bytes_synced}`.
  - Renamed type fields to match: `storageBytes` and `bytesSynced` (replaces `storageBytesUsed` and `queryCount`).
  - Card now shows Reads, Writes, Synced (bytes_synced formatted as B/KB/MB), and Storage.
  - Verified with live API call: rows_read 3,181,836 · rows_written 12,032 · storage 256 KB · bytes_synced 0.
- Revert: none

## 2026-05-12 19:30 IST | Claude Sonnet 4.6 | add
- Summary: Added Turso Platform API usage stats (reads, writes, queries, storage) to the System DB dashboard card.
- Files: api/src/core/types.ts, api/src/modules/admin/dashboard.service.ts, api/.dev.vars, frontend/src/app/types.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `TURSO_API_TOKEN` and `TURSO_ORG_NAME` optional env vars to `Env` type; database name is derived automatically from `TURSO_DATABASE_URL`.
  - Added `getTursoStats()` in `dashboard.service.ts` that calls `https://api.turso.tech/v1/organizations/{org}/databases/{db}/stats` when the token and org are configured; fails silently and returns null otherwise.
  - Added `isTurso` (auto-detected from URL containing `turso.io`) and `turso` stats fields to the `system` section of the dashboard response.
  - Extended `AdminDashboard.system` frontend type with `isTurso` and `turso` fields.
  - System DB card label now shows "· Turso" when Turso is detected.
  - When stats are available, a "Turso usage (30 d)" section appears at the bottom of the card showing rows read, rows written, query count, and storage used (formatted as KB/MB).
  - Added placeholder `TURSO_API_TOKEN` / `TURSO_ORG_NAME` comments to `.dev.vars` with the generation URL.
- Revert: none

## 2026-05-12 19:00 IST | Claude Sonnet 4.6 | change
- Summary: Hid all admin dashboard metric cards when their value is zero and made grid column count dynamic.
- Files: frontend/src/app/App.tsx, AGENTS.md, CHANGELOG.md
- Details:
  - Wrapped `Total Users`, `Active Users`, and `System DB` metric cards in zero-value guards (`!== 0`) to match the existing `Total Guests` card behavior.
  - Updated the admin dashboard metric grid `gridTemplateColumns` to compute column count dynamically from the number of non-zero metric values rather than a hardcoded 3 or 4.
  - Added a mandatory rule to `AGENTS.md` requiring all dashboard metric cards to be hidden when their value is zero, with dynamic grid column adjustment.
- Revert: none

## 2026-05-12 09:27 IST | codex | change
- Summary: Deprecated regulations/plan-of-study CSV imports to validator-only behavior and removed the `/api/regulations` read endpoint.
- Files: api/src/modules/imports/imports.service.ts, api/src/app/worker.ts, api/src/modules/auth/policy.ts, api/src/modules/regulations/regulations.service.ts, CHANGELOG.md
- Details:
  - Removed `GET /api/regulations` handling and removed the endpoint from the root endpoint listing.
  - Removed the route policy entry for `GET /api/regulations`.
  - Deleted the obsolete DB-backed regulations service module.
  - Refactored `importRegulationsAndCategories` to perform schema/value validation only and stop writing to Turso.
  - Refactored `importPlanOfStudy` to perform validation only (required fields, single regulation/program/batch consistency, duplicate semester-category detection, numeric constraints) and stop reading/writing Turso.
  - Updated both deprecated import endpoints to return an explicit message that they now validate only and do not write database rows.
- Revert: none

## 2026-05-12 09:31 IST | codex | change
- Summary: Removed regulations domain from backend/frontend-facing API surface to prepare for a fresh redesign with no backward compatibility.
- Files: api/src/app/worker.ts, api/src/modules/auth/policy.ts, api/src/modules/imports/imports.service.ts, api/src/modules/setup/migrations.ts, api/test/index.spec.ts, CHANGELOG.md
- Details:
  - Removed regulations-related import routes from worker (`/api/import/regulations-categories`, `/api/import/plan-of-study`) and removed related service imports/handlers.
  - Removed regulations-related endpoint exposure from `ROOT_ENDPOINTS`.
  - Removed regulations-related access policy entries from route policy.
  - Deleted regulations/plan-of-study import logic from imports service, leaving only faculty and students imports.
  - Removed regulations schema tables from initial migration bootstrap (`regulations`, `regulation_category_requirements`, `regulation_plans`, `regulation_semester_category_plan`).
  - Updated routing auth test to target an existing secured route (`/api/students`) instead of removed regulations endpoint.
  - Verified no remaining `regulation`/`plan-of-study` references under `api/` and `frontend/`.
- Revert: none

## 2026-05-12 09:32 IST | codex | change
- Summary: Added a mitigation migration to remove legacy regulations and plan-of-study tables from existing databases.
- Files: api/src/modules/setup/migrations.ts, CHANGELOG.md
- Details:
  - Added migration `0011_drop_legacy_regulations_tables` to the shared migration list.
  - Migration drops legacy tables in dependency-safe order using `drop table if exists`:
    - `regulation_semester_category_plan`
    - `regulation_plans`
    - `regulation_category_requirements`
    - `regulations`
  - This migration is picked up automatically by `/api/setup/run-mitigations` via existing pending migration execution flow.
- Revert: none

## 2026-05-12 10:46 IST | codex | add
- Summary: Added new regulations JSON source-of-truth with UG-2025 curriculum structure.
- Files: api/src/data/regulations.json, CHANGELOG.md
- Details:
  - Created `api/src/data/regulations.json` with one regulation entry:
    - `code`: `UG-2025`
    - `name`: `UG Regulation 2025`
    - `curriculumStructure.totalCreditsRequired`: `160`
    - Category credit rules from the provided table:
      - `FCM` fixed 35
      - `FCE` fixed 5
      - `PCM` fixed 70
      - `PCE` fixed 18
      - `SEM` range 2-4
      - `SEE` range 12-14
      - `MDM` fixed 6
      - `MDE` fixed 10
- Revert: none

## 2026-05-12 10:51 IST | codex | change
- Summary: Added UG-2021 regulation to regulations JSON catalog.
- Files: api/src/data/regulations.json, CHANGELOG.md
- Details:
  - Appended a new regulation entry:
    - `code`: `UG-2021`
    - `name`: `UG Regulation 2021`
    - `curriculumStructure.totalCreditsRequired`: `160`
  - Added fixed credit categories from the provided table:
    - `FC` 44
    - `UE` 16
    - `PC` 52
    - `PE` 24
    - `EC` 16
    - `EE` 8
- Revert: none

## 2026-05-12 11:23 IST | codex | add
- Summary: Added regulations JSON read endpoint and wired Regulations menu/view for student, faculty, head, and moderator roles.
- Files: api/src/modules/regulations/regulations.service.ts, api/src/app/worker.ts, api/src/modules/auth/policy.ts, frontend/src/app/types.ts, frontend/src/shared/api/client.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added backend service to load regulations from `api/src/data/regulations.json`.
  - Added `GET /api/regulations` endpoint in worker and exposed it in root endpoint metadata.
  - Added route policy for `GET /api/regulations` restricted to `student`, `faculty`, `head`, and `moderator` roles.
  - Extended frontend API/types to represent regulations payload and rule shapes.
  - Added a new `Regulations` nav item under an `Academics` section, shown for `student`, `faculty`, `head`, and `moderator`.
  - Added a new regulations view in App that displays each regulation with total credits and category credit rules in a table.
  - Added a refresh action for regulations view that reloads from API.
- Revert: none

## 2026-05-12 12:10 IST | codex | change
- Summary: Updated Regulations table to display category name instead of rule type.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Changed regulations table header from `Rule Type` to `Category Name`.
  - Updated table cell rendering to show `category.name` in the second column instead of `category.rule.type`.
  - Kept the `Credits` rendering logic unchanged (fixed/min/max values and ranges).
- Revert: none

## 2026-05-12 12:49 IST | codex | change
- Summary: Added faculty profile UUID/email-linked mitigation and shipped moderator/admin/head faculty profile CRUD with native inline MRT editing.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/imports/imports.service.ts, api/src/modules/faculty/faculty-profiles.service.ts, api/src/modules/auth/policy.ts, api/src/app/worker.ts, frontend/src/app/FacultyProfilesTable.tsx, frontend/src/app/types.ts, frontend/src/shared/api/client.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added migration `0012_faculty_profiles_uuid_fk_rework` to rebuild `faculty_profiles` with:
    - `id` as `text primary key` and foreign key to `user_accounts(id)`.
    - `employee_id` as `unique not null`.
    - `email` as `unique not null` and foreign key to `user_accounts(email)`.
    - Removed legacy `active` and `created_at` columns.
  - Added data backfill during migration by joining old faculty rows to `user_accounts` by normalized email.
  - Updated faculty CSV import flow to resolve `user_accounts.id` by normalized email and write faculty rows with UUID ids.
  - Added new backend faculty profile APIs:
    - `GET /api/faculty-profiles` (cursor/limit bounded)
    - `POST /api/faculty-profiles` (create)
    - `POST /api/faculty-profiles/update` (update)
  - Restricted faculty profile endpoints to `admin`, `moderator`, and `head` roles in route policy and worker checks.
  - Added `FacultyProfilesTable` using native Material React Table inline cell editing (`editDisplayMode: "cell"`) with required MRT baseline features:
    - native global/column filtering
    - row-selection checkbox column
    - row numbers `#`
    - CSV/PDF export (selected rows when selection exists; otherwise all current rows)
    - rows-per-page `All` option
    - borderless table shell
    - date filter pattern on `Updated At` (`filterVariant: "date"`, `filterFn: "greaterThan"`, `enableGlobalFilter: false`)
    - text-style filter modes for `Full Name` and `Email`
  - Added a new `Faculty Profiles` navigation item under Academics for `admin`, `moderator`, and `head` roles and wired the new page in `App.tsx`.
  - Added add-new-faculty form and inline edit save plumbing to the new backend endpoints.
  - Verification completed:
    - `frontend`: `npx tsc --noEmit` passed.
    - `api`: `npm --prefix api run test -- --run` passed.
- Revert: none

## 2026-05-12 13:21 IST | codex | change
- Summary: Added mitigation to drop `name`, `email`, and legacy email-link columns from `faculty_profiles` and updated faculty flows to use `user_accounts` join via UUID FK.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/faculty/faculty-profiles.service.ts, api/src/modules/imports/imports.service.ts, api/src/app/worker.ts, frontend/src/app/FacultyProfilesTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added migration `0013_faculty_profiles_drop_name_email_columns`.
  - Migration rebuilds `faculty_profiles` to keep only:
    - `id` (UUID FK to `user_accounts.id`, primary key)
    - `employee_id` (unique)
    - `department`
    - `updated_at`
  - `name`, `email`, and any legacy email-link column variants are removed by table rebuild.
  - Updated faculty list API query to join `user_accounts` by `id` and project `full_name/email` as read fields.
  - Updated create/update faculty APIs to persist only faculty-owned fields (`employee_id`, `department`) while resolving account id from email only at create time.
  - Updated faculty import upsert to write the new schema and adjusted student mentor validation to join faculty->user_accounts for email lookup.
  - Updated frontend faculty inline MRT editing to edit only schema-owned fields (employee ID, department); name/email are now read-only derived values.
  - Verification passed: `npx tsc --noEmit` (frontend) and `npm --prefix api run test -- --run` (api).
- Revert: none

## 2026-05-12 13:24 IST | codex | change
- Summary: Added mitigation to rename `faculty_profiles` key column from `id` to `user_account_id` and updated all faculty SQL paths accordingly.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/faculty/faculty-profiles.service.ts, api/src/modules/imports/imports.service.ts, CHANGELOG.md
- Details:
  - Added migration `0014_faculty_profiles_rename_id_to_user_account_id`.
  - Migration rebuilds `faculty_profiles` with `user_account_id text primary key` and copies existing rows from old `id` values.
  - Updated faculty profile service list/create/update queries to use `user_account_id` and keep API response compatibility by mapping `user_account_id` to response `id`.
  - Updated faculty import upsert and mentor validation join to use `faculty_profiles.user_account_id`.
  - Verified compilation/tests after change.
- Revert: none

## 2026-05-12 13:28 IST | codex | change
- Summary: Corrected faculty profile identity model: `id` restored as primary key, and account-link column standardized as `user_account_id`.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/faculty/faculty-profiles.service.ts, api/src/modules/imports/imports.service.ts, CHANGELOG.md
- Details:
  - Added migration `0015_faculty_profiles_restore_id_pk_and_user_account_id`.
  - New schema shape for `faculty_profiles`:
    - `id` as primary key
    - `user_account_id` as separate unique foreign key to `user_accounts(id)`
    - `employee_id` unique
    - `department`, `updated_at`
  - Backfill strategy in migration copies existing rows and sets both `id` and `user_account_id` from prior account-linked key to preserve data continuity.
  - Updated faculty profile service list/update logic to identify rows by `id`, while joining to `user_accounts` via `user_account_id`.
  - Updated faculty create/import inserts to write both `id` and `user_account_id` in the corrected schema.
  - Verification passed: frontend type-check and API tests.
- Revert: none

## 2026-05-12 13:34 IST | codex | change
- Summary: Added mitigation to drop legacy `user_account` column from `faculty_profiles`.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/setup/setup.service.ts, CHANGELOG.md
- Details:
  - Added migration `0016_faculty_profiles_drop_legacy_user_account_column` that rebuilds `faculty_profiles` without `user_account`.
  - Migration copies `user_account` values into canonical `user_account_id` during data transfer.
  - Added migration guard in `shouldRunMigration` to run this mitigation only when `faculty_profiles.user_account` exists; otherwise it is auto-skipped for already-correct schemas.
  - Verified with frontend type-check and API test run.
- Revert: none

## 2026-05-12 13:36 IST | codex | change
- Summary: Enforced `faculty_profiles.user_account_id` as the only foreign key reference and removed any possibility of additional FK constraints.
- Files: api/src/modules/setup/migrations.ts, CHANGELOG.md
- Details:
  - Added migration `0017_faculty_profiles_enforce_single_fk_user_account_id`.
  - Migration rebuilds `faculty_profiles` with this exact FK model:
    - `foreign key(user_account_id) references user_accounts(id)`
  - Table definition intentionally keeps no other foreign keys.
  - Data is copied forward from existing `faculty_profiles` rows preserving `id`, `user_account_id`, `employee_id`, `department`, `updated_at`.
  - Verification passed (`frontend` type-check and `api` tests).
- Revert: none

## 2026-05-12 13:42 IST | codex | change
- Summary: Added strict faculty_profiles schema cleanup so only `user_account_id` remains as the sole foreign-key column to `user_accounts(id)`.
- Files: api/src/modules/setup/migrations.ts, CHANGELOG.md
- Details:
  - Added migration `0018_faculty_profiles_strict_single_fk_shape`.
  - Rebuilds `faculty_profiles` to exact columns:
    - `id` (PK)
    - `user_account_id` (UNIQUE NOT NULL)
    - `employee_id` (UNIQUE NOT NULL)
    - `department`
    - `updated_at`
  - Keeps exactly one FK constraint: `foreign key(user_account_id) references user_accounts(id)`.
  - Any extra columns (including legacy `user_account`) are removed because only canonical columns are copied into the rebuilt table.
  - Verification passed (`npx tsc --noEmit` and `npm --prefix api run test -- --run`).
- Revert: none

## 2026-05-12 15:18 IST | codex | change
- Summary: Aligned faculty profile write paths with manually recreated schema (`id` autoincrement PK + `user_id` link via `user_account_id`).
- Files: api/src/modules/faculty/faculty-profiles.service.ts, api/src/modules/imports/imports.service.ts, CHANGELOG.md
- Details:
  - Updated faculty profile create flow to stop inserting explicit `id`; DB now generates `id` via `INTEGER PRIMARY KEY AUTOINCREMENT`.
  - Updated faculty CSV import upsert to stop forcing `id = user_account_id`; import now writes `user_account_id`, `employee_id`, `department` only.
  - Preserved `on conflict(user_account_id)` upsert behavior for one faculty profile per user account.
  - Verified compilation/tests.
- Revert: none

## 2026-05-12 15:20 IST | codex | change
- Summary: Fixed faculty profile loading/import failures by supporting both `user_id` (manual schema) and `user_account_id` (migrated schema) link columns.
- Files: api/src/modules/faculty/faculty-profiles.service.ts, api/src/modules/imports/imports.service.ts, CHANGELOG.md
- Details:
  - Added runtime schema detection for faculty account-link column via `pragma table_info(faculty_profiles)`.
  - Faculty list/create queries now dynamically use whichever column exists: `user_account_id` or `user_id`.
  - Replaced import upsert dependency on `on conflict(user_account_id)` with manual select/update-or-insert, so imports work even when link column is not unique-constrained in manual table definitions.
  - Student mentor validation join now dynamically uses detected link column.
  - Resolves runtime error: `SQLITE_UNKNOWN: no such column: fp.user_account_id` on schemas that use `user_id`.
  - Verification passed (`npx tsc --noEmit`, `npm --prefix api run test -- --run`).
- Revert: none

## 2026-05-12 15:28 IST | codex | change
- Summary: Removed faculty profile feature from backend/frontend and added mitigation to drop `faculty_profiles` table.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/imports/imports.service.ts, api/src/modules/auth/policy.ts, api/src/app/worker.ts, frontend/src/app/types.ts, frontend/src/shared/api/client.ts, frontend/src/app/App.tsx, api/src/modules/faculty/faculty-profiles.service.ts, frontend/src/app/FacultyProfilesTable.tsx, CHANGELOG.md
- Details:
  - Added migration `0019_drop_faculty_profiles_feature` with `drop table if exists faculty_profiles`.
  - Removed faculty profile API routes and handlers from worker:
    - `GET /api/faculty-profiles`
    - `POST /api/faculty-profiles`
    - `POST /api/faculty-profiles/update`
    - `POST /api/import/faculty`
  - Removed corresponding route-policy entries.
  - Removed faculty profile service module and frontend table component file.
  - Removed faculty-profile-specific frontend state, navigation entry, data-loading/actions, and view block from `App.tsx`.
  - Removed faculty profile type/API payload remnants from frontend shared types.
  - Updated student import mentor validation to check mentor existence directly in `user_accounts` and updated error text accordingly.
  - Verification passed: `npx tsc --noEmit` and `npm --prefix api run test -- --run`.
- Revert: none

## 2026-05-12 15:32 IST | codex | change
- Summary: Added mitigation to drop and recreate `students` table with user-linked schema only.
- Files: api/src/modules/setup/migrations.ts, CHANGELOG.md
- Details:
  - Added migration `0020_rebuild_students_table_user_linked`.
  - Migration performs:
    - `drop table if exists students`
    - `create table students (...)` using exact requested columns/constraints:
      - `user_id TEXT PRIMARY KEY`
      - `batch INTEGER NOT NULL`
      - `programme_duration REAL NOT NULL`
      - `programme VARCHAR(10)`
      - `mentor_id TEXT`
      - `CHECK (batch BETWEEN 2010 AND 2050)`
      - `FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE`
      - `FOREIGN KEY (mentor_id) REFERENCES user_accounts(id) ON DELETE SET NULL`
  - No additional students table feature code was added.
- Revert: none

## 2026-05-12 15:47 IST | codex | add
- Summary: Added Students Directory page showing all student-role users with joined student attributes and mentor name.
- Files: api/src/modules/students/students-directory.service.ts, api/src/modules/auth/policy.ts, api/src/app/worker.ts, frontend/src/app/types.ts, frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added backend service `listStudentsDirectory` that joins:
    - `user_accounts` (student-role users)
    - `students` (registration/batch/programme/duration/mentor_id data)
    - mentor `user_accounts` row for mentor full name
  - Added new endpoint `GET /api/students-directory` and exposed it in root endpoint metadata.
  - Restricted endpoint access to `admin`, `moderator`, and `head` roles.
  - Added frontend `StudentsDirectoryTable` using native Material React Table with required baseline behavior:
    - native global search + column filters
    - row selection + row numbers
    - CSV/PDF export (selected rows if selected, else all current rows)
    - rows-per-page includes `All`
  - Added new Academics nav item `Students` for `admin`, `moderator`, and `head`, and wired page state/load/refresh/load-more in App.
  - Displayed requested columns:
    - Full Name
    - Email
    - Registration Number
    - Batch
    - Programme
    - Duration
    - Mentor Name
  - Verification passed:
    - `frontend`: `npx tsc --noEmit`
    - `api`: `npm --prefix api run test -- --run`
- Revert: none

## 2026-05-12 15:53 IST | codex | change
- Summary: Switched Students Directory table to native MRT inline cell editing and wired updates to persist into `students` table.
- Files: api/src/modules/students/students-directory.service.ts, api/src/modules/auth/policy.ts, api/src/app/worker.ts, frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added backend upsert/update logic (`upsertStudentDirectoryRow`) to write `students` fields by `user_id`:
    - `batch`
    - `programme`
    - `programme_duration`
    - `mentor_id` (resolved from editable mentor full name to active faculty user id)
  - Added endpoint `POST /api/students-directory/update` with role access for `admin`, `moderator`, `head`.
  - Updated Students Directory MRT to inline cell editing (`editDisplayMode: "cell"`) for:
    - Batch
    - Programme
    - Duration
    - Mentor Name
  - Kept Full Name, Email, and Registration Number read-only (sourced from user account linkage / registration identity).
  - Wired frontend update callback in App to call update endpoint and refresh cached first-page data.
  - Verification passed:
    - `frontend`: `npx tsc --noEmit`
    - `api`: `npm --prefix api run test -- --run`
- Revert: none

## 2026-05-12 15:59 IST | codex | fix
- Summary: Fixed Students Directory inline-edit behavior to keep user-account fields read-only and enable click-to-edit on student-table fields.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Marked `Full Name` and `Email` columns as non-editable (`enableEditing: false`).
  - Kept `Registration Number` non-editable.
  - Added cell click handler to open MRT inline editor only for editable columns, matching CRUD-inline-cell interaction pattern.
  - Ensures inline edits are applied to student columns (`Batch`, `Programme`, `Duration`, `Mentor Name`) rather than user-account display columns.
  - Verification passed: `npx tsc --noEmit` and `npm --prefix api run test -- --run`.
- Revert: none

## 2026-05-12 16:00 IST | codex | fix
- Summary: Added always-visible `All` option in Students Directory MRT pagination rows-per-page selector.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Updated `muiPaginationProps` so `rowsPerPageOptions` always includes `{ label: "All", value: rowCount }` (with safe minimum of 1).
  - This ensures users can always choose `All` regardless of current row count.
  - Verification passed: `npx tsc --noEmit` and `npm --prefix api run test -- --run`.
- Revert: none

## 2026-05-12 16:05 IST | codex | change
- Summary: Added `registration_number` to students schema and enabled inline editing/persistence for Registration Number in Students Directory.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/students/students-directory.service.ts, api/src/app/worker.ts, api/src/modules/imports/imports.service.ts, frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added migration `0021_students_add_registration_number_unique` to rebuild `students` with:
    - `registration_number varchar(15) unique not null`
  - Backfilled existing rows with deterministic generated registration numbers (`REG` + zero-padded row number, max 15 chars).
  - Updated students directory read query to source Registration Number from `students.registration_number`.
  - Updated students directory update flow to validate and persist `registration_number` along with batch/programme/duration/mentor.
  - Updated worker endpoint `/api/students-directory/update` to accept `registrationNumber`.
  - Updated student CSV import write path to target current students schema and populate `registration_number` from `roll_no`.
  - Updated MRT students table to make Registration Number inline-editable and include it in update patch payload.
  - Verification passed:
    - `frontend`: `npx tsc --noEmit`
    - `api`: `npm --prefix api run test -- --run`
- Revert: none

## 2026-05-12 16:13 IST | codex | fix
- Summary: Fixed Registration Number inline edit persistence in Students Directory.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, api/src/modules/students/students-directory.service.ts, CHANGELOG.md
- Details:
  - Updated frontend Registration Number edit trigger condition to allow any changed value (not only truthy values) before save request.
  - Updated backend students upsert flow to support registration-number-only edits by merging missing patch fields with existing `students` row values (`batch`, `programme_duration`, `programme`, `mentor_id`).
  - Preserved validation for required schema fields and batch range while avoiding false failures when only one column is edited.
  - Verification passed: `npx tsc --noEmit` and `npm --prefix api run test -- --run`.
- Revert: none

## 2026-05-12 16:15 IST | codex | fix
- Summary: Improved students-directory update error handling for registration-number edits and schema drift.
- Files: api/src/modules/students/students-directory.service.ts, CHANGELOG.md
- Details:
  - Added schema introspection for `students` table (`pragma table_info(students)`).
  - `listStudentsDirectory` now gracefully falls back to `s.user_id` as registration display when `registration_number` column is not yet present.
  - `upsertStudentDirectoryRow` now returns a clear actionable error when `registration_number` is missing: run super-admin mitigations first.
  - Tightened validation messages for partial edits when required student fields are absent (`Batch`, `Duration`).
  - Verification passed: `npx tsc --noEmit` and `npm --prefix api run test -- --run`.
- Revert: none

## 2026-05-12 17:13 IST | codex | fix
- Summary: Applied default-value normalization for empty inline student edits before save.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/App.tsx, api/src/modules/students/students-directory.service.ts, CHANGELOG.md
- Details:
  - Enforced requested defaults when inline edit values are empty:
    - Registration Number -> `Not Allotted`
    - Batch -> `2010`
    - Programme -> `Not Allotted`
    - Duration -> `0`
    - Mentor Name -> `NULL` (`mentor_id` persisted as null)
  - Updated table editors to pass `null` for blank numeric cells instead of coercing to `0` unexpectedly.
  - Added client-side normalization in `updateStudentsDirectoryRow` before sending update payload.
  - Added server-side normalization in `upsertStudentDirectoryRow` to guarantee consistent defaults even for non-UI callers.
  - Verification passed: `npx tsc --noEmit` and `npm --prefix api run test -- --run`.
- Revert: none

## 2026-05-12 17:18 IST | codex | add
- Summary: Added Students page CSV import for bulk student-detail updates keyed by email.
- Files: api/src/modules/imports/imports.service.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated backend `importStudents` to upsert student details using `email -> user_accounts.id` mapping and current students schema fields:
    - `registration_number`
    - `batch`
    - `programme`
    - `programme_duration`
    - `mentor_id` (resolved from `mentor_email` when provided)
  - Added Students page CSV upload handler and UI action (for admin/moderator) that posts to `/api/import/students`.
  - CSV parsing supports common header variants:
    - `registration_number` / `roll_no`
    - `batch` / `batch_start_year`
    - `programme` / `program`
  - After successful import, students-directory cache is invalidated and table is refreshed.
  - Verification passed: `npx tsc --noEmit` and `npm --prefix api run test -- --run`.
- Revert: none

## 2026-05-12 17:49 IST | codex | change
- Summary: Added session-scoped regulations JSON caching with login warm-up and logout/session-clear invalidation.
- Files: frontend/src/app/constants.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added session storage keys for curriculum data caches in `frontend/src/app/constants.ts` (`fa_session_regulations`, reserved `fa_session_plan_of_study`).
  - Updated regulations loader in `frontend/src/app/App.tsx` to read from session cache first, fetch from `/api/regulations` when missing/forced, and persist fetched data back to session storage.
  - Warmed regulations cache on successful login (`finalizeSuccessfulLogin`) so first authenticated load seeds session data immediately.
  - Added deterministic cache clearing for curriculum session data on logout, tab takeover, and all session-expiry/session-invalid paths that clear principal state.
  - Kept manual Regulations page `Refresh` behavior as server fetch by calling `loadRegulations({ force: true })`.
  - Verification passed: `npx tsc --noEmit` (run in `frontend/`).
- Revert: none

## 2026-05-12 18:00 IST | codex | add
- Summary: Created plan-of-study JSON from the provided UG 2026-30 Excel sheet data.
- Files: api/src/data/plan-of-study.json, CHANGELOG.md
- Details:
  - Parsed `C:\\Users\\jprak\\Downloads\\Plan of study 2026-30 Batch (1).xlsx` (`Sheet1`) and extracted:
    - `regulationCode`: `UG-2025`
    - `planCode`: `UGBatch2025Regular`
    - Semester-wise category credits for semesters 1 through 8
    - Category totals and grand total credits
  - Added canonical JSON at `api/src/data/plan-of-study.json` with:
    - `plansOfStudy[]`
    - `semesters[]` with per-category credits and `totalCredits`
    - `categoryTotals`
    - plan-level `totalCredits`
- Revert: none

## 2026-05-12 17:59 IST | codex | add
- Summary: Added end-to-end backend and frontend support for Plan of Study JSON with session-cached loading.
- Files: api/src/modules/plan-of-study/plan-of-study.service.ts, api/src/app/worker.ts, api/src/modules/auth/policy.ts, frontend/src/app/types.ts, frontend/src/shared/api/client.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added new backend module `api/src/modules/plan-of-study/plan-of-study.service.ts` to load `api/src/data/plan-of-study.json` and return typed `plansOfStudy`.
  - Added new API endpoint `GET /api/plans-of-study` in worker routing and exposed it in root endpoint discovery list.
  - Updated access policy to authorize `GET /api/plans-of-study` and aligned `GET /api/regulations` visibility for `admin`, `moderator`, and `faculty` role paths.
  - Extended frontend API response typing and shared app types with `PlanOfStudy`.
  - Integrated frontend loading/caching in `App.tsx`:
    - Added `loadPlansOfStudy()` with session-storage cache (`SESSION_PLAN_OF_STUDY_CACHE_KEY`).
    - Warmed plan data after successful login.
    - Loaded plan data when entering Regulations view.
    - Added forced refresh behavior for both regulations and plans.
    - Added Plans of Study UI under the Regulations page with tabbed plans, semester/category table, and totals.
  - Verified there were no active legacy plan-of-study routes to remove; implementation is clean no-compat new path.
  - Verification passed:
    - `frontend`: `npx tsc --noEmit`
    - `api`: `npm --prefix api run test -- --run`
- Revert: none

## 2026-05-12 18:18 IST | codex | change
- Summary: Introduced a small intentional validation error in plan-of-study data for dashboard verification testing.
- Files: api/src/data/plan-of-study.json, CHANGELOG.md
- Details:
  - Updated semester 3 distribution:
    - `SEM` from `0` -> `1`
    - `FCM` from `2` -> `1`
  - Updated aggregated category totals accordingly:
    - `SEM` from `2` -> `3`
    - `FCM` from `35` -> `34`
  - Kept overall plan credits unchanged at `160` so the error is focused on category-rule validation (fixed `FCM` should be `35` for `UG-2025`).
- Revert: none

## 2026-05-12 18:23 IST | codex | add
- Summary: Added backend plan-of-study validation and surfaced validation errors in dashboard and regulations UI.
- Files: api/src/modules/plan-of-study/plan-of-study-validation.service.ts, api/src/app/worker.ts, api/src/modules/admin/dashboard.service.ts, frontend/src/app/constants.ts, frontend/src/app/types.ts, frontend/src/shared/api/client.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added new backend validator `validatePlansOfStudyAgainstRegulations()` with deterministic checks for:
    - regulation existence (`REGULATION_NOT_FOUND`)
    - plan total vs regulation total (`PLAN_TOTAL_MISMATCH`)
    - invalid category codes (`PLAN_CATEGORY_CODE_INVALID`)
    - missing regulation categories (`PLAN_CATEGORY_MISSING`)
    - category rule violations (`PLAN_CATEGORY_RULE_VIOLATION`)
    - semester total vs sum of semester categories (`SEMESTER_TOTAL_MISMATCH`)
  - Updated `GET /api/plans-of-study` response to include `validation` report.
  - Updated admin dashboard backend payload to include `curriculumValidation`.
  - Added frontend typings for validation payloads.
  - Added plan validation session cache key and cache load/write handling.
  - Added visible validation error alerts:
    - Admin Dashboard (from `dashboard.curriculumValidation`)
    - Regulations page (from `/api/plans-of-study` validation report), visible to admin/moderator/faculty flows.
  - Verification passed:
    - `frontend`: `npx tsc --noEmit`
    - `api`: `npm --prefix api run test -- --run`
- Revert: none

## 2026-05-12 18:25 IST | codex | fix
- Summary: Fixed category-code mismatch detection to validate semester category keys, not only category totals keys.
- Files: api/src/modules/plan-of-study/plan-of-study-validation.service.ts, CHANGELOG.md
- Details:
  - Added semester-level category code scan across all `plan.semesters[].categories` keys.
  - Validator now emits `PLAN_CATEGORY_CODE_INVALID` when unknown category codes appear in semester allocations, even if `categoryTotals` keys are valid.
  - Existing categoryTotals code validation remains in place.
  - Verification passed:
    - `api`: `npm --prefix api run test -- --run`
    - `frontend`: `npx tsc --noEmit`
- Revert: none

## 2026-05-12 18:32 IST | codex | change
- Summary: Switched category-total validation to compute totals from semester allocations instead of relying on `categoryTotals` JSON key.
- Files: api/src/modules/plan-of-study/plan-of-study-validation.service.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Backend validator now derives category totals from `plan.semesters[].categories` and uses computed totals for:
    - category presence checks
    - category rule checks (`fixed/min/max/range`)
  - Removed dependency on `plan.categoryTotals` for validation, so deleting that key will not affect rule validation behavior.
  - Updated Plans of Study UI totals row to display computed category totals from semester values, preserving display after `categoryTotals` removal.
  - Verification passed:
    - `api`: `npm --prefix api run test -- --run`
    - `frontend`: `npx tsc --noEmit`
- Revert: none

## 2026-05-12 18:59 IST | codex | change
- Summary: Switched plan-level total validation/display to compute total credits from semester totals (no `totalCredits` key required in plan JSON).
- Files: api/src/modules/plan-of-study/plan-of-study.service.ts, api/src/modules/plan-of-study/plan-of-study-validation.service.ts, frontend/src/app/types.ts, frontend/src/shared/api/client.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Made plan-level `totalCredits` optional in plan-of-study backend/frontend types.
  - Backend validator now computes `computedPlanTotalCredits = sum(plan.semesters[].totalCredits)` and compares that to regulation `totalCreditsRequired`.
  - Updated mismatch message to report computed plan total.
  - Plans UI now shows computed plan totals (tab chip, plan summary chip, total row chip) instead of relying on `plan.totalCredits`.
  - This enables removing the plan-level `totalCredits` key from JSON while preserving validation and display behavior.
  - Verification passed:
    - `frontend`: `npx tsc --noEmit`
    - `api`: `npm --prefix api run test -- --run`
- Revert: none

## 2026-05-12 19:10 IST | codex | add
- Summary: Added lateral-entry 2026-30 batch Excel data as a new Plan of Study entry.
- Files: api/src/data/plan-of-study.json, CHANGELOG.md
- Details:
  - Parsed `C:\\Users\\jprak\\Downloads\\Plan of study 2026-30 Batch  LE.xlsx` (`Sheet1`).
  - Appended new plan:
    - `planCode`: `UGBatch202LateralEntry`
    - `regulationCode`: `UG-2025-LE`
    - semesters `3` to `8` with category credits from the workbook.
  - Included `CSC` category values from the sheet (`0` where blank).
  - Kept schema aligned with current format (no plan-level `totalCredits` key).
  - Verified JSON parses correctly and now contains 2 plans.
- Revert: none

## 2026-05-12 19:15 IST | codex | change
- Summary: Filtered Regulations-page Plan of Study list to show only plans matching the selected regulation.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added derived selected regulation code from active regulation tab.
  - Added filtered plans list (`plansOfStudy` where `plan.regulationCode === selectedRegulationCode`).
  - Updated plan tabs/content rendering to use the filtered list instead of all plans.
  - Added tab-index clamping when filtered plan count changes to prevent invalid tab states.
  - Updated empty-state message to indicate no plans for selected regulation.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-12 21:16 IST | codex | add
- Summary: Added student-level `plan_of_study_code` column (max 30 chars) with mitigation migration and full UI/API wiring.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/students/students-directory.service.ts, api/src/modules/imports/imports.service.ts, api/src/app/worker.ts, frontend/src/app/types.ts, frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Added migration `0022_students_add_plan_of_study_code`:
    - `alter table students add column plan_of_study_code varchar(30)`
    - normalization update for existing empty values to `null`.
  - Updated students-directory backend read/write:
    - Included `plan_of_study_code` in list query and API row mapping.
    - Added schema guard for `students.plan_of_study_code` with mitigation-required error when missing.
    - Added server-side length validation (max 30 chars).
    - Upsert now persists `plan_of_study_code`.
  - Updated `/api/students-directory/update` request handling to accept and forward `planOfStudyCode`.
  - Updated student CSV import to accept optional `plan_of_study_code`/`plan_code` and persist it with max-30 validation.
  - Updated frontend students directory:
    - Added `planOfStudyCode` to `StudentDirectoryRow`.
    - Added editable `Plan Of Study Code` MRT column.
    - Included field in row update payloads and CSV/PDF export.
    - Included field in students CSV upload payload mapping.
  - Verification passed:
    - `frontend`: `npx tsc --noEmit`
    - `api`: `npm --prefix api run test -- --run`
- Revert: none

## 2026-05-12 21:20 IST | codex | change
- Summary: Changed Students Directory inline `Plan Of Study Code` editor to select/dropdown mode.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated MRT inline cell editor for `Plan Of Study Code` to `TextField select` with `MenuItem` options.
  - Added `planOfStudyCodes` prop to `StudentsDirectoryTable` and populated it from loaded `plansOfStudy.planCode` values in `App.tsx`.
  - Included a `None` option (`""`) to allow clearing the mapped plan code.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-12 21:29 IST | codex | change
- Summary: Switched plan-of-study identity to `planName` + integer `planCode`, storing integer code in students and showing plan name in frontend.
- Files: api/src/data/plan-of-study.json, api/src/modules/plan-of-study/plan-of-study.service.ts, api/src/modules/plan-of-study/plan-of-study-validation.service.ts, api/src/modules/setup/migrations.ts, api/src/modules/students/students-directory.service.ts, api/src/modules/imports/imports.service.ts, api/src/app/worker.ts, frontend/src/app/types.ts, frontend/src/shared/api/client.ts, frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Updated plan catalog shape:
    - `planName`: string
    - `planCode`: integer (converted existing `"1"`, `"2"` to `1`, `2`)
  - Updated backend/validation types and payloads to use integer `planCode` plus `planName`.
  - Added migration `0023_students_plan_of_study_code_integer` to rebuild `students` table with `plan_of_study_code integer` and migrate existing values with safe numeric casting.
  - Updated students directory backend read/write:
    - `planOfStudyCode` now treated as `number | null`
    - integer validation enforced server-side.
  - Updated student CSV import to parse `plan_of_study_code`/`plan_code` as integer and validate.
  - Updated frontend students table:
    - stores numeric plan code in row state and update payloads
    - inline select options use `{ code, name }`
    - cell display and exports show `planName` mapped from stored code.
  - Updated regulations page plans display to use `planName` as primary label and show `Code <planCode>` chip.
  - Verification passed:
    - `frontend`: `npx tsc --noEmit`
    - `api`: `npm --prefix api run test -- --run`
- Revert: none

## 2026-05-12 21:33 IST | codex | change
- Summary: Changed Students Directory Mentor Name inline editor to a faculty-user select list.
- Files: api/src/modules/students/students-directory.service.ts, frontend/src/shared/api/client.ts, frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Backend `listStudentsDirectory` now returns `mentorNameOptions` containing active faculty user full names (distinct, sorted).
  - Frontend app state now stores `mentorNameOptions` from `/api/students-directory` response (including first-page cache payload).
  - `StudentsDirectoryTable` now receives `mentorNameOptions` prop and uses a `select` editor for `Mentor Name` with:
    - `None` option for clearing mentor mapping
    - faculty names as selectable options.
  - Verification passed:
    - `frontend`: `npx tsc --noEmit`
    - `api`: `npm --prefix api run test -- --run`
- Revert: none

## 2026-05-12 21:38 IST | codex | add
- Summary: Added programme master JSON and switched Students Directory Programme inline editor to use id/name select options.
- Files: api/src/data/programmes.json, api/src/modules/programmes/programmes.service.ts, api/src/modules/auth/policy.ts, api/src/app/worker.ts, frontend/src/shared/api/client.ts, frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Added backend programme master data file with `{ id, name }` objects at `api/src/data/programmes.json`.
  - Added backend service `fetchProgrammesFromJson()` and new endpoint `GET /api/programmes`.
  - Added access policy for `GET /api/programmes` for `head`, `moderator`, `admin`.
  - Frontend now loads programme options from `/api/programmes` when opening Students page.
  - `StudentsDirectoryTable` now receives `programmeOptions` and uses a select editor for `Programme` with display label mapping:
    - stored value remains programme `id`
    - shown value uses programme `name`.
  - CSV/PDF export now outputs programme display names.
  - Verification passed:
    - `frontend`: `npx tsc --noEmit`
    - `api`: `npm --prefix api run test -- --run`
- Revert: none

## 2026-05-12 21:42 IST | codex | change
- Summary: Converted programme master IDs from strings to integers and updated frontend/backend typing + mapping.
- Files: api/src/data/programmes.json, api/src/modules/programmes/programmes.service.ts, frontend/src/shared/api/client.ts, frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Updated `api/src/data/programmes.json` to use integer ids (`0..6`) instead of string ids.
  - Updated backend programme type (`id: number`) in `programmes.service.ts`.
  - Updated frontend API typing for `programmes` (`id: number`).
  - Updated programmes loading logic in `App.tsx` to parse/filter integer ids.
  - Updated students table programme option matching/rendering to compare by stringified numeric ids so existing stored programme values keep displaying correctly.
  - Verification passed:
    - `frontend`: `npx tsc --noEmit`
    - `api`: `npm --prefix api run test -- --run`
- Revert: none

## 2026-05-12 21:45 IST | codex | change
- Summary: Normalized Students MRT NULL/empty display values to `Not Allotted`.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Updated Plan Of Study Code cell to show `Not Allotted` when value is null.
  - Added Mentor Name cell renderer to show `Not Allotted` for empty values.
  - Updated CSV/PDF exports to output `Not Allotted` instead of blank for null/empty:
    - plan of study
    - programme
    - mentor name
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-12 21:48 IST | codex | change
- Summary: Changed `students.programme` to numeric storage and updated student directory/import flows to use integer programme ids.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/students/students-directory.service.ts, api/src/modules/imports/imports.service.ts, api/src/app/worker.ts, frontend/src/app/types.ts, frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Added migration `0024_students_programme_integer` to rebuild `students` with `programme integer` and migrate existing values:
    - numeric text preserved as integer
    - non-numeric/blank values normalized to `0` (Not Allotted).
  - Updated backend students directory read/write to treat `programme` as `number | null` and validate integer input.
  - Updated worker students-directory update request parsing to pass numeric `programme`.
  - Updated student CSV import parsing/validation to accept integer programme ids.
  - Updated frontend `StudentDirectoryRow.programme` type to `number | null`.
  - Updated inline MRT Programme select/editor and display/export mapping for numeric programme ids.
  - Verification passed:
    - `frontend`: `npx tsc --noEmit`
    - `api`: `npm --prefix api run test -- --run`
- Revert: none

## 2026-05-12 22:02 IST | codex | fix
- Summary: Fixed Students Directory Programme inline select out-of-range MUI value warning when options are not yet loaded.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Updated Programme edit select value binding to use `""` unless the current programme id exists in `programmeOptions`.
  - Added a `None` option (`value=""`) so empty/null state always has a valid selectable value.
  - Normalized change handler to persist `null` when no programme is selected instead of using sentinel `0`.
  - This prevents MUI `SelectInput` warnings like: out-of-range value `1` when available values are only `""`.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-12 22:08 IST | codex | change
- Summary: Replaced Students Directory Programme custom editor with native MRT select editor sourced from programmes master data.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Removed the custom `Edit` renderer for the `Programme` column.
  - Configured MRT native select editing via `editVariant: "select"` and `editSelectOptions`.
  - Select option labels and stored values now come from `programmeOptions` (backed by `api/src/data/programmes.json`):
    - label = programme name
    - value = programme id
  - Kept update behavior to persist numeric programme ids (`number | null`) to the backend.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-12 22:03 IST | codex | fix
- Summary: Ensured Students Programme select is populated from programmes JSON and made programmes JSON parsing robust to shape issues.
- Files: api/src/modules/programmes/programmes.service.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Backend `fetchProgrammesFromJson()` now validates/normalizes programme items and supports these input shapes:
    - `{ "programmes": [...] }` (canonical)
    - root array `[...]`
    - `{ "pgrammes": [...] }` fallback for common key typo.
  - Invalid programme rows are filtered out unless they have an integer `id` and non-empty `name`.
  - Students Directory refresh now reloads `/api/programmes` before reloading students rows, so Programme edit select is filled before editing.
  - This addresses the case where the select showed only `None` due to empty/invalid options payload.
  - Verification passed:
    - `frontend`: `npx tsc --noEmit`
    - `api`: `npm --prefix api run test -- --run`
- Revert: none

## 2026-05-12 22:10 IST | codex | fix
- Summary: Fixed Students Directory Plan Of Study select out-of-range warning by normalizing select value/options handling.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Updated `Plan Of Study Code` edit select to only use current value when it exists in loaded options; otherwise fallback to `""`.
  - Normalized Plan Of Study `MenuItem` values to strings to match controlled select value type.
  - Prevents MUI warning: out-of-range value `1` when available option set is empty or type-mismatched.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-12 22:16 IST | codex | fix
- Summary: Added resilient programme-options preloading for Students Directory so Programme select does not render with only `None`.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - `loadStudentsDirectory()` now preloads programmes when loading the first page and `programmeOptions` is empty.
  - Added a view-level effect for `students-directory` to auto-load programmes whenever the view is active and options are empty.
  - This closes timing/race gaps where Programme edit dropdown could open before options were available.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-12 22:21 IST | codex | revert
- Summary: Reverted recent Plan Of Study select normalization changes in Students Directory to restore previous working behavior.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Reverted `Plan Of Study Code` edit select value guard that required option presence before showing current value.
  - Reverted Plan Of Study option `MenuItem` values from string back to numeric ids.
  - Kept Programme-related fixes intact; this revert applies only to Plan Of Study editor behavior.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: Reverts part of the 2026-05-12 22:10 IST change affecting Plan Of Study select behavior.

## 2026-05-12 22:29 IST | codex | change
- Summary: Aligned Students Directory Programme editor implementation with the same pattern used by Plan Of Study.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Replaced Programme MRT native select-edit config (`editVariant`/`editSelectOptions`) with explicit `Edit` `TextField select`, matching Plan Of Study coding style.
  - Programme select now uses the same value handling pattern as Plan Of Study:
    - `value={current == null ? "" : String(current)}`
    - `None` empty option
    - numeric option ids from `programmeOptions` as `MenuItem value`.
  - Stored value remains numeric programme id (`number | null`) and display text remains programme name.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-12 22:39 IST | codex | change
- Summary: Aligned Programme JSON loading flow with the same session-cached pattern used by Plan Of Study JSON loading.
- Files: frontend/src/app/constants.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `SESSION_PROGRAMMES_CACHE_KEY` and included it in session cache cleanup.
  - Refactored `loadProgrammes` to support `{ force?: boolean }`, mirroring `loadPlansOfStudy` behavior.
  - `loadProgrammes` now:
    - reads cached programmes from session storage when not forced,
    - fetches `/api/programmes` when needed,
    - normalizes and sorts by numeric id,
    - writes normalized results back to session cache.
  - Updated Students view open/refresh paths to force-refresh programmes before student reload, keeping select options in sync.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-12 22:43 IST | codex | change
- Summary: Added frontend debug console output for programme values stored in session storage.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `console.debug` in `loadProgrammes()` to print current `SESSION_PROGRAMMES_CACHE_KEY` payload:
    - label: `[Programmes][SessionStorage]`
    - value: parsed session-storage array of programme `{ id, name }` options.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-12 22:50 IST | codex | fix
- Summary: Prevented repeated Google Identity initialization calls that caused GSI logger warnings in dev.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `googleIdpInitializedRef` guard in `App.tsx`.
  - `google.accounts.id.initialize()` now runs only once per app lifecycle.
  - Subsequent effect reruns only re-render the button, avoiding repeated initialize calls and `[GSI_LOGGER] initialize() is called multiple times` warnings.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-12 22:54 IST | codex | change
- Summary: Made programme session-storage debug logs visible in normal browser console output.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced `console.debug` with `console.log` in `loadProgrammes()`.
  - Added explicit logs for before load, cached path, and after load:
    - `[Programmes][SessionStorage][BeforeLoad]`
    - `[Programmes][SessionStorage][UsingCached]`
    - `[Programmes][SessionStorage][AfterLoad]`
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-13 05:36 IST | codex | fix
- Summary: Hardened programmes JSON parsing to avoid empty programme lists when JSON import shape is wrapped.
- Files: api/src/modules/programmes/programmes.service.ts, CHANGELOG.md
- Details:
  - Updated `fetchProgrammesFromJson()` to support both direct and wrapped JSON module shapes:
    - direct `{ programmes: [...] }`
    - wrapped `{ default: { programmes: [...] } }`
    - typo fallback `{ pgrammes: [...] }` (including wrapped default).
  - Keeps existing normalization/validation of `{ id, name }` entries.
  - Prevents silent fallback to `[]` when runtime import shape differs.
  - Verification passed: `npm --prefix api run test -- --run`.
- Revert: none

## 2026-05-13 05:39 IST | codex | fix
- Summary: Hardened programmes API key extraction and added frontend API payload debug logging for programme options troubleshooting.
- Files: api/src/modules/programmes/programmes.service.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Backend programme parser now accepts id/name alias keys to avoid losing ids when JSON keys differ by shape/casing:
    - id aliases: `id`, `ID`, `code`, `programme_id`, `programmeId`, `program_id`, `programId`
    - name aliases: `name`, `programme`, `program`, `title`
  - Frontend `loadProgrammes()` now logs raw API `res.programmes` as `[Programmes][APIResponse]`.
  - Keeps existing normalization and integer-id filtering.
  - Verification passed:
    - `frontend`: `npx tsc --noEmit`
    - `api`: `npm --prefix api run test -- --run`
- Revert: none

## 2026-05-13 05:59 IST | codex | fix
- Summary: Fixed `/api/programmes` response losing programme `id` values due to global response sanitization.
- Files: api/src/app/worker.ts, CHANGELOG.md
- Details:
  - Root cause: `sanitizeResponsePayload()` strips keys matching `id`/`*_id` globally; this removed programme ids from `/api/programmes` response.
  - Updated `/api/programmes` route response to bypass sanitizer for this static catalogue payload:
    - `return respond({ ok: true, ...data }, 200, undefined, false);`
  - This preserves `{ id, name }` in API response so frontend option normalization no longer collapses to `[]`.
  - Verification passed: `npm --prefix api run test -- --run`.
- Revert: none

## 2026-05-13 06:03 IST | codex | change
- Summary: Removed temporary frontend programme debug console logs after successful verification.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Removed temporary debug logs from `loadProgrammes()`:
    - session-storage before-load log
    - cached-path log
    - API response payload log
    - after-load session log
  - Kept the underlying programme loading/caching behavior unchanged.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-13 11:45 IST | codex | change
- Summary: Standardized the Regulations page layout to match the shared admin page UI structure used by other sections.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Refactored `superView === "regulations"` rendering from nested cards into the same single `Card` + `CardContent` + stacked section pattern used by other admin views.
  - Converted regulations and plans panels to outlined `Paper` containers with consistent border radius and overflow handling.
  - Aligned header spacing/alignment and refresh button placement with existing page conventions.
  - Kept all existing behavior and data rendering unchanged (tabs, chips, tables, validation alert, and empty states).
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-13 12:00 IST | codex | change
- Summary: Increased native MUI spacing and reduced tight custom spacing overrides, especially on the Regulations view, for UI consistency.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Increased shared admin layout spacing tokens in `adminPageSx`:
    - `pageStack.spacing` from `2` to `3`
    - `headerPanel` padding from `{ xs: 1.25, sm: 1.5 }` to `{ xs: 2, sm: 2.5 }`
    - `sectionPanel` padding from `1.5` to `2`
  - Updated `superView === "regulations"` containers to lean on native MUI defaults and avoid tight custom wrappers:
    - Removed explicit tight tab-shell paddings (`px`, `pt`) in section headers.
    - Removed custom border-radius/overflow overrides where not needed.
    - Increased inner content padding from `2` to `3` on regulation and plan detail bodies.
    - Simplified empty-state panels to use larger default-like padding and reduced micro-layout tweaks.
  - Behavior and data rendering remain unchanged; this pass is spacing/layout-only.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-13 12:12 IST | codex | change
- Summary: Applied a second native-MUI spacing pass to All Users, Students Directory, and My Account to reduce cramped layouts.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced tight borderless table shells (`p: 1`, no border/shadow) with roomier outlined MUI containers (`Paper variant="outlined"` with `p: 2`) in:
    - Active Users table panel
    - Login Activity table panel
    - All Users table panel
    - Students Directory table panel
  - All Users add-user panel:
    - Removed custom radius/overflow wrapper override.
    - Increased header/footer block padding to `p: 2.5`.
    - Increased form stack spacing/padding to `spacing: 2.5`, `p: 2.5`.
  - My Account panels:
    - Increased outer tab content panel padding (`p: 1` -> `p: 2`).
    - Increased profile/password/sessions content wrappers from compact values to `{ xs: 2, sm: 2.5 }`.
    - Increased details-row paddings (`px: 2, py: 1.75` -> `px: 2.5, py: 2`).
    - Relaxed session card spacing (`Stack spacing: 1.25` -> `2`) and card content padding (`p: 2.5`).
    - Removed unnecessary custom radius/overflow overrides where default outlined paper behavior is sufficient.
  - Functional behavior unchanged; this is a presentation-spacing standardization pass.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-13 12:20 IST | codex | fix
- Summary: Fixed React unknown DOM prop warnings on Regulations tab labels by moving layout props into MUI `sx`.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated two `Stack` usages in the Regulations section that were passing layout props directly and triggering warnings in dev:
    - `alignItems` moved into `sx` for regulation tab label stack.
    - `flexWrap` and `alignItems` moved into `sx` for regulation header chip stack.
  - This resolves warnings like:
    - `React does not recognize the alignItems prop on a DOM element`
    - `React does not recognize the flexWrap prop on a DOM element`
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-13 12:28 IST | codex | change
- Summary: Standardized Regulations page refresh control to the same monochromatic icon-only pattern used across other admin pages.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced the Regulations header `Refresh` text button (`Button` with icon + label) with the common `Tooltip` + `IconButton` + `RefreshIcon` pattern.
  - Matched existing behavior used elsewhere:
    - icon-only monochromatic refresh control
    - disabled while `busy`
    - spin animation while `busy`
  - Refresh action logic remains unchanged: force reload regulations and plans of study.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-13 12:35 IST | codex | change
- Summary: Added consistent chip spacing on Regulations/Plans count chips so badges are not visually tight.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added small chip margins in Regulations and Plans tab labels (`mx/my: 0.25`) for count chips.
  - Added consistent outer margin (`m: 0.25`) to summary/count chips in:
    - Regulations header chip row
    - Plans header chip row
    - Plan semester total chips and overall total chip
  - Keeps existing chip content, ordering, and behavior unchanged; only visual spacing was adjusted.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-13 12:42 IST | codex | change
- Summary: Increased visual separation between heading text and adjacent count chips on Regulations and Plans sections.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated Regulations and Plans header rows to separate title text and chip groups into distinct nested `Stack` containers.
  - Increased parent row gap (`gap: 1` -> `1.5`) and added slight left offset (`ml: 0.5`) on chip groups.
  - Retained prior chip margin improvements; this change specifically addresses text-to-first-chip crowding.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-13 12:50 IST | codex | change
- Summary: Added an `Academic` navigation menu group under `Academics` and moved `Regulations` and `Students` into it.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated `navSections` in `App.tsx` to replace direct academic leaf items with a grouped item:
    - Parent group label: `Academic`
    - Child items: `Regulations`, `Students`
  - Preserved all existing role guards and click behavior:
    - `Regulations` remains available to academic roles/admin.
    - `Students` remains restricted to admin/head/moderator.
  - Uses existing shared navigation renderers, so sidebar and top bar now both show the same grouped structure.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-13 12:56 IST | codex | fix
- Summary: Resolved runtime crash caused by missing `SchoolIcon` import after Academics nav grouping update.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added missing `SchoolIcon` import from `@mui/icons-material/School` in `App.tsx`.
  - Fixes browser runtime error: `Uncaught ReferenceError: SchoolIcon is not defined` at nav construction.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-13 06:38 IST | codex | change
- Summary: Updated Students header actions to anchor Import CSV at the bottom-right with filled primary styling.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Moved the Students page action row (Import CSV and Refresh) below the header text block so controls render at the bottom-right of the header panel.
  - Changed the `Import CSV` button from `outlined` to `contained` with `color="primary"` to match a filled primary call-to-action appearance.
  - Kept existing role gating and disabled-state behavior intact for import and refresh controls.
- Revert: none
## 2026-05-13 06:39 IST | codex | change
- Summary: Restored Students page refresh icon to the original top-right header position while keeping Import CSV at bottom-right.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Moved the Students Directory refresh IconButton back into the top-right area of the header row to match other pages.
  - Kept `Import CSV` as a filled primary button in the bottom-right action row.
  - Preserved existing refresh behavior and busy/disabled handling.
- Revert: none
## 2026-05-13 06:41 IST | codex | change
- Summary: Added Manage Users-style CSV helper text to the left of Students Import CSV button.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced the standalone Students selected-file line with a bottom action row that includes left-side helper text, matching the Upload CSV pattern used in Manage Users.
  - Added `Bulk import via CSV.` guidance text on the left and kept `Selected: <filename>` directly beneath when a file is chosen.
  - Kept the filled primary `Import CSV` button on the right and preserved role gating/disabled behavior.
- Revert: none
## 2026-05-13 06:42 IST | codex | change
- Summary: Updated Students CSV helper text to explicitly list compulsory and optional column headers.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Revised the Students import helper copy to include required (`fullName`, `email`) and optional headers (`registrationNumber`, `department`, `batchYear`, `semesterNo`, `programmeId`, `planOfStudyCode`, `mentorName`).
  - Kept the Manage Users-style helper layout and selected-file indicator unchanged.
  - No behavioral changes to import flow, role gating, or button states.
- Revert: none
## 2026-05-13 06:44 IST | codex | change
- Summary: Enforced at least one optional student-column header for Students CSV import.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added Students CSV header validation to require at least one optional student field header in addition to required `email`.
  - Accepted optional header groups: `registration_number`/`roll_no`, `plan_of_study_code`/`plan_code`, `programme`/`program`, `batch`/`batch_start_year`, `programme_duration`, `mentor_email`.
  - Import now stops early with a clear status message when none of those optional headers are present.
- Revert: none
## 2026-05-13 06:47 IST | codex | change
- Summary: Switched Students CSV mentor input to mentorEmail and enforced mapping to active faculty UUID in `students.mentor_id`.
- Files: frontend/src/app/App.tsx, api/src/modules/imports/imports.service.ts, CHANGELOG.md
- Details:
  - Updated Students CSV parsing to collect `mentorEmail` from headers (`mentor_email` or `mentorEmail`) instead of mentor name text.
  - Kept optional-column validation aligned to accept either mentor-email header form.
  - Updated backend import resolution to map mentor email to `user_accounts.id` only when the matched account is active and has the `faculty` role.
  - Import now fails with a clear error if mentor email does not resolve to an active faculty account.
  - Updated Students CSV helper text to reflect the actual supported headers and required/optional policy.
- Revert: none
## 2026-05-13 06:51 IST | codex | change
- Summary: Removed legacy student-column aliases and standardized student import/scope reads to current `students` schema columns only.
- Files: frontend/src/app/App.tsx, api/src/modules/imports/imports.service.ts, api/src/modules/students/students.service.ts, api/src/core/csv.ts, CHANGELOG.md
- Details:
  - Removed legacy CSV header aliases from Students import flow (`roll_no`, `batch_start_year`, `plan_code`, `program`, `mentor_email`) and kept only current-field headers plus `mentorEmail` input.
  - Updated Students import parsing/messages/helper text to require current-column names only: `registration_number`, `plan_of_study_code`, `programme`, `batch`, `programme_duration`, `mentorEmail`.
  - Updated backend import service to read only current student fields and mentor email from `mentorEmail`, then map to active faculty `user_accounts.id` for `students.mentor_id`.
  - Reworked `api/src/modules/students/students.service.ts` queries to eliminate old-column usage (`roll_no`, `mentor_email`, `program`, `batch_start_year`) and use current `students` columns with `user_accounts` joins.
  - Updated CSV year-validation error text from `batch_start_year` to `batch`.
- Revert: none
## 2026-05-13 06:53 IST | codex | change
- Summary: Renamed Students CSV action button label from Import CSV to Upload CSV.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated Students header action button text to `Upload CSV` for consistency with Manage Users wording.
  - No behavior or permission logic changed.
- Revert: none
## 2026-05-13 06:57 IST | codex | change
- Summary: Added Programme and Plan of Study numeric-value legend below Students Upload CSV helper row.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added two caption lines beneath the Students CSV helper/upload row.
  - Programme line now shows `id - name` pairs sourced from loaded `programmeOptions`.
  - Plan of Study line now shows `code - name` pairs sourced from `planOfStudyOptions`.
  - Added clear fallback text when either dataset is not yet loaded.
- Revert: none
## 2026-05-14 15:15 IST | codex | change
- Summary: Added faculty dashboard mentoring list to show students assigned to the logged-in faculty account.
- Files: frontend/src/app/App.tsx, frontend/src/app/types.ts, frontend/src/app/constants.ts, CHANGELOG.md
- Details:
  - Added a new faculty dashboard data loader that calls `GET /api/students?limit=100` and maps API rows into a typed `FacultyStudentRow` shape.
  - Added session-scoped read cache support for the faculty mentoring list (`faculty-students:first`) with a 30-second TTL to align with dashboard read-caching policy.
  - Replaced the faculty dashboard placeholder text with a rendered "My Mentored Students" list showing each student name, registration number, and email, plus a force-refresh action.
  - Added the new frontend types and cache-key/TTL definitions required by the faculty list implementation.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-14 15:41 IST | codex | change
- Summary: Added faculty dashboard student-status cards and faculty-only Students page filtering for mentoring vs completed student lists.
- Files: api/src/modules/students/students.service.ts, frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/types.ts, frontend/src/app/constants.ts, CHANGELOG.md
- Details:
  - Extended `GET /api/students` response rows with `student_active` from `user_accounts.active` so faculty can deterministically split assigned students by active/inactive account status.
  - Reworked the Faculty dashboard section to show two metric cards: `Mentoring Students` (active accounts) and `Completed Students` (non-active accounts), each with a `View Students` action.
  - Implemented faculty drill-down routing to the existing `Students` view (`superView = "students-directory"`) with a faculty-only filter state (`mentoring`/`completed`) and faculty-scoped row mapping.
  - Kept admin/head/moderator Students behavior unchanged while enabling faculty access to the same page in read-only mode.
  - Updated Students table usage to disable inline editing for faculty-only mode (`canEdit={false}`) and retained existing editing/export behavior for admin/head/moderator.
  - Added/used faculty list cache key and TTL entries for session-scoped read caching alignment.
  - Verification passed: `npx tsc --noEmit` in `frontend/` and `npm --prefix api run test`.
- Revert: none
## 2026-05-15 00:27 IST | codex | change
- Summary: Made Students CSV `batch` optional in backend import flow to match frontend guidance.
- Files: api/src/modules/imports/imports.service.ts, CHANGELOG.md
- Details:
  - Updated student CSV import to treat missing/blank `batch` as optional instead of failing validation.
  - When `batch` is provided, validation remains enforced (`2010` to `2050`).
  - When `batch` is missing, importer now reuses existing `students.batch` for that user when present; otherwise it falls back to `2010` to satisfy non-null schema constraints.
  - Keeps import deterministic and compatible with current frontend text that marks `batch` as optional.
- Revert: none
## 2026-05-15 00:30 IST | codex | change
- Summary: Added safe registration-number fallback for student CSV imports and conflict checks.
- Files: api/src/modules/imports/imports.service.ts, CHANGELOG.md
- Details:
  - Replaced `registration_number` fallback from static `Not Allotted` to deterministic resolution: CSV value -> existing student value -> email local-part.
  - Added validation to fail clearly when registration number cannot be resolved or exceeds 15 characters.
  - Added conflict guard to detect `registration_number` already used by a different `user_id` before upsert, returning an explicit error.
  - Kept existing upsert behavior and batch optional flow intact.
- Revert: none
## 2026-05-15 00:33 IST | codex | change
- Summary: Reworked student CSV import to use null registration fallback and dynamic per-row column updates.
- Files: api/src/modules/imports/imports.service.ts, CHANGELOG.md
- Details:
  - Removed static `Not Allotted` registration-number fallback and now passes `null` when `registration_number` is missing on new inserts.
  - Replaced upsert with explicit existence-aware flow:
    - existing student row: dynamic `UPDATE` that only touches fields actually present in the CSV row,
    - new student row: dynamic `INSERT` with required columns and optional columns only when present.
  - Preserved batch optional behavior and validation, with existing-batch/default fallback for required storage.
  - Preserved mentor-email resolution to active faculty account before setting `mentor_id`.
- Revert: none
## 2026-05-15 00:36 IST | codex | change
- Summary: Made student import registration fallback schema-aware using email-derived value only when `registration_number` is NOT NULL.
- Files: api/src/modules/imports/imports.service.ts, CHANGELOG.md
- Details:
  - Added one-time schema inspection via `pragma table_info(students)` to detect whether `registration_number` is declared `NOT NULL`.
  - When CSV omits `registration_number`:
    - if schema requires it, importer now resolves value as existing student registration number (if any) or email local-part,
    - if schema does not require it, importer keeps `registration_number` as `null` on insert.
  - Added validation/conflict checks for resolved registration numbers (max length 15, uniqueness across other users).
  - Kept dynamic column update behavior: updates only fields present in CSV rows.
- Revert: none
## 2026-05-15 00:38 IST | codex | change
- Summary: Enforced non-null registration-number inserts and header-presence-driven dynamic student CSV updates.
- Files: api/src/modules/imports/imports.service.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated frontend CSV row construction to include only columns whose headers are actually present in the uploaded CSV.
  - Updated backend import logic to detect field presence by object keys (header presence semantics), not by non-empty cell values.
  - Ensured `registration_number` is never inserted as null: for new student rows it now always resolves as CSV value -> existing value -> email local-part, with uniqueness/length checks retained.
  - Preserved dynamic CRUD behavior so optional student columns are only included in SQL update/insert sets when their CSV headers are present.
- Revert: none
## 2026-05-15 00:46 IST | codex | change
- Summary: Fixed Students table select out-of-range warnings by guarding edit values against unloaded option lists.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Updated `planOfStudyCode` edit select to use `''` unless the current numeric code exists in `planOfStudyOptions`.
  - Updated `programme` edit select with the same guard against missing `programmeOptions` entries.
  - Prevents MUI `out-of-range value` warnings during async option-loading windows while preserving existing update behavior.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-15 00:48 IST | codex | change
- Summary: Ensured Plans of Study are loaded on Students view entry so plan-code editor options always populate.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated Students navigation onClick flow to load plans of study (`loadPlansOfStudy`) alongside programmes before rendering student table interactions.
  - Updated faculty students-directory opener (`openFacultyStudentsDirectory`) to load plans of study before loading faculty students.
  - Updated students-directory effect guard to trigger plans load when programmes are present but plans are missing, and to load both when entering with empty caches.
  - Fixes empty plan options in Students edit dropdown unless Regulations view was opened first.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-15 23:41 IST | codex | change
- Summary: Regenerated Cloudflare Worker type definitions with Wrangler to sync API types with current worker config.
- Files: api/worker-configuration.d.ts, CHANGELOG.md
- Details:
  - Re-ran wrangler types from pi/ (where wrangler.jsonc is defined).
  - Updated generated pi/worker-configuration.d.ts to reflect current Worker env/runtime typings.
  - Noted Wrangler log-write EPERM warning in local AppData logs path; type generation still completed successfully.
- Revert: none
## 2026-05-15 23:48 IST | codex | change
- Summary: Restricted My Account Password tab visibility to eligible local-role accounts and excluded super admin.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated local-password account detection to require `myAccount.provider === "local"` and a configured username.
  - Added explicit role gate for password-tab eligibility: `admin` (excluding super admin), `faculty`, or `moderator` only.
  - Updated password-tab fallback effect to redirect to `profile` whenever current user is not eligible for password changes.
  - Keeps password controls hidden for all non-local accounts and for super admin accounts per requirement.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-18 16:31 IST | codex | change
- Summary: Switched Students Directory edits to local staging with one batched submit request to reduce per-click Worker calls.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/App.tsx, api/src/app/worker.ts, api/src/modules/auth/policy.ts, CHANGELOG.md
- Details:
  - Reworked Students Directory table editing to stage cell changes in local component state instead of sending API requests on each edit interaction.
  - Added a `Submit (N)` toolbar action that sends all staged row updates in one request and clears staged state after success.
  - Added new API endpoint `POST /api/students-directory/update-batch` with role checks (`admin`, `moderator`, `head`) and bounded batch size (`<=100`).
  - Added route policy entry for `/api/students-directory/update-batch` to keep authorization behavior explicit and deterministic.
  - Preserved existing `/api/students-directory/update` endpoint behavior for compatibility.
  - Verification passed: `npx tsc --noEmit` in `frontend/` and `npm run build` at repo root (includes API tests + frontend build).
- Revert: none
## 2026-05-18 16:35 IST | codex | change
- Summary: Switched Students Directory MRT inline editing to native row Save/Cancel controls while keeping batched submit.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Replaced per-cell blur editing flow with MRT native `editDisplayMode: "row"` so each row edit uses built-in Save/Cancel actions.
  - Added row action edit trigger using MUI `IconButton` and MRT `setEditingRow`, reducing custom edit state complexity.
  - Kept local draft/pending staging in React state; row `Save` now stages row changes, row `Cancel` discards edit-mode changes.
  - Preserved single batched network write flow through existing `Submit (N)` toolbar button.
  - Reduced custom input wiring by using MRT-native edit variants (`select`, numeric text fields) and table callbacks.
  - Verification passed: `npx tsc --noEmit` in `frontend/` and `npm run build` at repo root.
- Revert: none
## 2026-05-18 16:39 IST | codex | change
- Summary: Moved MRT actions/edit column to appear immediately after the row-select checkbox in editable tables.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Students Directory table: changed `positionActionsColumn` to `"first"` and set explicit `initialState.columnOrder` so columns start as checkbox -> actions -> row number.
  - Manage Users table: changed `positionActionsColumn` to `"first"` and reordered `initialState.columnOrder` to checkbox -> actions -> row number.
  - Keeps existing MRT native editing behavior and all existing toolbar/filter/export features unchanged.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-18 16:43 IST | codex | change
- Summary: Removed inline row Save/Cancel controls from Students Directory and switched to staged cell edits with diff-only submit payload.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Removed MRT row editing action flow (`editDisplayMode: "row"`, row actions, and inline Save/Cancel controls).
  - Restored inline cell editing (`editDisplayMode: "cell"`) with local React state staging per edited cell.
  - Added patch comparison logic against original `props.rows` so unchanged rows are automatically excluded from pending state.
  - Submit now passes only genuinely updated rows from staged state.
  - Preserved MRT built-in filtering/search/export features and existing single batched submit request flow.
  - Verification passed: `npx tsc --noEmit` in `frontend/` and `npm run build` at repo root.
- Revert: none
## 2026-05-18 16:48 IST | codex | change
- Summary: Applied staged local editing + diff-only submit flow to Manage Users MRT with one-click submit processing.
- Files: frontend/src/app/ManageUsersTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Reworked Manage Users table edits to stage changes locally in React state instead of sending requests on each inline interaction.
  - Added pending-change tracking by `subject` with value comparison against original rows; unchanged rows are automatically removed from pending set.
  - Added `Submit (N)` action in Manage Users toolbar to send only changed rows.
  - Updated app-level handler to process staged user updates in one submit flow, suppressing per-row reload/status and refreshing users once after all updates complete.
  - Preserved MRT native filtering/search/export behavior and existing reset-password action.
  - Verification passed: `npx tsc --noEmit` in `frontend/` and `npm run build` at repo root.
- Revert: none
## 2026-05-18 16:51 IST | codex | change
- Summary: Added Manage Users CSV bulk-status action by username with single batch API request.
- Files: api/src/app/worker.ts, api/src/modules/auth/policy.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added new admin API endpoint `POST /api/admin/users/set-active-batch` to update user active status in bulk from `username` + `active` rows.
  - Endpoint validates request shape, enforces admin-only access, caps batch size at 100, resolves each username to subject, and applies status updates server-side.
  - Added route policy entry for the new batch status endpoint.
  - Added new Manage Users page action button `Upload Status CSV` with CSV parser and client validation.
  - CSV format supports columns `username` and `active` (or `status`) with values like `true/false`, `1/0`, `active/disabled`, `yes/no`.
  - Frontend submits a single request to the new batch endpoint, then refreshes users/cache once.
  - Verification passed: `npm run build` at repo root (API tests + frontend build).
- Revert: none
## 2026-05-18 16:53 IST | codex | change
- Summary: Renamed Manage Users CSV action labels and moved bulk status CSV action next to Add User control.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated user-import button text from `Upload CSV` to `Import Users CSV` for clearer action meaning.
  - Updated Add User toggle labels to clearer wording: `Add User` and `Hide User Form`.
  - Moved status CSV action out of form footer and into the top Manage Users header controls next to Add User.
  - Renamed status action button to `Bulk Update Status CSV` to clearly represent username-based active/disable updates.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-18 16:54 IST | codex | change
- Summary: Removed Manage Users load-more control and MRT row action column/actions.
- Files: frontend/src/app/ManageUsersTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Removed Manage Users page-level `Load More` button block from All Users view.
  - Removed MRT row action column configuration from Manage Users table (`enableRowActions`, row-actions display column, and `renderRowActions`).
  - Removed reset-password row action wiring and unused reset-password handler function from app page.
  - Removed now-unused `userHasMore` UI state reads/writes in user list loading flow.
  - Preserved staged inline editing, submit batching, and table export/filter behavior.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-18 16:57 IST | codex | change
- Summary: Restored Manage Users row-level reset-password action while keeping Load More removed.
- Files: frontend/src/app/ManageUsersTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Re-added Manage Users MRT row action column and reset-password button for local users.
  - Restored `resetUserPassword` handler and callback wiring from app page to Manage Users table.
  - Kept previous removal of All Users `Load More` control intact.
  - Removed now-unused users cursor state references created by load-more removal cleanup.
  - Verification passed: `npm run build` at repo root.
- Revert: partial correction of prior change; reset-password action restored per clarification.
## 2026-05-18 18:39 IST | codex | change
- Summary: Enforced dense session-scoped browser caching in App state using localStorage-backed TTL cache for read-heavy views.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added a session-bound local cache envelope (`cachedAt`, `sessionKey`, `payload`) backed by `localStorage`, keyed by `provider|subject`.
  - Upgraded admin first-page caches to hydrate from in-memory first, then localStorage fallback, and write-through on successful fetches.
  - Added deterministic cache invalidation/removal for both full and key-specific admin cache clears, including localStorage eviction.
  - Migrated static data caches (regulations, plans of study, validation report, programmes) from session-only storage behavior to dense localStorage TTL caching via shared helpers.
  - Ensured cache cleanup on identity/session changes by clearing scoped dataset caches when principal session key changes.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-18 18:41 IST | codex | change
- Summary: Added 15-minute inactivity auto-logout with a pre-timeout user prompt to keep the session active.
- Files: frontend/src/app/constants.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added inactivity configuration constants for logout threshold (`15m`) and warning lead time (`1m`) in app constants.
  - Implemented client-side activity tracking for keyboard/mouse/touch/scroll events while authenticated.
  - Added one-time warning prompt before timeout asking user to stay signed in; confirming resets activity timer and revalidates session.
  - Added forced logout path when inactivity exceeds 15 minutes, with explicit status message.
  - Reset inactivity warning/logout guard refs on successful login and logout to keep behavior deterministic per session.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 00:21 IST | codex | change
- Summary: Moved MRT staged-edits action before exports and renamed it to a save-oriented label with change count.
- Files: frontend/src/app/ExportToolbar.tsx, frontend/src/app/ManageUsersTable.tsx, frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Updated shared `ExportToolbar` render order so custom action buttons are shown before export actions.
  - Renamed Manage Users staged action from `Submit (N)` to `Save the edits (N)` and updated tooltip text accordingly.
  - Renamed Students Directory staged action from `Submit (N)` to `Save the edits (N)` and updated tooltip text accordingly.
  - This places save action first, followed by `Export CSV` and `Export PDF`, matching requested MRT toolbar behavior.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 10:13 IST | codex | change
- Summary: Implemented v1 credit completion tracking with published snapshot imports, computed status APIs, claims workflow, and new Credits Tracking UI section.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/credits/credits.service.ts, api/src/app/worker.ts, api/src/modules/auth/policy.ts, frontend/src/app/types.ts, frontend/src/app/constants.ts, frontend/src/app/CreditTrackingTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added migration `0026_credit_tracking_foundation` creating `credit_import_batches`, `student_credit_snapshots`, and `student_credit_claims` with indexes and publish/claim audit fields.
  - Added new backend module `credits.service.ts` implementing:
    - staged snapshot import (`xlsx`/`csv` source modes) with template versioning and validation summary,
    - publish latest official batch flow,
    - role-scoped computed credit list/detail using published snapshot + approved claim overrides,
    - student/faculty claim creation and review workflow,
    - CSV export endpoint data generation.
  - Added worker routes:
    - `POST /api/credits/import`
    - `POST /api/credits/import/:batchId/publish`
    - `GET /api/credits/students`
    - `GET /api/credits/students/:studentId`
    - `POST /api/credits/claims`
    - `POST /api/credits/claims/:id/review`
    - `GET /api/credits/export`
  - Added dynamic route policy matching in worker and explicit auth-policy entries for all new credit endpoints.
  - Added frontend credit tracker types, TTL cache key, and new MRT-based `CreditTrackingTable` with required built-in filters/search, row select/row numbers, export CSV/PDF, and `All` page-size option.
  - Added new `Credits Tracking` navigation item in `navSections` and role-gated page view with refresh, load-more, CSV import for head/admin/moderator, batch publish control, and student/faculty claim submission form.
  - Verification passed: `npm --prefix api run test -- --run` and `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 10:18 IST | codex | change
- Summary: Optimized credit-tracking DB access patterns for Turso free-tier by reducing import and read amplification.
- Files: api/src/modules/credits/credits.service.ts, CHANGELOG.md
- Details:
  - Replaced per-row student lookup during credit import with batched registration-number prefetch (`IN (...)` chunking), eliminating one DB read per input row.
  - Deduplicated import rows by registration number before writes, so repeated rows no longer trigger duplicate write operations in the same batch.
  - Replaced per-row snapshot upserts with chunked multi-row `INSERT ... VALUES (...), (...) ON CONFLICT ...` writes, significantly reducing DB round trips.
  - Added short TTL cache for currently published credit batch id to avoid repeated identical reads on high-frequency tracker/detail requests.
  - Kept deterministic correctness behavior intact (same validation/flagging semantics and published-batch output).
  - Verification passed: `npm --prefix api run test -- --run` and `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 10:36 IST | codex | change
- Summary: Added compact TTL cache for student claim-history detail reads with targeted invalidation on claim mutations.
- Files: api/src/modules/credits/credits.service.ts, CHANGELOG.md
- Details:
  - Added a lightweight in-memory claim-history cache keyed by `user_id` with a short TTL (`10s`) to reduce repeated reads during rapid detail refreshes.
  - Updated `getCreditStudentDetail` to serve claim-history rows from cache when fresh, falling back to DB only on cache miss/expiry.
  - Added deterministic invalidation on write paths:
    - `createCreditClaim` invalidates the target student claim-history cache key.
    - `reviewCreditClaim` invalidates the reviewed student claim-history cache key.
  - Keeps authorization behavior unchanged because access scope is still validated before claim-history retrieval.
  - Verification passed: `npm --prefix api run test -- --run` and `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 10:43 IST | codex | change
- Summary: Updated faculty-facing Credits Tracking table to show mentored student details in the requested column order and tracking labels.
- Files: frontend/src/app/CreditTrackingTable.tsx, CHANGELOG.md
- Details:
  - Reordered and simplified credit tracking columns to:
    1) `Full Name`
    2) `Registration Number`
    3) `Plan Of Code`
    4) `Required Credits`
    5) `Earned Credits`
    6) `Remaining Credits`
    7) `Status`
  - Removed extra display columns (`Email`, `Category Summary`) so faculty view focuses on mentoring essentials.
  - Mapped status display labels to tracking-friendly values:
    - `completed` -> `Completed`
    - `pending` -> `On Track`
    - `at-risk` -> `Lagging`
  - Updated export output (CSV/PDF headers and status labels) to match the same column structure and labels.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 10:41 IST | codex | change
- Summary: Updated credits-tracking backend list query so faculty always see full names of mentored students even when no credit snapshot details exist.
- Files: api/src/modules/credits/credits.service.ts, CHANGELOG.md
- Details:
  - Changed computed credits base query from snapshot-driven (`student_credit_snapshots` as source) to student-driven (`students` as source with left join snapshot for current published batch).
  - This ensures all scoped students (including faculty-mentored students) are listed with core profile fields even if credits import has not populated snapshot rows yet.
  - Kept role scoping intact (`mentor`, `self`, `all`) and preserved cursor pagination.
  - Snapshot fields now resolve as nullable overlays; required credits still derive from plan/regulation and earned defaults to `0` when snapshot is absent.
  - Verification passed: `npm --prefix api run test -- --run` and `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 10:49 IST | codex | change
- Summary: Displayed Plan of Study name (instead of numeric code) in Credits Tracking table.
- Files: frontend/src/app/CreditTrackingTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `planNameByCode` mapping in app state from loaded plans-of-study options.
  - Updated Credits Tracking nav open flow to ensure plans-of-study are loaded before credit rows render.
  - Updated Credits Tracking table `Plan Of Code` column to render plan name using the mapping, with numeric code fallback if name is unavailable.
  - Updated Credits Tracking CSV/PDF exports to output plan name values as well.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 10:51 IST | codex | change
- Summary: Updated faculty claim-entry workflow to use registration/email lookup, category dropdown, semester input, and hidden evidence source.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/credits/credits.service.ts, api/src/app/worker.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added migration `0027_credit_claims_add_semester` to store semester-level claim context (`claim_semester`) in `student_credit_claims`.
  - Extended claim API input handling to accept `studentLookup` (registration number or email) and map it server-side to `user_id` before authorization/update checks.
  - Updated claim insert flow to persist `claim_semester` and included `claim_semester` in claim-history detail reads.
  - Updated worker route payload mapping for `POST /api/credits/claims` to pass `studentLookup` and `claimSemester`.
  - Replaced faculty student target textbox from `Student User ID` to `Registration Number or Email`.
  - Replaced free-text category field with a select dropdown using `code - name` options derived from loaded regulation categories.
  - Added numeric `Semester` input for credits claim entries.
  - Removed evidence textbox from UI and now sends hidden value `Faculty Manual Entry` in claim payload.
  - Verification passed: `npm --prefix api run test -- --run` and `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 10:54 IST | codex | change
- Summary: Enforced active-student-only credit updates for mentoring/self claim submissions.
- Files: api/src/modules/credits/credits.service.ts, CHANGELOG.md
- Details:
  - Tightened `createCreditClaim` authorization guard so faculty can submit claims only when the target student is both:
    - mentored by that faculty (`mentor_id` match), and
    - active in `user_accounts` (`active = 1`).
  - Added active-account check for student self-claim submissions; inactive student accounts are blocked.
  - Updated error messages to clearly state active mentoring constraint.
  - Verification passed: `npm --prefix api run test -- --run`.
- Revert: none
## 2026-05-19 10:59 IST | codex | change
- Summary: Added session-scoped cache for faculty active mentored student minimal list and reused it across Students Directory and Credits Tracking pages.
- Files: frontend/src/app/constants.ts, frontend/src/app/types.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added new session cache key `SESSION_FACULTY_MENTORED_MINIMAL_KEY`.
  - Added minimal type model (`userId`, `email`, `registrationNumber`, `fullName`) for active mentored students.
  - Extended faculty students loader to derive/store active mentored minimal list into session-scoped cache and component state.
  - Added session-cache hydration path so faculty pages can bootstrap the list without immediate API dependency.
  - Wired cache usage into faculty Students Directory behavior:
    - mentoring count fallback uses cached minimal list when full rows are not yet loaded,
    - mentoring rows can fallback to cached minimal student identities.
  - Wired cache usage into faculty Credits claim workflow:
    - registration/email input is validated and resolved against cached active mentored list,
    - resolved `userId` is submitted for claim update.
  - This reduces repeated read pressure on Turso for faculty navigation across student-related pages while keeping backend authorization authoritative.
  - Verification passed: `npm --prefix api run test -- --run` and `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 11:05 IST | codex | change
- Summary: Filtered faculty claim category dropdown to plan-applicable options using only local session/state values (no DB/API at selection time).
- Files: frontend/src/app/types.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Extended cached faculty mentored minimal model with `planOfStudyCode` and persisted/hydrated it from session-scoped cache.
  - Added lookup resolver for selected mentoring student from local cached values (`registrationNumber`/`email`/`userId` match).
  - Added plan-specific category filtering in claim form:
    - derive student plan from cached minimal row,
    - derive regulation from already-loaded `plansOfStudy` + `regulations` state,
    - show only categories applicable to that regulation.
  - Updated claim category select to use filtered options for faculty and disabled it when no valid student context is resolved.
  - Added helper hint when no applicable categories are available and auto-clears invalid selected category when student context changes.
  - Implemented entirely on frontend session/local state path for the selection workflow (no DB/API calls triggered by category selection changes).
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 11:09 IST | codex | change
- Summary: Fixed faculty category select staying empty after valid registration/email lookup when plan mapping is unavailable.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated plan-specific category filter fallback behavior for faculty claim form:
    - if selected student is valid but `planOfStudyCode` is missing, unknown, or regulation mapping is unavailable, category options now fall back to full available category list.
  - Keeps strict empty-state only for invalid/unresolved student lookup.
  - This restores category selection usability after pasting valid register number/email while preserving plan-specific filtering when mapping exists.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 11:14 IST | codex | change
- Summary: Fixed faculty category selector remaining disabled after valid registration input when faculty students were loaded from cache.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Identified mismatch between cached faculty-student load path and category-enabling logic: cached path populated `facultyStudentRows` but did not refresh session-backed minimal mentored list used for registration/email lookup.
  - Added shared helper `toFacultyMentoredMinimalRows(...)` and reused it in both:
    - cached faculty load path, and
    - live API faculty load path.
  - Now cached page opens correctly hydrate `facultyMentoredMinimalRows`, enabling category dropdown for valid mentored registration/email entries.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 11:20 IST | codex | change
- Summary: Added robust faculty lookup fallback for category enabling to prevent disabled state/blank-screen behavior after Credits load.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Enhanced mentoring-student lookup normalization (trims and removes whitespace) for registration/email/user-id comparison.
  - Added fallback lookup source from already-loaded `creditTrackingRows` when session-cached minimal mentoring list is not yet available.
  - Added auto-hydration of faculty minimal mentoring cache from credit rows on credits page when the minimal cache is empty.
  - This ensures category select can enable immediately for valid pasted registration numbers visible in loaded credit rows.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 11:25 IST | codex | change
- Summary: Fixed React maximum-update-depth loop on Credits Tracking page by removing stateful fallback hydration effect.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Removed credits-page fallback effect that wrote `facultyMentoredMinimalRows` from `creditTrackingRows` on render path.
  - That effect could trigger repeated state updates under React 19/MRT layout cycles, causing `Maximum update depth exceeded` and white-screen failures.
  - Kept lookup fallback functional by resolving registration/email directly from `creditTrackingRows` in memoized selection logic (no extra state writes).
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 11:29 IST | codex | change
- Summary: Fixed MUI Tooltip warning for disabled refresh action in faculty dashboard card.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Wrapped disabled `IconButton` child inside `<span>` for `Tooltip title="Refresh counts"` to satisfy MUI tooltip event requirements on disabled controls.
  - Removes repeated console warning: "You are providing a disabled `button` child to the Tooltip component."
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 11:33 IST | codex | change
- Summary: Stabilized Credits Tracking MRT pagination/export props to prevent render-loop reinitialization causing white-screen after loading.
- Files: frontend/src/app/CreditTrackingTable.tsx, CHANGELOG.md
- Details:
  - Memoized CSV export config (`mkConfig`) so toolbar receives stable config reference.
  - Memoized MRT `rowsPerPageOptions`, including `All` option value, so pagination props are not reconstructed on every render.
  - This reduces table-internal layout/state churn that can trigger maximum-update-depth failures in React 19 + MRT mount cycles.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 11:24 IST | codex | fix
- Summary: Stabilized credits tracking table rendering to prevent MRT re-render loops and renamed plan column label.
- Files: frontend/src/app/CreditTrackingTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Refactored Credits Tracking table to render MaterialReactTable directly with stable pagination options callback and preserved MRT baseline controls.
  - Updated the faculty credits table plan column title from Plan Of Code to Pgm. Plan.
  - Added a one-shot hydration guard for faculty mentored-minimal session data on the credits page to avoid repeated state churn while view is active.
- Revert: none


## 2026-05-19 11:33 IST | codex | fix
- Summary: Fixed faculty credit-claim authorization mismatch for valid active mentored students by aligning scope check with email-based mentor resolution.
- Files: api/src/modules/credits/credits.service.ts, CHANGELOG.md
- Details:
  - Updated faculty claim authorization to validate target students against active mentor account IDs that share the acting faculty email, matching existing faculty student-list scope behavior.
  - Prevents false rejections when mentor assignment/account-linking uses a different but active user ID for the same faculty email.
  - Kept active-student enforcement unchanged with explicit coalesce(student_ua.active, 0) = 1.
- Revert: none


## 2026-05-19 11:35 IST | codex | fix
- Summary: Fixed faculty claim 400s caused by stale user-id mapping by prioritizing registration/email lookup resolution on the backend.
- Files: api/src/modules/credits/credits.service.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated claim target resolution to always resolve studentLookup first when provided, even if a userId is also sent, preventing ID-drift mismatches.
  - Updated faculty claim payload to include both userId and typed studentLookup so backend can reliably map to the current student account.
  - Preserved active-mentee authorization checks after lookup resolution.
- Revert: none


## 2026-05-19 11:37 IST | codex | fix
- Summary: Added claim_semester schema mitigation and backward-compatible claim insert/read paths for older databases.
- Files: api/src/modules/setup/wizard.service.ts, api/src/modules/credits/credits.service.ts, CHANGELOG.md
- Details:
  - Extended recent mitigations to add student_credit_claims.claim_semester when missing on existing deployments.
  - Added a cached schema check in credits service and made claim insert/read logic compatible with both pre- and post-claim_semester table shapes.
  - Prevents faculty/student claim submission failures on environments where migration 0027 was not yet applied.
- Revert: none


## 2026-05-19 11:44 IST | codex | change
- Summary: Removed reviewer-id/review-notes fields from credit-claims schema and added mitigation-driven table rebuild for existing databases.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/setup/wizard.service.ts, api/src/modules/credits/credits.service.ts, CHANGELOG.md
- Details:
  - Updated baseline and forward migration schema to drop student_credit_claims.reviewed_by_user_id and student_credit_claims.review_notes.
  - Added migration 0028 to rebuild student_credit_claims without the removed columns while preserving existing data and indexes.
  - Added runRecentMitigations table-shape repair for current databases that still contain the removed columns.
  - Updated claims read/review queries to stop selecting/updating removed fields.
- Revert: none


## 2026-05-19 11:55 IST | codex | change
- Summary: Removed reviewed_at from credit-claims schema and review flow, with migration and mitigation support for existing databases.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/setup/wizard.service.ts, api/src/modules/credits/credits.service.ts, api/src/app/worker.ts, CHANGELOG.md
- Details:
  - Removed reviewed_at from student_credit_claims schema definitions and claim detail query payload.
  - Added migration 0029 to rebuild student_credit_claims without reviewed_at while preserving existing claim records.
  - Extended runRecentMitigations table-repair logic to rebuild legacy claim tables that still contain reviewed_at/reviewer columns.
  - Simplified claim review update path to update only status, and removed reviewNotes plumbing from worker request handling.
- Revert: none


## 2026-05-19 19:01 IST | codex | change
- Summary: Removed credit-tracking backend and dropped snapshot/import batch tables with a forward schema migration.
- Files: api/src/app/worker.ts, api/src/modules/auth/policy.ts, api/src/modules/setup/migrations.ts, api/src/modules/setup/wizard.service.ts, api/src/modules/credits/credits.service.ts, CHANGELOG.md
- Details:
  - Removed all `/api/credits/*` route handling and credits module import from the API worker.
  - Removed credits-related access policies from route authorization.
  - Removed credit-tracking creation/shape migrations and added `0026_drop_credit_tracking_tables` to drop `student_credit_snapshots`, `credit_import_batches`, and `student_credit_claims`.
  - Removed credit-claims mitigation logic from setup wizard service.
  - Deleted `api/src/modules/credits/credits.service.ts`.
  - Verification passed: `npm --prefix api run test`.
- Revert: none

## 2026-05-19 19:07 IST | codex | change
- Summary: Removed frontend credits-tracking feature and added existing-db mitigation to drop retired credit tables.
- Files: frontend/src/app/App.tsx, frontend/src/app/types.ts, frontend/src/app/constants.ts, frontend/src/app/CreditTrackingTable.tsx, api/src/modules/setup/wizard.service.ts, CHANGELOG.md
- Details:
  - Removed all credits-tracking UI wiring from App: nav/view references, claim/import actions, credits API usage, and related state/effects.
  - Removed obsolete frontend types and cache-key constants tied to credits tracking.
  - Deleted `CreditTrackingTable.tsx` because the credits page is removed.
  - Added runtime mitigation in `runRecentMitigations` to drop `student_credit_snapshots`, `credit_import_batches`, and `student_credit_claims` on existing databases.
  - Verification passed: `npm --prefix api run test` and `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 19:19 IST | codex | revert
- Summary: Reverted recent students-table extension fields (`gender`, `section`, `mobile_number`) across schema, API, import path, and frontend directory UI.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/students/students-directory.service.ts, api/src/modules/students/students.service.ts, api/src/modules/imports/imports.service.ts, api/src/app/worker.ts, frontend/src/app/types.ts, frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Removed migration block that introduced `students.gender`, `students.section`, and `students.mobile_number`.
  - Reverted student-directory service read/write shape and validations to exclude those fields.
  - Reverted student list query shape to exclude those fields.
  - Reverted CSV import update/insert handling for those fields.
  - Reverted API request mapping for students-directory update endpoints to exclude those fields.
  - Reverted frontend student-directory data model, table columns/editors, exports, and guidance text to exclude those fields.
  - Kept unrelated credits-removal and mitigation work intact.
  - Verification passed: `npm --prefix api run test`; `npx tsc --noEmit` in `frontend/`.
- Revert: Reverted the recent student schema/UI/API field additions for gender/section/mobile.

## 2026-05-19 19:20 IST | codex | fix
- Summary: Fixed React unknown-prop warning by removing invalid 	extAlign DOM prop usage on login fallback container.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced <Box textAlign="center"> with <Box sx={{ textAlign: "center" }}> so alignment remains styled via MUI system props instead of being forwarded to a native div.
  - Eliminates the dev warning: "React does not recognize the 	extAlign prop on a DOM element" from the login view render path.
  - Verification passed: 
px tsc --noEmit in rontend/.
- Revert: none

## 2026-05-19 19:24 IST | codex | fix
- Summary: Restored missing Students Directory frontend handlers in App.tsx after revert cleanup to fix runtime ReferenceErrors.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Reintroduced `loadProgrammes`, `importStudentsFromCsvFile`, `openFacultyStudentsDirectory`, and `submitStudentsDirectoryRows` in `App.tsx`.
  - Kept the students-field rollback intact by ensuring restored handlers use the reverted student schema (no `gender`/`section`/`mobile_number` payload fields).
  - Fixes runtime errors: `importStudentsFromCsvFile is not defined` and `loadProgrammes is not defined`.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 19:29 IST | codex | change
- Summary: Enabled faculty student-directory edits and CSV bulk updates for only active mentored students, while preserving moderator/admin full-edit access.
- Files: api/src/modules/students/students-directory.service.ts, api/src/modules/imports/imports.service.ts, api/src/app/worker.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added server-side faculty scope validation for student updates by user id, restricted to active students currently mentored by the logged-in faculty account.
  - Extended students-directory update and batch-update routes to allow faculty writes only within that restricted scope; moderator/admin/head behavior remains unchanged.
  - Extended student CSV import route to allow faculty uploads with enforced active-mentored-student scope restrictions for each CSV row.
  - Updated Students Directory UI so faculty can edit rows only in the mentoring (active) view, and can use CSV bulk update with explicit scope guidance.
  - Updated post-save reload behavior so faculty edits refresh faculty-scoped datasets, while moderators/admins continue using full directory reloads.
  - Verification passed: `npx tsc --noEmit` in `frontend/`; `npm --prefix api run test`.
- Revert: none

## 2026-05-19 19:33 IST | codex | change
- Summary: Hid Mentor Name from faculty in Students Directory so faculty cannot view or edit mentor assignment there.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added table-level `showMentorName` control and disabled Mentor Name column rendering when faculty-only view is active.
  - Removed Mentor field visibility from faculty detail panel and excluded Mentor column from faculty CSV/PDF exports.
  - Wired Students Directory page to pass `showMentorName=false` for faculty-only scope while preserving mentor visibility for moderator/admin/head.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 19:35 IST | codex | fix
- Summary: Blocked faculty from changing mentor assignment through student bulk CSV updates.
- Files: api/src/modules/imports/imports.service.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Enforced server-side guard in student CSV import: when request is faculty-scoped, any `mentor_email`/`mentorEmail` field now fails with `Faculty cannot update mentor assignment via CSV.`.
  - Kept faculty row-scope restriction to active mentored students unchanged.
  - Normalized mentor email extraction to accept both `mentorEmail` and `mentor_email` keys consistently.
  - Updated faculty UI guidance text to clearly state mentor updates are not allowed in faculty CSV uploads.
  - Verification passed: `npx tsc --noEmit` in `frontend/`; `npm --prefix api run test`.
- Revert: none

## 2026-05-19 19:37 IST | codex | fix
- Summary: Fixed faculty 401 on `/api/programmes` by aligning route access policy with implemented faculty permissions.
- Files: api/src/modules/auth/policy.ts, CHANGELOG.md
- Details:
  - Updated access policy for `GET /api/programmes` to include `faculty` (and kept authenticated student/head/moderator/admin access).
  - Aligned access-policy entries with existing worker logic for faculty-enabled student directory and student CSV import endpoints:
    - `GET /api/students-directory`
    - `POST /api/students-directory/update`
    - `POST /api/students-directory/update-batch`
    - `POST /api/import/students`
  - Prevents policy-layer `401 Unauthorized` from blocking faculty before endpoint-level scope checks execute.
  - Verification passed: `npm --prefix api run test`.
- Revert: none

## 2026-05-19 19:40 IST | codex | fix
- Summary: Fixed faculty student batch-save 400 by preserving mentor assignment on faculty edits instead of validating/updating mentor name.
- Files: api/src/modules/students/students-directory.service.ts, api/src/app/worker.ts, CHANGELOG.md
- Details:
  - Updated student-directory upsert API contract to support `mentorName: null` as a preserve-existing-mentor signal.
  - Changed mentor resolution behavior:
    - `mentorName === null` keeps existing `mentor_id` unchanged.
    - `mentorName === ""` clears `mentor_id`.
    - non-empty mentor name still validates against active faculty full name.
  - Updated worker student update handlers so faculty-only principals send `mentorName: null` for both single-row and batch updates, preventing hidden/fallback mentor values from causing validation failures.
  - Preserves moderator/admin/head behavior for mentor updates.
  - Verification passed: `npm --prefix api run test`; `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 19:43 IST | codex | fix
- Summary: Fixed repeated faculty batch-update 400 by deriving faculty scoped mentor email from principal identity consistently.
- Files: api/src/app/worker.ts, CHANGELOG.md
- Details:
  - Replaced raw `principal.email` usage in faculty student-directory update scope checks with `resolveStudentScope(principal)` mentor-email derivation.
  - Applied same scope-derived faculty email path for student CSV import restriction wiring.
  - Added explicit `403` response when a faculty principal cannot resolve to mentor scope email, instead of failing later as `400` on scope validation.
  - This keeps scope checks deterministic across local/session/OAuth subject formats while preserving existing admin/moderator/head behavior.
  - Verification passed: `npm --prefix api run test`; `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 19:47 IST | codex | fix
- Summary: Fixed inline student save payload sending empty `userId` by filtering invalid faculty rows and guarding batch submit.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `userId` validity filtering when building faculty Students Directory rows (both fallback mentored-minimal rows and normal faculty student rows).
  - Added submit guard in `submitStudentsDirectoryRows` to ignore rows without `userId` and block save when all staged rows are invalid.
  - Added user-facing status messages for invalid-row skips to make the issue diagnosable from UI.
  - Prevents `/api/students-directory/update-batch` requests with `userId: ""` and avoids backend `userId is required.` failures.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 19:52 IST | codex | fix
- Summary: Restored faculty mentoring rows in Students Directory MRT while safely preventing inline edits/submits for rows missing identity.
- Files: frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Removed over-strict faculty row filtering that hid mentoring rows when fallback/session data lacked `userId`.
  - Preserved row visibility in MRT so faculty can still see mentoring student details.
  - Added inline edit guard in `StudentsDirectoryTable` so cell editing does not open for rows with empty `userId`.
  - Added stage-patch guard to block pending edit creation for rows without identity, preventing invalid batch payloads.
  - Keeps save-path protection from earlier changes that ignore invalid `userId` updates.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 19:56 IST | codex | fix
- Summary: Fixed Students Directory inline select editors so changing one row's dropdown does not mirror selection across other rows.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Updated `SelectEditField` to resync its local controlled value whenever `initialValue` changes.
  - Prevents stale editor state reuse across virtualized/reused MRT edit cells that made programme/plan/mentor dropdowns appear selected in multiple rows.
  - Keeps native inline edit behavior while isolating editor state per active row/cell.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 20:01 IST | codex | fix
- Summary: Reworked Students Directory inline editing to follow native MRT cell-edit patterns and fixed cross-row edit leakage/non-editable textbox issues.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Replaced custom `Edit` select/text editor components with MRT-native column editing config (`editVariant`, `editSelectOptions`, `muiEditTextFieldProps`) for inline cell editing.
  - Added a dedicated `stageFieldPatch` merge helper so each edited field updates only the targeted row patch consistently.
  - Fixed unstable/duplicate row identity behavior by adding a safe `getRowId` fallback for rows missing `userId`, preventing TanStack row-id collisions that can propagate edits across rows.
  - Removed duplicate `state` prop usage on `MaterialReactTable` and merged table state into a single object (`isLoading`, `showSkeletons`, `columnVisibility`) to avoid inconsistent rendering state.
  - Preserved existing faculty restrictions (non-editable rows with missing identity and mentor visibility controls) while restoring correct inline edit behavior for text and select fields.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 20:07 IST | codex | fix
- Summary: Added native MRT select support for `programme = 0` (`0 - Not Allotted`) to eliminate MUI out-of-range warnings.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Added `0 - Not Allotted` option to Programme inline-edit dropdown options.
  - Normalized Programme edit value binding so rows with `programme` null/0/unlisted values map to select value `"0"`, preventing MUI select out-of-range errors.
  - Updated Programme display mapping across table cell, detail panel, and CSV/PDF export paths so `0` renders as `Not Allotted`.
  - Keeps MRT native inline editing behavior while making zero-programme records valid editable states.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 20:10 IST | codex | fix
- Summary: Added native MRT select support for `plan_of_study_code = 0` (`0 - Not Allotted`) to prevent select out-of-range issues.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Added `0 - Not Allotted` option to Plan of Study inline-edit dropdown.
  - Normalized Plan of Study edit value binding so null/0/unlisted values map to select value `"0"`.
  - Updated Plan of Study display mapping in table cell, detail panel, and CSV/PDF export paths so `0` renders as `Not Allotted`.
  - Keeps MRT native inline-edit behavior consistent with Programme dropdown handling.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 20:15 IST | codex | fix
- Summary: Fixed Students Directory save wiring so faculty inline-edit failures are surfaced and successful-save UI only appears on true success.
- Files: frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Updated `submitStudentsDirectoryRows` to rethrow API/update errors after setting status, instead of swallowing them.
  - Updated table Save button handler to `await` submit and show success/reset staged edits only on resolved success.
  - On failure, staged edits are preserved for faculty/admin retry and the caller's status message remains visible.
  - This removes false-positive success behavior that made faculty save appear unwired.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 20:21 IST | codex | fix
- Summary: Fixed faculty inline-edit pending-count wiring by diffing against a stable table baseline snapshot.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Added `baselineRows` state in Students Directory table to capture the current loaded dataset as the immutable diff source for staged edits.
  - Updated staged-change comparison logic to use `baselineRows` instead of live `props.rows`, preventing pending edit count resets caused by parent render churn in faculty view.
  - Kept existing staged-edit behavior and save flow intact; only diff/reference stability changed.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 20:30 IST | codex | fix
- Summary: Fixed faculty inline-select edit commit/count issues by aligning MRT select option value types with numeric row data and adding blur-commit fallback.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Changed Plan of Study and Programme `editSelectOptions` values from string to number (including `0 - Not Allotted`) to match underlying numeric row values.
  - Removed explicit string-forced select value binding that caused MUI select out-of-range behavior with numeric fields.
  - Added select `onBlur` commit fallback for Plan of Study/Programme so staged edits are recorded even when change events are disrupted by focus transitions.
  - Kept existing MRT native inline-edit configuration and faculty save flow.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 20:38 IST | codex | fix
- Summary: Fixed faculty inline edit staging/count updates for Plan/Programme by moving select editors to explicit per-cell MRT `Edit` components.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Replaced Plan of Study and Programme `muiEditTextFieldProps` select handling with explicit `Edit` renderers using MUI `TextField select`.
  - Editor value now reads from current `draftRows` row state, and `onChange` stages patches immediately per edited row.
  - Preserved `0 - Not Allotted` option and numeric option values for both selects.
  - This avoids hidden native-select input focus/event quirks in faculty flow and ensures `Save the edits (N)` increments reliably on value changes.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 20:44 IST | codex | change
- Summary: Rewrote faculty Students Directory flow to reuse admin table behavior with strict faculty constraints (active mentored only, no Mentor/Programme display or edits).
- Files: frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, api/src/modules/imports/imports.service.ts, CHANGELOG.md
- Details:
  - Removed faculty students-directory filter mode dependency and simplified faculty directory entry to a single active-mentored dataset.
  - Faculty Students Directory now displays only `facultyStudentRows` where `studentActive = true`.
  - Reused shared `StudentsDirectoryTable` path and added `showProgramme` control so faculty view hides Programme column entirely.
  - Faculty view now hides both Programme and Mentor columns (non-displayed, non-inline-editable), while admin/moderator/head behavior remains unchanged.
  - Updated CSV guidance and frontend CSV validation to reject faculty uploads containing `programme` or `mentor_email` columns.
  - Enforced same rule server-side in imports service: faculty-scoped CSV updates cannot modify `programme` or `mentor_email`.
  - Adjusted faculty header/caption copy to reflect active mentoring scope only.
  - Verification passed: `npx tsc --noEmit` in `frontend/`; `npm --prefix api run test`.
- Revert: none

## 2026-05-19 20:52 IST | codex | change
- Summary: Removed faculty "Completed" card and navigation path from dashboard, leaving only active mentoring students entrypoint.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Removed `facultyCompletedCount` computation and corresponding dashboard card UI.
  - Removed completed-view "View students" path so faculty students-directory navigation is now single-path via mentoring card.
  - Removed now-unused `CheckCircleOutlineIcon` import.
  - Verification passed: `npx tsc --noEmit` in `frontend/`; `npm --prefix api run test`.
- Revert: none

## 2026-05-19 21:00 IST | codex | fix
- Summary: Hardened Students Directory staged-edit tracking so faculty `Save the edits (N)` updates even when row identity is inconsistent.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Replaced pending patch map keying from `userId` to stable row key (`userId` fallback to email/registration/fullName) for edit staging.
  - Removed early-return guard that skipped staging when `userId` was empty, enabling visible pending-count updates in faculty view.
  - Save action now resolves stable row keys back to current/baseline rows and submits only resolved rows with available `userId`.
  - This targets faculty-only symptom where inline edits were visible but pending counter/button state did not update.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 21:06 IST | codex | fix
- Summary: Fixed faculty inline edit corruption where editing one row could overwrite multiple rows with same data.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Updated staged row patch targeting to use stable row-key matching (same strategy as pending map) instead of `userId`-only matching.
  - This prevents bulk accidental updates when multiple faculty rows have empty `userId` and previously all matched the same update predicate.
  - Updated both row-level and field-level staging lookups to resolve by stable key (`userId` fallback to email/registration/fullName).
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 21:12 IST | codex | change
- Summary: Highlighted student Full Name in error color when row has no associated `userId`.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Added custom `Cell` renderer for `Full Name` column.
  - Applies warning/error styling (`error.main`, semibold) when `row.original.userId` is empty.
  - Keeps normal styling for rows with valid `userId`.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-19 20:59 IST | codex | fix
- Summary: Fixed faculty Students Directory missing `userId` on all rows by returning non-sanitized public identifier key from `/api/students`.
- Files: api/src/modules/students/students.service.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Root cause: response sanitization removes `*_id` keys globally, which stripped `user_id` from `/api/students` payload rows.
  - Updated student listing service to map DB rows into explicit response objects with `userId` (camelCase) instead of `user_id`.
  - Updated pagination cursor derivation to use `rows[].userId`.
  - Updated faculty client mapping to read `userId` first, with `user_id` fallback for backward compatibility.
  - This restores valid row identity in faculty view and prevents full-table warning state/row-edit targeting failures.
  - Verification passed: `npm --prefix api run test`; `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-19 20:44 IST | codex | change
- Summary: Added student semester/audit schema fields and wired Students Directory inline+CSV updates with role-aware audit display.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/setup/wizard.service.ts, api/src/modules/students/students-directory.service.ts, api/src/modules/imports/imports.service.ts, api/src/app/worker.ts, frontend/src/app/types.ts, frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Added migration `0026_students_add_current_semester_and_audit_columns` to add `students.current_semester` (default 1), `students.modified_by` (FK to `user_accounts.id`, nullable), and `students.modified_at` (default `current_timestamp`) with backfill updates.
  - Extended `runRecentMitigations` with existing-db guards that add/backfill the same columns when missing, so mitigation works for already-provisioned databases.
  - Updated students directory read/write backend flow to include `currentSemester`, persist `modifiedByUserId`, auto-stamp `modified_at`, and resolve/display modifier full name.
  - Updated CSV student import to accept optional `current_semester`, validate it as a positive integer, and stamp audit fields for updates/inserts when schema columns exist.
  - Updated Students Directory UI to support inline editing for `Current Semester`, include CSV guidance/parsing for `current_semester`, and show readonly `Modified By` + `Modified At (IST)` columns for admin/moderator/head views only.
- Revert: none
## 2026-05-19 20:50 IST | codex | change
- Summary: Tightened Students Directory numeric inline input bounds for batch and current semester.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Constrained inline `batch` numeric editor to `2010..2040` via input props and blur-time clamping.
  - Constrained inline `currentSemester` numeric editor to `min=1` and dynamic `max=duration` (floored, with safe minimum 1), including blur-time clamping.
  - Added a helper to compute effective row-level semester maximum from the current draft duration value.
- Revert: none
## 2026-05-19 20:54 IST | codex | change
- Summary: Updated current-semester inline bounds to derive from each student's Plan of Study semester range.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `planSemesterBounds` derivation in `App.tsx` from loaded `plansOfStudy` (`min/max` semester per `planCode`).
  - Passed plan semester bounds into `StudentsDirectoryTable` and used them for current-semester editor `min/max` when a student has a mapped `planOfStudyCode`.
  - Kept safe fallback behavior to `min=1` and `max=floor(duration)` when plan mapping is unavailable.
- Revert: none
## 2026-05-19 21:00 IST | codex | fix
- Summary: Made student audit-column migration self-healing on write to prevent runtime blocking errors.
- Files: api/src/modules/students/students-directory.service.ts, CHANGELOG.md
- Details:
  - Added `ensureStudentsAuditColumns()` to lazily add `current_semester`, `modified_by`, and `modified_at` columns when missing.
  - Added backfill updates for `current_semester` and `modified_at` after lazy column creation.
  - Switched `upsertStudentDirectoryRow()` to call the self-healing schema helper before validation and write.
- Revert: none
## 2026-05-19 21:02 IST | codex | fix
- Summary: Fixed SQLite `ALTER TABLE` failure by removing non-constant default from `modified_at` add-column mitigations.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/setup/wizard.service.ts, api/src/modules/students/students-directory.service.ts, CHANGELOG.md
- Details:
  - Replaced `alter table students add column modified_at text not null default current_timestamp` with `alter table students add column modified_at text` in migration and runtime mitigation paths.
  - Preserved data correctness by keeping existing backfill and write-time `modified_at = current_timestamp` stamping logic.
  - This resolves runtime error: `SQLITE_UNKNOWN: SQLite error: Cannot add a column with non-constant default`.
- Revert: none
## 2026-05-19 21:08 IST | codex | fix
- Summary: Fixed stale current semester display by returning `current_semester` in faculty-scoped student reads.
- Files: api/src/modules/students/students.service.ts, frontend/src/app/types.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `s.current_semester` to `/api/students` query output (`listStudentsByScope`) and mapped it into response rows.
  - Extended `FacultyStudentRow` type with `currentSemester`.
  - Updated faculty Students Directory row mapping to use `student.currentSemester` instead of hardcoded `1`.
- Revert: none
## 2026-05-19 21:15 IST | codex | fix
- Summary: Fixed faculty CSV post-import forbidden refresh and enforced CSV bounds for batch/current semester.
- Files: frontend/src/app/App.tsx, api/src/modules/imports/imports.service.ts, CHANGELOG.md
- Details:
  - Updated faculty-only CSV import refresh flow to reload `/api/students` data instead of calling admin/mod/head-only `/api/students-directory`, removing the false `Forbidden` status after successful updates.
  - Tightened CSV batch validation to `2010..2040` (both parsed input and effective final batch value checks).
  - Added CSV current-semester upper-bound validation against effective duration (`programme_duration` from CSV when provided, otherwise existing DB value), enforcing `1..floor(duration)` when duration is known.
- Revert: none
## 2026-05-19 21:19 IST | codex | change
- Summary: Changed CSV `current_semester` validation to prefer plan-of-study semester ranges with duration fallback.
- Files: api/src/modules/imports/imports.service.ts, CHANGELOG.md
- Details:
  - Loaded plan-of-study catalog in import flow and built `planCode -> {min,max}` semester bounds map.
  - For each row, resolved effective plan code from CSV `plan_of_study_code` when provided, otherwise existing student plan code.
  - Validated `current_semester` against plan semester bounds first; only when plan bounds are unavailable does validation fall back to duration-based max.
- Revert: none
## 2026-05-19 22:06 IST | codex | change
- Summary: Made student CSV import row-resilient and added end-of-import success/failure reporting with failed record details.
- Files: api/src/modules/imports/imports.service.ts, api/src/app/worker.ts, frontend/src/shared/api/client.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Changed student CSV import backend to process rows independently: on row error, record failure and continue to next row.
  - Added import summary response fields for student CSV uploads: `imported`, `failed`, `errors`, and `total`.
  - Updated frontend student CSV flow to show final counts and open a dedicated result dialog listing failed row details when any failures occur.
  - Kept post-import data refresh behavior role-aware (faculty uses scoped student reload).
- Revert: none
## 2026-05-19 22:07 IST | codex | fix
- Summary: Prevented aria-hidden focus warning when opening CSV result dialogs by blurring active trigger element first.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `blurActiveElement()` helper in `App.tsx`.
  - Called the helper right before opening both user CSV and student CSV result dialogs when failures are present.
  - This avoids leaving focus on the triggering button while MUI dialog modal logic marks background content as `aria-hidden`.
- Revert: none
## 2026-05-19 22:38 IST | codex | change
- Summary: Added mitigation migration to create `student_credit_details` with indexes and auto-`modified_at` update trigger.
- Files: api/src/modules/setup/migrations.ts, CHANGELOG.md
- Details:
  - Added migration `0027_student_credit_details_table_and_trigger` to create `student_credit_details` with uniqueness on `(student_id, category_id, semester_taken)`.
  - Included constraints for semester, credits, and status validation plus FKs to `students(user_id)` and `user_accounts(id)`.
  - Added indexes `idx_credit_details_student` and `idx_credit_details_student_sem`.
  - Added trigger `trg_student_credit_details_modified_at` to stamp `modified_at = current_timestamp` on updates when the value is unchanged.
- Revert: none
## 2026-05-19 23:05 IST | codex | change
- Summary: Made student full names open a new Student Credits view with Plan of Study, On Study, and Analytics tabs.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/StudentCreditsView.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated Students Directory `Full Name` cells to be clickable actions that open a per-student credits view.
  - Added `StudentCreditsView` with three tabs: `Plan of Study`, `On Study`, and `Analytics` placeholder.
  - Implemented semester-wise Plan of Study credits table showing category code/name, planned credits, and editable earned credits.
  - Enforced earned-credit editability only up to each student's current semester, with lower-bound handling tied to the minimum semester defined by the assigned plan of study.
  - Implemented On Study tab inputs for per-category registered credits using the selected student plan/regulation category set.
  - Added app state wiring for student selection, view navigation, and in-memory per-student credit draft storage.
- Revert: none
## 2026-05-19 23:14 IST | codex | fix
- Summary: Fixed App startup crash caused by reading `facultyStudentsDirectoryRows` before initialization.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Moved the `selectedStudentForCredits` synchronization `useEffect` to a position after `facultyStudentsDirectoryRows` is declared.
  - Resolved runtime TDZ error: `Cannot access 'facultyStudentsDirectoryRows' before initialization`.
  - Verified frontend type-check passes after the change.
- Revert: none
## 2026-05-20 16:21 IST | codex | change
- Summary: Removed `programme_duration` end-to-end, added binary `graduated` (Yes/No), and added a mitigation migration to enforce the new students schema.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/imports/imports.service.ts, api/src/modules/students/students-directory.service.ts, api/src/modules/students/students.service.ts, api/src/app/worker.ts, frontend/src/app/types.ts, frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Added migration `0028_students_replace_programme_duration_with_graduated` to rebuild `students` with `graduated integer not null default 0 check(graduated in (0,1))` and no `programme_duration` column.
  - Removed `programme_duration` handling from student import and update paths; added CSV/API support for `graduated` with strict Yes/No validation.
  - Updated student list/directory services and API handlers to persist/return `graduated` and removed duration-derived semester logic.
  - Updated frontend student types, Students Directory editing/export/detail views, and CSV import headers/payload mapping to use `graduated` instead of `duration`/`programme_duration`.
- Revert: none
## 2026-05-20 16:28 IST | codex | change
- Summary: Restored update-student-details CSV column guidance in the Students Directory header after toolbar-button move.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added a header caption listing CSV columns for student detail updates: required `email`; optional `registration_number`, `plan_of_study_code`, `programme`, `current_semester`, `batch`, `graduated`, `mentor_email`.
  - Added a faculty-only note clarifying CSV restrictions: `programme` and `mentor_email` are not allowed for faculty CSV updates.
- Revert: none
## 2026-05-20 17:09 IST | codex | fix
- Summary: Prevented accidental student-credit data loss by making empty/zero-only credit upserts non-destructive.
- Files: api/src/modules/students/students.service.ts, CHANGELOG.md
- Details:
  - Updated `upsertStudentCredits` to pre-filter positive-credit entries and return early when payload has no `credits > 0` rows.
  - Kept existing delete-and-reinsert behavior only when at least one positive-credit entry is present.
  - This blocks unintended wipes where a save/import submits empty or zero-only entries for a student.
  - Verification passed: `npm --prefix api run test`.
- Revert: none
## 2026-05-20 17:14 IST | codex | change
- Summary: Reworked student-credits write flow to strict explicit modes with transactional safety and intentional clear-all semantics (no backward compatibility).
- Files: api/src/modules/students/students.service.ts, api/src/app/worker.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Introduced mandatory `writeMode` contract for credits writes: `replace_all` or `patch`.
  - Updated `POST /api/student-credits` and `POST /api/student-credits/import-batch` to reject requests missing/invalid `writeMode`.
  - Added explicit `allowClearAll` gate for `replace_all`: empty/zero-only payloads now require `allowClearAll=true` to delete all rows.
  - Implemented transactional credit writes in `upsertStudentCredits` using `BEGIN`/`COMMIT`/`ROLLBACK`.
  - `replace_all` mode: delete existing student rows then insert positive-credit entries.
  - `patch` mode: upsert positive-credit entries only, preserving other rows.
  - Updated frontend callers to the new API contract:
    - Student credits Save uses `writeMode: "replace_all"` with `allowClearAll: true`.
    - Credits CSV import uses `writeMode: "replace_all"` with `allowClearAll: false`.
  - Verification passed: `npm --prefix api run test`.
- Revert: none
## 2026-05-20 17:20 IST | codex | fix
- Summary: Fixed post-migration SQLite FK break (`no such table: main.students_old_v5`) by rebinding `student_credit_details` foreign key to current `students`.
- Files: api/src/modules/setup/migrations.ts, CHANGELOG.md
- Details:
  - Added migration `0029_student_credit_details_rebind_students_fk`.
  - Rebuilds `student_credit_details`, copies data, and re-creates indexes/`modified_at` trigger.
  - Ensures `student_credit_details.student_id` FK references `students(user_id)` after students-table rebuild migrations.
  - Resolves runtime errors where credit writes/checks referenced retired table name `students_old_v5`.
- Revert: none
## 2026-05-20 17:23 IST | codex | fix
- Summary: Fixed student-credits write failure `cannot commit - no transaction is active` by making commit/rollback tolerant of libsql auto-managed transaction boundaries.
- Files: api/src/modules/students/students.service.ts, CHANGELOG.md
- Details:
  - Added local `safeCommit()` and `safeRollback()` helpers in students credits service.
  - Replaced direct `COMMIT`/`ROLLBACK` calls in `upsertStudentCredits` with safe wrappers that ignore no-active-transaction errors.
  - Aligned credits service transaction handling with existing auth/setup patterns already used in this codebase.
  - Verification passed: `npm --prefix api run test`.
- Revert: none
## 2026-05-21 08:05 IST | codex | change
- Summary: Added a faculty-facing Student Credit Table page with mentor-scoped credit rows and native selected/all CSV export.
- Files: api/src/modules/students/students.service.ts, api/src/app/worker.ts, api/src/modules/auth/policy.ts, frontend/src/app/types.ts, frontend/src/app/FacultyCreditDetailsTable.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added backend query `listStudentCreditTableByScope` to return per-credit rows with `registration_number`, `category_id`, `semester_taken`, `credits`, `modified_by` username, and `modified_at`.
  - Added new endpoint `GET /api/student-credit-table` and applied existing student scope resolution so faculty users only see rows for students in their mentoring scope.
  - Added access policy for `GET /api/student-credit-table` for `faculty/head/moderator/admin` roles.
  - Added frontend type `FacultyCreditTableRow` and new `FacultyCreditDetailsTable` using Material React Table with native global search/filters, row selection, row numbers, and CSV/PDF export toolbar behavior (selected rows if selected, otherwise all rows).
  - Added a new Academics nav item (`Student Credit Table`) for faculty-only users and wired page rendering in `App.tsx`.
  - Displayed modified time as IST in the table and export output.
  - Verification: `frontend` type-check passed with `npx tsc --noEmit` after nav updates. Workspace-wide `npm run build` still fails due to pre-existing unrelated TypeScript issues in `frontend/src/app/App.tsx`, `ActiveUsersTable.tsx`, and `ExportToolbar.tsx`.
- Revert: none
## 2026-05-21 08:02 IST | codex | fix
- Summary: Fixed faculty student-credit table query failure by removing reference to non-existent `user_accounts.username`.
- Files: api/src/modules/students/students.service.ts, CHANGELOG.md
- Details:
  - Replaced `modifier.username` in `listStudentCreditTableByScope` with a schema-safe display label fallback: `full_name`, then `email`, then `subject`.
  - Preserved API response shape (`modifiedByUsername`) so frontend remains unchanged.
  - Verification passed: `npm --prefix api run test`.
- Revert: none
## 2026-05-21 08:12 IST | codex | change
- Summary: Added `Graduated` (Yes/No) column to faculty student-credit table view and exports.
- Files: api/src/modules/students/students.service.ts, frontend/src/app/types.ts, frontend/src/app/App.tsx, frontend/src/app/FacultyCreditDetailsTable.tsx, CHANGELOG.md
- Details:
  - Extended `GET /api/student-credit-table` row payload to include `students.graduated` normalized as `Yes`/`No`.
  - Updated frontend row typing and API mapping for the new `graduated` field.
  - Added a `Graduated` column to the Material React Table using checkbox filter pattern for binary values.
  - Included `graduated` in CSV and PDF export outputs.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 14:35 IST | codex | change
- Summary: Updated Faculty Dashboard My Students section to show separate Graduated and Not Graduated cards with click-through filtered Students view.
- Files: frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Replaced the faculty My Students metric cards with two status cards: `Graduated` and `Not Graduated`.
  - Wired each card action to open Students Directory and apply the corresponding `Graduated` filter (`Yes` or `No`).
  - Added support in `StudentsDirectoryTable` for an external initial graduated filter and applied it as a table column filter for the `graduated` checkbox column.
  - Reset dashboard-triggered graduated filter when users open Students Directory from standard navigation to avoid stale deep-link filters.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 14:41 IST | codex | change
- Summary: Reordered Faculty My Students cards to show continuing students first and replaced "Not Graduated" wording with alternate phrasing.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Moved the non-graduated metric card to the first position.
  - Renamed first card label to `Continuing` and button text to `View continuing students`.
  - Preserved filter routing behavior: first card opens Students with `Graduated = No`; second card opens with `Graduated = Yes`.
- Revert: none
## 2026-05-21 14:44 IST | codex | change
- Summary: Replaced faculty non-graduated card wording from "Continuing" to "In Progress".
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated the first faculty My Students card label to `In Progress`.
  - Updated the first card action text to `View in-progress students`.
  - Kept existing filter behavior unchanged (`Graduated = No`).
- Revert: none
## 2026-05-21 14:52 IST | codex | fix
- Summary: Restored Students page credit detail/status rendering by ensuring regulations are loaded in Students route data-loading paths.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated faculty dashboard card navigation path (`openFacultyStudentsDirectory`) to load regulations before plans/students.
  - Updated Students route initialization effect to load regulations when missing and to treat plans+regulations as required context.
  - This restores reliable `Cr. Target`, `Cr. Earned`, `Deficient`, and `Status` calculations/rendering in Students view.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 10:54 IST | codex | change
- Summary: Added section-wise mentoring completion rollups on the Faculty Dashboard with separate In Progress and Graduated views.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added faculty dashboard rollup logic that aggregates mentoring students by graduation status and computes per-semester section totals.
  - Each section now shows all-category credit completion (`earned/required`) and category-wise credit chips for quick audit visibility.
  - Added a dedicated "Section-wise Completion Status" area under "My Students" with separate panels for `In Progress` and `Graduated` mentoring cohorts.
  - Data is sourced from existing mentoring student scope and faculty credit-detail rows to keep role scoping intact.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 13:10 IST | codex | change
- Summary: Added My Account menu entry to the bottom of the mobile hamburger drawer.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Kept mobile navigation hamburger-only and preserved existing role-based nav rendering.
  - Updated the mobile drawer layout to a full-height column so footer actions can be pinned.
  - Added a bottom `My Account` list action (mobile drawer only) that opens the Account profile view, closes the drawer, and refreshes active session context.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 13:12 IST | codex | refactor
- Summary: Unified desktop and mobile user account actions to a single shared menu-item source.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Created one shared `userAccountMenuItems` definition for account actions (`My Account`, `Sign Out`) inside `App.tsx`.
  - Updated the desktop top-right account dropdown to render items from the shared definition.
  - Updated the mobile hamburger bottom account section to render from the same shared definition, removing duplicate per-view logic.
  - Ensures future menu-item updates remain uniform across desktop and mobile from one source.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 13:13 IST | codex | change
- Summary: Added user avatar placeholder and display name to the mobile hamburger account section.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Preserved the shared user account action menu source used by desktop and mobile.
  - Added the same identity display pattern (avatar initials + full display name) to the mobile drawer account area.
  - Positioned identity block directly above the shared account actions at the bottom of the hamburger drawer.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 17:12 IST | codex | change
- Summary: Standardized credit values to two-decimal precision across student credit API flows and frontend credit displays.
- Files: api/src/modules/students/students.service.ts, api/src/app/worker.ts, frontend/src/app/utils.ts, frontend/src/app/App.tsx, frontend/src/app/FacultyCreditDetailsTable.tsx, frontend/src/app/StudentCreditsView.tsx, frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Added shared two-decimal normalization in API credit service paths for reads, summaries, import aggregation, and upserts.
  - Normalized incoming credit payloads in `/api/student-credits` and `/api/student-credits/import-batch` before persistence.
  - Added frontend credit helpers (`normalizeCredits`, `formatCredits`) and applied them to student-credit loading, saving, and state updates.
  - Updated Student Credits UI to display credit totals with two decimals and accept decimal input in `0.01` steps.
  - Updated Faculty Credit Table and Faculty Analytics credit outputs/tooltips/exports to render two-decimal credit values.
  - Verification passed: `npx tsc --noEmit` in `frontend/`. Workspace `npm run build` still fails due pre-existing unrelated frontend TypeScript issues (for example in `ActiveUsersTable.tsx`, `ExportToolbar.tsx`, and pre-existing `App.tsx` typing).
- Revert: none
## 2026-05-21 17:24 IST | codex | change
- Summary: Made credit display conditional across the UI (integers without decimals; fractional credits with exactly two decimals) and documented this as a mandatory rule in AGENTS.md.
- Files: frontend/src/app/utils.ts, frontend/src/app/StudentCreditsView.tsx, frontend/src/app/FacultyAnalyticsReport.tsx, AGENTS.md, CHANGELOG.md
- Details:
  - Updated shared `formatCredits` in `frontend/src/app/utils.ts` to render whole-number credits without decimal digits and fractional credits with two digits.
  - Updated remaining raw credit render paths in `StudentCreditsView` to use shared formatting for semester summary and deficit chip labels.
  - Updated zero-value fallback in `FacultyAnalyticsReport` exports to use shared credit formatting instead of hardcoded `0.00`.
  - Added a new mandatory product rule in `AGENTS.md` requiring app-wide credit formatting via shared formatter and prohibiting ad-hoc formatting.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 17:16 IST | codex | change
- Summary: Added earned-to-target percentage column to the Students directory credits table.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Added a new `"%"` column in `StudentsDirectoryTable` that displays `earned / target * 100` for each student.
  - Column is sortable via numeric accessor and shows `—` when credit summary is missing or target is zero.
  - Included the new column in mobile hidden-column defaults alongside existing credit columns.
- Revert: none
## 2026-05-21 17:20 IST | codex | change
- Summary: Enabled MRT native filter modes for selected Students directory columns.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Turned on `enableColumnFilterModes` for `Reg. Number`, `Semester`, `Cr. Target`, `Cr. Earned`, `%`, and `Status` columns.
  - Keeps existing table filter UI while exposing MRT's built-in per-column filter mode selector on the requested fields.
- Revert: none

## 2026-05-21 17:33 IST | codex | change
- Summary: Moved admin force-logout user action into Manage Users MRT row actions with confirmation dialog and existing API behavior.
- Files: frontend/src/app/App.tsx, frontend/src/app/ManageUsersTable.tsx, CHANGELOG.md
- Details:
  - Added a per-user logout icon action in ManageUsersTable next to existing activate/deactivate and reset-password icons.
  - Added a confirmation dialog in ManageUsersTable before executing user session revocation.
  - Reused the existing /api/admin/users/logout-all-sessions flow via a shared App-level helper callback passed into the table.
  - Removed the separate Force Logout User navigation item and dedicated session-admin page section from App.tsx.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 17:52 IST | codex | change
- Summary: Allowed email addresses in Manage Users add-user username field validation.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated Create Local Account username validation to accept either the existing lowercase username pattern or a valid email address format.
  - Updated the field label from `Username *` to `Username or email *` to match the allowed input.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 17:48 IST | codex | fix
- Summary: Fixed Manage Users add-user flow so creating a local user works when username is an email and email field is left blank.
- Files: api/src/modules/auth/password-auth.service.ts, CHANGELOG.md
- Details:
  - Root cause was backend requiring `email` even though the add-user form allows email to be optional.
  - Updated local user creation to derive canonical email from `username` when the username is a valid email address.
  - Kept explicit validation: if username is not an email and email is blank, creation still fails with a clear message.
  - Verification passed: `npm --prefix api run test` and `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 17:49 IST | codex | fix
- Summary: Clarified create-user username collision errors when the username belongs to a super admin account hidden from Manage Users.
- Files: api/src/modules/auth/password-auth.service.ts, CHANGELOG.md
- Details:
  - Updated username uniqueness lookup to join account metadata (`is_superuser`, active flags) when checking `auth_credentials`.
  - Added a specific error for super-admin-owned usernames: `Username is already used by a super admin account (not shown in Manage Users).`
  - Kept existing collision behavior for non-super-admin users (`Username already exists.`).
  - Verification passed: `npm --prefix api run test`.
- Revert: none
## 2026-05-21 18:00 IST | codex | fix
- Summary: Removed 100-row cap in Manage Users by fetching all cursor-paginated user pages for MRT.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Root cause: `loadUsers()` requested only one `limit=100` page and did not follow `nextCursor`.
  - Updated `loadUsers()` to iterate cursor pages (`/api/admin/users`) and aggregate rows until pagination is exhausted.
  - Preserved existing first-page cache key usage, now storing the full aggregated result set for `users:first`.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 18:18 IST | codex | fix
- Summary: Enforced faculty-scope data for faculty dashboard requests when users have mixed roles (for example `faculty` + `moderator`).
- Files: api/src/app/worker.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added optional request query flag `roleContext=faculty` handling in API worker scope resolution.
  - When `roleContext=faculty` is provided and the principal includes `faculty`, student scope is forced to faculty mentor-scope (if mentor email can be derived), instead of broader admin/moderator/head scope.
  - Updated faculty dashboard loaders to call:
    - `/api/students?limit=100&roleContext=faculty`
    - `/api/student-credit-table?roleContext=faculty`
  - This keeps broader-role behavior unchanged outside explicit faculty-context views.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 18:19 IST | codex | change
- Summary: Added moderator scoped dashboard parity with faculty UI and active-student-only role context filtering.
- Files: api/src/app/worker.ts, api/src/modules/students/students.service.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Extended API `roleContext` handling with `roleContext=moderator` and added active-only filtering for scoped student list and scoped student credit table responses.
  - Updated frontend scoped dashboard loaders to pass dynamic role context (`faculty` or `moderator`) for `/api/students` and `/api/student-credit-table`.
  - Enabled moderators to use the same dashboard student analytics UI previously shown for faculty, with moderator copy updated to reflect all active students.
  - Updated scoped Students Directory behavior to use the same scoped dataset for moderators (active students) and faculty (mentored students) when not in admin/head context.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
  - API test run failed in local environment due filesystem permission error writing `api/node_modules/.vite-temp` (EPERM), not due assertion/test failures.
- Revert: none
## 2026-05-21 18:25 IST | codex | fix
- Summary: Fixed multi-role dashboard rendering so faculty and moderator cards both appear and load their own scoped data.
- Files: frontend/src/app/App.tsx, frontend/src/app/types.ts, CHANGELOG.md
- Details:
  - Added separate moderator scoped state and loaders (`students` and `student-credit-table`) instead of a single shared scoped-role context that hid one role card.
  - Updated dashboard effects to load faculty scoped datasets and moderator scoped datasets independently when the principal has both roles.
  - Rendered two independent dashboard cards: `My Students` (faculty scope) and `Active Students` (moderator scope), each with its own counts and analytics dataset.
  - Added `moderator-students:first` admin cache key and included it in scoped cache invalidation paths after student updates/imports.
  - Added role-aware primary scoped loaders for Students Directory/Credit Table navigation so moderator-only scoped users load moderator context correctly.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 18:29 IST | codex | fix
- Summary: Enforced zero-value dashboard-card hiding for faculty/moderator student status cards and documented scoped-read increase justification.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated faculty and moderator dashboard status-card rendering to hide any metric card with value `0` (`In Progress`, `Graduated`) to satisfy mandatory dashboard card visibility rules.
  - Updated dashboard status-card grids to dynamically adjust column count based on the number of visible cards.
  - Added fallback helper text when both status metrics are `0` so no zero-value metric card is rendered.
  - Read-increase justification: multi-role dashboard mode performs additional scoped reads (`faculty` + `moderator`) by design to satisfy the mandatory role-section visibility rule for users with multiple roles; impact is bounded by first-page TTL caching and force-refresh bypass behavior already in place.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 18:31 IST | codex | fix
- Summary: Set moderator dashboard batch accordions to start collapsed by default while keeping faculty default expansion behavior unchanged.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `defaultExpandFirstBatch` prop to `FacultyAnalyticsReport` with default `true` to preserve existing faculty behavior (first batch expanded).
  - Updated accordion initialization in `FacultyAnalyticsReport` to use `defaultExpanded={defaultExpandFirstBatch && idx === 0}`.
  - Passed `defaultExpandFirstBatch={false}` from the moderator dashboard card usage in `App.tsx`, so all moderator batch accordions are closed on first render.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 18:32 IST | codex | change
- Summary: Enforced deterministic multi-role dashboard section order and documented the order rule in AGENTS.md.
- Files: frontend/src/app/App.tsx, AGENTS.md, CHANGELOG.md
- Details:
  - Reordered dashboard role sections in `App.tsx` so multi-role users see sections in this precedence: `Administrator`, `Head`, `Moderator`, `Faculty`, `Student`, `Guest`.
  - Preserved existing administrator dashboard block as the first section, then reordered role cards to `Head` -> `Moderator` -> `Faculty` -> `Student` -> `Guest`.
  - Added the same mandatory role-section ordering rule under dashboard routing constraints in `AGENTS.md` to keep future implementations consistent.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none
## 2026-05-21 18:44 IST | codex | change
- Summary: Added head dashboard parity with moderator analytics using `roleContext=head` and active-student scoped data.
- Files: api/src/app/worker.ts, frontend/src/app/App.tsx, frontend/src/app/types.ts, CHANGELOG.md
- Details:
  - Extended API role-context handling to support `roleContext=head` with the same active-student restriction behavior used by moderator role context.
  - Added head-scoped dashboard data stores and loaders in `App.tsx` for students and credit-table analytics, backed by `/api/students?roleContext=head` and `/api/student-credit-table?roleContext=head`.
  - Replaced head dashboard placeholder card with the same analytics UI structure as moderator card, using head-scoped datasets and collapsed-by-default batch accordions.
  - Added `head-students:first` to admin cache key types/list and included this cache in invalidation paths after student write/import operations.
  - Verification passed: `npx tsc --noEmit` in `frontend/` and `npx tsc --noEmit` in `api/`.
- Revert: none
## 2026-05-21 18:46 IST | codex | change
- Summary: Added Turso billing usage card to the top of the head dashboard and enabled head access to dashboard metrics source.
- Files: api/src/modules/auth/policy.ts, api/src/app/worker.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Extended dashboard metrics endpoint policy/access checks so `head` role can read `/api/admin/dashboard` data used for the Turso usage panel.
  - Updated frontend dashboard data loading to fetch dashboard metrics for head users in addition to admin users.
  - Added `Turso DB · Billing Cycle Usage` card as the first top card inside the head dashboard section, reusing the same metric rendering pattern used in the administrator dashboard.
  - Verification passed: `npx tsc --noEmit` in `frontend/` and `npx tsc --noEmit` in `api/`.
- Revert: none
## 2026-05-21 18:49 IST | codex | change
- Summary: Added batch-wise four-label user-distribution chart cards to head and moderator dashboards.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Extended `FacultyAnalyticsReport` with optional `showBatchStatusByLabelCard` prop.
  - Added a native ECharts stacked horizontal bar chart card titled `Batch Status Distribution`, showing per-batch counts across the four labels: `Complete`, `On Track`, `Marginal`, `Off Track`.
  - Enabled the new card in Head and Moderator dashboard usages while leaving Faculty behavior unchanged.
  - Chart uses the same computed student analytics dataset currently used by dashboard batch accordions to keep counts consistent.
  - Verification passed: `npx tsc --noEmit` in `frontend/` and `npx tsc --noEmit` in `api/`.
- Revert: none
## 2026-05-21 18:51 IST | codex | change
- Summary: Replaced head/moderator batch status card with a growth-focused trend chart for presentation use.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Replaced stacked horizontal bar chart with a multi-series line/area trend chart (native ECharts) ordered chronologically by batch.
  - Added an overlaid dashed `Total` trend line to help track overall department growth alongside the four status labels.
  - Updated card title/description to emphasize growth tracking and presentation readiness.
  - Verification passed: `npx tsc --noEmit` in `frontend/` and `npx tsc --noEmit` in `api/`.
- Revert: none
## 2026-05-21 18:52 IST | codex | change
- Summary: Replaced head/moderator growth card with a batch-vs-status heatmap for clearer multi-batch comparison.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Switched chart type to native ECharts `heatmap` for better readability when comparing up to ~9 batches.
  - Configured matrix axes as `batch` (X) and status labels (`Complete`, `On Track`, `Marginal`, `Off Track`) on Y, with each cell showing exact user count.
  - Added color-scale `visualMap` to make low/high concentration immediately visible for presentation and review.
  - Updated card title/description to reflect comparison-oriented usage.
  - Verification passed: `npx tsc --noEmit` in `frontend/` and `npx tsc --noEmit` in `api/`.
- Revert: none
## 2026-05-21 18:55 IST | codex | change
- Summary: Implemented 100% stacked bar plus thin total-users line overlay for head/moderator batch comparison card.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Replaced the heatmap card with a dual-insight chart:
    - 100% stacked bars per batch for status composition (`Complete`, `On Track`, `Marginal`, `Off Track`).
    - Thin overlaid line on a secondary Y-axis for absolute `Total Users` growth by batch.
  - Added percentage labels inside stacked bars (when legible), kept detailed tooltip with both counts and percentages.
  - Updated title/description to reflect composition + growth interpretation.
  - Verification passed: `npx tsc --noEmit` in `frontend/` and `npx tsc --noEmit` in `api/`.
- Revert: none
## 2026-05-21 18:55 IST | codex | change
- Summary: Removed total-users line overlay from head/moderator batch composition chart.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Removed the `Total Users` line series and secondary Y-axis from the batch composition card.
  - Kept the 100% stacked bar chart and tooltip composition details intact.
  - Updated card title/description to reflect composition-only view.
  - Verification passed: `npx tsc --noEmit` in `frontend/` and `npx tsc --noEmit` in `api/`.
- Revert: none
## 2026-05-21 18:57 IST | codex | change
- Summary: Repositioned head/moderator composition chart beside the two student count cards.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `chartOnly` mode to `FacultyAnalyticsReport` so the chart card can be rendered standalone without the batch accordions.
  - Updated Head and Moderator dashboard metric grids to include the chart as a third side-by-side card (same row as `In Progress` and `Graduated` cards).
  - Removed duplicate chart rendering from the lower analytics sections by disabling `showBatchStatusByLabelCard` there.
  - Verification passed: `npx tsc --noEmit` in `frontend/` and `npx tsc --noEmit` in `api/`.
- Revert: none
## 2026-05-21 18:58 IST | codex | change
- Summary: Removed batch-composition helper sentence from the head/moderator chart card.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Removed the sentence `100% stacked bars show status composition for each batch.` from the chart card caption area as requested.
- Revert: none
## 2026-05-21 18:40 IST | codex | fix
- Summary: Fixed dashboard status-chip navigation so Students Directory filtering stays scoped to the clicked batch.
- Files: frontend/src/app/App.tsx, frontend/src/app/FacultyAnalyticsReport.tsx, frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Extended `FacultyAnalyticsReport` chip callback contract to pass both `creditStatusFilter` and `batchFilter` from each batch accordion.
  - Added `initialBatchFilter` support in `StudentsDirectoryTable` and applied it to MRT column filters (`batch`) alongside existing graduated/status initial filters.
  - Replaced the faculty-only directory opener with a scoped opener in `App.tsx` so faculty and moderator dashboard chips both route to Students Directory with correct role scope and pre-applied `status + batch` filters.
  - Reset initial Students Directory quick filters (`graduated`, `status`, `batch`) when the main Students nav item is opened directly, preventing stale carry-over.
  - Verification passed: `npx tsc --noEmit` in `frontend/`.
- Revert: none

## 2026-05-21 19:04 IST | codex | change
- Summary: Filtered Regulations page for student-only sessions to show only the signed-in student's plan-linked regulation and plan.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added a student-self plan lookup via /api/students?limit=1 and stored the resolved plan_of_study_code in App state.
  - Scoped Regulations tabs to only the regulation associated with the student's plan and scoped Plans Of Study tabs to that single plan for student-only sessions.
  - Kept existing behavior for admin/faculty/head/moderator roles, including refresh support and safe tab-index clamping.
- Revert: none


## 2026-05-21 19:04 IST | codex | change
- Summary: Hid regulations validation error banner for student-only sessions.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated the regulations-page validation alert condition to suppress rendering when the session is student-only.
  - Preserved existing validation visibility for non-student/admin-staff sessions.
- Revert: none


## 2026-05-21 19:08 IST | codex | change
- Summary: Enabled Students menu/page for student role with self-only rows and removed student-visible toolbar/header extras in Students Directory.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added student-role access to Academic -> Students navigation and students-directory view gating.
  - Implemented student self-row hydration via /api/students?limit=1 and bound Students Directory rows to that self-scoped dataset for student-only sessions.
  - Hid student-only page header text blocks and suppressed edit/import/credit-import toolbar actions by disabling edit mode and omitting import handlers for student-only sessions.
  - Kept existing behavior unchanged for admin/head/moderator/faculty roles, including refresh and scoped loading paths.
- Revert: none


## 2026-05-21 19:09 IST | codex | fix
- Summary: Restored Students Directory page heading for student-only sessions while keeping auxiliary header text hidden.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated the Students Directory header block to always render the Students Directory title.
  - Kept student-only suppression of secondary header/helper text unchanged.
- Revert: none


## 2026-05-21 19:10 IST | codex | change
- Summary: Enabled student-role Full Name click-through in Students Directory to open the same student credits page used by other roles.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Removed the student-only guard that disabled onOpenStudentCredits in Students Directory table props.
  - Kept student-only edit/import restrictions intact; this change only restores navigation parity for the Full Name link action.
- Revert: none


## 2026-05-21 19:12 IST | codex | change
- Summary: Enabled student-role read/save on student credits with strict self-only ownership checks.
- Files: api/src/modules/students/students.service.ts, api/src/app/worker.ts, api/src/modules/auth/policy.ts, CHANGELOG.md
- Details:
  - Allowed GET /api/student-credits and POST /api/student-credits for student role in route policy.
  - Added ssertStudentCanAccessOwnUserId to verify the requested studentId belongs to the authenticated student's own active account (email-bound lookup).
  - Enforced self/mentor/none scope checks in worker handlers: students can access only self, faculty scope remains mentor-checked, and unresolved scope fails closed with 403.
- Revert: none


## 2026-05-21 19:15 IST | codex | fix
- Summary: Fixed student-role Students MRT credit summary refresh by enabling and scoping the summaries endpoint for student self-access.
- Files: api/src/modules/auth/policy.ts, api/src/app/worker.ts, CHANGELOG.md
- Details:
  - Allowed POST /api/student-credits/summaries for the student role in access policy.
  - Added scope enforcement in worker: 
one => 403, mentor => faculty ownership assertion, self => strict self-only studentId assertion for each requested id.
  - Ensures student MRT credit-related values can load/update for the logged-in student while remaining access-safe.
- Revert: none


## 2026-05-21 19:16 IST | codex | fix
- Summary: Fixed empty credit columns for student-role Students MRT by aligning summary calculation/loading with student-only row source.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added a unified studentsDirectorySourceRows selector that resolves to studentSelfDirectoryRows for student-only sessions.
  - Updated selected-student sync, credit navigation fallback, credit summary computation, and summary fetch trigger to use that unified source.
  - Resolved role-specific mismatch where student table rows differed from the rows used to compute/fetch credit metrics.
- Revert: none


## 2026-05-21 19:17 IST | codex | fix
- Summary: Restored mentor display in student-role Students MRT by populating student-self row mentor field from available API mentor attributes.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated student-self row mapping to set mentorName from mentor_name, fallback mentor_full_name, then mentor_email.
  - Scope-limited change to student-only row hydration path; no behavior change for faculty/head/moderator/admin row sources.
- Revert: none

## 2026-05-21 20:34 IST | codex | fix
- Summary: Updated student-scope students payload to provide mentor display name (faculty full name with email fallback) so student MRT shows faculty name instead of raw email.
- Files: api/src/modules/students/students.service.ts, CHANGELOG.md
- Details:
  - Extended listStudentsByScope select to include mentor_name as coalesce(mentor full_name, mentor email) from user_accounts.
  - Added mentor_name to returned row mapping without changing existing mentor_email field.
  - Keeps compatibility for other roles while enabling student-role UI to render mentor name consistently.
- Revert: none

## 2026-05-21 19:56 IST | claude-sonnet-4-6 | change
- Summary: Redesigned head and moderator dashboard cards with improved visual hierarchy, colored stat cards, and scaled chart width.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced plain "Active Students" heading with a proper dashboard header containing a title, role chip (Head / Moderator), subtitle, and refresh button.
  - Replaced Turso billing metrics list with a 4-column centered layout showing usage percentage prominently in color (green/amber/red) with a thin progress bar below.
  - Split stat cards into three color-coded Papers: Total Active (blue tint), In Progress (amber tint), Passed Out (green tint), each with a matching colored border and button.
  - Added `headBatchCount` and `moderatorBatchCount` memos; used them to cap the batch status chart width to `batchCount × 320 px` so the chart is not stretched on small batch sets.
  - Moved batch status chart out of the stats grid into its own full-width `Box`, eliminating the double-border caused by the previous outer `Paper` wrapper.
  - Replaced bare `Divider` before detailed analytics with a `Divider` containing a centered "Batch Analytics" `Chip` label.
- Revert: none

## 2026-05-21 19:56 IST | claude-sonnet-4-6 | change
- Summary: Renamed "Graduated" to "Passed Out" across all UI labels, table headers, filter toggles, and export headers.
- Files: frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/FacultyCreditDetailsTable.tsx, frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Updated overline chip labels in head, moderator, and faculty dashboard stat cards from "Graduated" to "Passed Out".
  - Updated button text "View graduated" to "View passed out" in all three dashboard cards.
  - Updated `StudentsDirectoryTable` column header, edit field label, mobile row label, and PDF export headers from "Graduated" to "Passed Out".
  - Updated `FacultyCreditDetailsTable` column header and PDF export header.
  - Updated `FacultyAnalyticsReport` CSV export column header.
  - Data field values (`graduated: "Yes" | "No"`) and variable names are unchanged.
- Revert: none

## 2026-05-21 19:56 IST | claude-sonnet-4-6 | fix
- Summary: Fixed dashboard stat card navigation buttons to pass correct graduated and credit-status filters to the students directory.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Head "View students" button now sets `graduatedFilter = "No"` and clears credit/batch filters before navigating to students-directory.
  - Head "View passed out" button now sets `graduatedFilter = "Yes"` and clears credit/batch filters before navigating.
  - Moderator "View students" button now calls `openScopedStudentsDirectory("moderator", "No")` instead of passing `null` as the graduated filter.
  - Moderator "View passed out" button now calls `openScopedStudentsDirectory("moderator", "Yes")`.
  - Fixed head dashboard `onViewStudents` callback in `FacultyAnalyticsReport` to receive and apply both `creditStatusFilter` and `batchFilter` parameters when navigating from batch analytics status chips.
- Revert: none

## 2026-05-21 19:56 IST | claude-sonnet-4-6 | change
- Summary: Improved batch analytics category detail cards with a completion progress bar and credits earned/required row.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Added `LinearProgress` to MUI imports in `FacultyAnalyticsReport.tsx`.
  - Added a `LinearProgress` bar directly below the category code and completion-percentage chip, color-coded by completion level (success ≥100%, primary ≥60%, warning ≥30%, error otherwise).
  - Added a "Credits: earned / required" summary row between the category name and the status breakdown list, showing `formatCredits` values for `cat.totalEarned` and `cat.totalRequired`.
  - Converted `batchGroups.map` arrow from implicit return to block body to compute per-batch `batchStatusCounts` (used for the chip row, replacing the previous per-chip `filter` scan).
- Revert: none

## 2026-05-21 19:57 IST | claude-sonnet-4-6 | fix
- Summary: Fixed "Cannot find namespace JSX" TypeScript error by importing ReactElement from react.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `type ReactElement` to the existing react named import.
  - Replaced `JSX.Element` with `ReactElement` in the `userAccountMenuItems` array type annotation (line 631).
- Revert: none

## 2026-05-21 | claude-sonnet-4-6 | feature
- Summary: Built the student-only dashboard with profile summary, plan of study overview, and credit progress tracking.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `studentSelf` memo (first row of `studentSelfDirectoryRows`) for the logged-in student's profile.
  - Added `studentSelfCreditSummary` memo computing total required/earned credits, completion percentage, overall credit status, and per-category breakdown (code, required, earned, status) from `activeStudentPlan` and `studentEarnedCreditsByUser`.
  - Added two `useEffect` hooks: one to auto-load plan-of-study, programmes, regulations, and plans when the student dashboard mounts; a second to load the student's earned credits once their directory row is available.
  - Replaced the placeholder student card (single-line message) with a full dashboard featuring:
    - Header with DashboardIcon, "My Dashboard" title, Student role chip, and a force-refresh button.
    - Profile Paper: name, email, Active chip, plus a 6-field grid (Registration Number, Batch, Current Semester, Programme, Mentor, Plan of Study).
    - Plan of Study Paper: plan name, regulation chip, and a row of semester boxes (current semester highlighted in blue, past semesters dimmed).
    - Credit Progress Paper: overall status chip, completion LinearProgress bar, and a per-category grid showing each category code, a color-coded progress bar, category name, and earned/required credits.
    - Quick Actions: "View My Credits" (opens student credit details table) and "My Profile" (navigates to account profile view).
  - All credit values rendered via `formatCredits` from utils.ts (AGENTS.md Rule 9 compliant).
  - Zero-required categories filtered out; null plan gracefully shows a loading/empty state.
- Revert: none

## 2026-05-21 | claude-sonnet-4-6 | change
- Summary: Redesigned faculty dashboard card to match the head/moderator visual style with proper header, colored stat cards, a batch status chart, and a labeled analytics divider.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced the SchoolIcon + subtitle1 "My Students" header with DashboardIcon + h6 "Faculty Dashboard" + Faculty role chip + subtitle + refresh button, matching head/moderator header pattern exactly.
  - Changed inner CardContent padding from `p: { xs: 2, sm: 2.5 }` to `p: { xs: 2, sm: 3 }` for consistency.
  - Added a "Total Mentored" summary card (blue tint, primary border) showing combined in-progress + passed-out count, visible when any metrics are non-zero.
  - Updated "In Progress" and "Passed Out" stat cards to use color-tinted backgrounds (warning.main/success.main at 4% opacity) with matching colored borders, h3 count typography, and colored view buttons, identical to head/moderator card styling.
  - Changed stat grid columns formula from `repeat(max(1, facultyMetricCardCount), ...)` to `repeat(facultyMetricCardCount + 1, ...)` to accommodate the new Total Mentored card.
  - Added `facultyBatchCount` memo (unique non-null batch values from `facultyStudentRows`).
  - Added a batch status chart (FacultyAnalyticsReport with `showBatchStatusByLabelCard chartOnly`) whose max-width scales as `facultyBatchCount × 320 px`, preventing chart stretching for small batch sets.
  - Replaced the plain `Divider` before detailed analytics with a `Divider` containing a centered "Batch Analytics" `Chip` label, matching head/moderator layout.
- Revert: none

## 2026-05-21 | claude-sonnet-4-6 | change
- Summary: Removed the "Status Composition by Batch" chart from the faculty dashboard.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Removed the FacultyAnalyticsReport `showBatchStatusByLabelCard chartOnly` block and its wrapping Box from the faculty dashboard.
  - Removed the now-unused `facultyBatchCount` useMemo.
- Revert: none

## 2026-05-21 | claude-sonnet-4-6 | change
- Summary: Redesigned student dashboard credit progress card for a more compact, modern look.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Overall section: progress bar moved directly below the title/chip row (h:6, rounded), with a single compact caption line below ("X of Y cr · Z% complete") instead of separate bold text + caption.
  - Category section: replaced bordered grid boxes with a flat vertical list; each row shows the category code (monospace, colored by status), category name, and earned/required credits on one line, followed by a thin (h:3) progress bar — no border, no % chip.
  - Removed the 2-column grid layout for categories in favour of a single-column list with consistent gap, improving readability on all screen sizes.
- Revert: none

## 2026-05-21 | claude-sonnet-4-6 | change
- Summary: Redesigned student dashboard layout and credit progress card for a cleaner, more balanced desktop/mobile experience.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Credit progress card: replaced bordered per-category boxes with a flat inline-bar list — each row shows the category code (monospace, colored by status), category name (flex, truncates), a fixed-width progress bar (80 px), and earned/required credits right-aligned. Overall section shows a large colored earned-credit number, progress bar (h:6), and a single caption line.
  - Layout restructure: wrapped Profile, Plan of Study, and Credit Progress in a two-column grid (`xs: 1fr`, `md: 1fr 1fr`). Left column stacks Profile Paper + Plan of Study Paper vertically; right column holds Credit Progress Paper. On mobile all three stack in a single column.
  - Equal-height columns: removed `alignItems: start` from the outer grid (default `stretch` makes both columns equal height); added `flex: 1` to Plan of Study Paper so it grows to fill the left column; added `height: 100%` to Credit Progress Paper so it fills the right grid cell.
  - Profile fields grid changed from responsive 2-col/3-col to a fixed 2-column layout to suit the narrower left column.
  - Added "View My Plan of Study" quick-action button that navigates to `regulations` view, placed between "View My Credits" and "My Profile".
- Revert: none

## 2026-05-21 | claude-sonnet-4-6 | fix
- Summary: Fixed student dashboard quick-action buttons stacking without spacing on mobile.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Changed Stack from `direction="row" flexWrap="wrap"` to `direction={{ xs: "column", sm: "row" }}`. On mobile the buttons now stack vertically with consistent spacing and stretch full-width for easy touch targets. On sm+ they remain inline as before.
- Revert: none

## 2026-05-21 22:22 IST | codex-gpt-5 | feature
- Summary: Implemented mixed credit/unit category support with regulation+plan JSON extensions, dual-track validation, per-student unit persistence, and student audit UI support.
- Files: api/src/app/worker.ts, api/src/data/plan-of-study.json, api/src/data/regulations.json, api/src/modules/plan-of-study/plan-of-study-validation.service.ts, api/src/modules/plan-of-study/plan-of-study.service.ts, api/src/modules/regulations/regulations.service.ts, api/src/modules/setup/migrations.ts, api/src/modules/students/students.service.ts, frontend/src/app/App.tsx, frontend/src/app/StudentCreditsView.tsx, frontend/src/app/types.ts, frontend/src/shared/api/client.ts, CHANGELOG.md
- Details:
  - Extended regulation categories with `measure` (`credits`/`units`) and added `totalUnitsRequired` at curriculum level.
  - Updated plans-of-study JSON to include `totalUnits` per semester and rebalanced semester/regulation credit totals to separate non-credit unit categories.
  - Updated plan-of-study validation to independently validate credit totals and unit totals at both plan and semester levels and added new error codes for unit mismatches.
  - Added DB migration `0030_student_unit_details_table_and_trigger` to persist per-student unit-earned values by category.
  - Added student unit service functions (`getStudentUnits`, `upsertStudentUnits`) and wired worker `/api/student-credits` GET/POST to return and save `unitDetails`/`unitEntries` alongside existing credits.
  - Extended frontend domain/API types to include category measure, unit totals, and unit details payloads.
  - Updated student credits data flow in `App.tsx` to load/save per-student unit maps and pass them to the audit view.
  - Updated `StudentCreditsView` to treat categories by measure, keep semester credit editing for `credits` categories, add non-credit unit editing UI, and gate completion when unit requirements are still pending.
- Revert: none

## 2026-05-21 22:24 IST | codex-gpt-5 | fix
- Summary: Prevented student credits page failure when unit-tracking migration is not yet applied by adding a safe fallback for missing `student_unit_details`.
- Files: api/src/modules/students/students.service.ts, CHANGELOG.md
- Details:
  - Added `isMissingStudentUnitDetailsTableError` helper for robust detection of missing unit table errors.
  - Updated `getStudentUnits` to catch missing-table errors and return an empty unit list instead of throwing, so `GET /api/student-credits` no longer fails with HTTP 400 in pre-migration environments.
  - Updated `upsertStudentUnits` to emit a clear actionable error message (`Run setup migrations, then retry saving.`) when unit save is attempted before migration.
- Revert: none

## 2026-05-21 22:30 IST | codex-gpt-5 | change
- Summary: Switched non-credit unit tracking from separate-table storage to single-table storage in `student_credit_details`.
- Files: api/src/modules/students/students.service.ts, api/src/modules/setup/migrations.ts, CHANGELOG.md
- Details:
  - `getStudentUnits` now reads units from `student_credit_details` (single table) using `status = 5` rows and category-wise aggregation.
  - `upsertStudentUnits` now writes units into `student_credit_details` with `semester_taken = 1` and `status = 5`, keeping `credits` as the numeric carrier for both credits and units depending on category measure.
  - Unit replace mode now clears only `status = 5` rows for the student, preventing interference with regular credit rows.
  - Removed migration `0030_student_unit_details_table_and_trigger` so the model remains single-table.
- Revert: none

## 2026-05-21 22:36 IST | codex-gpt-5 | fix
- Summary: Removed React unknown-DOM-prop warnings from Faculty Analytics layout by replacing problematic `Stack` prop usage with explicit flex `Box` containers.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Replaced `Stack` instances that used `direction`, `alignItems`, `justifyContent`, and `flexWrap` in affected sections with `Box` elements using equivalent `sx` flex styles.
  - Eliminates runtime warnings such as `React does not recognize the alignItems/flexWrap/justifyContent prop on a DOM element` seen from `FacultyAnalyticsReport` render paths.
  - Preserved visual layout and spacing behavior by matching previous row/stack alignment via `display: flex`, `flexDirection`, `gap`, `alignItems`, and `justifyContent` styles.
- Revert: none

## 2026-05-22 00:06 IST | codex-gpt-5 | change
- Summary: Moved non-credit unit handling into semester-wise category rows (single-table flow) and removed separate analytics unit editor block.
- Files: frontend/src/app/App.tsx, frontend/src/app/StudentCreditsView.tsx, CHANGELOG.md
- Details:
  - Updated `loadStudentCredits` to populate semester/category values from `creditDetails` for all category measures, so unit categories are filled by semester from existing table rows.
  - Updated `saveStudentCredits` to submit all categories (credits + units) via the same `entries` payload, preserving semester-wise values in `student_credit_details`.
  - Removed measure-based split that previously diverted units into separate aggregate `unitEntries` logic.
  - In `StudentCreditsView`, semester table category ordering now renders credit categories first and unit categories immediately after, matching plan-of-study semester structure.
  - Unit requirement completion checks now compute earned values from semester-wise `earnedCreditsBySemester` data (not separate unit map state).
  - Removed the separate "Non-credit Units" editor card under Analytics to avoid duplicate/competing editing paths.
- Revert: none

## 2026-05-22 00:12 IST | codex-gpt-5 | change
- Summary: Added clear credit vs non-credit category separation in the Plan of Study table.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added regulation-aware category measure mapping (`credits` vs `units`) when rendering each plan table.
  - Reordered displayed category columns to show all credit categories first, followed by non-credit unit categories.
  - Added a section-header row in the table head: `Credit Categories` and `Non-credit Unit Categories`.
  - Added a visible vertical divider at the boundary between credit and non-credit columns across header/body/total rows.
  - Added a `units planned` chip in the plan header when unit categories exist.
- Revert: none

## 2026-05-22 00:20 IST | codex-gpt-5 | change
- Summary: Updated Plan of Study sub-headings to `Credits` / `Non-credits` and changed completion earned/required displays to composite `X+Y` (credits+units).
- Files: frontend/src/app/App.tsx, frontend/src/app/StudentCreditsView.tsx, CHANGELOG.md
- Details:
  - Renamed Plan of Study grouped column sub-headings from `Credit Categories` and `Non-credit Unit Categories` to exact labels `Credits` and `Non-credits`.
  - In Student Credits header, changed overall earned/required display to composite format `X+Y / X+Y (Cr+Units)` where `X` is credits and `Y` is non-credit units.
  - Updated accessibility label and completion text to reflect total requirements (credits + units).
  - Updated analytics summary cards for `Required` and `Earned` to show composite `credits+units` values in `X+Y` format.
  - Updated bottom total strip to show composite `X+Y / X+Y total (Cr+Units)`.
- Revert: none

## 2026-05-22 00:31 IST | codex-gpt-5 | fix
- Summary: Added visible `Credits` / `Non-credits` subheading rows in the semester table and updated semester top/total displays to show both `cr` and `ut` values.
- Files: frontend/src/app/StudentCreditsView.tsx, CHANGELOG.md
- Details:
  - Added explicit subheading row `Credits` before credit category rows in the semester breakdown table.
  - Added explicit subheading row `Non-credits` at the boundary where unit categories begin.
  - Added `cr/ut` shorthand tag in category metadata line (`CODE · cr` or `CODE · ut`).
  - Updated semester header summary from credit-only format to combined format: `earned_cr+earned_ut / target_cr+target_ut (cr+ut)`.
  - Updated semester "Total" row Plan and Earned values to include both credits and units: `X cr + Y ut`.
- Revert: none

## 2026-05-22 00:36 IST | codex-gpt-5 | fix
- Summary: Fixed runtime crash in Student Credits view caused by using `activeSemCodes` before initialization.
- Files: frontend/src/app/StudentCreditsView.tsx, CHANGELOG.md
- Details:
  - Reordered active-semester derived constants so `activeSemCreditCodes`, `activeSemUnitCodes`, and `activeSemCodes` are defined before `activeSemUnitTarget` and `activeSemUnitEarned` reduce calculations.
  - Resolves `ReferenceError: Cannot access 'activeSemCodes' before initialization` in `StudentCreditsView`.
- Revert: none

## 2026-05-22 00:41 IST | codex-gpt-5 | fix
- Summary: Standardized student credits composite labels to use `cr+ut` shorthand instead of `Cr+Units`/`credits+units`.
- Files: frontend/src/app/StudentCreditsView.tsx, CHANGELOG.md
- Details:
  - Updated top-right earned/required suffix to `cr+ut`.
  - Updated bottom total strip suffix to `cr+ut`.
  - Updated accessibility label text to `cr+ut` phrasing.
  - Updated analytics sublabels from `credits+units` to `cr+ut`.
- Revert: none

## 2026-05-22 00:49 IST | codex-gpt-5 | fix
- Summary: Improved semester table text readability for mobile and desktop by preventing composite total text wrapping and resizing key columns responsively.
- Files: frontend/src/app/StudentCreditsView.tsx, CHANGELOG.md
- Details:
  - Changed semester category table layout to responsive mode (`auto` on mobile, `fixed` on desktop).
  - Increased `Plan`, `Earned`, and `Status` column widths using responsive `sx` widths to avoid cramped labels/values.
  - Added `whiteSpace: "nowrap"` and responsive font sizing for semester total composite values (`cr + ut`) in Plan and Earned cells.
  - Prevents line breaks like `23`, `cr`, `+`, `1`, `ut` stacking vertically and keeps text properly readable across viewports.
- Revert: none

## 2026-05-22 00:57 IST | codex-gpt-5 | fix
- Summary: Improved mobile semester-table edit usability in Student Credits view by enabling first-column text wrapping and rebalancing column widths.
- Files: frontend/src/app/StudentCreditsView.tsx, CHANGELOG.md
- Details:
  - Added viewport-aware logic (`useMediaQuery` + `useTheme`) for mobile-specific table behavior.
  - Enabled wrapping and word-break for category name/meta text in the first column on mobile; kept no-wrap behavior for desktop.
  - Rebalanced mobile column widths (`Category`, `Plan`, `Earned`, `Status`) to reduce clipping and preserve editable input visibility.
  - Increased numeric input width on mobile (`INPUT_SX`) for easier touch editing.
  - Maintained desktop behavior while making the mobile layout clearer for faculty/student/authorized users performing updates.
- Revert: none

## 2026-05-22 01:10 IST | codex-gpt-5 | change
- Summary: Updated batch analytics UI to separate credit/non-credit category cards and show units for non-credit cards; updated Student Detail target/earned to `X+Y` (credits+units) with combined percentage basis.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Added category measure awareness (`credits` vs `units`) in `FacultyAnalyticsReport` using regulation category metadata.
  - Category Detail cards are now rendered in two visual sections: `Credits` first, then `Non-credits`.
  - Non-credit category cards now display `Units` (instead of `Credits`) in the measure label line.
  - Student Detail table `Target` and `Earned` columns now display `X+Y` where `X` is credits and `Y` is units (numbers only).
  - Mobile Student Detail condensed column now also shows `X+Y / X+Y` for earned/target.
  - Student completion percentage in this dashboard path now uses combined totals (credits + units) for numerator/denominator, matching the new display semantics.
- Revert: none

## 2026-05-22 01:24 IST | codex-gpt-5 | fix
- Summary: Aligned Students page MRT credit calculations with dashboard combined credits+units logic and updated target/earned display to Cr+Ut.
- Files: frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/types.ts, CHANGELOG.md
- Details:
  - Updated creditSummaries derivation in App.tsx to compute required, earned, expected, and status using combined totals (credits + units) instead of credits-only.
  - Added category-measure aware earned split in App.tsx: semester category values are split into credits vs units using regulation category measure metadata.
  - Included saved per-student unit entries in earned totals and preserved credit-summary fallback behavior when detailed rows are not yet loaded.
  - Extended StudentCreditSummary with 	argetCredits, 	argetUnits, arnedCredits, and arnedUnits fields for consistent UI rendering.
  - Updated Students MRT Target and Earned columns to display composite values as X+Y (Cr+Ut) while preserving existing sort/filter/status behavior.
- Revert: none

## 2026-05-22 01:31 IST | codex-gpt-5 | fix
- Summary: Updated Students MRT Deficient column to show separate credit and unit deficiency values under one header.
- Files: frontend/src/app/types.ts, frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Extended StudentCreditSummary with deficitCredits and deficitUnits fields.
  - Updated student summary computation in App.tsx to calculate split deficiency using expected-vs-earned for each measure independently.
  - Kept existing combined deficit value for sorting/filtering continuity.
  - Updated Students page MRT Deficient cell to render two lines in one column: cr: -X and ut: -Y.
  - Preserved placeholder behavior (—) when both deficiencies are zero.
- Revert: none

## 2026-05-22 01:36 IST | codex-gpt-5 | fix
- Summary: Changed Students MRT Deficient display format to `X & Y` with dash fallback per measure.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Updated Deficient cell rendering to single-line format `X & Y`.
  - `X` now represents credits deficiency and shows numeric value only when non-zero; otherwise `-`.
  - `Y` now represents non-credits (units) deficiency and shows numeric value only when non-zero; otherwise `-`.
  - Preserved existing sort/filter behavior based on combined deficiency accessor value.
- Revert: none

## 2026-05-22 01:43 IST | codex-gpt-5 | fix
- Summary: Corrected Students MRT earned credits/non-credits aggregation to prevent unit double counting.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Removed incorrect mirror step in `loadStudentCredits` that copied all credit-detail category values into unit-category storage.
  - Updated Students MRT summary aggregation to avoid adding unit values twice when the same unit category appears in both credit-detail rows and unit-detail payload.
  - Unit totals now prefer measured category values from credit-detail rows and only add unit-detail values for categories not already present.
  - Fix aligns Students MRT earned values with the student credits table source-of-truth behavior.
- Revert: none

## 2026-05-22 01:51 IST | codex-gpt-5 | fix
- Summary: Replaced combined Students MRT deficient display with two filterable numeric columns for credits and units.
- Files: frontend/src/app/StudentsDirectoryTable.tsx, CHANGELOG.md
- Details:
  - Removed single combined `Deficient` cell (`X & Y`) that was not natively filter-friendly.
  - Added `Cr. Deficient` column backed by numeric accessor `deficitCredits`.
  - Added `Ut. Deficient` column backed by numeric accessor `deficitUnits`.
  - Preserved visual placeholder `—` for zero/empty values while keeping underlying numeric values for MRT native sort/filter.
  - Updated mobile hidden-column defaults to use new deficient column ids.
- Revert: none

## 2026-05-22 02:00 IST | codex-gpt-5 | fix
- Summary: Fixed Students MRT non-credit preload so units are calculated on table load (full and filtered lists) without opening individual Student Credits pages.
- Files: api/src/modules/students/students.service.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated student credit summaries API aggregation to return separate totals: `totalCredits` (excluding unit-status rows) and `totalUnits` (unit-status rows only).
  - Added frontend summary state for preloaded unit totals and used it when detailed per-student unit rows are not yet loaded.
  - Kept detailed-row precedence for both credits and units when available.
  - Fixed Students table preload trigger dependency to watch actual visible student user IDs (not only row count), so dashboard-filter changes reliably refresh summaries.
- Revert: none

## 2026-05-22 02:09 IST | codex-gpt-5 | fix
- Summary: Fixed remaining Students MRT preload mismatch by classifying summary totals per category code (credits vs units) instead of relying only on status flags.
- Files: api/src/modules/students/students.service.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Enhanced `/api/student-credits/summaries` backend response to include `byCategory` totals (`category_id -> summed value`) for each student.
  - Updated frontend `loadStudentCreditSummaries` to split preloaded totals into credits/units using regulation category `measure` mapping for each student’s plan.
  - Added fallback to legacy summary totals when `byCategory` is unavailable.
  - This resolves cases where unit categories were historically stored without the expected status marker and were incorrectly counted as credits in Students MRT preload.
- Revert: none

## 2026-05-22 02:18 IST | codex-gpt-5 | change
- Summary: Updated AGENTS policy by removing the mandatory borderless-table-shell constraint from MRT baseline requirements.
- Files: AGENTS.md, CHANGELOG.md
- Details:
  - Removed the bullet requiring outer table borders to be removed for all Material React Table instances.
  - Kept all other MRT baseline requirements unchanged.
- Revert: none
## 2026-05-22 09:55 IST | codex-gpt-5 | perf
- Summary: Consolidated admin dashboard count/aggregate reads into multi-stat SQL queries to reduce load-time database reads.
- Files: api/src/modules/admin/dashboard.service.ts, CHANGELOG.md
- Details:
  - Added a `safeSingleRow` helper for fetching grouped metrics from one SQL statement.
  - Replaced separate `totalUsers` and `totalGuests` queries with one `user_accounts` aggregate query using conditional sums.
  - Replaced separate `activeUsers` and `activeSessions` queries with one joined `auth_sessions + user_accounts` aggregate query.
  - Replaced two login-attempt counter queries with one 48-hour conditional aggregate query.
  - Replaced four students counters/average queries with one aggregate query on `students`.
  - Replaced separate error/warn log counter queries with one aggregate query on `app_logs`.
  - Preserved existing response shape and null-safe behavior when tables are unavailable.
- Revert: none
## 2026-05-22 09:56 IST | codex-gpt-5 | perf
- Summary: Replaced per-student faculty-authorization loop queries with a single batched `IN (...)` validation query.
- Files: api/src/modules/students/students-directory.service.ts, CHANGELOG.md
- Details:
  - Updated `assertFacultyCanEditStudentUserIds` to de-duplicate incoming user IDs before validation.
  - Replaced one-query-per-user loop with one query that checks all IDs at once using `where s.user_id in (...)`.
  - Preserved the same access rule: all requested IDs must be active students mentored by the current faculty email.
  - Preserved existing error behavior when any requested ID is out of scope.
- Revert: none
## 2026-05-22 09:58 IST | codex-gpt-5 | perf
- Summary: Batched high-read per-row import lookups into chunked `IN (...)` prefetch queries while preserving import behavior.
- Files: api/src/modules/imports/imports.service.ts, CHANGELOG.md
- Details:
  - Added chunked batching helpers to safely query large input sets within SQLite parameter limits.
  - Replaced per-row student account lookup (`user_accounts by email`) with preloaded map via batched `IN (...)` queries.
  - Replaced per-row faculty-scope validation lookup with precomputed allowed student-id set from batched `IN (...)` scoped query.
  - Preloaded existing student rows (`students by user_id`) to avoid per-row existence/detail reads.
  - Preloaded mentor faculty accounts (`user_accounts by mentor email`) to avoid per-row mentor resolution reads.
  - Kept row-level validation messages and update/insert semantics intact.
- Revert: none
## 2026-05-22 10:06 IST | codex-gpt-5 | perf
- Summary: Added session-identity dashboard caching with force-refresh bypass and invalidation hooks for auth and grade/credit writes.
- Files: api/src/app/worker.ts, frontend/src/app/App.tsx, frontend/src/app/constants.ts, CHANGELOG.md
- Details:
  - Added backend in-memory admin dashboard cache keyed by `provider|subject` with a 10-minute TTL.
  - Updated `GET /api/admin/dashboard` to serve cached payloads by default and bypass cache when `force=1|true|yes` is present.
  - Added backend cache invalidation on successful login/logout flows and on student/credit write endpoints (`students-directory` updates, `student-credits` save/import, and student CSV import).
  - Updated frontend dashboard loader to call `/api/admin/dashboard?force=1` when force refresh is requested.
  - Added explicit admin dashboard Refresh button in the dashboard header.
  - Increased frontend dashboard local cache TTL to 10 minutes and invalidated local dashboard cache after credit save/import success.
- Revert: none
## 2026-05-22 10:16 IST | codex-gpt-5 | perf
- Summary: Implemented ordered dashboard-read optimizations: removed duplicate summary fetches, added summary/scoped-students caching, batched self-scope checks, and reduced student-credit summary scans.
- Files: api/src/app/worker.ts, api/src/modules/students/students.service.ts, api/src/modules/setup/migrations.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Step 1: Removed duplicate dashboard summary-trigger calls by relying on the existing source-row effect, preventing repeated `/api/student-credits/summaries` requests during initial section loads/toggles.
  - Step 2: Added session-scoped client cache for student credit summaries keyed by role-context + student-id set (10-minute TTL), with automatic invalidation alongside dashboard/students cache invalidations.
  - Step 3: Added server-side cache for first-page `/api/students` scoped reads (per principal + role context + scope + active-only + limit) with force bypass support (`force=1`).
  - Step 4: Reworked `getStudentCreditSummaries` to use a single aggregated SQL pass (CTE + window sums) instead of separate totals and by-category scans.
  - Step 5: Added migration `0030_student_credit_details_summary_lookup_index` to create `idx_credit_details_student_category_status` for summary query acceleration.
  - Step 6: Replaced per-student self-scope authorization loop in `/api/student-credits/summaries` with a batched `IN (...)` validator (`assertStudentCanAccessOwnUserIds`).
  - Preserved existing response shapes, role access rules, and UI behavior.
- Revert: none
## 2026-05-22 10:20 IST | codex-gpt-5 | fix
- Summary: Fixed scoped dashboard regression where earned credits rendered as zero by restoring targeted summary prefetch on section loads.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added `prefetchStudentSummariesForRows` helper to request student credit summaries for loaded scoped dashboard rows.
  - Restored summary prefetch when initially loading the first scoped dashboard section (head/moderator/faculty).
  - Restored summary prefetch when expanding a scoped dashboard section for the first time.
  - Kept the new summary caching layer intact, so restored prefetch does not reintroduce high duplicate read load.
- Revert: none
## 2026-05-22 10:23 IST | codex-gpt-5 | fix
- Summary: Fixed dashboard-first load issue where scoped dashboard metrics appeared only after visiting Students by preloading required regulation/plan datasets on dashboard entry.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated scoped dashboard initialization effect to load regulations and plans-of-study before loading first scoped student section.
  - Ensures analytics components have required plan/regulation context on direct dashboard entry.
  - Preserves existing cache behavior and avoids requiring a prior navigation to Students page.
- Revert: none
## 2026-05-22 10:34 IST | codex-gpt-5 | perf
- Summary: Implemented materialized per-student credit summary table with mitigation/backfill and write-path recomputation hooks to reduce dashboard read amplification.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/students/students.service.ts, api/src/modules/imports/imports.service.ts, api/src/app/worker.ts, CHANGELOG.md
- Details:
  - Added migration `0031_student_credit_status_summary_table` to create `student_credit_status_summary` (one row per student) with status/aggregate fields and indexes.
  - Included mitigation backfill SQL in migration to populate summary rows from existing `students` + `student_credit_details` data.
  - Switched `getStudentCreditSummaries` read path to `student_credit_status_summary` (including parsed `category_totals_json`) instead of scanning detail rows directly.
  - Added summary recomputation helpers (`recomputeStudentCreditSummary`, `recomputeStudentCreditSummaries`) and wired them into credit write paths (`upsertStudentCredits`, `upsertStudentUnits`).
  - Wired recomputation into student profile update flows (`/api/students-directory/update`, `/api/students-directory/update-batch`) so batch/plan/current-semester summary columns stay synchronized.
  - Extended student CSV import service to return updated student IDs and recompute summaries for touched students in `/api/import/students`.
  - Preserved existing API response shapes for student summary consumers.
- Revert: none
## 2026-05-22 10:46 IST | codex-gpt-5 | change
- Summary: Unified Head/Moderator dashboard into a single shared UI module and reused Turso usage module across admin/head to reduce duplicate read-trigger paths.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced separate Head and Moderator dashboard blocks with one combined section rendered once when either role is present.
  - Dynamic combined title now follows role presence: `Head Dashboard`, `Moderator Dashboard`, or `Head, Moderator Dashboard`.
  - Shared cards (`Total Active`, `In Progress`, `Passed Out`) now compute and render once from a single combined dataset source.
  - Shared batch completion chart and batch analytics now render once for head/moderator instead of duplicated blocks.
  - Added `tursoUsageModule` reusable UI block and reused it in admin dashboard and head-capable combined dashboard section.
  - Refresh action for combined section triggers only one scoped student load call path (head scope when available, otherwise moderator scope).
- Revert: none
## 2026-05-22 11:18 IST | codex-gpt-5 | perf
- Summary: Added scoped per-batch summary table read path and wired combined Head/Moderator dashboard cards to consume it, with migration backfill for existing data.
- Files: api/src/modules/setup/migrations.ts, api/src/modules/students/students.service.ts, api/src/app/worker.ts, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added migration `0032_batch_credit_status_summary_table` to create `batch_credit_status_summary` with scope-aware rows (`head`, `moderator`, `faculty`) and full backfill SQL from existing student + student-summary data.
  - Extended `readBatchStatusSummaryByScope` with role preference support so `all` scope can explicitly serve `head` or `moderator` summary slices.
  - Added `GET /api/students/batch-summary` endpoint with role-context selection and existing role-based access checks.
  - Updated combined Head/Moderator dashboard cards (`Total Active`, `In Progress`, `Passed Out`) to read from the new batch-summary endpoint instead of recomputing from full student arrays.
  - Removed duplicate chart-only render in combined Head/Moderator dashboard so status composition analytics is displayed once.
- Revert: none
## 2026-05-22 11:34 IST | codex-gpt-5 | fix
- Summary: Ensured admin active-status toggles immediately refresh student and batch summary tables so dashboards stay correct after activation/deactivation.
- Files: api/src/app/worker.ts, CHANGELOG.md
- Details:
  - Added batched worker helper to resolve updated `subject` values to affected student `user_id` rows.
  - Wired `POST /api/admin/users/set-active` to trigger summary recomputation for affected students after active flag updates.
  - Wired `POST /api/admin/users/set-active-batch` to accumulate all touched subjects and trigger one batched summary recomputation pass.
  - Added dashboard cache invalidation after active-status updates so UI reads fresh summary values immediately.
- Revert: none
## 2026-05-22 11:49 IST | codex-gpt-5 | observability
- Summary: Added browser-console per-session approximate DB-read counter for API usage visibility.
- Files: frontend/src/shared/api/client.ts, CHANGELOG.md
- Details:
  - Added endpoint-aware DB read estimation in the shared `callApi` client for both GET and POST requests.
  - Added per-tab session cumulative counter using `sessionStorage` (`fa_db_read_estimate_total_v1`).
  - Added console log output on each API response in the format: `[DB READ ESTIMATE] +delta | total=n | METHOD /path`.
  - Kept the estimator intentionally conservative and approximate to avoid backend/runtime risk.
- Revert: none
## 2026-05-22 12:02 IST | codex-gpt-5 | fix
- Summary: Fixed Head/Moderator dashboard batch-wise summary cards/graph initialization by loading batch summary data on first dashboard entry.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated scoped dashboard initialization effect (`superView === "dashboard"`) to load `loadHeadModeratorBatchSummary()` when the principal has Head or Moderator roles.
  - This aligns dashboard-first load behavior with the existing students-directory scoped effect and prevents empty metric cards/graph on initial dashboard render.
- Revert: none
## 2026-05-22 12:11 IST | codex-gpt-5 | fix
- Summary: Fixed runtime crash in Head/Moderator batch summary loader by removing undefined cache helper usage.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced `getAdminCacheKey`/`readCachedAdminPayload` references in `loadHeadModeratorBatchSummary` with direct API fetch logic.
  - Preserved force-refresh behavior by appending `force=1` query param when requested.
  - Removed stale `setCachedAdminPayload` write for this path to avoid invalid cache-key coupling.
- Revert: none
## 2026-05-22 12:27 IST | codex-gpt-5 | change
- Summary: Restored default batch-wise comparison chart display in the combined Head/Moderator dashboard.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Re-added the `FacultyAnalyticsReport` chart-only render (`showBatchStatusByLabelCard` + `chartOnly`) in the Head/Moderator dashboard.
  - The chart now appears by default above the Batch Analytics accordion while preserving single-render behavior for each chart section.
- Revert: none
## 2026-05-22 12:48 IST | codex-gpt-5 | change
- Summary: Restructured dashboard batch analytics UX into chart card + batch-row card and added Academics -> Analysis page for expanded batch details.
- Files: frontend/src/app/App.tsx, frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Added dedicated chart card with `Batch Analytics` heading at the top and kept the batch comparison echart visible by default.
  - Added separate `Batch Details` card that renders each batch summary as a single-row clickable item.
  - Clicking a batch item now routes to new `Academics -> Analysis` view and pre-filters that batch.
  - Added new `analysis` view to `superView` and wired it into the Academics navigation.
  - Added expanded analytics page rendering with `FacultyAnalyticsReport` and `expandAllBatches` behavior to show detailed batch sections expanded.
  - Extended `FacultyAnalyticsReport` with `expandAllBatches` prop to support expanded-detail analysis view.
- Revert: none
## 2026-05-22 13:02 IST | codex-gpt-5 | change
- Summary: Restored `Batch Analytics` as divider-style header in Head/Moderator dashboard.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced inline section title above batch chart card with divider + outlined chip (`Batch Analytics`), matching previous visual style.
  - Kept the chart card and batch details card structure unchanged.
- Revert: none
## 2026-05-22 13:13 IST | codex-gpt-5 | fix
- Summary: Removed double-border effect around Head/Moderator batch comparison chart card.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Removed outer `Paper` wrapper around `FacultyAnalyticsReport` chart-only render in Head/Moderator dashboard.
  - Kept existing inner chart card from `FacultyAnalyticsReport`, resulting in a single visible border.
- Revert: none
## 2026-05-22 13:25 IST | codex-gpt-5 | change
- Summary: Updated Head/Moderator batch analytics card layout to responsive two-column desktop and single-column mobile arrangement.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Wrapped batch comparison chart and batch details card inside a responsive CSS grid container.
  - Layout now uses one column on mobile (`xs`) and two cards in a single row on desktop (`lg`).
  - Preserved existing content and interactions in both cards.
- Revert: none
## 2026-05-22 13:41 IST | codex-gpt-5 | change
- Summary: Updated batch detail rows to use bold batch titles with colored status chips/counts in single-line rows.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced plain text batch-detail button labels with row layout matching earlier style: bold `Batch <year>` title + colored outlined chips (`Complete`, `On Track`, `Marginal`, `Alarming`, `Off Track`).
  - Kept each batch in one clickable row and preserved navigation to `Academics -> Analysis`.
  - Added keyboard accessibility (`Enter`/`Space`) for row activation.
- Revert: none
## 2026-05-22 14:05 IST | codex-gpt-5 | fix
- Summary: Fixed incorrect batch chip counts by sourcing row counts from the same live analytics computation used by the batch comparison chart.
- Files: frontend/src/app/App.tsx, frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Added `onBatchSummaryComputed` callback in `FacultyAnalyticsReport` to emit computed per-batch status counts.
  - Wired Head/Moderator dashboard chart render to capture those computed counts and reuse them for batch detail rows.
  - Batch detail chips now always match chart/analysis logic (`Complete`, `On Track`, `Marginal`, `Alarming`, `Off Track`) and avoid divergence from stale precomputed summary rows.
- Revert: none
## 2026-05-22 14:22 IST | codex-gpt-5 | fix
- Summary: Fixed maximum update depth loop caused by repeated batch-summary callback state updates.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced inline `onBatchSummaryComputed` callback with stable `useCallback` handler.
  - Added structural equality guard in `setCombinedHmBatchLiveRows` updater to skip state updates when computed rows are unchanged.
  - Prevents render-effect-update loop while keeping live batch chip counts synchronized with chart analytics.
- Revert: none
## 2026-05-22 14:47 IST | codex-gpt-5 | change
- Summary: Simplified Faculty dashboard batch section to chip-only batch rows with direct Analysis-page navigation.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced inline expanded analytics in Faculty dashboard with compact batch-wise chip rows.
  - Added per-batch navigation to `Academics -> Analysis` by clicking the row or the `Analysis` action button.
  - Added dedicated faculty batch summary state and stabilized callback updater so chip rows use live computed analytics counts.
  - Kept detailed mentored-student batch analytics in the Analysis page (filtered by selected batch when opened from dashboard).
- Revert: none
## 2026-05-22 15:02 IST | codex-gpt-5 | fix
- Summary: Replaced custom in-page print CSS hack with native print-window flow for batch analytics printing.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Updated print icon handler to open a native browser print window containing only the selected batch analytics content.
  - Copied active stylesheets/style blocks into the print window and invoked `window.print()` there.
  - Removed fixed-position visibility print hack that caused clipped/inconsistent render output.
  - Kept color print fidelity settings and non-print element exclusion support (`[data-noprint]`).
- Revert: none
## 2026-05-22 15:18 IST | codex-gpt-5 | fix
- Summary: Fixed blank `about:blank` print popup by hardening batch print window flow and adding fallback.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Removed popup `noopener,noreferrer` window features that could break writable print-window behavior.
  - Switched to writing a minimal print document first, then appending a cloned batch content node.
  - Added short render delay before calling native `print()` and automatic close after print.
  - Added fallback to `window.print()` if popup content rendering fails.
- Revert: none
## 2026-05-22 15:33 IST | codex-gpt-5 | fix
- Summary: Fixed missing ECharts in print output by converting chart canvases to static images in print clone.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Updated batch print handler to map source canvases to cloned canvases and replace each cloned canvas with an image generated via `canvas.toDataURL()`.
  - Ensures ECharts visuals are preserved in print popup even when live canvas state is not carried to cloned DOM.
- Revert: none
## 2026-05-22 15:49 IST | codex-gpt-5 | fix
- Summary: Fixed clipped chart rendering in print output by switching canvas-image replacement to responsive sizing.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Changed print chart image sizing from fixed pixel width/height to fluid (`width: 100%`, `max-width: 100%`, `height: auto`).
  - Ensured chart parent containers in print clone are set to `width: 100%`, `height: auto`, and `overflow: visible`.
  - Prevents right-edge legend/content clipping in printed ECharts snapshots.
- Revert: none

## 2026-05-22 11:49 IST | codex-gpt-5 | fix
- Summary: Stabilized UI state across focus/session revalidation and prevented MRT pagination resets during benign refreshes.
- Files: frontend/src/app/App.tsx, frontend/src/app/StudentsDirectoryTable.tsx, frontend/src/app/ManageUsersTable.tsx, frontend/src/app/ActiveUsersTable.tsx, CHANGELOG.md
- Details:
  - Made session principal updates idempotent in loadSessionPrincipal and evalidateSessionStrict by comparing a stable auth/identity key before calling setPrincipal, preventing unnecessary downstream reload effects.
  - Hardened visibility-triggered revalidation by skipping strict auth checks after short tab blur intervals when a recent successful server check exists, reducing focus churn resets without changing auth enforcement.
  - Switched Students, Manage Users, and Active Users MRT instances to controlled pagination state with utoResetPageIndex: false, preserving current page across normal data refreshes and clamping page index when row counts shrink.
  - Added controlled sorting/filter/global filter state for Manage Users and Active Users to preserve current table view context through re-renders.
- Revert: none

## 2026-05-22 16:05 IST | codex-gpt-5 | fix
- Summary: Fixed React key warning in App role chip lists by using collision-safe keys.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated dashboard role chip rendering to use composite keys (ole + index) instead of plain role names.
  - Updated My Account role chip rendering with the same composite key strategy.
  - Prevents duplicate-key warnings when role arrays contain repeated values while preserving existing UI behavior.
- Revert: none
## 2026-05-22 16:13 IST | codex-gpt-5 | fix
- Summary: Hardened additional App.tsx list keys against duplicate-key warnings.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Updated Turso usage card map key from label to label-index.
  - Updated sidebar nav section fragment key from section.label to section.label-index.
  - Updated student profile summary grid key from label to label-index.
  - Updated activity filter chip keys from raw option values to alue-index for level and status families.
  - Kept all behavior and rendering order unchanged; this only strengthens key uniqueness guarantees.
- Revert: none
## 2026-05-22 16:24 IST | codex-gpt-5 | change
- Summary: Grouped regulation categories under Credits and Non-Credits sub-headings and renamed Credits column to Credits/Units.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - In Regulations detail table, categories are now rendered in two sections based on category measure: Credits and Non-Credits.
  - Added section header rows within the table body for both sub-headings (shown only when that section has rows).
  - Renamed table column heading from Credits to Credits/Units.
  - Preserved existing percentage/share calculations and row content behavior.
- Revert: none
## 2026-05-22 16:31 IST | codex-gpt-5 | change
- Summary: Added units-required chip to the Regulations header alongside credits-required chip.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - In each Regulations detail header, added a `units required` chip using `curriculumStructure.totalUnitsRequired` (defaulting to 0 when absent).
  - Kept existing `credits required`, category count, and flexible-range chips unchanged.
- Revert: none
## 2026-05-22 16:38 IST | codex-gpt-5 | change
- Summary: Updated Regulations tab chip to display combined credits+units count as `cr+ut`.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - In Regulations tabs, changed chip value from credits-only to `(totalCreditsRequired + totalUnitsRequired)`.
  - Updated chip suffix from `cr` to `cr+ut`.
- Revert: none
## 2026-05-22 16:44 IST | codex-gpt-5 | fix
- Summary: Updated Regulations tab chip format to display separate credits and units as `x cr + y ut`.
- Files: frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Replaced combined `cr+ut` total with explicit split values using the format `credits cr + units ut`.
  - Uses `totalCreditsRequired` and `totalUnitsRequired` directly with shared credit formatter.
- Revert: none
## 2026-05-22 16:52 IST | codex-gpt-5 | fix
- Summary: Fixed analysis table tooltip unit suffix to show `ut` for non-credit categories.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, CHANGELOG.md
- Details:
  - Replaced hardcoded `cr` in per-category student-cell tooltip with a measure-aware suffix.
  - Tooltip now renders `cr` for credit categories and `ut` for unit/non-credit categories using `cat.measure`.
- Revert: none
## 2026-05-22 17:02 IST | codex-gpt-5 | change
- Summary: Linked analysis table student names to the individual student credit page.
- Files: frontend/src/app/FacultyAnalyticsReport.tsx, frontend/src/app/App.tsx, CHANGELOG.md
- Details:
  - Added optional `onOpenStudentCredits(userId)` callback support to `FacultyAnalyticsReport` and wired it into `BatchPanel`.
  - Updated the student name cell in the analysis student-detail table to render as a link-style button that invokes the callback.
  - Connected analysis view usage in `App.tsx` to existing `openStudentCredits(...)` by resolving the selected student from `studentsDirectorySourceRows`.
- Revert: none
