import { getDb } from "../../core/db";
import type { Env } from "../../core/types";

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 100);
}

type StudentsSchemaInfo = {
  hasRegistrationNumber: boolean;
  hasPlanOfStudyCode: boolean;
  hasCurrentSemester: boolean;
  hasModifiedBy: boolean;
  hasModifiedAt: boolean;
};

async function getStudentsSchemaInfo(env: Env): Promise<StudentsSchemaInfo> {
  const db = getDb(env);
  const columns = await db.execute("pragma table_info(students)");
  const names = new Set(columns.rows.map((row) => String(row.name ?? "").toLowerCase()));
  return {
    hasRegistrationNumber: names.has("registration_number"),
    hasPlanOfStudyCode: names.has("plan_of_study_code"),
    hasCurrentSemester: names.has("current_semester"),
    hasModifiedBy: names.has("modified_by"),
    hasModifiedAt: names.has("modified_at"),
  };
}

async function ensureStudentsAuditColumns(env: Env): Promise<StudentsSchemaInfo> {
  const db = getDb(env);
  let schema = await getStudentsSchemaInfo(env);
  if (!schema.hasCurrentSemester) {
    await db.execute("alter table students add column current_semester integer not null default 1");
  }
  if (!schema.hasModifiedBy) {
    await db.execute("alter table students add column modified_by text references user_accounts(id)");
  }
  if (!schema.hasModifiedAt) {
    await db.execute("alter table students add column modified_at text");
  }
  if (!schema.hasCurrentSemester || !schema.hasModifiedAt) {
    await db.execute("update students set current_semester = 1 where current_semester is null").catch(() => undefined);
    await db.execute("update students set modified_at = current_timestamp where modified_at is null or trim(modified_at) = ''").catch(() => undefined);
  }
  schema = await getStudentsSchemaInfo(env);
  return schema;
}

export async function listStudentsDirectory(env: Env, limitRaw: string | null, cursorRaw: string | null) {
  const db = getDb(env);
  const schema = await getStudentsSchemaInfo(env);
  const limit = parseLimit(limitRaw);
  const cursor = String(cursorRaw ?? "").trim();

  const args: Array<string | number> = [];
  const where = cursor ? "where ua.id > ?" : "where 1 = 1";
  if (cursor) args.push(cursor);
  args.push(limit + 1);

  const rowsRes = await db.execute({
    sql: `select
            ua.id as user_id,
            coalesce(ua.full_name, '') as full_name,
            coalesce(ua.email, '') as email,
            ${schema.hasRegistrationNumber ? "s.registration_number" : "s.user_id"} as registration_number,
            ${schema.hasPlanOfStudyCode ? "s.plan_of_study_code" : "null"} as plan_of_study_code,
            ${schema.hasCurrentSemester ? "s.current_semester" : "1"} as current_semester,
            s.batch as batch,
            s.programme as programme,
            s.graduated as graduated,
            coalesce(mentor.full_name, '') as mentor_name,
            ${schema.hasModifiedBy ? "coalesce(modifier.full_name, '')" : "''"} as modified_by_name,
            ${schema.hasModifiedAt ? "s.modified_at" : "null"} as modified_at
          from user_accounts ua
          left join students s on s.user_id = ua.id
          left join user_accounts mentor on mentor.id = s.mentor_id
          left join user_accounts modifier on modifier.id = s.modified_by
          ${where}
          and ua.active = 1
            and lower(coalesce(ua.roles_json, '')) like '%student%'
          order by ua.id asc
          limit ?`,
    args,
  });

  const hasMore = rowsRes.rows.length > limit;
  const mentorOptionsRes = await db.execute({
    sql: `select distinct trim(full_name) as full_name
          from user_accounts ua
          where ua.active = 1
            and trim(coalesce(ua.full_name, '')) <> ''
            and exists (
              select 1
              from json_each(case when json_valid(ua.roles_json) then ua.roles_json else '[]' end) r
              where lower(trim(cast(r.value as text))) = 'faculty'
            )
          order by trim(full_name) asc`,
  });
  const mentorNameOptions = mentorOptionsRes.rows
    .map((row) => String(row.full_name ?? "").trim())
    .filter((value) => value.length > 0);

  const rows = rowsRes.rows.slice(0, limit).map((row) => ({
    userId: String(row.user_id ?? ""),
    fullName: String(row.full_name ?? ""),
    email: String(row.email ?? ""),
    registrationNumber: row.registration_number == null ? "" : String(row.registration_number),
    planOfStudyCode: row.plan_of_study_code == null ? null : Number(row.plan_of_study_code),
    currentSemester: row.current_semester == null ? 1 : Number(row.current_semester),
    batch: row.batch == null ? null : Number(row.batch),
    programme: row.programme == null ? null : Number(row.programme),
    graduated: Number(row.graduated ?? 0) === 1 ? "Yes" : "No",
    mentorName: row.mentor_name == null ? "" : String(row.mentor_name),
    modifiedByName: row.modified_by_name == null ? "" : String(row.modified_by_name),
    modifiedAt: row.modified_at == null ? null : String(row.modified_at),
  }));

  return {
    rows,
    mentorNameOptions,
    page: {
      limit,
      hasMore,
      nextCursor: hasMore ? rows[rows.length - 1]?.userId ?? null : null,
    },
  };
}

