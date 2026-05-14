import { getDb } from "../../core/db";
import type { Env } from "../../core/types";
import type { StudentScope } from "../auth/authorization.service";

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }
  return Math.min(parsed, 100);
}

function scopeWhere(scope: StudentScope): { clause: string; args: Array<string | number | null> } {
  if (scope.type === "all") {
    return { clause: "", args: [] };
  }
  if (scope.type === "mentor") {
    return {
      clause: ` where s.mentor_id in (
        select ua.id
        from user_accounts ua
        where lower(trim(ua.email)) = ?
          and ua.active = 1
      ) `,
      args: [scope.mentorEmail]
    };
  }
  if (scope.type === "self") {
    return { clause: " where lower(trim(student_ua.email)) = ? ", args: [scope.studentEmail] };
  }
  return { clause: " where 1 = 0 ", args: [] };
}

export async function listStudentsByScope(env: Env, scope: StudentScope, limitRaw: string | null, cursorRaw: string | null) {
  const db = getDb(env);
  const limit = parseLimit(limitRaw);
  const cursor = String(cursorRaw ?? "").trim();
  const scoped = scopeWhere(scope);
  const whereWithCursor = cursor
    ? scoped.clause
      ? `${scoped.clause} and s.user_id > ? `
      : " where s.user_id > ? "
    : scoped.clause;
  const args: Array<string | number | null> = cursor
    ? ([...scoped.args, cursor, limit + 1] as Array<string | number | null>)
    : ([...scoped.args, limit + 1] as Array<string | number | null>);

  const result = await db.execute({
    sql: `select
            s.user_id,
            s.registration_number,
            s.plan_of_study_code,
            s.gender,
            s.section,
            s.mobile_number,
            s.batch,
            s.programme_duration,
            s.programme,
            student_ua.full_name,
            student_ua.email,
            student_ua.active as student_active,
            mentor_ua.email as mentor_email
          from students s
          left join user_accounts student_ua on student_ua.id = s.user_id
          left join user_accounts mentor_ua on mentor_ua.id = s.mentor_id
          ${whereWithCursor}
          order by s.user_id asc
          limit ?`,
    args
  });

  const rows = result.rows.slice(0, limit);
  const hasMore = result.rows.length > limit;
  const nextCursor = hasMore ? String(rows[rows.length - 1]?.user_id ?? "") : null;
  return {
    rows,
    page: {
      limit,
      hasMore,
      nextCursor
    }
  };
}

export async function getStudentStatsByScope(env: Env, scope: StudentScope) {
  const db = getDb(env);
  const scoped = scopeWhere(scope);
  const summary = await db.execute({
    sql: `select
            count(*) as total_students,
            null as avg_risk_score,
            null as on_track_count
          from students s
          ${scoped.clause}`,
    args: scoped.args
  });
  const byProgram = await db.execute({
    sql: `select s.programme as program, count(*) as count
          from students s
          ${scoped.clause}
          group by s.programme
          order by s.programme asc`,
    args: scoped.args
  });
  return {
    summary: summary.rows[0] ?? { total_students: 0, avg_risk_score: null, on_track_count: 0 },
    byProgram: byProgram.rows
  };
}
