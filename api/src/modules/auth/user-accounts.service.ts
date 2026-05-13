import { getDb } from "../../core/db";
import type { Env } from "../../core/types";
import type { AuthPrincipal } from "./identity";
const PROVIDER_SUBJECT_SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;
let supportsProviderSubjectCache: { value: boolean; expiresAt: number } | null = null;

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return email || null;
}

function normalizeProvider(value: string): string {
  return truncate(String(value ?? "").trim().toLowerCase(), 64);
}

function normalizeProviderSubject(value: string | null | undefined): string | null {
  const v = String(value ?? "").trim();
  return v ? truncate(v, 128) : null;
}

function resolveDisplaySubject(email: string | null, provider: string, providerSubject: string | null): string {
  if (email) return truncate(email, 320);
  if (providerSubject) return truncate(`${provider}:${providerSubject}`, 160);
  return `${provider}:anonymous`;
}

function resolveDisplayName(principal: AuthPrincipal): string {
  const direct = String(principal.fullName ?? "").trim();
  if (direct) return truncate(direct, 160);
  const email = normalizeEmail(principal.email);
  if (email) return truncate(email, 160);
  return truncate(principal.subject || "User", 160);
}

async function safeRollback(db: ReturnType<typeof getDb>): Promise<void> {
  try {
    await db.execute("ROLLBACK");
  } catch {
    // Ignore rollback errors when no active transaction exists.
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

export async function resolveUserAccountIdByPrincipal(env: Env, principal: AuthPrincipal): Promise<string | null> {
  const db = getDb(env);
  const supportsProviderSubject = await hasProviderSubjectColumn(db);
  const provider = normalizeProvider(principal.provider);
  const providerSubject = normalizeProviderSubject(principal.subject);
  const email = normalizeEmail(principal.email);

  const rawSubject = truncate(String(principal.subject ?? "").trim(), 160);
  const subjectCandidates = new Set<string>();
  if (rawSubject) {
    subjectCandidates.add(rawSubject);
    if (provider === "local" && rawSubject.startsWith("local-")) {
      subjectCandidates.add(`local:${rawSubject.slice("local-".length)}`);
    } else if (provider === "local" && rawSubject.startsWith("local:")) {
      subjectCandidates.add(`local-${rawSubject.slice("local:".length)}`);
    }
  }

  if (subjectCandidates.size > 0) {
    const items = Array.from(subjectCandidates);
    const placeholders = items.map(() => "?").join(", ");
    const bySubject = await db.execute({
      sql: `select id
            from user_accounts
            where active = 1
              and provider = ?
              and subject in (${placeholders})
            limit 1`,
      args: [provider, ...items]
    });
    if (bySubject.rows.length > 0) {
      return String(bySubject.rows[0]?.id ?? "") || null;
    }
  }

  if (providerSubject && supportsProviderSubject) {
    const byProviderSubject = await db.execute({
      sql: `select id
            from user_accounts
            where active = 1
              and provider = ?
              and provider_subject = ?
            limit 1`,
      args: [provider, providerSubject]
    });
    if (byProviderSubject.rows.length > 0) {
      return String(byProviderSubject.rows[0]?.id ?? "") || null;
    }
  }

  if (!email) {
    return null;
  }

  const byEmail = await db.execute({
    sql: "select id from user_accounts where email = ? and active = 1 limit 1",
    args: [email]
  });
  if (byEmail.rows.length === 0) {
    return null;
  }

  const accountId = String(byEmail.rows[0]?.id ?? "");
  if (!accountId) {
    return null;
  }

  if (providerSubject) {
    if (supportsProviderSubject) {
      await db.execute({
        sql: `update user_accounts
              set provider = ?,
                  provider_subject = ?,
                  subject = ?,
                  updated_at = current_timestamp
              where id = ?`,
        args: [provider, providerSubject, resolveDisplaySubject(email, provider, providerSubject), accountId]
      });
    } else {
      await db.execute({
        sql: `update user_accounts
              set provider = ?,
                  subject = ?,
                  updated_at = current_timestamp
              where id = ?`,
        args: [provider, resolveDisplaySubject(email, provider, providerSubject), accountId]
      });
    }
  }

  return accountId;
}

export async function persistAuthenticatedAdmin(env: Env, principal: AuthPrincipal): Promise<void> {
  const db = getDb(env);
  const supportsProviderSubject = await hasProviderSubjectColumn(db);
  const provider = normalizeProvider(principal.provider);
  const providerSubject = normalizeProviderSubject(principal.subject);
  const email = normalizeEmail(principal.email);
  const normalizedRoles: string[] = principal.roles.length > 0 ? principal.roles : ["guest"];
  const rolesJson = JSON.stringify(normalizedRoles);
  const permissionsJson = JSON.stringify(principal.permissions);
  const fullName = resolveDisplayName(principal);
  const isAdmin = normalizedRoles.includes("admin") ? 1 : 0;

  await db.execute("BEGIN");
  try {
    const superRes = await db.execute("select count(*) as count from user_accounts where is_superuser = 1 and active = 1");
    const superCount = Number(superRes.rows[0]?.count ?? 0);

    let accountId = await resolveUserAccountIdByPrincipal(env, principal);
    if (!accountId) {
      accountId = crypto.randomUUID();
      if (supportsProviderSubject) {
        await db.execute({
          sql: `insert into user_accounts(id, provider, provider_subject, subject, email, full_name, roles_json, permissions_json, is_admin, is_superuser, active, created_at, updated_at, last_login_at)
                values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, current_timestamp, current_timestamp, current_timestamp)`,
          args: [
            accountId,
            provider,
            providerSubject,
            resolveDisplaySubject(email, provider, providerSubject),
            email,
            fullName,
            rolesJson,
            permissionsJson,
            isAdmin,
            isAdmin === 1 && superCount === 0 ? 1 : 0
          ]
        });
      } else {
        await db.execute({
          sql: `insert into user_accounts(id, provider, subject, email, full_name, roles_json, permissions_json, is_admin, is_superuser, active, created_at, updated_at, last_login_at)
                values(?, ?, ?, ?, ?, ?, ?, ?, ?, 1, current_timestamp, current_timestamp, current_timestamp)`,
          args: [
            accountId,
            provider,
            resolveDisplaySubject(email, provider, providerSubject),
            email,
            fullName,
            rolesJson,
            permissionsJson,
            isAdmin,
            isAdmin === 1 && superCount === 0 ? 1 : 0
          ]
        });
      }
    } else {
      if (supportsProviderSubject) {
        await db.execute({
          sql: `update user_accounts
                set provider = ?,
                    provider_subject = coalesce(?, provider_subject),
                    subject = ?,
                    email = coalesce(?, email),
                    full_name = coalesce(?, full_name),
                    roles_json = ?,
                    permissions_json = ?,
                    is_admin = ?,
                    active = 1,
                    updated_at = current_timestamp,
                    last_login_at = current_timestamp
                where id = ?`,
          args: [
            provider,
            providerSubject,
            resolveDisplaySubject(email, provider, providerSubject),
            email,
            fullName,
            rolesJson,
            permissionsJson,
            isAdmin,
            accountId
          ]
        });
      } else {
        await db.execute({
          sql: `update user_accounts
                set provider = ?,
                    subject = ?,
                    email = coalesce(?, email),
                    full_name = coalesce(?, full_name),
                    roles_json = ?,
                    permissions_json = ?,
                    is_admin = ?,
                    active = 1,
                    updated_at = current_timestamp,
                    last_login_at = current_timestamp
                where id = ?`,
          args: [
            provider,
            resolveDisplaySubject(email, provider, providerSubject),
            email,
            fullName,
            rolesJson,
            permissionsJson,
            isAdmin,
            accountId
          ]
        });
      }
    }

    await db.execute("COMMIT");
  } catch (error) {
    await safeRollback(db);
    throw error;
  }
}

export async function getAccountProfileByPrincipal(
  env: Env,
  principal: AuthPrincipal
): Promise<{ subject: string; email: string | null; fullName: string | null; roles: string[]; provider: string; username: string | null } | null> {
  const accountId = await resolveUserAccountIdByPrincipal(env, principal);
  if (!accountId) {
    return null;
  }
  const db = getDb(env);
  const res = await db.execute({
    sql: `select
            ua.subject as subject,
            ua.email as email,
            ua.full_name as full_name,
            ua.roles_json as roles_json,
            ua.provider as provider,
            ac.username as username
          from user_accounts ua
          left join auth_credentials ac on ac.user_account_id = ua.id and ac.active = 1
          where ua.id = ? and ua.active = 1
          limit 1`,
    args: [accountId]
  });
  if (res.rows.length === 0) {
    return null;
  }
  const row = res.rows[0];
  return {
    subject: String(row.subject),
    email: row.email ? String(row.email) : null,
    fullName: row.full_name ? String(row.full_name) : null,
    roles: JSON.parse(String(row.roles_json)) as string[],
    provider: String(row.provider),
    username: row.username ? String(row.username) : null
  };
}

export async function updateOwnFullName(env: Env, principal: AuthPrincipal, fullName: string): Promise<void> {
  const normalized = truncate(String(fullName ?? "").trim(), 160);
  if (!normalized) {
    throw new Error("Full name is required.");
  }
  const accountId = await resolveUserAccountIdByPrincipal(env, principal);
  if (!accountId) {
    throw new Error("User account not found.");
  }
  const db = getDb(env);
  await db.execute({
    sql: "update user_accounts set full_name = ?, updated_at = current_timestamp where id = ? and active = 1",
    args: [normalized, accountId]
  });
}

export async function getPrincipalAccountFlags(env: Env, principal: AuthPrincipal): Promise<{ isSuperuser: boolean } | null> {
  const db = getDb(env);
  const provider = normalizeProvider(principal.provider);
  const rawSubject = truncate(String(principal.subject ?? "").trim(), 160);
  const subjectCandidates = new Set<string>();
  if (rawSubject) {
    subjectCandidates.add(rawSubject);
    if (provider === "local" && rawSubject.startsWith("local-")) {
      subjectCandidates.add(`local:${rawSubject.slice("local-".length)}`);
    } else if (provider === "local" && rawSubject.startsWith("local:")) {
      subjectCandidates.add(`local-${rawSubject.slice("local:".length)}`);
    }
  }
  if (subjectCandidates.size > 0) {
    const items = Array.from(subjectCandidates);
    const placeholders = items.map(() => "?").join(", ");
    const direct = await db.execute({
      sql: `select is_superuser
            from user_accounts
            where active = 1
              and provider = ?
              and subject in (${placeholders})
            limit 1`,
      args: [provider, ...items]
    });
    if (direct.rows.length > 0) {
      return { isSuperuser: Number(direct.rows[0]?.is_superuser ?? 0) === 1 };
    }
  }

  const accountId = await resolveUserAccountIdByPrincipal(env, principal);
  if (!accountId) {
    return null;
  }
  const res = await db.execute({
    sql: "select is_superuser from user_accounts where id = ? and active = 1 limit 1",
    args: [accountId]
  });
  if (res.rows.length === 0) {
    return null;
  }
  return {
    isSuperuser: Number(res.rows[0]?.is_superuser ?? 0) === 1
  };
}

export async function setUserActiveByAdmin(env: Env, principal: AuthPrincipal, targetSubject: string, active: boolean): Promise<void> {
  if (!principal.roles.includes("admin")) {
    throw new Error("Admin access required.");
  }
  const subject = String(targetSubject ?? "").trim();
  if (!subject) {
    throw new Error("Target user is required.");
  }
  const db = getDb(env);
  const target = await db.execute({
    sql: "select id, is_superuser from user_accounts where subject = ? limit 1",
    args: [subject]
  });
  if (target.rows.length === 0) {
    throw new Error("Target user not found.");
  }
  if (Number(target.rows[0]?.is_superuser ?? 0) === 1) {
    throw new Error("Super admin cannot be modified through this action.");
  }

  const accountId = String(target.rows[0]?.id ?? "");
  await db.execute({
    sql: "update user_accounts set active = ?, updated_at = current_timestamp where id = ?",
    args: [active ? 1 : 0, accountId]
  });
  if (!active) {
    await db.execute({
      sql: "update auth_sessions set revoked_at = current_timestamp where user_account_id = ? and revoked_at is null",
      args: [accountId]
    });
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

function normalizeRoles(inputs: unknown): string[] {
  const rawRoles = Array.isArray(inputs) ? inputs : [];
  const normalized = rawRoles
    .map((role) => normalizeRole(String(role ?? "")))
    .filter(Boolean);
  const unique = Array.from(new Set(normalized));
  if (unique.length === 0) {
    throw new Error("At least one role is required.");
  }
  return unique;
}

export async function updateUserByAdmin(
  env: Env,
  principal: AuthPrincipal,
  payload: { subject: string; fullName: string; roles: string[]; email?: string; username?: string }
): Promise<void> {
  if (!principal.roles.includes("admin")) {
    throw new Error("Admin access required.");
  }
  const subject = String(payload.subject ?? "").trim();
  const fullName = truncate(String(payload.fullName ?? "").trim(), 160);
  const roles = normalizeRoles(payload.roles);
  if (!subject) {
    throw new Error("Target user is required.");
  }
  if (!fullName) {
    throw new Error("User name is required.");
  }
  const db = getDb(env);
  const target = await db.execute({
    sql: "select id, is_superuser, provider from user_accounts where subject = ? limit 1",
    args: [subject]
  });
  if (target.rows.length === 0) {
    throw new Error("Target user not found.");
  }
  if (Number(target.rows[0]?.is_superuser ?? 0) === 1) {
    throw new Error("Super admin cannot be modified through this action.");
  }

  const accountId = String(target.rows[0]?.id ?? "");
  const provider = String(target.rows[0]?.provider ?? "");

  const permissions = roles.includes("admin") ? ["*"] : [];
  await db.execute({
    sql: `update user_accounts
          set full_name = ?, roles_json = ?, permissions_json = ?, is_admin = ?, updated_at = current_timestamp
          where id = ?`,
    args: [fullName, JSON.stringify(roles), JSON.stringify(permissions), roles.includes("admin") ? 1 : 0, accountId]
  });

  if (provider === "local") {
    if (payload.email !== undefined) {
      const newEmail = normalizeEmail(payload.email);
      await db.execute({
        sql: "update user_accounts set email = ?, updated_at = current_timestamp where id = ?",
        args: [newEmail, accountId]
      });
    }

    if (payload.username !== undefined) {
      const newUsername = truncate(String(payload.username ?? "").trim().toLowerCase(), 80);
      if (!newUsername) {
        throw new Error("Username cannot be empty.");
      }
      await db.execute({
        sql: "update auth_credentials set username = ? where user_account_id = ?",
        args: [newUsername, accountId]
      });
    }
  }
}
