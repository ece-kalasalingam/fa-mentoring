import { createClient } from "@libsql/client";
import type { Env } from "./types";

export function requireDbEnv(env: Env) {
  const url = String(env.TURSO_DATABASE_URL ?? "").trim();
  const token = String(env.TURSO_AUTH_TOKEN ?? "").trim();

  if (!url) {
    throw new Error("Missing TURSO_DATABASE_URL. For local dev, add it in api/.dev.vars; for deployed worker, use wrangler secret put.");
  }
  if (!token) {
    throw new Error("Missing TURSO_AUTH_TOKEN. For local dev, add it in api/.dev.vars; for deployed worker, use wrangler secret put.");
  }

  return { url, token };
}

export function getDb(env: Env) {
  const dbEnv = requireDbEnv(env);
  return createClient({
    url: dbEnv.url,
    authToken: dbEnv.token
  });
}
