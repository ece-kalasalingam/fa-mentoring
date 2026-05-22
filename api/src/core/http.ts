import type { Env } from "./types";

type CorsPolicy = {
  allowedOrigin: string;
  allowCredentials: boolean;
};

function resolveCorsPolicy(request: Request, env: Env): CorsPolicy {
  const requestOrigin = request.headers.get("origin") ?? "";
  const configured = String(env.FRONTEND_ORIGIN ?? "").trim();
  const requestUrl = new URL(request.url);
  const requestHost = requestUrl.hostname.toLowerCase();
  const requestOriginHost = requestOrigin ? new URL(requestOrigin).hostname.toLowerCase() : "";
  if (!configured) {
    const isLocalApiHost = requestHost === "localhost" || requestHost === "127.0.0.1";
    const isLocalFrontendOrigin = requestOriginHost === "localhost" || requestOriginHost === "127.0.0.1";
    if (isLocalApiHost && isLocalFrontendOrigin && requestOrigin) {
      return { allowedOrigin: requestOrigin, allowCredentials: true };
    }
    return { allowedOrigin: "null", allowCredentials: false };
  }
  const allowedOrigins = configured.split(",").map((item) => item.trim()).filter(Boolean);
  if (allowedOrigins.includes(requestOrigin)) {
    return { allowedOrigin: requestOrigin, allowCredentials: true };
  }
  const isLocalApiHost = requestHost === "localhost" || requestHost === "127.0.0.1";
  const isLocalFrontendOrigin = requestOriginHost === "localhost" || requestOriginHost === "127.0.0.1";
  if (isLocalApiHost && isLocalFrontendOrigin && requestOrigin) {
    return { allowedOrigin: requestOrigin, allowCredentials: true };
  }
  return { allowedOrigin: allowedOrigins[0] ?? "null", allowCredentials: true };
}

export function json(data: unknown, status = 200, request?: Request, env?: Env, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: buildCorsAwareHeaders(request, env, {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    }),
  });
}

export function buildCorsAwareHeaders(
  request?: Request,
  env?: Env,
  extraHeaders?: Record<string, string>,
): Record<string, string> {
  const corsPolicy = request && env
    ? resolveCorsPolicy(request, env)
    : { allowedOrigin: "null", allowCredentials: false };
  const isHttps = request ? new URL(request.url).protocol === "https:" : false;
  return {
    "access-control-allow-origin": corsPolicy.allowedOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-csrf-token",
    "access-control-allow-credentials": corsPolicy.allowCredentials ? "true" : "false",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    ...(isHttps ? { "strict-transport-security": "max-age=31536000; includeSubDomains; preload" } : {}),
    vary: "origin",
    ...extraHeaders,
  };
}
