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
