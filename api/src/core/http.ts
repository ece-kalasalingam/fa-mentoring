import type { Env } from "./types";

function resolveAllowedOrigin(request: Request, env: Env): string {
  const requestOrigin = request.headers.get("origin") ?? "";
  const configured = String(env.FRONTEND_ORIGIN ?? "").trim();
  if (!configured) {
    return requestOrigin || "*";
  }
  const allowedOrigins = configured.split(",").map((item) => item.trim()).filter(Boolean);
  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  return allowedOrigins[0];
}

export function json(data: unknown, status = 200, request?: Request, env?: Env, extraHeaders?: Record<string, string>) {
  const allowedOrigin = request && env ? resolveAllowedOrigin(request, env) : "*";
  const isHttps = request ? new URL(request.url).protocol === "https:" : false;
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": allowedOrigin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type, authorization, x-csrf-token",
      "access-control-allow-credentials": "true",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      ...(isHttps ? { "strict-transport-security": "max-age=31536000; includeSubDomains; preload" } : {}),
      vary: "origin",
      ...extraHeaders
    }
  });
}
