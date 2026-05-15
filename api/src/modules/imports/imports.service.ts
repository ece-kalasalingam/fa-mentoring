import { getDb } from "../../core/db";
import { normalizeEmail, normalizeText, toYear } from "../../core/csv";
import type { CsvImportRow, Env } from "../../core/types";

export async function importStudents(env: Env, rows: CsvImportRow[]) {
  const db = getDb(env);

  for (const row of rows) {
    const hasField = (key: string) => Object.prototype.hasOwnProperty.call(row, key);
    const registrationNumberText = normalizeText(row.registration_number);
    const hasRegistrationNumber = hasField("registration_number");
    const planOfStudyCodeText = normalizeText(row.plan_of_study_code);
    const hasPlanOfStudyCode = hasField("plan_of_study_code");
    const planOfStudyCode = planOfStudyCodeText ? Number(planOfStudyCodeText) : null;
    const genderText = normalizeText(row.gender);
    const hasGender = hasField("gender");
    const gender = genderText || null;
    const sectionText = normalizeText(row.section);
    const hasSection = hasField("section");
    const section = sectionText || null;
    const mobileText = normalizeText(row.mobile_number) || normalizeText(row.mobileNumber);
    const hasMobileNumber = hasField("mobile_number") || hasField("mobileNumber");
    const mobileNumber = mobileText || null;
    const email = normalizeEmail(row.email);
    const programText = normalizeText(row.programme);
    const hasProgramme = hasField("programme");
    const program = programText ? Number(programText) : 0;
    const batchText = normalizeText(row.batch);
    const hasBatch = hasField("batch");
    const parsedBatch = batchText ? toYear(batchText) : null;
    const programmeDurationText = normalizeText(row.programme_duration);
    const hasProgrammeDuration = hasField("programme_duration");
    const durationRaw = Number(programmeDurationText);
    const duration = Number.isFinite(durationRaw) ? durationRaw : 0;
    const mentorEmail = normalizeEmail(row.mentorEmail);
    const hasMentorEmail = hasField("mentorEmail") || hasField("mentor_email");

    if (!email) {
      throw new Error("Missing required student field: email");
    }
    if (parsedBatch != null && (parsedBatch < 2010 || parsedBatch > 2050)) {
      throw new Error(`Invalid batch for email ${email}`);
    }
    if (hasPlanOfStudyCode && (planOfStudyCode == null || !Number.isFinite(planOfStudyCode) || !Number.isInteger(planOfStudyCode))) {
      throw new Error(`Plan of study code must be an integer for email ${email}`);
    }
    if (hasProgramme && (!Number.isFinite(program) || !Number.isInteger(program))) {
      throw new Error(`Programme must be an integer id for email ${email}`);
    }
    if (section && section.length > 6) {
      throw new Error(`Section must be at most 6 characters for email ${email}`);
    }
    if (hasProgrammeDuration && !Number.isFinite(durationRaw)) {
      throw new Error(`programme_duration must be numeric for email ${email}`);
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
    const existingStudent = await db.execute({
      sql: `select user_id, registration_number, batch
              from students
              where user_id = ?
              limit 1`,
      args: [userId]
    });
    const hasExistingStudent = existingStudent.rows.length > 0;
    const existingRegistrationNumber = normalizeText(existingStudent.rows[0]?.registration_number);
    const derivedRegistrationNumber = normalizeText(email.split("@")[0] ?? "");
    const resolvedRegistrationNumber = registrationNumberText
      || existingRegistrationNumber
      || derivedRegistrationNumber;
    if (!resolvedRegistrationNumber) {
      throw new Error(`Missing registration_number and unable to derive from email for ${email}`);
    }
    if (resolvedRegistrationNumber.length > 15) {
      throw new Error(`registration_number must be at most 15 characters for email ${email}`);
    }
    const shouldSetRegistrationNumber = hasRegistrationNumber && registrationNumberText.length > 0;
    if (shouldSetRegistrationNumber || !hasExistingStudent) {
      const conflictingRegistration = await db.execute({
        sql: `select user_id
              from students
              where registration_number = ?
                and user_id <> ?
              limit 1`,
        args: [resolvedRegistrationNumber, userId]
      });
      if (conflictingRegistration.rows.length > 0) {
        throw new Error(`registration_number already assigned to another student: ${resolvedRegistrationNumber}`);
      }
    }

    let batchValue = parsedBatch;
    if (batchValue == null) {
      const existingBatch = existingStudent.rows[0]?.batch;
      const numericExistingBatch = existingBatch == null ? null : Number(existingBatch);
      batchValue = Number.isInteger(numericExistingBatch) ? numericExistingBatch : 2010;
    }

    let mentorId: string | null = null;
    if (hasMentorEmail) {
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

    if (hasExistingStudent) {
      const updateColumns: string[] = [];
      const updateArgs: unknown[] = [];
      if (shouldSetRegistrationNumber) {
        updateColumns.push("registration_number = ?");
        updateArgs.push(resolvedRegistrationNumber);
      }
      if (hasPlanOfStudyCode) {
        updateColumns.push("plan_of_study_code = ?");
        updateArgs.push(planOfStudyCode);
      }
      if (hasGender) {
        updateColumns.push("gender = ?");
        updateArgs.push(gender);
      }
      if (hasSection) {
        updateColumns.push("section = ?");
        updateArgs.push(section);
      }
      if (hasMobileNumber) {
        updateColumns.push("mobile_number = ?");
        updateArgs.push(mobileNumber);
      }
      if (hasBatch) {
        updateColumns.push("batch = ?");
        updateArgs.push(batchValue);
      }
      if (hasProgrammeDuration) {
        updateColumns.push("programme_duration = ?");
        updateArgs.push(duration);
      }
      if (hasProgramme) {
        updateColumns.push("programme = ?");
        updateArgs.push(program);
      }
      if (hasMentorEmail) {
        updateColumns.push("mentor_id = ?");
        updateArgs.push(mentorId);
      }
      if (updateColumns.length > 0) {
        await db.execute({
          sql: `update students
                set ${updateColumns.join(", ")}
                where user_id = ?`,
          args: [...updateArgs, userId]
        });
      }
      continue;
    }

    const insertColumns = ["user_id", "registration_number", "batch"];
    const insertArgs: unknown[] = [userId, resolvedRegistrationNumber, batchValue];
    if (hasPlanOfStudyCode) {
      insertColumns.push("plan_of_study_code");
      insertArgs.push(planOfStudyCode);
    }
    if (hasGender) {
      insertColumns.push("gender");
      insertArgs.push(gender);
    }
    if (hasSection) {
      insertColumns.push("section");
      insertArgs.push(section);
    }
    if (hasMobileNumber) {
      insertColumns.push("mobile_number");
      insertArgs.push(mobileNumber);
    }
    if (hasProgrammeDuration) {
      insertColumns.push("programme_duration");
      insertArgs.push(duration);
    }
    if (hasProgramme) {
      insertColumns.push("programme");
      insertArgs.push(program);
    }
    if (hasMentorEmail) {
      insertColumns.push("mentor_id");
      insertArgs.push(mentorId);
    }
    const placeholders = insertColumns.map(() => "?").join(", ");
    await db.execute({
      sql: `insert into students(${insertColumns.join(", ")})
            values(${placeholders})`,
      args: insertArgs
    });
  }
}
