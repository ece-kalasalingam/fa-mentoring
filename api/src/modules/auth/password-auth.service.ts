import { getDb } from "../../core/db";
import type { Env } from "../../core/types";
import type { AuthPrincipal } from "./identity";
import { persistAuthenticatedAdmin, resolveUserAccountIdByPrincipal } from "./user-accounts.service";

// Cloudflare Workers WebCrypto PBKDF2 currently supports up to 100000 iterations.
const PASSWORD_ITERATIONS = 100000;
const SESSION_HOURS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_ATTEMPTS_PER_IP = 30;
const RATE_LIMIT_MAX_ATTEMPTS_PER_USERNAME = 15;
const PROVIDER_SUBJECT_SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;
let supportsProviderSubjectCache: { value: boolean; expiresAt: number } | null = null;

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

function toBase64Url(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toBase64Url(new Uint8Array(digest));
}

async function hashPassword(password: string, salt: Uint8Array, iterations = PASSWORD_ITERATIONS): Promise<string> {
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new Uint8Array(saltBuffer),
      iterations
    },
    key,
    256
  );
  return toBase64Url(new Uint8Array(bits));
}

function secureEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) {
    return "Password must be at least 12 characters.";
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "Password must include upper, lower, number, and symbol.";
  }
  return null;
}

function randomPassword(length = 20): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

async function pruneAttempts(env: Env): Promise<void> {
  const db = getDb(env);
  const supportsProviderSubject = await hasProviderSubjectColumn(db);
  await db.execute("delete from auth_login_attempts where attempted_at < datetime('now', '-7 days')");
}

async function recordAttempt(env: Env, username: string, ipHash: string, ipAddress: string, success: boolean): Promise<void> {
  const db = getDb(env);
  await db.execute({
    sql: "insert into auth_login_attempts(username, ip_hash, ip_address, success) values(?, ?, ?, ?)",
    args: [username.toLowerCase(), ipHash, ipAddress || null, success ? 1 : 0]
  });
}

async function enforceRateLimits(env: Env, username: string, ipHash: string): Promise<void> {
  const db = getDb(env);
  const ipRes = await db.execute({
    sql: "select count(*) as count from auth_login_attempts where ip_hash = ? and attempted_at >= datetime('now', ?)",
    args: [ipHash, `-${RATE_LIMIT_WINDOW_MINUTES} minutes`]
  });
  const userRes = await db.execute({
    sql: "select count(*) as count from auth_login_attempts where username = ? and attempted_at >= datetime('now', ?)",
    args: [username.toLowerCase(), `-${RATE_LIMIT_WINDOW_MINUTES} minutes`]
  });
  const ipCount = Number(ipRes.rows[0]?.count ?? 0);
  const userCount = Number(userRes.rows[0]?.count ?? 0);
  if (ipCount >= RATE_LIMIT_MAX_ATTEMPTS_PER_IP || userCount >= RATE_LIMIT_MAX_ATTEMPTS_PER_USERNAME) {
    throw new Error("Too many login attempts. Try again later.");
  }
}

