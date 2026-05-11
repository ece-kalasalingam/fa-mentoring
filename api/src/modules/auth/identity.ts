import type { Env } from "../../core/types";
import { getAuthCookieName } from "./cookie-config";
import { resolveSessionPrincipal } from "./password-auth.service";

export type AuthRole = "admin" | "head" | "faculty" | "student" | "guest" | "moderator";

export type AuthPrincipal = {
  subject: string;
  email?: string;
  fullName?: string;
  roles: AuthRole[];
  permissions: string[];
  provider: string;
};

export type IdentityProvider = {
  name: string;
  authenticate(request: Request, env: Env): Promise<AuthPrincipal | null>;
};

type StaticTokenRecord = {
  token: string;
  subject: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
};

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function toRoles(roles: unknown): AuthRole[] {
  const allowed = new Set<AuthRole>(["admin", "head", "faculty", "student", "guest", "moderator"]);
  const values = Array.isArray(roles) ? roles.map((role) => normalize(role).toLowerCase()) : [];
  return values.filter((role): role is AuthRole => allowed.has(role as AuthRole));
}

function toPermissions(permissions: unknown): string[] {
  return Array.isArray(permissions)
    ? permissions.map((permission) => normalize(permission).toLowerCase()).filter(Boolean)
    : [];
}

export function parseBearerToken(request: Request): string {
  const header = normalize(request.headers.get("authorization"));
  const parts = header.split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return "";
  }
  return parts[1];
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

function parseSessionToken(request: Request, env: Env): string {
  return parseBearerToken(request) || parseCookieToken(request, getAuthCookieName(env));
}

function getStaticTokenRecords(env: Env): StaticTokenRecord[] {
  const raw = normalize(env.AUTH_STATIC_TOKENS_JSON);
  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AUTH_STATIC_TOKENS_JSON is not valid JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AUTH_STATIC_TOKENS_JSON must be a JSON array");
  }

  return parsed.map((item) => item as StaticTokenRecord);
}

function staticBearerProvider(): IdentityProvider {
  return {
    name: "static-bearer",
    async authenticate(request: Request, env: Env): Promise<AuthPrincipal | null> {
      const token = parseBearerToken(request);
      if (!token) {
        return null;
      }

      const records = getStaticTokenRecords(env);
      const record = records.find((item) => normalize(item.token) === token);
      if (!record) {
        return null;
      }

      return {
        subject: normalize(record.subject),
        email: normalize(record.email) || undefined,
        fullName: undefined,
        roles: toRoles(record.roles),
        permissions: toPermissions(record.permissions),
        provider: "static-bearer"
      };
    }
  };
}

function noAuthProvider(): IdentityProvider {
  return {
    name: "none",
    async authenticate(): Promise<AuthPrincipal | null> {
      return {
        subject: "anonymous",
        roles: ["guest"],
        permissions: [],
        provider: "none"
      };
    }
  };
}

export function createIdentityProvider(env: Env): IdentityProvider {
  const provider = normalize(env.AUTH_PROVIDER).toLowerCase();
  if (provider === "static-bearer") {
    return staticBearerProvider();
  }
  if (provider === "password-session") {
    return {
      name: "password-session",
      async authenticate(request: Request): Promise<AuthPrincipal | null> {
        const token = parseSessionToken(request, env);
        return resolveSessionPrincipal(env, token);
      }
    };
  }
  if (provider === "hybrid") {
    return {
      name: "hybrid",
      async authenticate(request: Request, envInput: Env): Promise<AuthPrincipal | null> {
        const staticPrincipal = await staticBearerProvider().authenticate(request, envInput);
        if (staticPrincipal) {
          return staticPrincipal;
        }
        const token = parseSessionToken(request, envInput);
        return resolveSessionPrincipal(envInput, token);
      }
    };
  }

  // Only allow insecure anonymous-admin auth when explicitly opted in.
  const allowInsecureNone = normalize(env.ALLOW_INSECURE_AUTH_NONE).toLowerCase() === "true";
  if (provider === "none" && allowInsecureNone) {
    return noAuthProvider();
  }

  // Safe default for production/dev: no implicit admin fallback.
  return {
    name: provider || "password-session",
    async authenticate(): Promise<AuthPrincipal | null> {
      return null;
    }
  };
}
