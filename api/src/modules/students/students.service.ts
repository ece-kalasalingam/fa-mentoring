import { getDb } from "../../core/db";
import type { Env } from "../../core/types";
import type { StudentScope } from "../auth/authorization.service";

function toTwoDecimalNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

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
            s.current_semester,
            s.batch,
            s.graduated,
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

  const rows = result.rows.slice(0, limit).map((row) => ({
    userId: String(row.user_id ?? ""),
    registration_number: row.registration_number == null ? null : String(row.registration_number),
    plan_of_study_code: row.plan_of_study_code == null ? null : Number(row.plan_of_study_code),
    current_semester: row.current_semester == null ? null : Number(row.current_semester),
    batch: row.batch == null ? null : Number(row.batch),
    graduated: Number(row.graduated ?? 0) === 1 ? "Yes" : "No",
    programme: row.programme == null ? null : Number(row.programme),
    full_name: row.full_name == null ? null : String(row.full_name),
    email: row.email == null ? null : String(row.email),
    student_active: row.student_active == null ? 0 : Number(row.student_active),
    mentor_email: row.mentor_email == null ? null : String(row.mentor_email),
  }));
  const hasMore = result.rows.length > limit;
  const nextCursor = hasMore ? String(rows[rows.length - 1]?.userId ?? "") : null;
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

export async function getStudentCreditSummaries(
  env: Env,
  studentIds: string[],
): Promise<Array<{ studentId: string; totalCredits: number }>> {
  if (studentIds.length === 0) return [];
  const db = getDb(env);
  const placeholders = studentIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `select student_id, coalesce(sum(credits), 0) as total_credits
          from student_credit_details
          where student_id in (${placeholders})
          group by student_id`,
    args: studentIds as Array<string | number | null>,
  });
  return result.rows.map((row) => ({
    studentId: String(row.student_id ?? ""),
    totalCredits: toTwoDecimalNumber(Number(row.total_credits ?? 0)),
  }));
}

export async function getStudentCredits(env: Env, studentId: string) {
  const db = getDb(env);
  const result = await db.execute({
    sql: `select category_id, semester_taken, credits
          from student_credit_details
          where student_id = ?
          order by semester_taken asc, category_id asc`,
    args: [studentId],
  });
  return result.rows.map((row) => ({
    categoryId: String(row.category_id ?? ""),
    semesterTaken: Number(row.semester_taken),
    credits: toTwoDecimalNumber(Number(row.credits)),
  }));
}

export type StudentCreditTableRow = {
  registrationNumber: string | null;
  graduated: "Yes" | "No";
  categoryId: string;
  semester: number;
  credits: number;
  modifiedByUsername: string | null;
  modifiedAt: string | null;
};

export async function listStudentCreditTableByScope(
  env: Env,
  scope: StudentScope,
): Promise<StudentCreditTableRow[]> {
  const db = getDb(env);
  const scoped = scopeWhere(scope);
  const result = await db.execute({
    sql: `select
            s.registration_number,
            s.graduated,
            scd.category_id,
            scd.semester_taken,
            scd.credits,
            coalesce(nullif(trim(modifier.full_name), ''), nullif(trim(modifier.email), ''), nullif(trim(modifier.subject), '')) as modified_by_username,
            scd.modified_at
          from student_credit_details scd
          inner join students s on s.user_id = scd.student_id
          left join user_accounts modifier on modifier.id = scd.modified_by
          ${scoped.clause}
          order by s.registration_number asc, scd.semester_taken asc, scd.category_id asc`,
    args: scoped.args,
  });
  return result.rows.map((row) => ({
    registrationNumber: row.registration_number == null ? null : String(row.registration_number),
    graduated: Number(row.graduated ?? 0) === 1 ? "Yes" : "No",
    categoryId: String(row.category_id ?? ""),
    semester: Number(row.semester_taken ?? 0),
    credits: toTwoDecimalNumber(Number(row.credits ?? 0)),
    modifiedByUsername: row.modified_by_username == null ? null : String(row.modified_by_username),
    modifiedAt: row.modified_at == null ? null : String(row.modified_at),
  }));
}