export async function setLocalPasswordForPrincipal(env: Env, principal: AuthPrincipal, username: string, password: string) {
  if (!principal.roles.includes("admin")) {
    throw new Error("Only admin can set local credentials.");
  }
  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername) {
    throw new Error("Username is required.");
  }
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  await persistAuthenticatedAdmin(env, principal);
  const db = getDb(env);
  const userAccountId = await resolveUserAccountIdByPrincipal(env, principal);
  if (!userAccountId) {
    throw new Error("Unable to resolve user account.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(password, salt);
  const saltEncoded = toBase64Url(salt);

  await db.execute({
    sql: `insert into auth_credentials(user_account_id, username, password_hash, password_salt, password_iterations, failed_attempts, locked_until, active, updated_at, password_changed_at)
          values(?, ?, ?, ?, ?, 0, null, 1, current_timestamp, current_timestamp)
          on conflict(user_account_id) do update set
            username = excluded.username,
            password_hash = excluded.password_hash,
            password_salt = excluded.password_salt,
            password_iterations = excluded.password_iterations,
            failed_attempts = 0,
            locked_until = null,
            active = 1,
            updated_at = current_timestamp,
            password_changed_at = current_timestamp`,
    args: [userAccountId, normalizedUsername, passwordHash, saltEncoded, PASSWORD_ITERATIONS]
  });
}

export async function changeOwnPassword(env: Env, principal: AuthPrincipal, currentPassword: string, newPassword: string): Promise<void> {
  if (principal.roles.includes("guest")) {
    throw new Error("Guest users cannot set a local password.");
  }
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    throw new Error(passwordError);
  }
  const db = getDb(env);
  const userAccountId = await resolveUserAccountIdByPrincipal(env, principal);
  if (!userAccountId) {
    throw new Error("Local credentials not found for this account.");
  }
  const res = await db.execute({
    sql: `select
            ua.id as user_account_id,
            ac.password_hash as password_hash,
            ac.password_salt as password_salt,
            ac.password_iterations as password_iterations
          from user_accounts ua
          join auth_credentials ac on ac.user_account_id = ua.id
          where ua.id = ? and ua.active = 1 and ac.active = 1
          limit 1`,
    args: [userAccountId]
  });
  if (res.rows.length === 0) {
    throw new Error("Local credentials not found for this account.");
  }
  const row = res.rows[0];
  const salt = fromBase64Url(String(row.password_salt));
  const iterations = Number(row.password_iterations);
  const candidate = await hashPassword(currentPassword, salt, iterations);
  if (!secureEquals(candidate, String(row.password_hash))) {
    throw new Error("Current password is incorrect.");
  }

  const newSalt = crypto.getRandomValues(new Uint8Array(16));
  const newHash = await hashPassword(newPassword, newSalt, PASSWORD_ITERATIONS);
  await db.execute({
    sql: `update auth_credentials
          set password_hash = ?, password_salt = ?, password_iterations = ?, failed_attempts = 0, locked_until = null, updated_at = current_timestamp, password_changed_at = current_timestamp
          where user_account_id = ?`,
    args: [newHash, toBase64Url(newSalt), PASSWORD_ITERATIONS, row.user_account_id]
  });
}

