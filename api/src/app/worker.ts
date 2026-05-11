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
import { importFaculty, importPlanOfStudy, importRegulationsAndCategories, importStudents } from "../modules/imports/imports.service";
import { clearAllLogs, readRecentLogs, writeLog } from "../modules/logging/logger.service";
import { fetchRegulations } from "../modules/regulations/regulations.service";
import { getSetupStatus, setupSchema } from "../modules/setup/setup.service";
import { checkConnections, getSetupState, getWizardState, hasSuperAdmin, markSetupComplete, resetSetupState, runMigrations, runRecentMitigations, seedInitialData } from "../modules/setup/wizard.service";
import { getStudentStatsByScope, listStudentsByScope } from "../modules/students/students.service";

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
  "/api/students",
  "/api/students/stats",
  "/api/import/regulations-categories",
  "/api/import/faculty",
  "/api/import/students",
  "/api/import/plan-of-study"
];

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
      principalSubject = principal?.subject ?? null;
      authProvider = identityProvider.name;

      // DB-write optimization for Turso free tier:
      // avoid per-request account sync writes in hot paths.
      // Account records are still created/updated on explicit auth/setup operations.

      const policy = getAccessPolicy(request.method, pathname);

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

      if (requiresCsrfCheck(request, principal?.provider ?? null) && pathname !== "/api/auth/login") {
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
        const flags = await getPrincipalAccountFlags(env, principal).catch(() => null);
        if (!flags?.isSuperuser) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Super admin access required." }, 403);
        }
        const data = await getAdminDashboard(env);
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
        const data = await readUsers(env, url.searchParams.get("limit"), url.searchParams.get("cursor"));
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
        const fullName = isObject(body) ? String(body.fullName ?? "") : "";
        const email = isObject(body) ? String(body.email ?? "") : "";
        await createLocalUserByAdmin(env, principal, { username, password, role, fullName, email });
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
        const role = isObject(body) ? String(body.role ?? "") : "";
        await updateUserByAdmin(env, principal, { subject, fullName, role });
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
        statusCode = 200;
        event = active ? "admin.user.activated" : "admin.user.deactivated";
        return respond({ ok: true, message: active ? "User activated." : "User deactivated." });
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
        if (principal.roles.includes("guest")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Guest users cannot edit local account profile." }, 403);
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
        return respond({ ok: true, message: "Schema migrations completed", ...result });
      }

      if (pathname === "/api/migrate" && request.method === "POST") {
        const result = await setupSchema(env);
        statusCode = 200;
        return respond({ ok: true, message: "Migrations executed", ...result });
      }

      if (pathname === "/api/regulations" && request.method === "GET") {
        const data = await fetchRegulations(env);
        statusCode = 200;
        return respond({ ok: true, ...data });
      }

      if (pathname === "/api/students" && request.method === "GET") {
        if (!principal || !canPerformAction(principal, "students.read")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Forbidden" }, 403);
        }
        const scope = resolveStudentScope(principal);
        const url = new URL(request.url);
        const data = await listStudentsByScope(env, scope, url.searchParams.get("limit"), url.searchParams.get("cursor"));
        statusCode = 200;
        return respond({ ok: true, ...data });
      }

      if (pathname === "/api/students/stats" && request.method === "GET") {
        if (!principal || !canPerformAction(principal, "students.stats.read")) {
          statusCode = 403;
          event = "request.forbidden";
          return respond({ ok: false, error: "Forbidden" }, 403);
        }
        const scope = resolveStudentScope(principal);
        const data = await getStudentStatsByScope(env, scope);
        statusCode = 200;
        return respond({ ok: true, ...data });
      }

      if (pathname === "/api/import/regulations-categories" && request.method === "POST") {
        if (!canPerformAction(principal, "imports.manage")) {
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
        await importRegulationsAndCategories(env, body.rows as CsvImportRow[]);
        statusCode = 200;
        return respond({ ok: true, imported: body.rows.length });
      }

      if (pathname === "/api/import/faculty" && request.method === "POST") {
        if (!canPerformAction(principal, "imports.manage")) {
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
        await importFaculty(env, body.rows as CsvImportRow[]);
        statusCode = 200;
        return respond({ ok: true, imported: body.rows.length });
      }

      if (pathname === "/api/import/students" && request.method === "POST") {
        if (!canPerformAction(principal, "imports.manage")) {
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
        await importStudents(env, body.rows as CsvImportRow[]);
        statusCode = 200;
        return respond({ ok: true, imported: body.rows.length });
      }

      if (pathname === "/api/import/plan-of-study" && request.method === "POST") {
        if (!canPerformAction(principal, "imports.manage")) {
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
        await importPlanOfStudy(env, body.rows as CsvImportRow[]);
        statusCode = 200;
        return respond({ ok: true, imported: body.rows.length });
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
          error: errorMessage
        },
        400
      );
    } finally {
      try {
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
      } catch {
        // Never fail request handling because logging failed.
      }
    }
  }
};
