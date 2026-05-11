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