export async function loginWithPassword(env: Env, username: string, password: string, ipAddress: string) {
  const normalizedUsername = username.trim().toLowerCase();
  const ipHash = await sha256(ipAddress || "unknown");

  await pruneAttempts(env);
  await enforceRateLimits(env, normalizedUsername, ipHash);

  const db = getDb(env);
  const supportsProviderSubject = await hasProviderSubjectColumn(db);
  const res = await db.execute({
    sql: `select
            ua.id as user_account_id,
            ua.provider as provider,
            ua.subject as subject,
            ${supportsProviderSubject ? "ua.provider_subject" : "null"} as provider_subject,
            ua.email as email,
            ua.full_name as full_name,
            ua.is_superuser as is_superuser,
            ua.roles_json as roles_json,
            ua.permissions_json as permissions_json,
            ac.password_hash as password_hash,
            ac.password_salt as password_salt,
            ac.password_iterations as password_iterations,
            ac.failed_attempts as failed_attempts,
            ac.locked_until as locked_until
          from auth_credentials ac
          join user_accounts ua on ua.id = ac.user_account_id
          where ac.username = ? and ac.active = 1 and ua.active = 1
          limit 1`,
    args: [normalizedUsername]
  });

  if (res.rows.length === 0) {
    await recordAttempt(env, normalizedUsername, ipHash, ipAddress, false);
    throw new Error("Invalid username or password.");
  }

  const row = res.rows[0];
  const isSuperuser = Number(row.is_superuser ?? 0) === 1;
  if (!isSuperuser && !String(row.full_name ?? "").trim()) {
    throw new Error("Full name is required for this account. Please contact superuser.");
  }
  const lockedUntil = row.locked_until ? String(row.locked_until) : null;
  if (lockedUntil) {
    const lockRes = await db.execute({
      sql: "select datetime('now') < datetime(?) as is_locked",
      args: [lockedUntil]
    });
    if (Number(lockRes.rows[0]?.is_locked ?? 0) === 1) {
      await recordAttempt(env, normalizedUsername, ipHash, ipAddress, false);
      throw new Error("Account temporarily locked. Try again later.");
    }
  }

  const salt = fromBase64Url(String(row.password_salt));
  const iterations = Number(row.password_iterations);
  const candidate = await hashPassword(password, salt, iterations);
  const stored = String(row.password_hash);

  if (!secureEquals(candidate, stored)) {
    const failedAttempts = Number(row.failed_attempts ?? 0) + 1;
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await db.execute({
        sql: "update auth_credentials set failed_attempts = 0, locked_until = datetime('now', ?), updated_at = current_timestamp where user_account_id = ?",
        args: [`+${LOCK_MINUTES} minutes`, row.user_account_id]
      });
    } else {
      await db.execute({
        sql: "update auth_credentials set failed_attempts = ?, updated_at = current_timestamp where user_account_id = ?",
        args: [failedAttempts, row.user_account_id]
      });
    }
    await recordAttempt(env, normalizedUsername, ipHash, ipAddress, false);
    throw new Error("Invalid username or password.");
  }

  await db.execute({
    sql: "update auth_credentials set failed_attempts = 0, locked_until = null, updated_at = current_timestamp where user_account_id = ?",
    args: [row.user_account_id]
  });
  await db.execute({
    sql: "update user_accounts set last_login_at = current_timestamp, updated_at = current_timestamp where id = ?",
    args: [row.user_account_id]
  });
  await recordAttempt(env, normalizedUsername, ipHash, ipAddress, true);

  const tokenRaw = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(tokenRaw);
  // Enforce single-session policy: revoke any existing active sessions
  // for this account before issuing a new one.
  await db.execute({
    sql: "update auth_sessions set revoked_at = current_timestamp where user_account_id = ? and revoked_at is null",
    args: [row.user_account_id]
  });
  await db.execute({
    sql: "insert into auth_sessions(user_account_id, token_hash, expires_at) values(?, ?, datetime('now', ?))",
    args: [row.user_account_id, tokenHash, `+${SESSION_HOURS} hours`]
  });

  return {
    token: tokenRaw,
    expiresInHours: SESSION_HOURS,
    principal: {
      subject: String(row.provider_subject ?? row.subject),
      email: row.email ? String(row.email) : undefined,
      fullName: row.full_name ? String(row.full_name) : undefined,
      roles: JSON.parse(String(row.roles_json)) as string[],
      permissions: JSON.parse(String(row.permissions_json)) as string[],
      provider: String(row.provider)
    }
  };
}

export async function revokeSessionToken(env: Env, token: string): Promise<void> {
  if (!token) {
    return;
  }
  const db = getDb(env);
  const tokenHash = await sha256(token);
  await db.execute({
    sql: "update auth_sessions set revoked_at = current_timestamp where token_hash = ? and revoked_at is null",
    args: [tokenHash]
  });
}

export async function revokeOtherSessionsForPrincipal(env: Env, principal: AuthPrincipal, currentToken: string): Promise<number> {
  if (!currentToken) {
    return 0;
  }
  const db = getDb(env);
  const userAccountId = await resolveUserAccountIdByPrincipal(env, principal);
  if (!userAccountId) {
    return 0;
  }
  const tokenHash = await sha256(currentToken);
  const countRes = await db.execute({
    sql: `select count(*) as count
          from auth_sessions
          where user_account_id = ?
            and revoked_at is null
            and datetime(expires_at) > datetime('now')
            and token_hash != ?`,
    args: [userAccountId, tokenHash]
  });
  const revokedCount = Number(countRes.rows[0]?.count ?? 0);
  if (revokedCount <= 0) {
    return 0;
  }
  await db.execute({
    sql: "update auth_sessions set revoked_at = current_timestamp where user_account_id = ? and revoked_at is null and token_hash != ?",
    args: [userAccountId, tokenHash]
  });
  return revokedCount;
}

export async function countOtherSessionsForPrincipal(env: Env, principal: AuthPrincipal, currentToken: string): Promise<number> {
  if (!currentToken) {
    return 0;
  }
  const db = getDb(env);
  const userAccountId = await resolveUserAccountIdByPrincipal(env, principal);
  if (!userAccountId) {
    return 0;
  }
  const tokenHash = await sha256(currentToken);
  const countRes = await db.execute({
    sql: `select count(*) as count
          from auth_sessions
          where user_account_id = ?
            and revoked_at is null
            and datetime(expires_at) > datetime('now')
            and token_hash != ?`,
    args: [userAccountId, tokenHash]
  });
  return Number(countRes.rows[0]?.count ?? 0);
}

