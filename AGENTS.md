# AGENT.md

## Mandatory Product Rules (Compulsory)

1. Super admin access is mandatory and must never regress.
- A logged-in user with `is_superuser = 1` and `active = 1` MUST always see super-admin-only navigation (Dashboard, System, mitigation controls).
- Super-admin-only operations MUST remain blocked for non-super-admin users.

2. Mitigation execution access.
- Only super admin may run mitigations (`/api/setup/run-mitigations`).
- Super admin access checks must be deterministic and robust across local/OAuth/SSO subject formats.

3. Single account per person by email.
- Canonical identity is one `user_accounts.id` (UUID) per person.
- Same normalized email across local/OAuth/SSO MUST map to the same account row.
- No duplicate account creation for the same normalized email.

4. Identity linking behavior.
- Login resolution order MUST be:
  1. `(provider, subject)` exact match
  2. fallback to normalized `email`
  3. if email match found, bind/update provider identity on that same row
- Single-account-by-email guarantee applies when normalized email is available from the provider or existing account data.
- If provider gives no email and no prior provider-subject mapping exists, do not auto-link by weak heuristics.

5. No backward compatibility requirement.
- Development mode assumes schema may be reset or replaced.
- Prefer correctness/simplicity over migration complexity.
- Production mode: any change that may break backward compatibility MUST be explicitly proposed and approved before implementation.

6. Dashboard/My Account routing is mandatory.
- There MUST be a single shared dashboard route/view for all authenticated users.
- The dashboard route must render role-based sections; if a user has multiple roles, all matching sections must be shown.
- `My Account` MUST remain a dedicated separate route/view for personal profile/password actions.
- Dashboard metric cards MUST be hidden when their value is zero. Do not render a card if its underlying count/metric is 0. The grid column count must adjust dynamically to match the number of visible cards.

7. Table UX and Material React Table baseline are mandatory.
- Any table/grid UI MUST use native table-level search/filter controls by default (for Material React Table: built-in global search and column filters enabled).
- Do not add duplicate external search/filter bars for the same table unless explicitly required.
- Applies to all `MaterialReactTable` instances unless explicitly excluded in this file.
- Required MRT defaults:
  - Row-select checkbox column enabled (native MRT `enableRowSelection`).
  - Row number `#` column enabled (native MRT `enableRowNumbers`, static numbering).
  - Export CSV action in top toolbar.
  - Export PDF action in top toolbar.
  - Export behavior: if any rows are selected, export selected rows only; otherwise export all current table rows.
  - Rows-per-page selector must include an `All` option.
  - Outer table border should be removed (borderless table shell).
  - Any MRT column that represents date/time values MUST use the same filtering pattern as Manage Users `Last Login`: date value accessor, `filterVariant: "date"`, `filterFn: "greaterThan"`, and `enableGlobalFilter: false`.
  - Any MRT column titled `Full Name` MUST use the same filter behavior as Manage Users `Full Name` (column filter modes enabled and text-style filtering).
  - Any MRT column titled `User`, `Username`, or `Email` MUST follow the same filter mode/type behavior as Manage Users `Full Name` (text-style filter with column filter modes enabled).
  - Default filter-mode policy: enable filter modes by default only for textbox-style columns (`Full Name`, `User`, `Username`, `Email`). For all non-textbox columns, filter modes MUST be explicitly opted-in per MRT/column; otherwise keep `enableColumnFilterModes: false` on those columns.
  - Fixed-value categorical columns policy:
    - If a column has fixed predefined values with more than two unique values, use the same select-style pattern as Manage Users `Roles` (`filterVariant: "multi-select"` with explicit `filterSelectOptions`).
    - If a fixed-value column is binary, use the same pattern as Manage Users `Status` (`filterVariant: "checkbox"` with boolean-style accessor values).
- Exceptions are allowed only for explicitly approved tables, and each exception must be documented in this file before divergence is implemented.

8. Changelog logging is mandatory for every change.
- `CHANGELOG.md` at repo root is compulsory and is the system of record for repository changes.
- Any AI agent or human contributor making file changes MUST append one new changelog entry before task completion.
- Reverts and partial rollbacks MUST be logged explicitly, including what was reverted and why.
- If a task makes no file changes, no changelog entry is required.
- Pull requests/tasks are non-compliant if file changes are made without a matching changelog entry.

### MRT Baseline Exceptions
- None currently approved.

## Data Model Rules

