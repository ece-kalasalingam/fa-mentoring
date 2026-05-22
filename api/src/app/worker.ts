import { isObject } from "../core/csv";
import { getDb } from "../core/db";
import { json } from "../core/http";
import { sanitizeResponsePayload } from "../core/sanitize";
import type { CsvImportRow, Env } from "../core/types";
import { getAdminDashboard } from "../modules/admin/dashboard.service";
import { readActiveUsers } from "../modules/admin/active-users.service";
import { readLoginAttempts } from "../modules/admin/login-attempts.service";
import { readUsers } from "../modules/admin/users-list.service";
import { revokeAllSessionsForUser } from "../modules/admin/session-admin.service";
import { createIdentityProvider } from "../modules/auth/identity";
import { parseBearerToken } from "../modules/auth/identity";
import { canPerformAction, resolveStudentScope } from "../modules/auth/authorization.service";
import { buildClearSessionCookie, buildSessionCookie, getAuthCookieName, getSameSite, getSessionHours, shouldUseSecureCookie } from "../modules/auth/cookie-config";
import { buildCsrfCookie, issueCsrfToken, validateCsrf } from "../modules/auth/csrf.service";
import { getAccessPolicy, isAuthorized } from "../modules/auth/policy";
import { loginWithGoogleIdToken } from "../modules/auth/google-auth.service";
import {
  changeOwnPassword,
  adminResetLocalUserPassword,
  createLocalUserByAdmin,
  createLocalSuperAdmin,
  loginWithPassword,
  countOtherSessionsForPrincipal,
  listActiveSessionsForPrincipal,
  revokeOtherSessionsForPrincipal,
  revokeSessionToken,
  setLocalPasswordForPrincipal
} from "../modules/auth/password-auth.service";
import { getAccountProfileByPrincipal, getPrincipalAccountFlags, resolveUserAccountIdByPrincipal, setUserActiveByAdmin, updateOwnFullName, updateUserByAdmin } from "../modules/auth/user-accounts.service";
import { importStudents } from "../modules/imports/imports.service";
import { clearAllLogs, readRecentLogs, writeLog } from "../modules/logging/logger.service";
import { fetchPlansOfStudyFromJson } from "../modules/plan-of-study/plan-of-study.service";
import { validatePlansOfStudyAgainstRegulations } from "../modules/plan-of-study/plan-of-study-validation.service";
import { fetchProgrammesFromJson } from "../modules/programmes/programmes.service";
import { fetchRegulationsFromJson } from "../modules/regulations/regulations.service";
import { getSetupStatus, setupSchema } from "../modules/setup/setup.service";
import { checkConnections, getSetupState, getWizardState, hasSuperAdmin, markSetupComplete, resetSetupState, runMigrations, runRecentMitigations, seedInitialData } from "../modules/setup/wizard.service";
import { assertStudentCanAccessOwnUserId, assertStudentCanAccessOwnUserIds, bulkImportStudentCredits, getStudentCreditSummaries, getStudentCredits, getStudentStatsByScope, getStudentUnits, listStudentCreditTableByScope, listStudentsByScope, readBatchStatusSummaryByScope, recomputeStudentCreditSummary, recomputeStudentCreditSummaries, upsertStudentCredits, upsertStudentUnits } from "../modules/students/students.service";
import { assertFacultyCanAccessStudentUserIds, assertFacultyCanEditStudentUserIds, listStudentsDirectory, upsertStudentDirectoryRow } from "../modules/students/students-directory.service";

const ROOT_ENDPOINTS = [
  "/api/health",
  "/api/setup-status",
  "/api/admin/dashboard",
  "/api/admin/active-users",
  "/api/admin/login-attempts",
  "/api/admin/users",
  "/api/admin/users/update",
  "/api/admin/users/reset-password",
  "/api/admin/users/set-active",
  "/api/admin/users/set-active-batch",
  "/api/admin/users/logout-all-sessions",
  "/api/startup-warnings",
  "/api/setup/wizard-status",
  "/api/setup/check-connections",
  "/api/setup/run-migrations",
  "/api/setup/run-mitigations",
  "/api/setup/seed-data",
  "/api/setup/create-super-admin",
  "/api/setup/reset-state",
  "/api/logs",
  "/api/logs/clear",
  "/api/auth/login",
  "/api/auth/google",
  "/api/auth/logout",
  "/api/auth/logout-other-sessions",
  "/api/auth/other-sessions-count",
  "/api/auth/sessions",
  "/api/auth/set-password",
  "/api/auth/change-password",
  "/api/auth/me",
  "/api/auth/my-account",
  "/api/setup",
  "/api/migrate",
  "/api/regulations",
  "/api/plans-of-study",
  "/api/programmes",
  "/api/students",
  "/api/students-directory",
  "/api/students-directory/update",
  "/api/students-directory/update-batch",
  "/api/students/stats",
  "/api/students/batch-summary",
  "/api/student-credit-table",
  "/api/import/students"
];

const ADMIN_DASHBOARD_CACHE_TTL_MS = 10 * 60 * 1000;
const SCOPED_STUDENTS_CACHE_TTL_MS = 10 * 60 * 1000;
const STUDENT_CREDIT_DETAILS_CACHE_TTL_MS = 2 * 60 * 1000;
type AdminDashboardPayload = Awaited<ReturnType<typeof getAdminDashboard>>;
const adminDashboardCacheByPrincipal = new Map<string, { cachedAt: number; payload: AdminDashboardPayload }>();
type ScopedStudentsPayload = Awaited<ReturnType<typeof listStudentsByScope>>;
const scopedStudentsCacheByPrincipal = new Map<string, { cachedAt: number; payload: ScopedStudentsPayload }>();
type StudentCreditDetailsPayload = {
  creditDetails: Awaited<ReturnType<typeof getStudentCredits>>;
  unitDetails: Awaited<ReturnType<typeof getStudentUnits>>;
};
const studentCreditDetailsCacheByPrincipal = new Map<string, { cachedAt: number; payload: StudentCreditDetailsPayload }>();

function getAdminDashboardCacheKey(principal: { provider: string; subject: string } | null | undefined): string | null {
  if (!principal) return null;
  const provider = String(principal.provider ?? "").trim();
  const subject = String(principal.subject ?? "").trim();
  if (!provider || !subject) return null;
  return `${provider}|${subject}`;
}

function readAdminDashboardCache(cacheKey: string): AdminDashboardPayload | null {
  const entry = adminDashboardCacheByPrincipal.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > ADMIN_DASHBOARD_CACHE_TTL_MS) {
    adminDashboardCacheByPrincipal.delete(cacheKey);
    return null;
  }
  return entry.payload;
}

function writeAdminDashboardCache(cacheKey: string, payload: AdminDashboardPayload): void {
  adminDashboardCacheByPrincipal.set(cacheKey, { cachedAt: Date.now(), payload });
}