export type PrincipalSessionRow = {
  id: string;
  createdAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string | null;
  isCurrent: boolean;
};

export async function listActiveSessionsForPrincipal(env: Env, principal: AuthPrincipal, currentToken: string): Promise<PrincipalSessionRow[]> {
  if (!currentToken) {
    return [];
  }
  const db = getDb(env);
  const userAccountId = await resolveUserAccountIdByPrincipal(env, principal);
  if (!userAccountId) {
    return [];
  }
  const tokenHash = await sha256(currentToken);
  const res = await db.execute({
    sql: `select id, created_at, last_seen_at, expires_at, token_hash
          from auth_sessions
          where user_account_id = ?
            and revoked_at is null
            and datetime(expires_at) > datetime('now')
          order by datetime(last_seen_at) desc, datetime(created_at) desc`,
    args: [userAccountId]
  });
  return res.rows.map((row) => ({
    id: String(row.id ?? ""),
    createdAt: row.created_at ? String(row.created_at) : null,
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    isCurrent: String(row.token_hash ?? "") === tokenHash
  }));
}

export async function resolveSessionPrincipal(env: Env, token: string): Promise<AuthPrincipal | null> {
  if (!token) {
    return null;
  }
  const db = getDb(env);
  const supportsProviderSubject = await hasProviderSubjectColumn(db);
  const tokenHash = await sha256(token);
  let res;
  try {
    res = await db.execute({
      sql: `select
            ua.id as user_account_id,
            ua.subject as subject,
            ${supportsProviderSubject ? "ua.provider_subject" : "null"} as provider_subject,
            ua.provider as provider,
            ua.email as email,
            ua.full_name as full_name,
            ua.is_superuser as is_superuser,
            ua.roles_json as roles_json,
            ua.permissions_json as permissions_json
            from auth_sessions s
            join user_accounts ua on ua.id = s.user_account_id
            where s.token_hash = ?
              and s.revoked_at is null
              and datetime(s.expires_at) > datetime('now')
              and ua.active = 1
            limit 1`,
      args: [tokenHash]
    });
  } catch {
    // During first-run/bootstrap (or manual table resets), auth tables may not exist yet.
    // Fail-safe to anonymous unauthenticated state so setup wizard can proceed.
    return null;
  }
  if (res.rows.length === 0) {
    return null;
  }

  try {
    // Throttle write pressure: refresh last_seen_at at most once every 30 minutes.
    await db.execute({
      sql: "update auth_sessions set last_seen_at = current_timestamp where token_hash = ? and datetime(last_seen_at) < datetime('now', '-30 minutes')",
      args: [tokenHash]
    });
    // Keep last_login_at fresh in DB for all authenticated roles.
    // Throttle to avoid excessive writes in Turso free tier.
    const userAccountId = String(res.rows[0]?.user_account_id ?? "");
    if (userAccountId) {
      await db.execute({
        sql: "update user_accounts set last_login_at = current_timestamp, updated_at = current_timestamp where id = ? and datetime(last_login_at) < datetime('now', '-30 minutes')",
        args: [userAccountId]
      });
    }
  } catch {
    // Non-fatal bookkeeping update.
  }

  const row = res.rows[0];
  const isSuperuser = Number(row.is_superuser ?? 0) === 1;
  if (!isSuperuser && !String(row.full_name ?? "").trim()) {
    return null;
  }
  return {
    subject: String(row.provider_subject ?? row.subject),
    email: row.email ? String(row.email) : undefined,
    fullName: row.full_name ? String(row.full_name) : undefined,
    roles: JSON.parse(String(row.roles_json)) as AuthPrincipal["roles"],
    permissions: JSON.parse(String(row.permissions_json)) as string[],
    provider: String(row.provider)
  };
}

