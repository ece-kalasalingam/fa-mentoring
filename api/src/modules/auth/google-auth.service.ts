import { getDb } from "../../core/db";
import type { Env } from "../../core/types";
import type { AuthPrincipal } from "./identity";

const SESSION_HOURS = 12;
const PROVIDER_SUBJECT_SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;
let supportsProviderSubjectCache: { value: boolean; expiresAt: number } | null = null;

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown): string | null {
  const email = normalize(value).toLowerCase();
  return email || null;
}

function toBase64Url(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toBase64Url(new Uint8Array(digest));
}

async function safeRollback(db: ReturnType<typeof getDb>): Promise<void> {
  try {
    await db.execute("ROLLBACK");
  } catch {
    // Ignore rollback errors when no active transaction exists.
  }
}

async function safeCommit(db: ReturnType<typeof getDb>): Promise<void> {
  try {
    await db.execute("COMMIT");
  } catch {
    // Ignore commit errors when no active transaction exists.
    // Some SQLite/libSQL paths can auto-complete transaction boundaries.
  }
}

async function hasProviderSubjectColumn(db: ReturnType<typeof getDb>): Promise<boolean> {
  const now = Date.now();
  if (supportsProviderSubjectCache && supportsProviderSubjectCache.expiresAt > now) {
    return supportsProviderSubjectCache.value;
  }
  const columns = await db.execute("pragma table_info(user_accounts)");
  const value = columns.rows.some((row) => String(row.name ?? "").toLowerCase() === "provider_subject");
  supportsProviderSubjectCache = { value, expiresAt: now + PROVIDER_SUBJECT_SCHEMA_CACHE_TTL_MS };
  return value;
}

function parseAllowedClientIds(env: Env): Set<string> {
  const configured = normalize(env.GOOGLE_CLIENT_ID);
  const ids = configured.split(",").map((v) => normalize(v)).filter(Boolean);
  return new Set(ids);
}

type GoogleTokenInfo = {
  aud?: string;
  iss?: string;
  sub?: string;
  exp?: string;
  email?: string;
  email_verified?: string;
  name?: string;
};

async function verifyGoogleIdToken(env: Env, idToken: string): Promise<{ sub: string; email: string; fullName: string }> {
  const clientIds = parseAllowedClientIds(env);
  if (clientIds.size === 0) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }
  const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const res = await fetch(verifyUrl);
  if (!res.ok) {
    throw new Error("Invalid Google ID token.");
  }
  const payload = (await res.json()) as GoogleTokenInfo;
  const aud = normalize(payload.aud);
  const iss = normalize(payload.iss);
  const sub = normalize(payload.sub);
  const email = normalizeEmail(payload.email);
  const emailVerified = normalize(payload.email_verified).toLowerCase() === "true";
  const exp = Number(payload.exp ?? 0);
  const now = Math.floor(Date.now() / 1000);
  if (!sub || !email || !emailVerified) {
    throw new Error("Google account must provide a verified email.");
  }
  if (!aud || !clientIds.has(aud)) {
    throw new Error("Google token audience mismatch.");
  }
  if (iss !== "https://accounts.google.com" && iss !== "accounts.google.com") {
    throw new Error("Google token issuer mismatch.");
  }
  if (!exp || exp <= now) {
    throw new Error("Google token has expired.");
  }
  const fullName = normalize(payload.name) || email;
  return { sub, email, fullName };
}

async function resolveAccountIdByGoogleIdentity(env: Env, subject: string, email: string): Promise<string | null> {
  const db = getDb(env);
  const supportsProviderSubject = await hasProviderSubjectColumn(db);
  if (supportsProviderSubject) {
    const byProviderSubject = await db.execute({
      sql: `select id from user_accounts where active = 1 and provider = 'google' and provider_subject = ? limit 1`,
      args: [subject]
    });
    if (byProviderSubject.rows.length > 0) {
      return String(byProviderSubject.rows[0]?.id ?? "") || null;
    }
  }

  const byProviderSubjectFallback = await db.execute({
    sql: `select id from user_accounts where active = 1 and provider = 'google' and subject = ? limit 1`,
    args: [email]
  });
  if (byProviderSubjectFallback.rows.length > 0) {
    return String(byProviderSubjectFallback.rows[0]?.id ?? "") || null;
  }

  const byEmail = await db.execute({
    sql: `select id from user_accounts where active = 1 and email = ? limit 1`,
    args: [email]
  });
  if (byEmail.rows.length > 0) {
    return String(byEmail.rows[0]?.id ?? "") || null;
  }

  return null;
}

