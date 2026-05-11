import { getDb } from "../../core/db";
import type { Env } from "../../core/types";
import { getSetupStatus } from "../setup/setup.service";

async function safeSingleNumber(env: Env, sql: string, args: Array<string | number> = []): Promise<number | null> {
  try {
    const db = getDb(env);
    const res = await db.execute({ sql, args });
    const firstRow = res.rows[0] ?? {};
    const firstValue = Object.values(firstRow)[0];
    return Number(firstValue ?? 0);
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

  const totalUsers = hasUserAccounts ? await safeSingleNumber(env, "select count(*) from user_accounts where is_superuser = 0") : null;
  const totalGuests = hasUserAccounts
    ? await safeSingleNumber(
        env,
        `select count(*)
         from user_accounts ua
         where ua.is_superuser = 0
           and exists (
             select 1
             from json_each(case when json_valid(ua.roles_json) then ua.roles_json else '[]' end) r
             where lower(trim(cast(r.value as text))) = 'guest'
           )`
      )
    : null;
  const activeUsers =
    hasUserAccounts && hasSessions
      ? await safeSingleNumber(
          env,
          `select count(distinct s.user_account_id)
           from auth_sessions s
           join user_accounts ua on ua.id = s.user_account_id
           where s.revoked_at is null
             and datetime(s.expires_at) > datetime('now')
             and ua.is_superuser = 0
             and ua.active = 1`
        )
      : null;
  const activeSessions = hasSessions
    ? await safeSingleNumber(env, "select count(*) from auth_sessions where revoked_at is null and datetime(expires_at) > datetime('now')")
    : null;

  const successfulLogins48h = hasAttempts
    ? await safeSingleNumber(
        env,
        "select count(*) from auth_login_attempts where success = 1 and attempted_at >= datetime('now', '-48 hours')"
      )
    : null;
  const failedLogins48h = hasAttempts
    ? await safeSingleNumber(
        env,
        "select count(*) from auth_login_attempts where success = 0 and attempted_at >= datetime('now', '-48 hours')"
      )
    : null;
  const loginTimeline48h = hasAttempts ? await readLoginTimeline48h(env) : null;

  const totalStudents = hasStudents ? await safeSingleNumber(env, "select count(*) from students") : null;
  const onTrackStudents = hasStudents ? await safeSingleNumber(env, "select count(*) from students where completion_status = 'On Track'") : null;
  const atRiskStudents = hasStudents ? await safeSingleNumber(env, "select count(*) from students where risk_score >= 70") : null;
  const avgRiskScore = hasStudents ? await safeSingleNumber(env, "select coalesce(round(avg(risk_score), 2), 0) from students") : null;

  const errorLogs48h = hasLogs
    ? await safeSingleNumber(env, "select count(*) from app_logs where level = 'error' and ts >= datetime('now', '-48 hours')")
    : null;
  const warnLogs48h = hasLogs
    ? await safeSingleNumber(env, "select count(*) from app_logs where level = 'warn' and ts >= datetime('now', '-48 hours')")
    : null;

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
      currentSchemaVersion: setup.currentSchemaVersion
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
    }
  };
}