export async function createBootstrapLocalAdmin(env: Env): Promise<{ username: string; password: string } | null> {
  const db = getDb(env);
  const existing = await db.execute("select count(*) as count from auth_credentials");
  if (Number(existing.rows[0]?.count ?? 0) > 0) {
    return null;
  }

  const username = "admin";
  const password = randomPassword(22);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(password, salt);
  const saltEncoded = toBase64Url(salt);

  await db.execute("BEGIN");
  try {
    const accountId = crypto.randomUUID();
    const supportsProviderSubject = await hasProviderSubjectColumn(db);
    if (supportsProviderSubject) {
      await db.execute({
        sql: `insert into user_accounts(id, provider, provider_subject, subject, email, full_name, roles_json, permissions_json, is_admin, is_superuser, active, updated_at, last_login_at)
              values(?, 'local', 'local:admin', 'local:admin', null, 'Super Admin', ?, ?, 1, 1, 1, current_timestamp, current_timestamp)`,
        args: [accountId, JSON.stringify(["admin"]), JSON.stringify(["*"])]
      });
    } else {
      await db.execute({
        sql: `insert into user_accounts(id, provider, subject, email, full_name, roles_json, permissions_json, is_admin, is_superuser, active, updated_at, last_login_at)
              values(?, 'local', 'local-admin', null, 'Super Admin', ?, ?, 1, 1, 1, current_timestamp, current_timestamp)`,
        args: [accountId, JSON.stringify(["admin"]), JSON.stringify(["*"])]
      });
    }

    const accountRes = await db.execute({
      sql: "select id from user_accounts where id = ? limit 1",
      args: [accountId]
    });
    const userAccountId = String(accountRes.rows[0]?.id ?? "");
    if (!userAccountId) {
      throw new Error("Failed to create local admin account.");
    }

    await db.execute({
      sql: `insert into auth_credentials(user_account_id, username, password_hash, password_salt, password_iterations, failed_attempts, locked_until, active, updated_at, password_changed_at)
            values(?, ?, ?, ?, ?, 0, null, 1, current_timestamp, current_timestamp)`,
      args: [userAccountId, username, passwordHash, saltEncoded, PASSWORD_ITERATIONS]
    });

    await safeCommit(db);
    return { username, password };
  } catch (error) {
    await safeRollback(db);
    throw error;
  }
}

export async function hasAnyLocalCredential(env: Env): Promise<boolean> {
  const db = getDb(env);
  const existing = await db.execute("select count(*) as count from auth_credentials");
  return Number(existing.rows[0]?.count ?? 0) > 0;
}

export async function createLocalSuperAdmin(env: Env, username: string, password: string): Promise<void> {
  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername) {
    throw new Error("Username is required.");
  }
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const db = getDb(env);
  const supportsProviderSubject = await hasProviderSubjectColumn(db);
  const superRes = await db.execute("select id from user_accounts where is_superuser = 1 and active = 1 order by created_at asc limit 1");

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(password, salt);
  const saltEncoded = toBase64Url(salt);

  await db.execute("BEGIN");
  try {
    let userAccountId = String(superRes.rows[0]?.id ?? "");
    if (!userAccountId) {
      userAccountId = crypto.randomUUID();
      if (supportsProviderSubject) {
        await db.execute({
          sql: `insert into user_accounts(id, provider, provider_subject, subject, email, full_name, roles_json, permissions_json, is_admin, is_superuser, active, updated_at, last_login_at)
                values(?, 'local', ?, ?, null, ?, ?, ?, 1, 1, 1, current_timestamp, current_timestamp)`,
          args: [userAccountId, `local:${normalizedUsername}`, `local:${normalizedUsername}`, "Super Admin", JSON.stringify(["admin"]), JSON.stringify(["*"])]
        });
      } else {
        await db.execute({
          sql: `insert into user_accounts(id, provider, subject, email, full_name, roles_json, permissions_json, is_admin, is_superuser, active, updated_at, last_login_at)
                values(?, 'local', ?, null, ?, ?, ?, 1, 1, 1, current_timestamp, current_timestamp)`,
          args: [userAccountId, `local-${normalizedUsername}`, "Super Admin", JSON.stringify(["admin"]), JSON.stringify(["*"])]
        });
      }
    }

    await db.execute({
      sql: `insert into auth_credentials(user_account_id, username, password_hash, password_salt, password_iterations, failed_attempts, locked_until, active, updated_at, password_changed_at)
            values(?, ?, ?, ?, ?, 0, null, 1, current_timestamp, current_timestamp)
            on conflict(user_account_id) do update set
              username = excluded.username,
              password_hash = excluded.password_hash,
              password_salt = excluded.password_salt,
              password_iterations = excluded.password_iterations,
              failed_attempts = 0,
              locked_until = null,
              active = 1,
              updated_at = current_timestamp,
              password_changed_at = current_timestamp`,
      args: [userAccountId, normalizedUsername, passwordHash, saltEncoded, PASSWORD_ITERATIONS]
    });
    await safeCommit(db);
  } catch (error) {
    await safeRollback(db);
    throw error;
  }
}

