import type { Env } from "../../core/types";

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(normalize(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAuthCookieName(env: Env): string {
  return normalize(env.AUTH_COOKIE_NAME) || "fa_session";
}

export function getSessionHours(env: Env): number {
  return toInt(env.AUTH_SESSION_HOURS, 12);
}

export function getSameSite(env: Env): "Lax" | "Strict" | "None" {
  const raw = normalize(env.AUTH_COOKIE_SAMESITE).toLowerCase();
  if (raw === "strict") return "Strict";
  if (raw === "none") return "None";
  return "Lax";
}

export function shouldUseSecureCookie(request: Request, env: Env): boolean {
  const configured = normalize(env.AUTH_COOKIE_SECURE).toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return new URL(request.url).protocol === "https:";
}

export function buildSessionCookie(env: Env, request: Request, token: string): string {
  const secure = shouldUseSecureCookie(request, env) ? "; Secure" : "";
  const maxAgeSeconds = getSessionHours(env) * 3600;
  const sameSite = getSameSite(env);
  const name = getAuthCookieName(env);
  return `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAgeSeconds}${secure}`;
}

export function buildClearSessionCookie(env: Env, request: Request): string {
  const secure = shouldUseSecureCookie(request, env) ? "; Secure" : "";
  const sameSite = getSameSite(env);
  const name = getAuthCookieName(env);
  return `${name}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secure}`;
}