function invalidateAdminDashboardCacheForPrincipal(principal: { provider: string; subject: string } | null | undefined): void {
  const cacheKey = getAdminDashboardCacheKey(principal);
  if (!cacheKey) return;
  adminDashboardCacheByPrincipal.delete(cacheKey);
  for (const key of scopedStudentsCacheByPrincipal.keys()) {
    if (key.startsWith(`${cacheKey}|`)) {
      scopedStudentsCacheByPrincipal.delete(key);
    }
  }
}

function invalidateAllAdminDashboardCaches(): void {
  adminDashboardCacheByPrincipal.clear();
  scopedStudentsCacheByPrincipal.clear();
}

function getScopedStudentsCacheKey(
  principal: { provider: string; subject: string } | null | undefined,
  roleContext: string,
  scopeKey: string,
  activeOnly: boolean,
  limit: string
): string | null {
  const principalKey = getAdminDashboardCacheKey(principal);
  if (!principalKey) return null;
  return `${principalKey}|students|${roleContext}|${scopeKey}|active:${activeOnly ? 1 : 0}|limit:${limit}`;
}

function readScopedStudentsCache(cacheKey: string): ScopedStudentsPayload | null {
  const entry = scopedStudentsCacheByPrincipal.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > SCOPED_STUDENTS_CACHE_TTL_MS) {
    scopedStudentsCacheByPrincipal.delete(cacheKey);
    return null;
  }
  return entry.payload;
}

function writeScopedStudentsCache(cacheKey: string, payload: ScopedStudentsPayload): void {
  scopedStudentsCacheByPrincipal.set(cacheKey, { cachedAt: Date.now(), payload });
}

function getStudentCreditDetailsCacheKey(
  principal: { provider: string; subject: string } | null | undefined,
  studentId: string,
): string | null {
  const principalKey = getAdminDashboardCacheKey(principal);
  const normalizedStudentId = String(studentId ?? "").trim();
  if (!principalKey || !normalizedStudentId) return null;
  return `${principalKey}|student-credits|${normalizedStudentId}`;
}

function readStudentCreditDetailsCache(cacheKey: string): StudentCreditDetailsPayload | null {
  const entry = studentCreditDetailsCacheByPrincipal.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > STUDENT_CREDIT_DETAILS_CACHE_TTL_MS) {
    studentCreditDetailsCacheByPrincipal.delete(cacheKey);
    return null;
  }
  return entry.payload;
}

function writeStudentCreditDetailsCache(cacheKey: string, payload: StudentCreditDetailsPayload): void {
  studentCreditDetailsCacheByPrincipal.set(cacheKey, { cachedAt: Date.now(), payload });
}

function invalidateAllStudentCreditDetailsCaches(): void {
  studentCreditDetailsCacheByPrincipal.clear();
}

function toTwoDecimalNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

async function recomputeStudentSummaryTablesForSubjects(env: Env, subjects: string[]): Promise<void> {
  const uniqueSubjects = Array.from(
    new Set(
      subjects
        .map((subject) => String(subject ?? "").trim())
        .filter((subject) => subject.length > 0)
    )
  );
  if (uniqueSubjects.length === 0) return;
  const db = getDb(env);
  const placeholders = uniqueSubjects.map(() => "?").join(", ");
  const studentRes = await db.execute({
    sql: `select s.user_id
          from students s
          inner join user_accounts ua on ua.id = s.user_id
          where ua.subject in (${placeholders})`,
    args: uniqueSubjects,
  });
  const studentIds = studentRes.rows
    .map((row) => String(row.user_id ?? "").trim())
    .filter((id) => id.length > 0);
  if (studentIds.length === 0) return;
  await recomputeStudentCreditSummaries(env, studentIds);
}

function parseCookieToken(request: Request, name: string): string {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    const [k, ...rest] = part.split("=");
    if (k === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return "";
}

function requiresCsrfCheck(request: Request, provider: string | null): boolean {
  return request.method === "POST" && provider === "session";
}

function resolveClientIp(request: Request): string {
  const normalizeIpCandidate = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    const withoutQuotes = trimmed.replace(/^"+|"+$/g, "");
    const withoutBrackets = withoutQuotes.replace(/^\[|\]$/g, "");
    // Handle host:port for IPv4, while leaving IPv6 literals intact.
    const ipv4WithPort = withoutBrackets.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
    if (ipv4WithPort?.[1]) {
      return ipv4WithPort[1];
    }
    return withoutBrackets;
  };

  const headerCandidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    request.headers.get("true-client-ip"),
    request.headers.get("x-client-ip"),
    request.headers.get("x-forwarded"),
    request.headers.get("forwarded-for"),
    request.headers.get("forwarded")
  ];

  for (const rawValue of headerCandidates) {
    if (!rawValue) {
      continue;
    }
    const firstPart = rawValue.split(",")[0]?.trim();
    if (!firstPart) {
      continue;
    }
    // RFC 7239 "Forwarded" may include "for=<ip>;proto=...".
    const forwardedMatch = firstPart.match(/for="?([^";,\s]+)"?/i);
    const candidate = normalizeIpCandidate(forwardedMatch?.[1] ?? firstPart);
    if (candidate && candidate.toLowerCase() !== "unknown") {
      return candidate;
    }
  }

  // Local dev fallback: wrangler/miniflare may not inject proxy IP headers.
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "127.0.0.1";
  }
  if (hostname === "::1" || hostname === "[::1]") {
    return "::1";
  }

  return "unknown";
}