1. `user_accounts` is the canonical identity table.
- Required unique identifiers:
  - `id` (UUID primary key)
  - `email` unique (nullable only where explicitly required)
  - `(provider, subject)` unique where provider-subject is available

2. Avoid extra identity-mapping tables unless absolutely needed.
- Current preferred model is single-table identity for lower read/write amplification.

## Turso Free Plan Optimization Rules

1. Minimize write amplification.
- Throttle heartbeat-like updates (`last_seen_at`, `last_login_at`) to coarse intervals (already 30m target).
- Avoid redundant updates when values have not changed.
- Avoid per-request account sync writes in hot paths.

2. Minimize read amplification.
- Use direct indexed lookups in this order:
  - `(provider, subject)`
  - `email`
- Avoid extra joins for identity resolution where a single-table lookup is possible.

3. Keep queries index-friendly.
- Ensure indexes exist and are used for:
  - `email`
  - `(provider, subject)`
  - session token hash
  - active session scans by `user_account_id`

4. Bound list/log endpoints.
- Enforce limits (`<=100`) and cursor pagination.
- Never perform full-table scans for UI listing endpoints.

5. Avoid expensive schema churn in runtime paths.
- Schema checks should be cached (TTL cache pattern) and never repeated per request unnecessarily.

6. Keep auth flows deterministic.
- No ambiguous account selection when multiple candidates exist.
- Fail closed on conflicting identity bindings.

7. Role-wide read caching policy (session-scoped) is mandatory.
- Applies to all authenticated roles and all read-heavy dashboard/list/log views.
- UI reads MUST use short-interval TTL cache/memoization to reduce repeated DB queries during navigation.
- Cache entries MUST be bound to session identity (`provider + subject`) and MUST be invalidated on:
  - login/logout,
  - session expiry,
  - tab/session takeover,
  - principal/account identity change.
- Force-refresh actions (explicit user refresh click) MUST bypass cache and fetch fresh data.
- Any successful write/mutation affecting a dataset MUST invalidate related read caches before next read.
- Cursor-based pagination may cache only first-page snapshots by default; subsequent cursor pages should fetch live unless explicitly designed otherwise.

## Frontend Navigation System Rules

Navigation in `frontend/src/app/App.tsx` uses a data-driven modular system. All agents MUST follow this pattern when adding or modifying navigation.

### Types (defined near top of App.tsx)

```typescript
type NavLeaf = { id: string; label: string; icon: JSX.Element; active: boolean; disabled?: boolean; onClick: () => void };
type NavGroup = { id: string; label: string; icon: JSX.Element; children: NavLeaf[] };
type NavItem = NavLeaf | NavGroup;
type NavSection = { label: string; items: NavItem[] };
```

### Single source of truth: `navSections`

All navigation is declared in one `const navSections: NavSection[]` inside the `App` component. Role-gating uses spread conditions:

```typescript
const navSections: NavSection[] = [
  ...(isAdmin ? [{ label: "Overview", items: [/* leaves */] }] : []),
  ...(isSuperAdmin ? [{ label: "Administration", items: [/* groups/leaves */] }] : []),
  { label: "Monitoring", items: [/* groups/leaves */] },
  { label: "Users", items: [/* groups/leaves */] },
];
```

### Renderers (do not duplicate logic)

- **`renderSidebarNav()`** — renders `navSections` into the MUI `List` used by both permanent and temporary `Drawer`. Groups auto-expand when a child `active` is true. Chevron reflects open/active state.
- **`topBarNav`** — renders `navSections` into the AppBar `Stack` of `Button`+`Menu` pairs. Active state and chevron rotation derive from the same `active` flags.

Both drawers use `{renderSidebarNav()}`. The AppBar uses `{principal && isAdmin ? topBarNav : null}`.

### State for open/close and anchors

- `openGroups: Record<string, boolean>` — sidebar group expand state, keyed by `NavGroup.id`.
- `menuAnchors: Record<string, HTMLElement | null>` — top bar dropdown anchor elements, keyed by `NavGroup.id`.
- Both MUST be reset to `{}` on logout, session expiry, tab takeover, and any auth state clear.

### Font sizes (canonical — apply everywhere, no exceptions)

| Level | Size | Where applied |
|---|---|---|
| Main nav items | `0.875rem` | Top bar `Button` sx + sidebar List sx `& .MuiListItemText-primary` |
| Sub-menu items | `0.8rem` | Top bar `MenuItem` sx + sidebar child `ListItemText` slotProps |
| Section labels | `0.6rem` | Sidebar `Typography variant="overline"` sx |

