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
  // Existing-db mitigation: aggressively remove retired credit-tracking tables.
  await db.execute("drop table if exists student_credit_snapshots");
  await db.execute("drop table if exists credit_import_batches");
  await db.execute("drop table if exists student_credit_claims");
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
  const studentColumnsRes = await db.execute("pragma table_info(students)").catch(() => ({ rows: [] }));
  const studentColumnNames = new Set(studentColumnsRes.rows.map((row) => String(row.name ?? "").toLowerCase()));
  if (!studentColumnNames.has("current_semester")) {
    await db.execute("alter table students add column current_semester integer not null default 1");
  }
  if (!studentColumnNames.has("modified_by")) {
    await db.execute("alter table students add column modified_by text references user_accounts(id)");
  }
  if (!studentColumnNames.has("modified_at")) {
    await db.execute("alter table students add column modified_at text");
  }
  await db.execute("update students set current_semester = 1 where current_semester is null").catch(() => undefined);
  await db.execute("update students set modified_at = current_timestamp where modified_at is null or trim(modified_at) = ''").catch(() => undefined);

  // Existing-db mitigation: repair legacy FK residue that still points to students_old_v5.
  // This can happen if older rename/rebuild flows were interrupted.
  const legacyStudentsRef = await db.execute({
    sql: `select name, type
          from sqlite_master
          where sql is not null
            and lower(sql) like '%students_old_v5%'`
  }).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
  if (legacyStudentsRef.rows.length > 0) {
    await db.execute("drop trigger if exists trg_student_credit_details_modified_at").catch(() => undefined);
    await db.execute("alter table student_credit_details rename to student_credit_details_repair_old").catch(() => undefined);
    await db.execute(`create table if not exists student_credit_details (
      enrollment_id integer primary key autoincrement,
      student_id text not null,
      category_id text(10) not null,
      semester_taken integer not null check (semester_taken > 0),
      credits real not null check (credits >= 0),
      status integer not null default 1 check (status in (0,1,2,3,4,5)),
      modified_by text,
      modified_at datetime not null default current_timestamp,
      constraint fk_credit_student_id
        foreign key (student_id) references students(user_id) on delete cascade,
      constraint fk_credit_modified_by
        foreign key (modified_by) references user_accounts(id) on delete set null,
      constraint uq_student_semester_category
        unique (student_id, category_id, semester_taken)
    )`);
    await db.execute(`insert into student_credit_details(enrollment_id, student_id, category_id, semester_taken, credits, status, modified_by, modified_at)
      select enrollment_id, student_id, category_id, semester_taken, credits, status, modified_by, modified_at
      from student_credit_details_repair_old`).catch(() => undefined);
    await db.execute("drop table if exists student_credit_details_repair_old").catch(() => undefined);
    await db.execute("create index if not exists idx_credit_details_student on student_credit_details(student_id)");
    await db.execute("create index if not exists idx_credit_details_student_sem on student_credit_details(student_id, semester_taken)");
    await db.execute("create index if not exists idx_credit_details_student_category_status on student_credit_details(student_id, category_id, status)");
    await db.execute(`create trigger if not exists trg_student_credit_details_modified_at
      after update on student_credit_details
      for each row
      when new.modified_at = old.modified_at
      begin
        update student_credit_details
        set modified_at = current_timestamp
        where enrollment_id = new.enrollment_id;
      end`);
  }
  return {
    ok: true,
    migrations: migrationResult,
    fullNameBackfilledUsers: backfilled
  };
}
