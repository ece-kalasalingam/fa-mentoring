import { getDb } from "../../core/db";
import type { Env } from "../../core/types";
import { validatePlansOfStudyAgainstRegulations } from "../plan-of-study/plan-of-study-validation.service";
import { getSetupStatus } from "../setup/setup.service";

type TursoStats = {
  rowsRead: number | null;
  rowsWritten: number | null;
  storageBytes: number | null;
  bytesSynced: number | null;
};

function deriveTursoDbName(databaseUrl: string, orgName: string): string | null {
  try {
    const hostname = databaseUrl.replace(/^libsql:\/\//, "").split("/")[0];
    const subdomain = hostname.split(".")[0];
    const orgSuffix = `-${orgName}`;
    return subdomain.endsWith(orgSuffix) ? subdomain.slice(0, -orgSuffix.length) : subdomain;
  } catch {
    return null;
  }
}

async function getTursoStats(env: Env): Promise<TursoStats | null> {
  const apiToken = env.TURSO_API_TOKEN;
  const orgName = env.TURSO_ORG_NAME;
  if (!apiToken || !orgName) return null;
  const dbName = deriveTursoDbName(env.TURSO_DATABASE_URL ?? "", orgName);
  if (!dbName) return null;
  try {
    const res = await fetch(
      `https://api.turso.tech/v1/organizations/${orgName}/databases/${dbName}/usage`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    if (!res.ok) return null;
    const raw = (await res.json()) as Record<string, unknown>;
    const db = raw.database as Record<string, unknown> | undefined;
    const usage = (db?.usage ?? {}) as Record<string, unknown>;
    return {
      rowsRead: typeof usage.rows_read === "number" ? usage.rows_read : null,
      rowsWritten: typeof usage.rows_written === "number" ? usage.rows_written : null,
      storageBytes: typeof usage.storage_bytes === "number" ? usage.storage_bytes : null,
      bytesSynced: typeof usage.bytes_synced === "number" ? usage.bytes_synced : null,
    };
  } catch {
    return null;
  }
}

async function safeSingleRow(
  env: Env,
  sql: string,
  args: Array<string | number> = []
): Promise<Record<string, unknown> | null> {
  try {
    const db = getDb(env);
    const res = await db.execute({ sql, args });
    return (res.rows[0] ?? null) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

async function readLoginTimeline48h(
  env: Env
): Promise<Array<{ hourTs: string; successCount: number; failedCount: number }> | null> {
  try {
    const db = getDb(env);
    const res = await db.execute({
      sql: `with recursive seq(i) as (
              select 0
              union all
              select i + 1 from seq where i < 47
            ),
            hours as (
              select strftime('%Y-%m-%d %H:00:00', datetime('now', '-' || (47 - i) || ' hours')) as hour_ts
              from seq
            )
            select
              h.hour_ts as hour_ts,
              coalesce(sum(case when a.success = 1 then 1 else 0 end), 0) as success_count,
              coalesce(sum(case when a.success = 0 then 1 else 0 end), 0) as failed_count
            from hours h
            left join auth_login_attempts a
              on a.attempted_at >= h.hour_ts
             and a.attempted_at < datetime(h.hour_ts, '+1 hour')
            group by h.hour_ts
            order by h.hour_ts asc`
    });
    return res.rows.map((row) => ({
      hourTs: String(row.hour_ts ?? ""),
      successCount: Number(row.success_count ?? 0),
      failedCount: Number(row.failed_count ?? 0),
    }));
  } catch {
    return null;
  }
}

export async function getAdminDashboard(env: Env) {
  const setup = await getSetupStatus(env);
  const pending = setup.pendingMigrations ?? [];
  const needsMitigations = pending.length > 0;
  const tableNames = new Set(setup.tableNames ?? []);

  const hasUserAccounts = tableNames.has("user_accounts");
  const hasSessions = tableNames.has("auth_sessions");
  const hasAttempts = tableNames.has("auth_login_attempts");
  const hasStudents = tableNames.has("students");
  const hasLogs = tableNames.has("app_logs");

  const authUsersRow = hasUserAccounts
    ? await safeSingleRow(
        env,
        `select
           coalesce(sum(case when ua.is_superuser = 0 then 1 else 0 end), 0) as total_users,
           coalesce(sum(
             case
               when ua.is_superuser = 0
                 and exists (
                   select 1
                   from json_each(case when json_valid(ua.roles_json) then ua.roles_json else '[]' end) r
                   where lower(trim(cast(r.value as text))) = 'guest'
                 )
               then 1
               else 0
             end
           ), 0) as total_guests
         from user_accounts ua`
      )
    : null;
  const totalUsers = hasUserAccounts ? Number(authUsersRow?.total_users ?? 0) : null;
  const totalGuests = hasUserAccounts ? Number(authUsersRow?.total_guests ?? 0) : null;

  const authSessionsRow =
    hasUserAccounts && hasSessions
      ? await safeSingleRow(
          env,
          `select
             coalesce(sum(case when s.revoked_at is null and datetime(s.expires_at) > datetime('now') then 1 else 0 end), 0) as active_sessions,
             coalesce(count(distinct case
               when s.revoked_at is null
                and datetime(s.expires_at) > datetime('now')
                and ua.is_superuser = 0
                and ua.active = 1
               then s.user_account_id
               else null
             end), 0) as active_users
           from auth_sessions s
           join user_accounts ua on ua.id = s.user_account_id`
        )
      : null;
  const activeSessions = hasSessions ? Number(authSessionsRow?.active_sessions ?? 0) : null;
  const activeUsers = hasUserAccounts && hasSessions ? Number(authSessionsRow?.active_users ?? 0) : null;

  const loginAttemptsRow = hasAttempts
    ? await safeSingleRow(
        env,
        `select
           coalesce(sum(case when success = 1 then 1 else 0 end), 0) as successful_logins_48h,
           coalesce(sum(case when success = 0 then 1 else 0 end), 0) as failed_logins_48h
         from auth_login_attempts
         where attempted_at >= datetime('now', '-48 hours')`
      )
    : null;
  const successfulLogins48h = hasAttempts ? Number(loginAttemptsRow?.successful_logins_48h ?? 0) : null;
  const failedLogins48h = hasAttempts ? Number(loginAttemptsRow?.failed_logins_48h ?? 0) : null;
  const loginTimeline48h = hasAttempts ? await readLoginTimeline48h(env) : null;

  const studentsRow = hasStudents
    ? await safeSingleRow(
        env,
        `select
           count(*) as total_students,
           coalesce(sum(case when completion_status = 'On Track' then 1 else 0 end), 0) as on_track_students,
           coalesce(sum(case when risk_score >= 70 then 1 else 0 end), 0) as at_risk_students,
           coalesce(round(avg(risk_score), 2), 0) as avg_risk_score
         from students`
      )
    : null;
  const totalStudents = hasStudents ? Number(studentsRow?.total_students ?? 0) : null;
  const onTrackStudents = hasStudents ? Number(studentsRow?.on_track_students ?? 0) : null;
  const atRiskStudents = hasStudents ? Number(studentsRow?.at_risk_students ?? 0) : null;
  const avgRiskScore = hasStudents ? Number(studentsRow?.avg_risk_score ?? 0) : null;

  const logsRow = hasLogs
    ? await safeSingleRow(
        env,
        `select
           coalesce(sum(case when level = 'error' and ts >= datetime('now', '-48 hours') then 1 else 0 end), 0) as error_logs_48h,
           coalesce(sum(case when level = 'warn' and ts >= datetime('now', '-48 hours') then 1 else 0 end), 0) as warn_logs_48h
         from app_logs`
      )
    : null;
  const errorLogs48h = hasLogs ? Number(logsRow?.error_logs_48h ?? 0) : null;
  const warnLogs48h = hasLogs ? Number(logsRow?.warn_logs_48h ?? 0) : null;

  const isTurso = Boolean(env.TURSO_DATABASE_URL?.includes("turso.io"));
  const tursoStats = isTurso ? await getTursoStats(env) : null;
  const curriculumValidation = await validatePlansOfStudyAgainstRegulations();

  return {
    generatedAt: new Date().toISOString(),
    mitigations: {
      needsMitigations,
      pendingCount: pending.length,
      pendingMigrations: pending,
      message: needsMitigations
        ? `Mitigations pending: ${pending.length} migration(s) not yet applied.`
        : "No new mitigations pending."
    },
    system: {
      hasTables: setup.hasTables,
      tableCount: setup.tableCount,
      currentSchemaVersion: setup.currentSchemaVersion,
      isTurso,
      turso: tursoStats,
    },
    auth: {
      totalUsers,
      totalGuests,
      activeUsers,
      activeSessions,
      successfulLogins48h,
      failedLogins48h,
      loginTimeline48h
    },
    students: {
      totalStudents,
      onTrackStudents,
      atRiskStudents,
      avgRiskScore
    },
    logging: {
      errorLogs48h,
      warnLogs48h
    },
    curriculumValidation,
  };
}