function normalizeRole(input: string): string {
  const role = String(input ?? "").trim().toLowerCase();
  const allowed = new Set(["admin", "moderator", "head", "faculty", "student", "guest"]);
  if (!allowed.has(role)) {
    throw new Error("Invalid role.");
  }
  return role;
}

function normalizeRoles(input: unknown): string[] {
  const list = Array.isArray(input) ? input : [];
  const normalized = list
    .map((role) => normalizeRole(String(role ?? "")))
    .filter((role, index, arr) => arr.indexOf(role) === index);
  return normalized.length > 0 ? normalized : ["guest"];
}

export async function createLocalUserByAdmin(
  env: Env,
  principal: AuthPrincipal,
  payload: { username: string; password: string; role?: string; roles?: unknown[]; fullName: string; email?: string }
): Promise<void> {
  if (!principal.roles.includes("admin")) {
    throw new Error("Admin access required.");
  }

  const username = String(payload.username ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");
  const normalizedRoles = Array.isArray(payload.roles) && payload.roles.length > 0
    ? normalizeRoles(payload.roles)
    : [normalizeRole(String(payload.role ?? ""))];
  const isAdmin = normalizedRoles.includes("admin");
  const fullName = String(payload.fullName ?? "").trim();
  const emailRaw = String(payload.email ?? "").trim().toLowerCase();
  const usernameAsEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username) ? username : "";
  const email = (emailRaw || usernameAsEmail || null);

  if (!username) {
    throw new Error("Username is required.");
  }
  if (!fullName) {
    throw new Error("Full name is required.");
  }
  if (!email) {
    throw new Error("Email is required when username is not an email.");
  }
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const db = getDb(env);
  const supportsProviderSubject = await hasProviderSubjectColumn(db);
  const existing = await db.execute({
    sql: `select
            ac.user_account_id as user_account_id,
            coalesce(ua.is_superuser, 0) as is_superuser,
            coalesce(ua.active, 0) as account_active,
            coalesce(ac.active, 0) as credential_active
          from auth_credentials ac
          left join user_accounts ua on ua.id = ac.user_account_id
          where ac.username = ?
          limit 1`,
    args: [username]
  });
  if (existing.rows.length > 0) {
    const isSuperuserOwner = Number(existing.rows[0]?.is_superuser ?? 0) === 1;
    if (isSuperuserOwner) {
      throw new Error("Username is already used by a super admin account (not shown in Manage Users).");
    }
    throw new Error("Username already exists.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(password, salt);
  const saltEncoded = toBase64Url(salt);
  const permissions = isAdmin ? ["*"] : [];

  await db.execute("BEGIN");
  try {
    const existingByEmail = await db.execute({
      sql: "select id, is_superuser from user_accounts where email = ? limit 1",
      args: [email]
    });
    const userAccountId = String(existingByEmail.rows[0]?.id ?? "") || crypto.randomUUID();
    if (!existingByEmail.rows.length) {
      if (supportsProviderSubject) {
        await db.execute({
          sql: `insert into user_accounts(id, provider, provider_subject, subject, email, full_name, roles_json, permissions_json, is_admin, is_superuser, active, updated_at, last_login_at)
                values(?, 'local', ?, ?, ?, ?, ?, ?, ?, 0, 1, current_timestamp, current_timestamp)`,
          args: [userAccountId, `local:${username}`, `local:${username}`, email, fullName, JSON.stringify(normalizedRoles), JSON.stringify(permissions), isAdmin ? 1 : 0]
        });
      } else {
        await db.execute({
          sql: `insert into user_accounts(id, provider, subject, email, full_name, roles_json, permissions_json, is_admin, is_superuser, active, updated_at, last_login_at)
                values(?, 'local', ?, ?, ?, ?, ?, ?, 0, 1, current_timestamp, current_timestamp)`,
          args: [userAccountId, `local-${username}`, email, fullName, JSON.stringify(normalizedRoles), JSON.stringify(permissions), isAdmin ? 1 : 0]
        });
      }
    } else {
      if (Number(existingByEmail.rows[0]?.is_superuser ?? 0) === 1 && !isAdmin) {
        throw new Error("Cannot downgrade super admin role.");
      }
      if (supportsProviderSubject) {
        await db.execute({
          sql: `update user_accounts
                set provider = 'local',
                    provider_subject = ?,
                    subject = ?,
                    full_name = ?,
                    roles_json = ?,
                    permissions_json = ?,
                    is_admin = ?,
                    active = 1,
                    updated_at = current_timestamp
                where id = ?`,
          args: [`local:${username}`, `local:${username}`, fullName, JSON.stringify(normalizedRoles), JSON.stringify(permissions), isAdmin ? 1 : 0, userAccountId]
        });
      } else {
        await db.execute({
          sql: `update user_accounts
                set provider = 'local',
                    subject = ?,
                    full_name = ?,
                    roles_json = ?,
                    permissions_json = ?,
                    is_admin = ?,
                    active = 1,
                    updated_at = current_timestamp
                where id = ?`,
          args: [`local-${username}`, fullName, JSON.stringify(normalizedRoles), JSON.stringify(permissions), isAdmin ? 1 : 0, userAccountId]
        });
      }
    }
    await db.execute({
      sql: `insert into auth_credentials(user_account_id, username, password_hash, password_salt, password_iterations, failed_attempts, locked_until, active, updated_at, password_changed_at)
            values(?, ?, ?, ?, ?, 0, null, 1, current_timestamp, current_timestamp)`,
      args: [userAccountId, username, passwordHash, saltEncoded, PASSWORD_ITERATIONS]
    });
    await safeCommit(db);
  } catch (error) {
    await safeRollback(db);
    throw error;
  }
}

export async function adminResetLocalUserPassword(
  env: Env,
  principal: AuthPrincipal,
  targetSubject: string,
  newPassword: string
): Promise<void> {
  if (!principal.roles.includes("admin")) {
    throw new Error("Admin access required.");
  }
  const normalizedSubject = String(targetSubject ?? "").trim();
  if (!normalizedSubject) {
    throw new Error("Target user is required.");
  }
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const db = getDb(env);
  const targetRes = await db.execute({
    sql: `select ua.id as user_account_id, ua.provider as provider
          from user_accounts ua
          where ua.subject = ? and ua.active = 1
          limit 1`,
    args: [normalizedSubject]
  });
  if (targetRes.rows.length === 0) {
    throw new Error("Target user not found.");
  }
  const provider = String(targetRes.rows[0]?.provider ?? "");
  if (provider !== "local") {
    throw new Error("Password reset is available only for local users.");
  }
  const userAccountId = String(targetRes.rows[0]?.user_account_id ?? "");

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(newPassword, salt);
  const saltEncoded = toBase64Url(salt);

  const updateRes = await db.execute({
    sql: `update auth_credentials
          set password_hash = ?, password_salt = ?, password_iterations = ?, failed_attempts = 0, locked_until = null, updated_at = current_timestamp, password_changed_at = current_timestamp
          where user_account_id = ? and active = 1`,
    args: [passwordHash, saltEncoded, PASSWORD_ITERATIONS, userAccountId]
  });
  if ((updateRes.rowsAffected ?? 0) <= 0) {
    throw new Error("Local credentials not found for this user.");
  }

  await db.execute({
    sql: "update auth_sessions set revoked_at = current_timestamp where user_account_id = ? and revoked_at is null",
    args: [userAccountId]
  });
}