export async function assertFacultyCanEditStudentUserIds(
  env: Env,
  mentorEmailRaw: string,
  userIds: string[]
) {
  const db = getDb(env);
  const mentorEmail = String(mentorEmailRaw ?? "").trim().toLowerCase();
  const scopedUserIds = userIds.map((id) => String(id ?? "").trim()).filter((id) => id.length > 0);
  if (!mentorEmail || scopedUserIds.length === 0) return;

  for (const userId of scopedUserIds) {
    const result = await db.execute({
      sql: `select 1
            from students s
            inner join user_accounts student_ua on student_ua.id = s.user_id
            inner join user_accounts mentor_ua on mentor_ua.id = s.mentor_id
            where s.user_id = ?
              and student_ua.active = 1
              and lower(trim(mentor_ua.email)) = ?
            limit 1`,
      args: [userId, mentorEmail],
    });
    if (result.rows.length === 0) {
      throw new Error("Faculty can only update active students they are mentoring.");
    }
  }
}

export async function upsertStudentDirectoryRow(
  env: Env,
  input: {
    userId: string;
    registrationNumber: string;
    planOfStudyCode: number | null;
    batch: number | null;
    programme: number | null;
    graduated: "Yes" | "No" | null;
    currentSemester: number | null;
    mentorName: string | null;
    modifiedByUserId?: string | null;
  }
) {
  const db = getDb(env);
  const schema = await ensureStudentsAuditColumns(env);
  const userId = String(input.userId ?? "").trim();
  if (!userId) {
    throw new Error("userId is required.");
  }
  if (!schema.hasRegistrationNumber) {
    throw new Error("students.registration_number column is missing. Run super-admin mitigations first.");
  }
  if (!schema.hasPlanOfStudyCode) {
    throw new Error("students.plan_of_study_code column is missing. Run super-admin mitigations first.");
  }
  if (!schema.hasCurrentSemester || !schema.hasModifiedBy || !schema.hasModifiedAt) {
    throw new Error("students audit columns could not be ensured.");
  }

  const userRes = await db.execute({
    sql: "select id from user_accounts where id = ? and active = 1 limit 1",
    args: [userId],
  });
  if (userRes.rows.length === 0) {
    throw new Error("Student user account not found.");
  }

  const batch = input.batch == null ? null : Number(input.batch);
  const graduated = input.graduated == null ? null : String(input.graduated).trim().toLowerCase();
  const registrationNumber = String(input.registrationNumber ?? "").trim() || "Not Allotted";
  const planOfStudyCode = input.planOfStudyCode == null ? null : Number(input.planOfStudyCode);
  const programme = input.programme == null ? null : Number(input.programme);
  const currentSemester = input.currentSemester == null ? null : Number(input.currentSemester);
  const modifiedByUserId = input.modifiedByUserId == null ? null : String(input.modifiedByUserId).trim();
  const mentorName = input.mentorName == null ? null : String(input.mentorName).trim();
  if (registrationNumber.length > 15) {
    throw new Error("Registration number must be at most 15 characters.");
  }
  if (planOfStudyCode != null && (!Number.isFinite(planOfStudyCode) || !Number.isInteger(planOfStudyCode))) {
    throw new Error("Plan of study code must be an integer.");
  }
  if (programme != null && (!Number.isFinite(programme) || !Number.isInteger(programme))) {
    throw new Error("Programme must be an integer.");
  }
  if (currentSemester != null && (!Number.isFinite(currentSemester) || !Number.isInteger(currentSemester) || currentSemester < 1)) {
    throw new Error("Current semester must be a positive integer.");
  }

  const existingRes = await db.execute({
    sql: `select batch, programme, mentor_id, graduated
          from students
          where user_id = ?
          limit 1`,
    args: [userId],
  });
  const existing = existingRes.rows[0] as Record<string, unknown> | undefined;
  const existingBatch = existing?.batch == null ? null : Number(existing.batch);
  const existingProgramme = existing?.programme == null ? null : Number(existing.programme);
  const existingGraduated = Number(existing?.graduated ?? 0) === 1 ? 1 : 0;

  const effectiveBatch = batch ?? existingBatch ?? 2010;
  const effectiveProgramme = programme ?? existingProgramme ?? 0;
  const effectiveGraduated = graduated == null ? existingGraduated : (graduated === "yes" ? 1 : 0);

  if (effectiveBatch == null || !Number.isFinite(effectiveBatch)) {
    throw new Error("Batch is required before saving. Fill Batch first.");
  }
  if (effectiveBatch < 2010 || effectiveBatch > 2050) {
    throw new Error("Batch must be between 2010 and 2050.");
  }

  let mentorId: string | null = existing?.mentor_id == null ? null : String(existing.mentor_id);
  if (mentorName !== null && mentorName.length > 0) {
    const mentorRes = await db.execute({
      sql: `select id
            from user_accounts
            where active = 1
              and lower(trim(full_name)) = lower(trim(?))
              and lower(coalesce(roles_json, '')) like '%faculty%'
            limit 1`,
      args: [mentorName],
    });
    mentorId = mentorRes.rows.length > 0 ? String(mentorRes.rows[0]?.id ?? "").trim() : null;
    if (!mentorId) {
      throw new Error("Mentor name must match an active faculty user full name.");
    }
  } else if (mentorName === "") {
    mentorId = null;
  }

  await db.execute({
    sql: `insert into students(user_id, registration_number, plan_of_study_code, current_semester, batch, programme, graduated, mentor_id, modified_by, modified_at)
          values(?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp)
          on conflict(user_id) do update set
            registration_number = excluded.registration_number,
            plan_of_study_code = excluded.plan_of_study_code,
            current_semester = excluded.current_semester,
            batch = excluded.batch,
            programme = excluded.programme,
            graduated = excluded.graduated,
            mentor_id = excluded.mentor_id,
            modified_by = excluded.modified_by,
            modified_at = current_timestamp`,
    args: [
      userId,
      registrationNumber,
      planOfStudyCode,
      currentSemester ?? 1,
      effectiveBatch,
      effectiveProgramme,
      effectiveGraduated,
      mentorId,
      modifiedByUserId,
    ],
  });
}