type CreditEntry = { categoryId: string; semesterTaken: number; credits: number };
type CreditWriteMode = "replace_all" | "patch";

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
  }
}

export async function bulkImportStudentCredits(
  env: Env,
  scope: StudentScope,
  rows: Array<{ registrationNumber: string; semester: number; categoryCode: string; credits: number }>,
  modifiedById: string | null,
  writeMode: CreditWriteMode,
  allowClearAll: boolean,
): Promise<{ imported: number; failed: number; errors: string[] }> {
  const db = getDb(env);
  const scoped = scopeWhere(scope);

  const studentsResult = await db.execute({
    sql: `select s.user_id, s.registration_number
          from students s
          ${scoped.clause}`,
    args: scoped.args,
  });

  const regToUserId = new Map<string, string>();
  for (const row of studentsResult.rows) {
    const reg = String(row.registration_number ?? "").trim();
    const userId = String(row.user_id ?? "").trim();
    if (reg && userId) regToUserId.set(reg.toLowerCase(), userId);
  }

  const aggregated = new Map<string, number>();
  const unknownRegs = new Set<string>();

  for (const row of rows) {
    const userId = regToUserId.get(row.registrationNumber.toLowerCase());
    if (!userId) {
      unknownRegs.add(row.registrationNumber);
      continue;
    }
    if (row.semester <= 0 || !row.categoryCode.trim() || row.credits < 0) continue;
    const key = `${userId}\0${row.semester}\0${row.categoryCode.trim()}`;
    const next = (aggregated.get(key) ?? 0) + row.credits;
    aggregated.set(key, toTwoDecimalNumber(next));
  }

  const byUser = new Map<string, Array<CreditEntry>>();
  for (const [key, credits] of aggregated) {
    const [userId, semStr, categoryId] = key.split("\0");
    if (!byUser.has(userId)) byUser.set(userId, []);
    byUser.get(userId)!.push({ categoryId, semesterTaken: Number(semStr), credits });
  }

  const errors = Array.from(unknownRegs).map((r) => `Registration number not in your students: ${r}`);
  let imported = 0;
  for (const [userId, entries] of byUser) {
    await upsertStudentCredits(env, userId, entries, modifiedById, writeMode, allowClearAll);
    imported += 1;
  }

  return { imported, failed: unknownRegs.size, errors };
}

export async function upsertStudentCredits(
  env: Env,
  studentId: string,
  entries: CreditEntry[],
  modifiedById: string | null,
  writeMode: CreditWriteMode,
  allowClearAll: boolean,
) {
  const db = getDb(env);
  if (writeMode !== "replace_all" && writeMode !== "patch") {
    throw new Error("writeMode must be one of: replace_all, patch");
  }
  const normalizedEntries = entries.map((e) => ({
    ...e,
    credits: toTwoDecimalNumber(Number(e.credits ?? 0)),
  }));
  const positiveEntries = normalizedEntries.filter((e) => e.credits > 0);
  await db.execute("begin");
  try {
    if (writeMode === "replace_all") {
      if (positiveEntries.length === 0 && !allowClearAll) {
        throw new Error("replace_all with empty credits requires allowClearAll=true");
      }
      await db.execute({ sql: `delete from student_credit_details where student_id = ?`, args: [studentId] });
      for (const { categoryId, semesterTaken, credits } of positiveEntries) {
        await db.execute({
          sql: `insert into student_credit_details (student_id, category_id, semester_taken, credits, modified_by)
                values (?, ?, ?, ?, ?)`,
          args: [studentId, categoryId, semesterTaken, credits, modifiedById],
        });
      }
    } else {
      for (const { categoryId, semesterTaken, credits } of positiveEntries) {
        await db.execute({
          sql: `insert into student_credit_details (student_id, category_id, semester_taken, credits, modified_by)
                values (?, ?, ?, ?, ?)
                on conflict(student_id, category_id, semester_taken) do update set
                  credits = excluded.credits,
                  modified_by = excluded.modified_by,
                  modified_at = current_timestamp`,
          args: [studentId, categoryId, semesterTaken, credits, modifiedById],
        });
      }
    }
    await safeCommit(db);
  } catch (error) {
    await safeRollback(db);
    throw error;
  }
}
