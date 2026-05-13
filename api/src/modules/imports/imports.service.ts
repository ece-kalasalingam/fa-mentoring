import { getDb } from "../../core/db";
import { normalizeEmail, normalizeText, toYear } from "../../core/csv";
import type { CsvImportRow, Env } from "../../core/types";

export async function importStudents(env: Env, rows: CsvImportRow[]) {
  const db = getDb(env);

  for (const row of rows) {
    const registrationNumber = normalizeText(row.registration_number) || "Not Allotted";
    const planOfStudyCodeText = normalizeText(row.plan_of_study_code);
    const planOfStudyCode = planOfStudyCodeText ? Number(planOfStudyCodeText) : null;
    const email = normalizeEmail(row.email);
    const programText = normalizeText(row.programme);
    const program = programText ? Number(programText) : 0;
    const batchValue = toYear(row.batch);
    const durationRaw = Number(row.programme_duration);
    const duration = Number.isFinite(durationRaw) ? durationRaw : 0;
    const mentorEmail = normalizeEmail(row.mentorEmail);

    if (!email) {
      throw new Error("Missing required student field: email");
    }
    if (!batchValue || batchValue < 2010 || batchValue > 2050) {
      throw new Error(`Invalid or missing batch for email ${email}`);
    }
    if (planOfStudyCode != null && (!Number.isFinite(planOfStudyCode) || !Number.isInteger(planOfStudyCode))) {
      throw new Error(`Plan of study code must be an integer for email ${email}`);
    }
    if (!Number.isFinite(program) || !Number.isInteger(program)) {
      throw new Error(`Programme must be an integer id for email ${email}`);
    }

    const studentAccount = await db.execute({
      sql: `select id
            from user_accounts
            where lower(trim(email)) = ?
              and active = 1
            limit 1`,
      args: [email]
    });
    const userId = String(studentAccount.rows[0]?.id ?? "").trim();
    if (!userId) {
      throw new Error(`Student account not found in user_accounts: ${email}`);
    }

    let mentorId: string | null = null;
    if (mentorEmail) {
      const mentor = await db.execute({
        sql: `select id
              from user_accounts ua
              where lower(trim(ua.email)) = ?
                and ua.active = 1
                and exists (
                  select 1
                  from json_each(case when json_valid(ua.roles_json) then ua.roles_json else '[]' end) r
                  where lower(trim(cast(r.value as text))) = 'faculty'
                )
              limit 1`,
        args: [mentorEmail]
      });
      mentorId = mentor.rows.length > 0 ? String(mentor.rows[0]?.id ?? "").trim() : null;
      if (!mentorId) {
        throw new Error(`Mentor account not found as active faculty in user_accounts: ${mentorEmail}`);
      }
    }

    await db.execute({
      sql: `insert into students(user_id, registration_number, plan_of_study_code, batch, programme_duration, programme, mentor_id)
            values(?, ?, ?, ?, ?, ?, ?)
            on conflict(user_id) do update set
              registration_number = excluded.registration_number,
              plan_of_study_code = excluded.plan_of_study_code,
              batch = excluded.batch,
              programme_duration = excluded.programme_duration,
              programme = excluded.programme,
              mentor_id = excluded.mentor_id`,
      args: [userId, registrationNumber, planOfStudyCode, batchValue, duration, program, mentorId]
    });
  }
}
