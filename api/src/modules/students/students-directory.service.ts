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
  hasGender: boolean;
  hasSection: boolean;
  hasMobileNumber: boolean;
};

async function getStudentsSchemaInfo(env: Env): Promise<StudentsSchemaInfo> {
  const db = getDb(env);
  const columns = await db.execute("pragma table_info(students)");
  const names = new Set(columns.rows.map((row) => String(row.name ?? "").toLowerCase()));
  return {
    hasRegistrationNumber: names.has("registration_number"),
    hasPlanOfStudyCode: names.has("plan_of_study_code"),
    hasGender: names.has("gender"),
    hasSection: names.has("section"),
    hasMobileNumber: names.has("mobile_number"),
  };
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
            ${schema.hasGender ? "s.gender" : "null"} as gender,
            ${schema.hasSection ? "s.section" : "null"} as section,
            ${schema.hasMobileNumber ? "s.mobile_number" : "null"} as mobile_number,
            s.batch as batch,
            s.programme as programme,
            s.programme_duration as programme_duration,
            coalesce(mentor.full_name, '') as mentor_name
          from user_accounts ua
          left join students s on s.user_id = ua.id
          left join user_accounts mentor on mentor.id = s.mentor_id
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
    gender: row.gender == null ? "" : String(row.gender),
    section: row.section == null ? "" : String(row.section),
    mobileNumber: row.mobile_number == null ? "" : String(row.mobile_number),
    batch: row.batch == null ? null : Number(row.batch),
    programme: row.programme == null ? null : Number(row.programme),
    duration: row.programme_duration == null ? null : Number(row.programme_duration),
    mentorName: row.mentor_name == null ? "" : String(row.mentor_name),
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

export async function upsertStudentDirectoryRow(
  env: Env,
  input: {
    userId: string;
    registrationNumber: string;
    planOfStudyCode: number | null;
    gender: string;
    section: string;
    mobileNumber: string;
    batch: number | null;
    programme: number | null;
    duration: number | null;
    mentorName: string;
  }
) {
  const db = getDb(env);
  const schema = await getStudentsSchemaInfo(env);
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
  if (!schema.hasGender) {
    throw new Error("students.gender column is missing. Run super-admin mitigations first.");
  }
  if (!schema.hasSection) {
    throw new Error("students.section column is missing. Run super-admin mitigations first.");
  }
  if (!schema.hasMobileNumber) {
    throw new Error("students.mobile_number column is missing. Run super-admin mitigations first.");
  }

  const userRes = await db.execute({
    sql: "select id from user_accounts where id = ? and active = 1 limit 1",
    args: [userId],
  });
  if (userRes.rows.length === 0) {
    throw new Error("Student user account not found.");
  }

  const batch = input.batch == null ? null : Number(input.batch);
  const duration = input.duration == null ? null : Number(input.duration);
  const registrationNumber = String(input.registrationNumber ?? "").trim() || "Not Allotted";
  const planOfStudyCode = input.planOfStudyCode == null ? null : Number(input.planOfStudyCode);
  const gender = String(input.gender ?? "").trim();
  const section = String(input.section ?? "").trim();
  const mobileNumber = String(input.mobileNumber ?? "").trim();
  const programme = input.programme == null ? null : Number(input.programme);
  const mentorName = String(input.mentorName ?? "").trim();
  if (registrationNumber.length > 15) {
    throw new Error("Registration number must be at most 15 characters.");
  }
  if (planOfStudyCode != null && (!Number.isFinite(planOfStudyCode) || !Number.isInteger(planOfStudyCode))) {
    throw new Error("Plan of study code must be an integer.");
  }
  if (programme != null && (!Number.isFinite(programme) || !Number.isInteger(programme))) {
    throw new Error("Programme must be an integer.");
  }
  if (section.length > 6) {
    throw new Error("Section must be at most 6 characters.");
  }

  const existingRes = await db.execute({
    sql: `select batch, programme_duration, programme, mentor_id
          from students
          where user_id = ?
          limit 1`,
    args: [userId],
  });
  const existing = existingRes.rows[0] as Record<string, unknown> | undefined;
  const existingBatch = existing?.batch == null ? null : Number(existing.batch);
  const existingDuration = existing?.programme_duration == null ? null : Number(existing.programme_duration);
  const existingProgramme = existing?.programme == null ? null : Number(existing.programme);

  const effectiveBatch = batch ?? existingBatch ?? 2010;
  const effectiveDuration = duration ?? existingDuration ?? 0;
  const effectiveProgramme = programme ?? existingProgramme ?? 0;

  if (effectiveBatch == null || !Number.isFinite(effectiveBatch)) {
    throw new Error("Batch is required before saving. Fill Batch first.");
  }
  if (effectiveDuration == null || !Number.isFinite(effectiveDuration)) {
    throw new Error("Duration is required before saving. Fill Duration first.");
  }
  if (effectiveBatch < 2010 || effectiveBatch > 2050) {
    throw new Error("Batch must be between 2010 and 2050.");
  }

  let mentorId: string | null = null;
  if (mentorName) {
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
  }

  await db.execute({
    sql: `insert into students(user_id, registration_number, plan_of_study_code, gender, section, mobile_number, batch, programme_duration, programme, mentor_id)
          values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(user_id) do update set
            registration_number = excluded.registration_number,
            plan_of_study_code = excluded.plan_of_study_code,
            gender = excluded.gender,
            section = excluded.section,
            mobile_number = excluded.mobile_number,
            batch = excluded.batch,
            programme_duration = excluded.programme_duration,
            programme = excluded.programme,
            mentor_id = excluded.mentor_id`,
    args: [
      userId,
      registrationNumber,
      planOfStudyCode,
      gender || null,
      section || null,
      mobileNumber || null,
      effectiveBatch,
      effectiveDuration,
      effectiveProgramme,
      mentorId,
    ],
  });
}
