import { getDb, requireDbEnv } from "../../core/db";
import type { Env } from "../../core/types";
import { hasAnyLocalCredential } from "../auth/password-auth.service";
import { getSetupStatus, setupSchema } from "./setup.service";

const SETUP_STATE_KEY = "setup_state";

type SetupStateRecord = {
  setupComplete: boolean;
  completedAt: string;
};

async function ensureAppConfigTable(env: Env) {
  const db = getDb(env);
  await db.execute(`create table if not exists app_config (
    key text primary key,
    value text not null,
    updated_at text not null default current_timestamp
  )`);
}

export async function getSetupState(env: Env): Promise<SetupStateRecord | null> {
  try {
    const db = getDb(env);
    const res = await db.execute({
      sql: "select value from app_config where key = ? limit 1",
      args: [SETUP_STATE_KEY]
    });
    const raw = String(res.rows[0]?.value ?? "").trim();
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<SetupStateRecord>;
    if (!parsed || parsed.setupComplete !== true) {
      return null;
    }
    const completedAt = String(parsed.completedAt ?? "").trim();
    if (!completedAt) {
      return null;
    }
    return { setupComplete: true, completedAt };
  } catch {
    return null;
  }
}

export async function markSetupComplete(env: Env) {
  await ensureAppConfigTable(env);
  const db = getDb(env);
  const payload: SetupStateRecord = {
    setupComplete: true,
    completedAt: new Date().toISOString()
  };
  await db.execute({
    sql: `insert into app_config(key, value, updated_at) values(?, ?, current_timestamp)
          on conflict(key) do update set value = excluded.value, updated_at = current_timestamp`,
    args: [SETUP_STATE_KEY, JSON.stringify(payload)]
  });
  return payload;
}

export async function resetSetupState(env: Env) {
  await ensureAppConfigTable(env);
  const db = getDb(env);
  await db.execute({
    sql: "delete from app_config where key = ?",
    args: [SETUP_STATE_KEY]
  });
  return { ok: true, setupComplete: false };
}

export async function checkConnections(env: Env) {
  requireDbEnv(env);
  const db = getDb(env);
  await db.execute("select 1 as ok");
  return { ok: true, message: "Connections verified" };
}

export async function seedInitialData(env: Env) {
  const db = getDb(env);
  await db.execute(`create table if not exists app_config (
    key text primary key,
    value text not null,
    updated_at text not null default current_timestamp
  )`);
  await db.execute({
    sql: `insert into app_config(key, value, updated_at) values('seeded_at', current_timestamp, current_timestamp)
          on conflict(key) do update set value = excluded.value, updated_at = current_timestamp`
  });
  return { ok: true, message: "Initial data seeded" };
}

export async function getWizardState(env: Env) {
  let setupStatus;
  try {
    setupStatus = await getSetupStatus(env);
  } catch {
    setupStatus = {
      hasTables: false,
      tableCount: 0,
      tableNames: [],
      currentSchemaVersion: null,
      totalMigrations: 0,
      appliedMigrations: 0,
      pendingMigrations: []
    };
  }
  const hasCredentials = await hasAnyLocalCredential(env).catch(() => false);
  const setupState = await getSetupState(env);
  const superAdminRes = await getDb(env)
    .execute("select count(*) as count from user_accounts where is_superuser = 1 and active = 1")
    .catch(() => ({ rows: [{ count: 0 }] }));
  const hasSuperAdmin = Number(superAdminRes.rows[0]?.count ?? 0) > 0;
  return {
    hasConnection: true,
    hasTables: setupStatus.hasTables,
    hasSeedData: setupStatus.tableNames.includes("app_config"),
    setupComplete: Boolean(setupState?.setupComplete),
    setupCompletedAt: setupState?.completedAt ?? null,
    hasSuperAdmin,
    hasCredentials
  };
}

export async function hasSuperAdmin(env: Env): Promise<boolean> {
  const res = await getDb(env).execute("select count(*) as count from user_accounts where is_superuser = 1 and active = 1");
  return Number(res.rows[0]?.count ?? 0) > 0;
}

export async function runMigrations(env: Env) {
  const result = await setupSchema(env);
  return { ok: true, ...result };
}

function inferFullName(subject: string, email: string | null): string {
  if (email && email.trim()) {
    return email.trim();
  }
  const s = subject.trim();
  if (s.startsWith("local-")) {
    return s.slice("local-".length);
  }
  return s || "User";
}

export async function runRecentMitigations(env: Env) {
  const migrationResult = await runMigrations(env);
  const db = getDb(env);
  const columns = await db.execute("pragma table_info(user_accounts)");
  const hasFullName = columns.rows.some((row) => String(row.name ?? "").toLowerCase() === "full_name");
  let backfilled = 0;
  if (hasFullName) {
    const missing = await db.execute(
      "select count(*) as c from user_accounts where active = 1 and (full_name is null or trim(full_name) = '')"
    );
    backfilled = Number(missing.rows[0]?.c ?? 0);
    if (backfilled > 0) {
      // Single set-based update avoids per-row write loops that can exceed Worker subrequest limits.
      await db.execute(`update user_accounts
        set
          full_name = case
            when email is not null and trim(email) <> '' then trim(email)
            when subject like 'local-%' then substr(subject, 7)
            when trim(coalesce(subject, '')) <> '' then trim(subject)
            else 'User'
          end,
          updated_at = current_timestamp
        where active = 1 and (full_name is null or trim(full_name) = '')`);
    }
  }
  return {
    ok: true,
    migrations: migrationResult,
    fullNameBackfilledUsers: backfilled
  };
}