async function upsertGoogleAccount(env: Env, googleSubject: string, email: string, fullName: string): Promise<string> {
  const db = getDb(env);
  const supportsProviderSubject = await hasProviderSubjectColumn(db);
  await db.execute("BEGIN");
  try {
    const existingId = await resolveAccountIdByGoogleIdentity(env, googleSubject, email);
    if (!existingId) {
      const accountId = crypto.randomUUID();
      if (supportsProviderSubject) {
        await db.execute({
          sql: `insert into user_accounts(id, provider, provider_subject, subject, email, full_name, roles_json, permissions_json, is_admin, is_superuser, active, created_at, updated_at, last_login_at)
                values(?, 'google', ?, ?, ?, ?, '["guest"]', '[]', 0, 0, 1, current_timestamp, current_timestamp, current_timestamp)`,
          args: [accountId, googleSubject, email, email, fullName]
        });
      } else {
        await db.execute({
          sql: `insert into user_accounts(id, provider, subject, email, full_name, roles_json, permissions_json, is_admin, is_superuser, active, created_at, updated_at, last_login_at)
                values(?, 'google', ?, ?, ?, '["guest"]', '[]', 0, 0, 1, current_timestamp, current_timestamp, current_timestamp)`,
          args: [accountId, email, email, fullName]
        });
      }
      await safeCommit(db);
      return accountId;
    }

    if (supportsProviderSubject) {
      await db.execute({
        sql: `update user_accounts
              set provider = 'google',
                  provider_subject = ?,
                  subject = ?,
                  email = coalesce(?, email),
                  full_name = coalesce(?, full_name),
                  active = 1,
                  updated_at = current_timestamp,
                  last_login_at = current_timestamp
              where id = ?`,
        args: [googleSubject, email, email, fullName, existingId]
      });
    } else {
      await db.execute({
        sql: `update user_accounts
              set provider = 'google',
                  subject = ?,
                  email = coalesce(?, email),
                  full_name = coalesce(?, full_name),
                  active = 1,
                  updated_at = current_timestamp,
                  last_login_at = current_timestamp
              where id = ?`,
        args: [email, email, fullName, existingId]
      });
    }
    await safeCommit(db);
    return existingId;
  } catch (error) {
    await safeRollback(db);
    throw error;
  }
}

async function loadPrincipalForAccount(env: Env, accountId: string): Promise<AuthPrincipal> {
  const db = getDb(env);
  const supportsProviderSubject = await hasProviderSubjectColumn(db);
  const res = await db.execute({
    sql: `select
            provider,
            subject,
            ${supportsProviderSubject ? "provider_subject" : "null"} as provider_subject,
            email,
            full_name,
            roles_json,
            permissions_json
          from user_accounts
          where id = ? and active = 1
          limit 1`,
    args: [accountId]
  });
  if (res.rows.length === 0) {
    throw new Error("User account not found.");
  }
  const row = res.rows[0];
  return {
    subject: String(row.provider_subject ?? row.subject ?? ""),
    email: row.email ? String(row.email) : undefined,
    fullName: row.full_name ? String(row.full_name) : undefined,
    roles: JSON.parse(String(row.roles_json ?? "[]")) as AuthPrincipal["roles"],
    permissions: JSON.parse(String(row.permissions_json ?? "[]")) as string[],
    provider: String(row.provider ?? "google")
  };
}

async function createSessionForAccount(env: Env, userAccountId: string): Promise<string> {
  const db = getDb(env);
  const tokenRaw = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(tokenRaw);
  await db.execute({
    sql: "update auth_sessions set revoked_at = current_timestamp where user_account_id = ? and revoked_at is null",
    args: [userAccountId]
  });
  await db.execute({
    sql: "insert into auth_sessions(user_account_id, token_hash, expires_at) values(?, ?, datetime('now', ?))",
    args: [userAccountId, tokenHash, `+${SESSION_HOURS} hours`]
  });
  return tokenRaw;
}

export async function loginWithGoogleIdToken(env: Env, idToken: string): Promise<{ token: string; expiresInHours: number; principal: AuthPrincipal }> {
  const normalizedToken = normalize(idToken);
  if (!normalizedToken) {
    throw new Error("Google ID token is required.");
  }
  const { sub, email, fullName } = await verifyGoogleIdToken(env, normalizedToken);
  const accountId = await upsertGoogleAccount(env, sub, email, fullName);
  const principal = await loadPrincipalForAccount(env, accountId);
  const token = await createSessionForAccount(env, accountId);
  return { token, expiresInHours: SESSION_HOURS, principal };
}