Never use MUI implicit defaults for nav font sizes — always set them explicitly so both navs stay in sync.

### Rules

1. **Never add hardcoded nav JSX.** All new menu items go into `navSections` only.
2. **Never add new per-item state vars** (`someMenuOpen`, `someAnchorEl`). Use `openGroups`/`menuAnchors` with the item's `id` as key.
3. **Role-gate at the section or item level** using spread conditions in `navSections`, not inside renderers.
4. **`active` flags** must be derived from `superView` or equivalent view state — never from menu open state.
5. **Adding a new role's nav** = add a new `NavSection` entry in `navSections` with the appropriate role guard. The sidebar and top bar renderers pick it up automatically.
6. After any nav change, run `npx tsc --noEmit` in `frontend/` and confirm zero errors.

## Single Source of Truth and Modularization Rule (Compulsory)

1. **Single Source of Truth is mandatory for designated domains.**
- Keep canonical, shared definitions centralized where this file explicitly requires it (for example: navigation in `frontend/src/app/App.tsx` via `navSections`, canonical identity semantics in `user_accounts`).
- Do not duplicate or fork authoritative config/state definitions across multiple files.

2. **Modular code organization is required outside designated single-source domains.**
- Feature logic, UI pieces, API services, helpers, and validation SHOULD be split into focused modules/files rather than one large file.
- Keep module boundaries intentional: one responsibility per module where practical, with clear imports/exports.

3. **Conflict resolution rule.**
- If modularization conflicts with a mandated single-source section in this file, preserve the mandated single-source pattern and modularize around it (helpers/hooks/components/services may be extracted, while canonical declarations remain centralized).

## Operational Guardrails

1. Any change touching auth/account/session logic must preserve:
- super-admin visibility and permissions,
- single-account-per-email behavior,
- mitigation-run access for super admin only.

2. Any change that increases read/write count must include explicit justification.

3. On incidents where super admin is not recognized:
- verify `/api/auth/me` payload,
- verify exact row in `user_accounts` (`provider`, `subject`, `email`, `is_superuser`, `active`),
- verify provider-subject binding consistency.

## Acceptance Checklist (must pass)

- Super admin login returns `isSuperuser: true`.
- Super admin sees Dashboard + System + mitigation controls.
- Non-super-admin cannot run mitigations.
- Same email across local/OAuth/SSO resolves to one `user_accounts.id`.
- API type-check/build passes.
- `CHANGELOG.md` includes an entry for the completed change set (including any reverts).

## Changelog Workflow (Compulsory)

1. After making file edits, append exactly one new entry to `CHANGELOG.md`.
2. Use the mandatory entry template defined in `CHANGELOG.md` (timestamp, author/agent, type, summary, files, details, revert status).
3. The `Files` field MUST list every modified file path for that task.
4. If any previous change was reverted (full or partial), set `type` to `revert` or include revert details in `Revert`.
5. Do not close a task until changelog update is completed.

## Turso Verification SQL

Use these SQL checks after migrations or auth refactors.

1. Confirm canonical columns exist (`subject` expected):
```sql
pragma table_info(user_accounts);
```

2. Confirm critical indexes:
```sql
pragma index_list(user_accounts);
pragma index_list(auth_sessions);
pragma index_list(auth_credentials);
```

3. Confirm super-admin rows:
```sql
select id, provider, subject, email, is_admin, is_superuser, active
from user_accounts
where is_superuser = 1
order by created_at desc;
```

4. Confirm no duplicate emails:
```sql
select lower(email) as email_key, count(*) as c
from user_accounts
where email is not null and trim(email) <> ''
group by lower(email)
having c > 1;
```

5. Confirm no duplicate provider-subject pairs (when column exists):
```sql
select provider, subject, count(*) as c
from user_accounts
where subject is not null and trim(subject) <> ''
group by provider, subject
having c > 1;
```

6. Confirm active session count distribution:
```sql
select user_account_id, count(*) as active_sessions
from auth_sessions
where revoked_at is null
  and datetime(expires_at) > datetime('now')
group by user_account_id
order by active_sessions desc;
```

7. Quick identity lookup sanity (replace placeholders):
```sql
select id, provider, subject, email, is_superuser, active
from user_accounts
where lower(email) = lower('<email>')
   or (provider = '<provider>' and subject = '<subject>');
```
