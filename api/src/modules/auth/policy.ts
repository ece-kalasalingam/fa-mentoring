import type { AuthPrincipal, AuthRole } from "./identity";

export type AccessPolicy = {
  anyRole?: AuthRole[];
  anyPermission?: string[];
};

const OPEN_POLICY: AccessPolicy = {};

const ROUTE_POLICIES: Record<string, AccessPolicy> = {
  "GET /": OPEN_POLICY,
  "GET /api/health": OPEN_POLICY,
  "GET /api/setup-status": OPEN_POLICY,
  "GET /api/admin/dashboard": { anyRole: ["admin"] },
  "GET /api/admin/active-users": { anyRole: ["admin"] },
  "GET /api/admin/login-attempts": { anyRole: ["admin"] },
  "GET /api/admin/users": { anyRole: ["admin"] },
  "POST /api/admin/users": { anyRole: ["admin"] },
  "POST /api/admin/users/update": { anyRole: ["admin"] },
  "POST /api/admin/users/reset-password": { anyRole: ["admin"] },
  "POST /api/admin/users/set-active": { anyRole: ["admin"] },
  "POST /api/admin/users/logout-all-sessions": { anyRole: ["admin"] },
  "GET /api/startup-warnings": OPEN_POLICY,
  "GET /api/setup/wizard-status": OPEN_POLICY,
  "POST /api/setup/check-connections": OPEN_POLICY,
  "POST /api/setup/run-migrations": OPEN_POLICY,
  "POST /api/setup/run-mitigations": { anyRole: ["admin"] },
  "POST /api/setup/seed-data": OPEN_POLICY,
  "POST /api/setup/create-super-admin": OPEN_POLICY,
  "POST /api/setup/reset-state": { anyRole: ["admin"] },
  "GET /api/debug-env": { anyRole: ["admin"] },
  "GET /api/logs": { anyRole: ["admin"] },
  "POST /api/logs/clear": { anyRole: ["admin"] },
  "GET /api/auth/csrf": { anyRole: ["guest", "student", "faculty", "head", "moderator", "admin"] },
  "POST /api/auth/login": OPEN_POLICY,
  "POST /api/auth/logout": { anyRole: ["guest", "student", "faculty", "head", "moderator", "admin"] },
  "POST /api/auth/logout-other-sessions": { anyRole: ["student", "faculty", "head", "moderator", "admin"] },
  "GET /api/auth/other-sessions-count": { anyRole: ["student", "faculty", "head", "moderator", "admin"] },
  "GET /api/auth/sessions": { anyRole: ["student", "faculty", "head", "moderator", "admin"] },
  "POST /api/auth/set-password": { anyRole: ["admin"] },
  "POST /api/auth/change-password": { anyRole: ["faculty", "head", "moderator", "admin"] },
  "GET /api/auth/me": { anyRole: ["guest", "student", "faculty", "head", "moderator", "admin"] },
  "GET /api/auth/my-account": { anyRole: ["guest", "student", "faculty", "head", "moderator", "admin"] },
  "POST /api/auth/my-account": { anyRole: ["faculty", "head", "moderator", "admin"] },
  "POST /api/setup": { anyRole: ["admin"] },
  "POST /api/migrate": { anyRole: ["admin"] },
  "GET /api/regulations": { anyRole: ["student", "faculty", "head", "moderator", "admin"] },
  "GET /api/plans-of-study": { anyRole: ["student", "faculty", "head", "moderator", "admin"] },
  "GET /api/programmes": { anyRole: ["head", "moderator", "admin"] },
  "GET /api/students": { anyRole: ["student", "faculty", "head", "moderator", "admin"] },
  "GET /api/students-directory": { anyRole: ["head", "moderator", "admin"] },
  "POST /api/students-directory/update": { anyRole: ["head", "moderator", "admin"] },
  "GET /api/students/stats": { anyRole: ["faculty", "head", "admin"] },
  "POST /api/import/students": { anyRole: ["moderator", "admin"] }
};

function hasIntersection(left: string[], right: string[]): boolean {
  const set = new Set(left.map((item) => item.toLowerCase()));
  return right.some((item) => set.has(item.toLowerCase()));
}

export function getAccessPolicy(method: string, pathname: string): AccessPolicy {
  return ROUTE_POLICIES[`${method.toUpperCase()} ${pathname}`] ?? OPEN_POLICY;
}

export function isAuthorized(principal: AuthPrincipal | null, policy: AccessPolicy): boolean {
  const roleRequirement = policy.anyRole ?? [];
  const permissionRequirement = policy.anyPermission ?? [];
  const requiresAuth = roleRequirement.length > 0 || permissionRequirement.length > 0;

  if (!requiresAuth) {
    return true;
  }
  if (!principal) {
    return false;
  }
  if (principal.permissions.includes("*")) {
    return true;
  }
  if (roleRequirement.length > 0 && hasIntersection(principal.roles, roleRequirement)) {
    return true;
  }
  if (permissionRequirement.length > 0 && hasIntersection(principal.permissions, permissionRequirement)) {
    return true;
  }
  return false;
}