export const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const respond = (data: unknown, status = 200, extraHeaders?: Record<string, string>, sanitize = true) =>
      json(sanitize ? sanitizeResponsePayload(data) : data, status, request, env, extraHeaders);
    const startedAt = Date.now();
    const requestId = request.headers.get("cf-ray") ?? crypto.randomUUID();
    const { pathname } = new URL(request.url);
    const policyPath = pathname;
    let statusCode = 500;
    let principalSubject: string | null = null;
    let authProvider: string | null = null;
    let event = "request.completed";
    let errorMessage: string | null = null;

    if (request.method === "OPTIONS") {
      statusCode = 200;
      return respond({ ok: true });
    }

    try {
      const preSetupStatus = await getSetupStatus(env).catch(() => ({
        hasTables: false,
        tableCount: 0,
        tableNames: []
      }));

      const identityProvider = createIdentityProvider(env);
      const principal = await identityProvider.authenticate(request, env);
      const roleContext = new URL(request.url).searchParams.get("roleContext");
      const preferFacultyScope = roleContext === "faculty";
      const preferModeratorActiveScope = roleContext === "moderator";
      const preferHeadActiveScope = roleContext === "head";
      const resolveScopedStudentAccess = (currentPrincipal: NonNullable<typeof principal>) => {
        if (preferFacultyScope && currentPrincipal.roles.includes("faculty")) {
          const facultyScopedPrincipal = {
            ...currentPrincipal,
            roles: ["faculty"] as typeof currentPrincipal.roles,
          };
          const facultyScope = resolveStudentScope(facultyScopedPrincipal);
          if (facultyScope.type === "mentor") {
            return facultyScope;
          }
        }
        return resolveStudentScope(currentPrincipal);
      };
      const shouldRestrictToActiveStudents = (currentPrincipal: NonNullable<typeof principal>) =>
        (preferModeratorActiveScope && currentPrincipal.roles.includes("moderator"))
        || (preferHeadActiveScope && currentPrincipal.roles.includes("head"));
      principalSubject = principal?.subject ?? null;
      authProvider = identityProvider.name;

      // DB-write optimization for Turso free tier:
      // avoid per-request account sync writes in hot paths.
      // Account records are still created/updated on explicit auth/setup operations.

      const policy = getAccessPolicy(request.method, policyPath);

      if (!isAuthorized(principal, policy)) {
        statusCode = 401;
        event = "request.unauthorized";
        return respond({ ok: false, error: "Unauthorized" }, 401);
      }

      const isSetupMutation =
        pathname === "/api/setup/check-connections" ||
        pathname === "/api/setup/run-migrations" ||
        pathname === "/api/setup/run-mitigations" ||
        pathname === "/api/setup/seed-data" ||
        pathname === "/api/setup/create-super-admin" ||
        pathname === "/api/setup/reset-state";
      const isBootstrapAdminEndpoint = pathname === "/api/setup/create-super-admin";
      if (isSetupMutation && request.method === "POST") {
        const locked = await hasSuperAdmin(env).catch(() => false);
        if (locked && !isBootstrapAdminEndpoint && !principal?.roles.includes("admin")) {
          statusCode = 403;
          event = "setup.locked";
          return respond({ ok: false, error: "Setup is locked. Admin login required." }, 403);
        }
      }

      if (requiresCsrfCheck(request, principal?.provider ?? null) && pathname !== "/api/auth/login" && pathname !== "/api/auth/google") {
        if (!validateCsrf(request)) {
          statusCode = 403;
          event = "request.csrf_failed";
          return respond({ ok: false, error: "CSRF validation failed" }, 403);
        }
      }

      if (pathname === "/" && request.method === "GET") {
        statusCode = 200;
        return respond({
          ok: true,
          service: "fa-mentoring-api",
          authProvider: identityProvider.name,
          endpoints: ROOT_ENDPOINTS
        });
      }

      if (pathname === "/api/debug-env" && request.method === "GET") {
        const allowDebugEndpoints = String(env.ALLOW_DEBUG_ENDPOINTS ?? "").trim().toLowerCase() === "true";
        if (!allowDebugEndpoints) {
          statusCode = 404;
          event = "request.not_found";
          return respond({ ok: false, error: "Not found" }, 404);
        }
        const flags = principal ? await getPrincipalAccountFlags(env, principal) : null;
        if (!flags?.isSuperuser) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Super admin access required." }, 403);
        }
        statusCode = 200;
        return respond({
          ok: true,
          hasDatabaseUrl: Boolean(env.TURSO_DATABASE_URL && String(env.TURSO_DATABASE_URL).trim()),
          hasAuthToken: Boolean(env.TURSO_AUTH_TOKEN && String(env.TURSO_AUTH_TOKEN).trim())
        });
      }

      if (pathname === "/api/health" && request.method === "GET") {
        statusCode = 200;
        return respond({ ok: true, service: "fa-mentoring-api" });
      }

      if (pathname === "/api/setup-status" && request.method === "GET") {
        const status = await getSetupStatus(env);
        const setupState = await getSetupState(env);
        statusCode = 200;
        return respond({
          ok: true,
          ...status,
          setupComplete: Boolean(setupState?.setupComplete),
          setupCompletedAt: setupState?.completedAt ?? null
        });
      }

      if (pathname === "/api/admin/dashboard" && request.method === "GET") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        if (!principal.roles.includes("admin") && !principal.roles.includes("head")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Admin or head access required." }, 403);
        }
        const url = new URL(request.url);
        const forceRefresh = ["1", "true", "yes"].includes(String(url.searchParams.get("force") ?? "").trim().toLowerCase());
        const cacheKey = getAdminDashboardCacheKey(principal);
        if (!forceRefresh && cacheKey) {
          const cached = readAdminDashboardCache(cacheKey);
          if (cached) {
            statusCode = 200;
            return respond({ ok: true, ...cached });
          }
        }
        const data = await getAdminDashboard(env);
        if (cacheKey) {
          writeAdminDashboardCache(cacheKey, data);
        }
        statusCode = 200;
        return respond({ ok: true, ...data });
      }

      if (pathname === "/api/admin/active-users" && request.method === "GET") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        if (!principal.roles.includes("admin")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Admin access required." }, 403);
        }
        const url = new URL(request.url);
        const data = await readActiveUsers(env, url.searchParams.get("limit"), url.searchParams.get("cursor"));
        statusCode = 200;
        return respond({ ok: true, ...data });
      }

      if (pathname === "/api/admin/users" && request.method === "GET") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        if (!principal.roles.includes("admin")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Admin access required." }, 403);
        }
        const url = new URL(request.url);
        const data = await readUsers(env, {
          limitParam: url.searchParams.get("limit"),
          cursorParam: url.searchParams.get("cursor"),
          searchParam: url.searchParams.get("q"),
        });
        statusCode = 200;
        return respond({ ok: true, ...data });
      }

      if (pathname === "/api/admin/login-attempts" && request.method === "GET") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        if (!principal.roles.includes("admin")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Admin access required." }, 403);
        }
        const url = new URL(request.url);
        const data = await readLoginAttempts(
          env,
          url.searchParams.get("limit"),
          url.searchParams.get("cursor"),
          url.searchParams.get("success"),
          url.searchParams.get("sinceHours")
        );
        statusCode = 200;
        return respond({ ok: true, ...data });
      }

      if (pathname === "/api/admin/users" && request.method === "POST") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        if (!principal.roles.includes("admin")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Admin access required." }, 403);
        }
        const body = await request.json();
        const username = isObject(body) ? String(body.username ?? "") : "";
        const password = isObject(body) ? String(body.password ?? "") : "";
        const role = isObject(body) ? String(body.role ?? "") : "";
        const roles = isObject(body) && Array.isArray(body.roles) ? body.roles : [];
        const fullName = isObject(body) ? String(body.fullName ?? "") : "";
        const email = isObject(body) ? String(body.email ?? "") : "";
        await createLocalUserByAdmin(env, principal, { username, password, role, roles, fullName, email });
        statusCode = 200;
        event = "admin.user.created";
        return respond({ ok: true, message: "User created." });
      }

      if (pathname === "/api/admin/users/update" && request.method === "POST") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        if (!principal.roles.includes("admin")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Admin access required." }, 403);
        }
        const body = await request.json();
        const subject = isObject(body) ? String(body.subject ?? "") : "";
        const fullName = isObject(body) ? String(body.fullName ?? "") : "";
        const roles = isObject(body) && Array.isArray(body.roles) ? body.roles : [];
        const email = isObject(body) && "email" in body ? String(body.email ?? "") : undefined;
        const username = isObject(body) && "username" in body ? String(body.username ?? "") : undefined;
        await updateUserByAdmin(env, principal, { subject, fullName, roles, email, username });
        statusCode = 200;
        event = "admin.user.updated";
        return respond({ ok: true, message: "User updated." });
      }

      if (pathname === "/api/admin/users/reset-password" && request.method === "POST") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        if (!principal.roles.includes("admin")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Admin access required." }, 403);
        }
        const body = await request.json();
        const subject = isObject(body) ? String(body.subject ?? "") : "";
        const newPassword = isObject(body) ? String(body.newPassword ?? "") : "";
        await adminResetLocalUserPassword(env, principal, subject, newPassword);
        statusCode = 200;
        event = "admin.user.password_reset";
        return respond({ ok: true, message: "Password reset." });
      }

      if (pathname === "/api/admin/users/set-active" && request.method === "POST") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        if (!principal.roles.includes("admin")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Admin access required." }, 403);
        }
        const body = await request.json();
        const subject = isObject(body) ? String(body.subject ?? "") : "";
        const active = isObject(body) ? Boolean(body.active) : false;
        await setUserActiveByAdmin(env, principal, subject, active);
        await recomputeStudentSummaryTablesForSubjects(env, [subject]);
        invalidateAllAdminDashboardCaches();
        statusCode = 200;
        event = active ? "admin.user.activated" : "admin.user.deactivated";
        return respond({ ok: true, message: active ? "User activated." : "User deactivated." });
      }

      if (pathname === "/api/admin/users/set-active-batch" && request.method === "POST") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        if (!principal.roles.includes("admin")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Admin access required." }, 403);
        }
        const body = await request.json();
        const updates = isObject(body) && Array.isArray(body.updates) ? body.updates : null;
        if (!updates || updates.length === 0) {
          statusCode = 400;
          event = "request.validation_failed";
          return respond({ ok: false, error: "updates[] is required" }, 400);
        }
        if (updates.length > 100) {
          statusCode = 400;
          event = "request.validation_failed";
          return respond({ ok: false, error: "updates[] cannot exceed 100 rows per request" }, 400);
        }
        const db = getDb(env);
        let updated = 0;
        const touchedSubjects: string[] = [];
        for (const item of updates) {
          const username = isObject(item) ? String(item.username ?? "").trim().toLowerCase() : "";
          const active = isObject(item) ? Boolean(item.active) : false;
          if (!username) {
            throw new Error("username is required for each update row");
          }
          const userLookup = await db.execute({
            sql: "select subject from user_accounts where lower(trim(coalesce(username, ''))) = ? limit 1",
            args: [username],
          });
          if (userLookup.rows.length === 0) {
            throw new Error(`User not found for username: ${username}`);
          }
          const subject = String(userLookup.rows[0]?.subject ?? "").trim();
          await setUserActiveByAdmin(env, principal, subject, active);
          touchedSubjects.push(subject);
          updated += 1;
        }
        await recomputeStudentSummaryTablesForSubjects(env, touchedSubjects);
        invalidateAllAdminDashboardCaches();
        statusCode = 200;
        event = "admin.users_active_bulk_updated";
        return respond({ ok: true, updated, message: `Updated ${updated} user status row(s).` });
      }

      if (pathname === "/api/admin/users/logout-all-sessions" && request.method === "POST") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        if (!principal.roles.includes("admin")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Admin access required." }, 403);
        }
        const body = await request.json();
        const identifier = isObject(body) ? String(body.identifier ?? "") : "";
        const result = await revokeAllSessionsForUser(env, identifier);
        const currentAccountRef = (await resolveUserAccountIdByPrincipal(env, principal)) ?? "";
        const revokedOwnSession = Boolean(currentAccountRef && result.targetAccountRef === currentAccountRef);
        statusCode = 200;
        event = "admin.sessions.revoked_all";
        return respond(
          { ...result, revokedOwnSession },
          200,
          revokedOwnSession ? { "set-cookie": buildClearSessionCookie(env, request) } : undefined
        );
      }

      if (pathname === "/api/startup-warnings" && request.method === "GET") {
        const requestUrl = new URL(request.url);
        const requestHost = requestUrl.host;
        const requestOrigin = request.headers.get("origin") ?? "";
        const configuredOrigins = String(env.FRONTEND_ORIGIN ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        const originHost = requestOrigin ? new URL(requestOrigin).host : "";
        const configuredOriginHosts = configuredOrigins.map((o) => {
          try {
            return new URL(o).host;
          } catch {
            return "";
          }
        });
        const localhostMismatch =
          (requestHost.includes("127.0.0.1") && configuredOriginHosts.some((h) => h.includes("localhost"))) ||
          (requestHost.includes("localhost") && configuredOriginHosts.some((h) => h.includes("127.0.0.1"))) ||
          (originHost.includes("localhost") && requestHost.includes("127.0.0.1")) ||
          (originHost.includes("127.0.0.1") && requestHost.includes("localhost"));

        statusCode = 200;
        return respond({
          ok: true,
          cookieConfig: {
            name: getAuthCookieName(env),
            secure: shouldUseSecureCookie(request, env),
            sameSite: getSameSite(env),
            sessionHours: getSessionHours(env)
          },
          requestContext: {
            requestHost,
            requestOrigin
          },
          warnings: [
            ...(configuredOrigins.length === 0 ? ["FRONTEND_ORIGIN is not configured."] : []),
            ...(requestOrigin && configuredOrigins.length > 0 && !configuredOrigins.includes(requestOrigin)
              ? [`Origin ${requestOrigin} is not in FRONTEND_ORIGIN allow list.`]
              : []),
            ...(localhostMismatch ? ["Potential localhost/127.0.0.1 host mismatch detected."] : [])
          ]
        });
      }

      if (pathname === "/api/setup/wizard-status" && request.method === "GET") {
        const state = await getWizardState(env);
        statusCode = 200;
        return respond({ ok: true, ...state, setupLocked: state.hasSuperAdmin });
      }

      if (pathname === "/api/setup/check-connections" && request.method === "POST") {
        const result = await checkConnections(env);
        statusCode = 200;
        return respond(result);
      }

      if (pathname === "/api/setup/run-migrations" && request.method === "POST") {
        const result = await runMigrations(env);
        statusCode = 200;
        return respond(result);
      }

      if (pathname === "/api/setup/run-mitigations" && request.method === "POST") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        const flags = await getPrincipalAccountFlags(env, principal).catch(() => null);
        if (!flags?.isSuperuser) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Super admin access required." }, 403);
        }
        const result = await runRecentMitigations(env);
        statusCode = 200;
        return respond(result);
      }

      if (pathname === "/api/setup/seed-data" && request.method === "POST") {
        const result = await seedInitialData(env);
        statusCode = 200;
        return respond(result);
      }

      if (pathname === "/api/setup/create-super-admin" && request.method === "POST") {
        const body = await request.json();
        const bootstrapKey = isObject(body) ? String(body.bootstrapKey ?? "") : "";
        const username = isObject(body) ? String(body.username ?? "").trim() : "";
        const password = isObject(body) ? String(body.password ?? "") : "";
        const expected = String(env.SETUP_BOOTSTRAP_KEY ?? "").trim();
        if (!expected) {
          statusCode = 500;
          return respond({ ok: false, error: "SETUP_BOOTSTRAP_KEY is not configured." }, 500);
        }
        if (!bootstrapKey || bootstrapKey !== expected) {
          statusCode = 403;
          event = "setup.bootstrap_key_failed";
          return respond({ ok: false, error: "Invalid bootstrap key." }, 403);
        }
        await createLocalSuperAdmin(env, username, password);
        await markSetupComplete(env);
        statusCode = 200;
        return respond({ ok: true, message: "Super admin created." });
      }

      if (pathname === "/api/setup/reset-state" && request.method === "POST") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        if (!principal.roles.includes("admin")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Admin access required." }, 403);
        }
        await resetSetupState(env);
        statusCode = 200;
        return respond({
          ok: true,
          message: "Setup state reset. Development-only re-onboarding is now enabled.",
          setupComplete: false
        });
      }

      if (pathname === "/api/auth/me" && request.method === "GET") {
        let isSuperuser = false;
        if (principal) {
          const flags = await getPrincipalAccountFlags(env, principal).catch(() => null);
          isSuperuser = Boolean(flags?.isSuperuser);
        }
        statusCode = 200;
        return respond({
          ok: true,
          principal: principal ? { ...principal, isSuperuser } : null,
          authProvider: identityProvider.name
        });
      }

      if (pathname === "/api/auth/my-account" && request.method === "GET") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        const profile = await getAccountProfileByPrincipal(env, principal);
        statusCode = 200;
        return respond({
          ok: true,
          profile: profile
            ? {
                subject: profile.subject,
                email: profile.email,
                fullName: profile.fullName,
                roles: profile.roles,
                provider: profile.provider,
                username: profile.username
              }
            : null
        });
      }

      if (pathname === "/api/auth/my-account" && request.method === "POST") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        const body = await request.json();
        const fullName = isObject(body) ? String(body.fullName ?? "") : "";
        await updateOwnFullName(env, principal, fullName);
        statusCode = 200;
        return respond({ ok: true, message: "Profile updated" });
      }

      if (pathname === "/api/auth/csrf" && request.method === "GET") {
        const token = issueCsrfToken();
        const secureAttr = new URL(request.url).protocol === "https:" ? "; Secure" : "";
        const cookie = buildCsrfCookie(token, Boolean(secureAttr));
        statusCode = 200;
        return respond({ ok: true, csrfToken: token }, 200, { "set-cookie": cookie });
      }

      if (pathname === "/api/auth/login" && request.method === "POST") {
        const body = await request.json();
        const username = isObject(body) ? String(body.username ?? "").trim() : "";
        const password = isObject(body) ? String(body.password ?? "") : "";
        if (!username || !password) {
          statusCode = 400;
          event = "request.validation_failed";
          return respond({ ok: false, error: "username and password are required" }, 400);
        }
        const ipAddress = resolveClientIp(request);
        const loginResult = await loginWithPassword(env, username, password, ipAddress);
        invalidateAllAdminDashboardCaches();
        statusCode = 200;
        event = "auth.login_success";
        const cookie = buildSessionCookie(env, request, loginResult.token);
        return respond(
          {
            ok: true,
            expiresInHours: loginResult.expiresInHours,
            principal: loginResult.principal
          },
          200,
          { "set-cookie": cookie }
        );
      }

      if (pathname === "/api/auth/google" && request.method === "POST") {
        const body = await request.json();
        const idToken = isObject(body) ? String(body.idToken ?? "") : "";
        if (!idToken) {
          statusCode = 400;
          event = "request.validation_failed";
          return respond({ ok: false, error: "idToken is required" }, 400);
        }
        const loginResult = await loginWithGoogleIdToken(env, idToken);
        invalidateAllAdminDashboardCaches();
        statusCode = 200;
        event = "auth.login_success";
        const cookie = buildSessionCookie(env, request, loginResult.token);
        return respond(
          {
            ok: true,
            expiresInHours: loginResult.expiresInHours,
            principal: loginResult.principal
          },
          200,
          { "set-cookie": cookie }
        );
      }

      if (pathname === "/api/auth/logout" && request.method === "POST") {
        invalidateAdminDashboardCacheForPrincipal(principal);
        const token = parseBearerToken(request) || parseCookieToken(request, getAuthCookieName(env));
        await revokeSessionToken(env, token);
        statusCode = 200;
        event = "auth.logout";
        const clearCookie = buildClearSessionCookie(env, request);
        return respond({ ok: true }, 200, { "set-cookie": clearCookie });
      }

      if (pathname === "/api/auth/logout-other-sessions" && request.method === "POST") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        const currentToken = parseBearerToken(request) || parseCookieToken(request, getAuthCookieName(env));
        const revokedSessions = await revokeOtherSessionsForPrincipal(env, principal, currentToken);
        invalidateAdminDashboardCacheForPrincipal(principal);
        statusCode = 200;
        event = "auth.logout_other_sessions";
        return respond({ ok: true, revokedSessions });
      }

      if (pathname === "/api/auth/other-sessions-count" && request.method === "GET") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        const currentToken = parseBearerToken(request) || parseCookieToken(request, getAuthCookieName(env));
        const otherSessions = await countOtherSessionsForPrincipal(env, principal, currentToken);
        statusCode = 200;
        return respond({ ok: true, otherSessions });
      }

      if (pathname === "/api/auth/sessions" && request.method === "GET") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        const currentToken = parseBearerToken(request) || parseCookieToken(request, getAuthCookieName(env));
        const sessions = await listActiveSessionsForPrincipal(env, principal, currentToken);
        statusCode = 200;
        return respond({ ok: true, sessions });
      }

      if (pathname === "/api/auth/set-password" && request.method === "POST") {
        const body = await request.json();
        const username = isObject(body) ? String(body.username ?? "").trim() : "";
        const password = isObject(body) ? String(body.password ?? "") : "";
        if (!username || !password) {
          statusCode = 400;
          event = "request.validation_failed";
          return respond({ ok: false, error: "username and password are required" }, 400);
        }
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        await setLocalPasswordForPrincipal(env, principal, username, password);
        statusCode = 200;
        event = "auth.password_set";
        return respond({ ok: true, message: "Local credentials updated" });
      }

      if (pathname === "/api/auth/change-password" && request.method === "POST") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        const body = await request.json();
        const currentPassword = isObject(body) ? String(body.currentPassword ?? "") : "";
        const newPassword = isObject(body) ? String(body.newPassword ?? "") : "";
        if (!currentPassword || !newPassword) {
          statusCode = 400;
          event = "request.validation_failed";
          return respond({ ok: false, error: "currentPassword and newPassword are required" }, 400);
        }
        await changeOwnPassword(env, principal, currentPassword, newPassword);
        statusCode = 200;
        event = "auth.password_changed";
        return respond({ ok: true, message: "Password changed successfully." });
      }

      if (pathname === "/api/logs" && request.method === "GET") {
        if (!canPerformAction(principal, "logs.read")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Forbidden" }, 403);
        }
        const url = new URL(request.url);
        const data = await readRecentLogs(
          env,
          url.searchParams.get("limit"),
          url.searchParams.get("cursor"),
          url.searchParams.get("level"),
          url.searchParams.get("sinceHours")
        );
        statusCode = 200;
        return respond({ ok: true, ...data });
      }

      if (pathname === "/api/logs/clear" && request.method === "POST") {
        if (!canPerformAction(principal, "logs.read")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Forbidden" }, 403);
        }
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        const flags = await getPrincipalAccountFlags(env, principal).catch(() => null);
        if (!flags?.isSuperuser) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Super admin access required." }, 403);
        }
        const cleared = await clearAllLogs(env);
        statusCode = 200;
        event = "logs.cleared";
        return respond({ ok: true, message: `Cleared ${cleared} log entries.` });
      }

      if (pathname === "/api/setup" && request.method === "POST") {
        const result = await setupSchema(env);
        statusCode = 200;
        return respond({ ok: true, message: result.hasMore ? "Schema migrations processed (more pending)." : "Schema migrations completed", ...result });
      }

      if (pathname === "/api/migrate" && request.method === "POST") {
        const result = await setupSchema(env);
        statusCode = 200;
        return respond({ ok: true, message: result.hasMore ? "Migrations processed (more pending)." : "Migrations executed", ...result });
      }

      if (pathname === "/api/regulations" && request.method === "GET") {
        const data = await fetchRegulationsFromJson();
        statusCode = 200;
        return respond({ ok: true, ...data });
      }

      if (pathname === "/api/plans-of-study" && request.method === "GET") {
        const data = await fetchPlansOfStudyFromJson();
        const validation = await validatePlansOfStudyAgainstRegulations();
        statusCode = 200;
        return respond({ ok: true, ...data, validation });
      }

      if (pathname === "/api/programmes" && request.method === "GET") {
        const data = await fetchProgrammesFromJson();
        statusCode = 200;
        return respond({ ok: true, ...data }, 200, undefined, false);
      }

      if (pathname === "/api/students" && request.method === "GET") {
        if (!principal || !canPerformAction(principal, "students.read")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Forbidden" }, 403);
        }
        const url = new URL(request.url);
        const limitParam = url.searchParams.get("limit");
        const cursorParam = url.searchParams.get("cursor");
        const roleContextParam = String(url.searchParams.get("roleContext") ?? "").trim().toLowerCase();
        const forceRefresh = ["1", "true", "yes"].includes(String(url.searchParams.get("force") ?? "").trim().toLowerCase());
        const scope = resolveScopedStudentAccess(principal);
        const activeOnly = shouldRestrictToActiveStudents(principal);
        const scopeKey =
          scope.type === "mentor"
            ? `mentor:${scope.mentorEmail}`
            : scope.type === "self"
              ? `self:${scope.studentEmail}`
              : scope.type;
        const cacheKey = !cursorParam
          ? getScopedStudentsCacheKey(principal, roleContextParam, scopeKey, activeOnly, String(limitParam ?? ""))
          : null;
        if (!forceRefresh && cacheKey) {
          const cached = readScopedStudentsCache(cacheKey);
          if (cached) {
            statusCode = 200;
            return respond({ ok: true, ...cached });
          }
        }
        const data = await listStudentsByScope(env, scope, limitParam, cursorParam, activeOnly);
        if (cacheKey) {
          writeScopedStudentsCache(cacheKey, data);
        }
        statusCode = 200;
        return respond({ ok: true, ...data });
      }

      if (pathname === "/api/students-directory" && request.method === "GET") {
        if (!principal || (!principal.roles.includes("admin") && !principal.roles.includes("moderator") && !principal.roles.includes("head"))) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Forbidden" }, 403);
        }
        const url = new URL(request.url);
        const data = await listStudentsDirectory(env, url.searchParams.get("limit"), url.searchParams.get("cursor"));
        statusCode = 200;
        return respond({ ok: true, ...data });
      }

      if (pathname === "/api/students-directory/update" && request.method === "POST") {
        if (!principal || (!principal.roles.includes("admin") && !principal.roles.includes("moderator") && !principal.roles.includes("head") && !principal.roles.includes("faculty"))) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Forbidden" }, 403);
        }
        const body = await request.json();
        const userId = isObject(body) ? String(body.userId ?? "") : "";
        const registrationNumber = isObject(body) ? String(body.registrationNumber ?? "") : "";
        const planOfStudyCode = isObject(body) && "planOfStudyCode" in body && body.planOfStudyCode !== null && body.planOfStudyCode !== ""
          ? Number(body.planOfStudyCode)
          : null;
        const batch = isObject(body) && "batch" in body ? Number(body.batch) : null;
        const programme = isObject(body) && "programme" in body && body.programme !== null && body.programme !== ""
          ? Number(body.programme)
          : null;
        const graduated = isObject(body) && "graduated" in body ? String(body.graduated ?? "") : null;
        const currentSemester = isObject(body) && "currentSemester" in body && body.currentSemester !== null && body.currentSemester !== ""
          ? Number(body.currentSemester)
          : null;
        const isFacultyOnlyPrincipal =
          principal.roles.includes("faculty")
          && !principal.roles.includes("admin")
          && !principal.roles.includes("moderator")
          && !principal.roles.includes("head");
        const modifierUserId = await resolveUserAccountIdByPrincipal(env, principal);
        const mentorName = isFacultyOnlyPrincipal ? null : (isObject(body) ? String(body.mentorName ?? "") : "");
        if (isFacultyOnlyPrincipal) {
          const facultyScope = resolveStudentScope(principal);
          if (facultyScope.type !== "mentor") {
            statusCode = 403;
            event = "request.forbidden";
            return respond({ ok: false, error: "Faculty identity email is required for scoped updates." }, 403);
          }
          await assertFacultyCanEditStudentUserIds(env, facultyScope.mentorEmail, [userId]);
        }
        await upsertStudentDirectoryRow(env, {
          userId,
          registrationNumber,
          planOfStudyCode,
          batch,
          programme,
          graduated: graduated === null ? null : (graduated.trim().toLowerCase() === "yes" ? "Yes" : "No"),
          currentSemester,
          mentorName,
          modifiedByUserId: modifierUserId,
        });
        await recomputeStudentCreditSummary(env, userId);
        invalidateAllAdminDashboardCaches();
        statusCode = 200;
        event = "students.directory.updated";
        return respond({ ok: true, message: "Student updated." });
      }

      if (pathname === "/api/students-directory/update-batch" && request.method === "POST") {
        if (!principal || (!principal.roles.includes("admin") && !principal.roles.includes("moderator") && !principal.roles.includes("head") && !principal.roles.includes("faculty"))) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Forbidden" }, 403);
        }
        const body = await request.json();
        const updates = isObject(body) && Array.isArray(body.updates) ? body.updates : null;
        if (!updates || updates.length === 0) {
          statusCode = 400;
          event = "request.validation_failed";
          return respond({ ok: false, error: "updates[] is required" }, 400);
        }
        if (updates.length > 100) {
          statusCode = 400;
          event = "request.validation_failed";
          return respond({ ok: false, error: "updates[] cannot exceed 100 rows per request" }, 400);
        }
        const isFacultyOnlyPrincipal =
          principal.roles.includes("faculty")
          && !principal.roles.includes("admin")
          && !principal.roles.includes("moderator")
          && !principal.roles.includes("head");
        const modifierUserId = await resolveUserAccountIdByPrincipal(env, principal);
        if (isFacultyOnlyPrincipal) {
          const facultyScope = resolveStudentScope(principal);
          if (facultyScope.type !== "mentor") {
            statusCode = 403;
            event = "request.forbidden";
            return respond({ ok: false, error: "Faculty identity email is required for scoped updates." }, 403);
          }
          const scopedUserIds = updates
            .map((item) => (isObject(item) ? String(item.userId ?? "") : ""))
            .filter((value) => value.trim().length > 0);
          await assertFacultyCanEditStudentUserIds(env, facultyScope.mentorEmail, scopedUserIds);
        }
        for (const item of updates) {
          const userId = isObject(item) ? String(item.userId ?? "") : "";
          const registrationNumber = isObject(item) ? String(item.registrationNumber ?? "") : "";
          const planOfStudyCode = isObject(item) && "planOfStudyCode" in item && item.planOfStudyCode !== null && item.planOfStudyCode !== ""
            ? Number(item.planOfStudyCode)
            : null;
          const batch = isObject(item) && "batch" in item ? Number(item.batch) : null;
          const programme = isObject(item) && "programme" in item && item.programme !== null && item.programme !== ""
            ? Number(item.programme)
            : null;
          const graduated = isObject(item) && "graduated" in item ? String(item.graduated ?? "") : null;
          const currentSemester = isObject(item) && "currentSemester" in item && item.currentSemester !== null && item.currentSemester !== ""
            ? Number(item.currentSemester)
            : null;
          const mentorName = isFacultyOnlyPrincipal ? null : (isObject(item) ? String(item.mentorName ?? "") : "");
          await upsertStudentDirectoryRow(env, {
            userId,
            registrationNumber,
            planOfStudyCode,
            batch,
            programme,
            graduated: graduated === null ? null : (graduated.trim().toLowerCase() === "yes" ? "Yes" : "No"),
            currentSemester,
            mentorName,
            modifiedByUserId: modifierUserId,
          });
        }
        const touchedUserIds = updates
          .map((item) => (isObject(item) ? String(item.userId ?? "").trim() : ""))
          .filter((id) => id.length > 0);
        await recomputeStudentCreditSummaries(env, touchedUserIds);
        invalidateAllAdminDashboardCaches();
        statusCode = 200;
        event = "students.directory.batch_updated";
        return respond({ ok: true, updated: updates.length, message: "Students updated." });
      }

      if (pathname === "/api/students/stats" && request.method === "GET") {
        if (!principal || !canPerformAction(principal, "students.stats.read")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Forbidden" }, 403);
        }
        const scope = resolveScopedStudentAccess(principal);
        const data = await getStudentStatsByScope(env, scope);
        statusCode = 200;
        return respond({ ok: true, ...data });
      }

      if (pathname === "/api/students/batch-summary" && request.method === "GET") {
        if (!principal) {
          statusCode = 401;
          event = "request.unauthorized";
          return respond({ ok: false, error: "Unauthorized" }, 401);
        }
        const scope = resolveScopedStudentAccess(principal);
        if (scope.type === "none" || scope.type === "self") {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Forbidden" }, 403);
        }
        const roleContextRaw = new URL(request.url).searchParams.get("roleContext");
        const roleContext = roleContextRaw === "moderator" ? "moderator"
          : roleContextRaw === "faculty" ? "faculty"
          : "head";
        const rows = await readBatchStatusSummaryByScope(
          env,
          scope,
          { preferredScopeType: roleContext }
        );
        statusCode = 200;
        return respond({ ok: true, rows });
      }

      if (pathname === "/api/student-credits" && request.method === "GET") {
        const studentId = new URL(request.url).searchParams.get("studentId") ?? "";
        if (!studentId) {
          return respond({ ok: false, error: "studentId is required" }, 400);
        }
        const scope = resolveScopedStudentAccess(principal!);
        if (scope.type === "none") {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Forbidden" }, 403);
        }
        if (scope.type === "mentor") {
          await assertFacultyCanAccessStudentUserIds(env, scope.mentorEmail, [studentId]);
        } else if (scope.type === "self") {
          await assertStudentCanAccessOwnUserId(env, scope.studentEmail, studentId);
        }
        const cacheKey = getStudentCreditDetailsCacheKey(principal, studentId);
        if (cacheKey) {
          const cached = readStudentCreditDetailsCache(cacheKey);
          if (cached) {
            statusCode = 200;
            return respond({ ok: true, ...cached });
          }
        }
        const [credits, units] = await Promise.all([
          getStudentCredits(env, studentId),
          getStudentUnits(env, studentId),
        ]);
        if (cacheKey) {
          writeStudentCreditDetailsCache(cacheKey, { creditDetails: credits, unitDetails: units });
        }
        statusCode = 200;
        return respond({ ok: true, creditDetails: credits, unitDetails: units });
      }

      if (pathname === "/api/student-credits" && request.method === "POST") {
        const body = await request.json();
        const studentId = isObject(body) ? String(body.studentId ?? "") : "";
        if (!studentId) {
          return respond({ ok: false, error: "studentId is required" }, 400);
        }
        const writeMode = isObject(body) ? String(body.writeMode ?? "").trim().toLowerCase() : "";
        if (writeMode !== "replace_all" && writeMode !== "patch") {
          return respond({ ok: false, error: "writeMode is required and must be replace_all or patch" }, 400);
        }
        const allowClearAll = Boolean(isObject(body) && body.allowClearAll === true);
        const rawEntries = isObject(body) && Array.isArray(body.entries) ? body.entries : [];
        const entries = (rawEntries as unknown[])
          .filter((e): e is Record<string, unknown> => isObject(e))
          .map((e) => ({
            categoryId: String(e.categoryId ?? ""),
            semesterTaken: Number(e.semesterTaken ?? 0),
            credits: toTwoDecimalNumber(Number(e.credits ?? 0)),
          }))
          .filter((e) => e.categoryId.length > 0 && e.semesterTaken > 0 && e.credits >= 0);
        const rawUnitEntries = isObject(body) && Array.isArray(body.unitEntries) ? body.unitEntries : [];
        const unitEntries = (rawUnitEntries as unknown[])
          .filter((e): e is Record<string, unknown> => isObject(e))
          .map((e) => ({
            categoryId: String(e.categoryId ?? ""),
            unitsEarned: toTwoDecimalNumber(Number(e.unitsEarned ?? 0)),
          }))
          .filter((e) => e.categoryId.length > 0 && e.unitsEarned >= 0);
        const scope = resolveScopedStudentAccess(principal!);
        if (scope.type === "none") {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Forbidden" }, 403);
        }
        if (scope.type === "mentor") {
          await assertFacultyCanEditStudentUserIds(env, scope.mentorEmail, [studentId]);
        } else if (scope.type === "self") {
          await assertStudentCanAccessOwnUserId(env, scope.studentEmail, studentId);
        }
        const modifiedById = await resolveUserAccountIdByPrincipal(env, principal!);
        await upsertStudentCredits(
          env,
          studentId,
          entries,
          modifiedById,
          writeMode === "replace_all" ? "replace_all" : "patch",
          allowClearAll,
        );
        await upsertStudentUnits(
          env,
          studentId,
          unitEntries,
          modifiedById,
          writeMode === "replace_all" ? "replace_all" : "patch",
          allowClearAll,
        );
        invalidateAllAdminDashboardCaches();
        invalidateAllStudentCreditDetailsCaches();
        statusCode = 200;
        event = "students.credits.updated";
        return respond({ ok: true, message: "Credits saved." });
      }

      if (pathname === "/api/student-credits/summaries" && request.method === "POST") {
        const body = await request.json();
        const rawIds = isObject(body) && Array.isArray(body.studentIds) ? body.studentIds : [];
        const studentIds = (rawIds as unknown[]).filter((id): id is string => typeof id === "string" && id.length > 0);
        const scope = resolveScopedStudentAccess(principal!);
        if (scope.type === "none") {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Forbidden" }, 403);
        }
        if (scope.type === "mentor") {
          await assertFacultyCanAccessStudentUserIds(env, scope.mentorEmail, studentIds);
        } else if (scope.type === "self") {
          await assertStudentCanAccessOwnUserIds(env, scope.studentEmail, studentIds);
        }
        const summaries = await getStudentCreditSummaries(env, studentIds);
        statusCode = 200;
        return respond({ ok: true, summaries });
      }

      if (pathname === "/api/student-credits/import-batch" && request.method === "POST") {
        const body = await request.json();
        const writeModeRaw = isObject(body) ? String(body.writeMode ?? "").trim().toLowerCase() : "";
        const writeMode = writeModeRaw === "" ? "patch" : writeModeRaw;
        if (writeMode !== "replace_all" && writeMode !== "patch") {
          return respond({ ok: false, error: "writeMode is required and must be replace_all or patch" }, 400);
        }
        const allowClearAll = Boolean(isObject(body) && body.allowClearAll === true);
        const rawRows = isObject(body) && Array.isArray(body.rows) ? body.rows : [];
        const rows = (rawRows as unknown[])
          .filter((r): r is Record<string, unknown> => isObject(r))
          .map((r) => ({
            registrationNumber: String(r.registrationNumber ?? "").trim(),
            semester: Number(r.semester ?? 0),
            categoryCode: String(r.categoryCode ?? "").trim(),
            credits: toTwoDecimalNumber(Number(r.credits ?? 0)),
          }))
          .filter((r) => r.registrationNumber && r.semester > 0 && r.categoryCode && r.credits >= 0);
        const scope = resolveScopedStudentAccess(principal!);
        const modifiedById = await resolveUserAccountIdByPrincipal(env, principal!);
        const result = await bulkImportStudentCredits(
          env,
          scope,
          rows,
          modifiedById,
          writeMode === "replace_all" ? "replace_all" : "patch",
          allowClearAll,
        );
        invalidateAllAdminDashboardCaches();
        invalidateAllStudentCreditDetailsCaches();
        statusCode = 200;
        event = "students.credits.batch_imported";
        return respond({ ok: true, ...result });
      }

      if (pathname === "/api/student-credit-table" && request.method === "GET") {
        const scope = resolveScopedStudentAccess(principal!);
        const url = new URL(request.url);
        const data = await listStudentCreditTableByScope(
          env,
          scope,
          shouldRestrictToActiveStudents(principal!),
          {
            limitRaw: url.searchParams.get("limit"),
            offsetRaw: url.searchParams.get("offset"),
            filters: {
              registrationNumber: url.searchParams.get("registrationNumber"),
              categoryId: url.searchParams.get("categoryId"),
              graduated: (url.searchParams.get("graduated") as "Yes" | "No" | null),
              modifiedByUsername: url.searchParams.get("modifiedByUsername"),
              semester: url.searchParams.get("semester") == null ? null : Number(url.searchParams.get("semester")),
            },
          },
        );
        statusCode = 200;
        return respond({ ok: true, rows: data.rows, page: data.page });
      }

      if (pathname === "/api/import/students" && request.method === "POST") {
        const hasCsvStudentUpdateRole = Boolean(
          principal
          && (principal.roles.includes("admin")
            || principal.roles.includes("moderator")
            || principal.roles.includes("head")
            || principal.roles.includes("faculty"))
        );
        if (!principal || (!canPerformAction(principal, "imports.manage") && !hasCsvStudentUpdateRole)) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Forbidden" }, 403);
        }
        const body = await request.json();
        if (!isObject(body) || !Array.isArray(body.rows)) {
          statusCode = 400;
          event = "request.validation_failed";
          return respond({ ok: false, error: "rows[] is required" }, 400);
        }
        let facultyRestrictedEmail: string | null = null;
        if (
          principal.roles.includes("faculty")
          && !principal.roles.includes("admin")
          && !principal.roles.includes("moderator")
          && !principal.roles.includes("head")
        ) {
          const facultyScope = resolveStudentScope(principal);
          facultyRestrictedEmail = facultyScope.type === "mentor" ? facultyScope.mentorEmail : "";
        }
        const modifierUserId = await resolveUserAccountIdByPrincipal(env, principal);
        const result = await importStudents(env, body.rows as CsvImportRow[], {
          restrictToActiveMentorEmail: facultyRestrictedEmail,
          modifiedByUserId: modifierUserId,
        });
        await recomputeStudentCreditSummaries(env, (result.updatedStudentUserIds ?? []) as string[]);
        invalidateAllAdminDashboardCaches();
        invalidateAllStudentCreditDetailsCaches();
        statusCode = 200;
        return respond({
          ok: true,
          imported: result.succeeded,
          failed: result.failed,
          errors: result.errors,
          total: result.total,
        });
      }

      statusCode = 404;
      event = "request.not_found";
      return respond({ ok: false, error: "Not found" }, 404);
    } catch (error) {
      statusCode = 400;
      event = "request.error";
      errorMessage = error instanceof Error ? error.message : "Unknown error";
      return respond(
        {
          ok: false,
          error: "Request failed. See server logs for details."
        },
        400
      );
    } finally {
      try {
        const skipLogForPath =
          pathname === "/api/setup/run-migrations" ||
          pathname === "/api/setup/run-mitigations" ||
          pathname === "/api/setup" ||
          pathname === "/api/migrate";
        if (!skipLogForPath) {
          await writeLog(env, {
            level: statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info",
            requestId,
            method: request.method,
            path: pathname,
            statusCode,
            durationMs: Date.now() - startedAt,
            principalSubject,
            authProvider,
            event,
            meta: errorMessage ? { error: errorMessage } : undefined
          });
        }
      } catch {
        // Never fail request handling because logging failed.
      }
    }
  }
};
