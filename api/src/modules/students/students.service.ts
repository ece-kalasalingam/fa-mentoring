import { getDb } from "../../core/db";
import type { Env } from "../../core/types";
import type { StudentScope } from "../auth/authorization.service";

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }
  return Math.min(parsed, 200);
}

function scopeWhere(scope: StudentScope): { clause: string; args: Array<string | number | null> } {
  if (scope.type === "all") {
    return { clause: "", args: [] };
  }
  if (scope.type === "mentor") {
    return { clause: " where mentor_email = ? ", args: [scope.mentorEmail] };
  }
  if (scope.type === "self") {
    return { clause: " where email = ? ", args: [scope.studentEmail] };
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
      ? `${scoped.clause} and roll_no > ? `
      : " where roll_no > ? "
    : scoped.clause;
  const args: Array<string | number | null> = cursor
    ? ([...scoped.args, cursor, limit + 1] as Array<string | number | null>)
    : ([...scoped.args, limit + 1] as Array<string | number | null>);

  const result = await db.execute({
    sql: `select roll_no, full_name, email, program, batch_start_year, mentor_email, completion_status, risk_score
          from students
          ${whereWithCursor}
          order by roll_no asc
          limit ?`,
    args
  });

  const rows = result.rows.slice(0, limit);
  const hasMore = result.rows.length > limit;
  const nextCursor = hasMore ? String(rows[rows.length - 1]?.roll_no ?? "") : null;
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
            avg(risk_score) as avg_risk_score,
            sum(case when completion_status = 'On Track' then 1 else 0 end) as on_track_count
          from students
          ${scoped.clause}`,
    args: scoped.args
  });
  const byProgram = await db.execute({
    sql: `select program, count(*) as count
          from students
          ${scoped.clause}
          group by program
          order by program asc`,
    args: scoped.args
  });
  return {
    summary: summary.rows[0] ?? { total_students: 0, avg_risk_score: null, on_track_count: 0 },
    byProgram: byProgram.rows
  };
}
