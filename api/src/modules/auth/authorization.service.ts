import type { Env } from "../../core/types";
import type { AuthPrincipal, AuthRole } from "./identity";

export type AuthAction =
  | "students.read"
  | "students.stats.read"
  | "imports.manage"
  | "logs.read"
  | "setup.manage"
  | "account.self.manage";

export type StudentScope =
  | { type: "all" }
  | { type: "mentor"; mentorEmail: string }
  | { type: "self"; studentEmail: string }
  | { type: "none" };

const ROLE_ACTIONS: Record<AuthRole, readonly AuthAction[]> = {
  admin: ["students.read", "students.stats.read", "imports.manage", "logs.read", "setup.manage", "account.self.manage"],
  moderator: ["students.read", "imports.manage", "account.self.manage"],
  head: ["students.read", "students.stats.read", "account.self.manage"],
  faculty: ["students.read", "students.stats.read", "account.self.manage"],
  student: ["students.read", "account.self.manage"],
  guest: []
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function derivePrincipalEmail(principal: AuthPrincipal): string {
  if (principal.email?.trim()) {
    return normalizeEmail(principal.email);
  }
  const subject = principal.subject.trim().toLowerCase();
  if (subject.startsWith("local-")) {
    const candidate = subject.slice("local-".length);
    if (candidate.includes("@")) {
      return normalizeEmail(candidate);
    }
  }
  if (subject.includes("@")) {
    return normalizeEmail(subject);
  }
  return "";
}

export function canPerformAction(principal: AuthPrincipal | null, action: AuthAction): boolean {
  if (!principal) {
    return false;
  }
  if (principal.permissions.includes("*") || principal.permissions.includes(action)) {
    return true;
  }
  return principal.roles.some((role) => (ROLE_ACTIONS[role] ?? []).includes(action));
}

export function resolveStudentScope(principal: AuthPrincipal): StudentScope {
  if (principal.roles.includes("admin") || principal.roles.includes("head") || principal.roles.includes("moderator")) {
    return { type: "all" };
  }
  if (principal.roles.includes("faculty")) {
    const email = derivePrincipalEmail(principal);
    if (!email) {
      return { type: "none" };
    }
    return { type: "mentor", mentorEmail: email };
  }
  if (principal.roles.includes("student")) {
    const email = derivePrincipalEmail(principal);
    if (!email) {
      return { type: "none" };
    }
    return { type: "self", studentEmail: email };
  }
  return { type: "none" };
}

export function assertAction(principal: AuthPrincipal | null, action: AuthAction): void {
  if (!canPerformAction(principal, action)) {
    throw new Error("Forbidden");
  }
}

export function isDevMode(env: Env): boolean {
  return String(env.AUTH_PROVIDER ?? "").toLowerCase() !== "password-session";
}
