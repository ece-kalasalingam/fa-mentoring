import { getDb } from "../../core/db";
import { normalizeEmail, normalizeText, toYear } from "../../core/csv";
import type { CsvImportRow, Env } from "../../core/types";
import { fetchPlansOfStudyFromJson } from "../plan-of-study/plan-of-study.service";

export async function importStudents(
  env: Env,
  rows: CsvImportRow[],
  options?: { restrictToActiveMentorEmail?: string | null; modifiedByUserId?: string | null }
) {
  const db = getDb(env);
  const restrictedMentorEmail = normalizeEmail(options?.restrictToActiveMentorEmail);
  const modifiedByUserId = normalizeText(options?.modifiedByUserId);
  const studentColumnsRes = await db.execute("pragma table_info(students)").catch(() => ({ rows: [] }));
  const studentColumnNames = new Set(studentColumnsRes.rows.map((row) => String(row.name ?? "").toLowerCase()));
  const hasCurrentSemester = studentColumnNames.has("current_semester");
  const hasModifiedBy = studentColumnNames.has("modified_by");
  const hasModifiedAt = studentColumnNames.has("modified_at");
  const plansCatalog = await fetchPlansOfStudyFromJson().catch(() => ({ plansOfStudy: [] as Array<{ planCode: number; semesters: Array<{ semester: number }> }> }));
  const planSemesterBoundsByCode = new Map<number, { min: number; max: number }>();
  for (const plan of plansCatalog.plansOfStudy ?? []) {
    const code = Number(plan.planCode);
    const semesters = Array.isArray(plan.semesters)
      ? plan.semesters
          .map((item) => Number(item.semester))
          .filter((value) => Number.isFinite(value) && Number.isInteger(value))
      : [];
    if (Number.isInteger(code) && semesters.length > 0) {
      planSemesterBoundsByCode.set(code, {
        min: Math.min(...semesters),
        max: Math.max(...semesters),
      });
    }
  }

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    let rowEmail = "";
    try {
    const hasField = (key: string) => Object.prototype.hasOwnProperty.call(row, key);
    const registrationNumberText = normalizeText(row.registration_number);
    const hasRegistrationNumber = hasField("registration_number");
    const planOfStudyCodeText = normalizeText(row.plan_of_study_code);
    const hasPlanOfStudyCode = hasField("plan_of_study_code");
    const planOfStudyCode = planOfStudyCodeText ? Number(planOfStudyCodeText) : null;
    const email = normalizeEmail(row.email);
    rowEmail = email;
    const programText = normalizeText(row.programme);
    const hasProgramme = hasField("programme");
    const program = programText ? Number(programText) : 0;
    const batchText = normalizeText(row.batch);
    const hasBatch = hasField("batch");
    const parsedBatch = batchText ? toYear(batchText) : null;
    const graduatedText = normalizeText(row.graduated).toLowerCase();
    const hasGraduated = hasField("graduated");
    const graduated = graduatedText === "yes" ? 1 : 0;
    const mentorEmail = normalizeEmail(row.mentorEmail ?? row.mentor_email);
    const hasMentorEmail = hasField("mentorEmail") || hasField("mentor_email");
    const currentSemesterText = normalizeText(row.current_semester);
    const hasCurrentSemesterInput = hasField("current_semester");
    const currentSemester = currentSemesterText ? Number(currentSemesterText) : null;

    if (!email) {
      throw new Error("Missing required student field: email");
    }
    if (parsedBatch != null && (parsedBatch < 2010 || parsedBatch > 2040)) {
      throw new Error(`Invalid batch for email ${email}`);
    }
    if (hasPlanOfStudyCode && (planOfStudyCode == null || !Number.isFinite(planOfStudyCode) || !Number.isInteger(planOfStudyCode))) {
      throw new Error(`Plan of study code must be an integer for email ${email}`);
    }
    if (hasProgramme && (!Number.isFinite(program) || !Number.isInteger(program))) {
      throw new Error(`Programme must be an integer id for email ${email}`);
    }
    if (hasGraduated && graduatedText !== "yes" && graduatedText !== "no") {
      throw new Error(`graduated must be Yes or No for email ${email}`);
    }
    if (hasCurrentSemesterInput && (currentSemester == null || !Number.isFinite(currentSemester) || !Number.isInteger(currentSemester) || currentSemester < 1)) {
      throw new Error(`current_semester must be a positive integer for email ${email}`);
    }
    if (restrictedMentorEmail && hasMentorEmail) {
      throw new Error("Faculty cannot update mentor assignment via CSV.");
    }
    if (restrictedMentorEmail && hasProgramme) {
      throw new Error("Faculty cannot update programme via CSV.");
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
    if (restrictedMentorEmail) {
      const scopedStudent = await db.execute({
        sql: `select 1
              from students s
              inner join user_accounts student_ua on student_ua.id = s.user_id
              inner join user_accounts mentor_ua on mentor_ua.id = s.mentor_id
              where s.user_id = ?
                and student_ua.active = 1
                and lower(trim(mentor_ua.email)) = ?
              limit 1`,
        args: [userId, restrictedMentorEmail],
      });
      if (scopedStudent.rows.length === 0) {
        throw new Error(`Faculty can only update active students they are mentoring: ${email}`);
      }
    }
    const existingStudent = await db.execute({
      sql: `select user_id, registration_number, plan_of_study_code, batch
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
    if (batchValue != null && (batchValue < 2010 || batchValue > 2040)) {
      throw new Error(`Batch must be between 2010 and 2040 for email ${email}`);
    }

    const existingPlanOfStudyCode = existingStudent.rows[0]?.plan_of_study_code == null
      ? null
      : Number(existingStudent.rows[0]?.plan_of_study_code);
    const effectivePlanOfStudyCode = hasPlanOfStudyCode
      ? planOfStudyCode
      : (Number.isInteger(existingPlanOfStudyCode) ? existingPlanOfStudyCode : null);
    if (hasCurrentSemesterInput) {
      if (currentSemester == null || !Number.isFinite(currentSemester) || !Number.isInteger(currentSemester) || currentSemester < 1) {
        throw new Error(`current_semester must be a positive integer for email ${email}`);
      }
      const planBounds = effectivePlanOfStudyCode == null ? null : planSemesterBoundsByCode.get(effectivePlanOfStudyCode) ?? null;
      if (planBounds) {
        const minSemester = Math.max(1, Math.floor(planBounds.min));
        const maxSemester = Math.max(minSemester, Math.floor(planBounds.max));
        if (currentSemester < minSemester || currentSemester > maxSemester) {
          throw new Error(`current_semester must be between ${minSemester} and ${maxSemester} for email ${email}`);
        }
      }
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
      const updateArgs: Array<string | number | null> = [];
      if (shouldSetRegistrationNumber) {
        updateColumns.push("registration_number = ?");
        updateArgs.push(resolvedRegistrationNumber);
      }
      if (hasPlanOfStudyCode) {
        updateColumns.push("plan_of_study_code = ?");
        updateArgs.push(planOfStudyCode);
      }
      if (hasBatch) {
        updateColumns.push("batch = ?");
        updateArgs.push(batchValue);
      }
      if (hasProgramme) {
        updateColumns.push("programme = ?");
        updateArgs.push(program);
      }
      if (hasGraduated) {
        updateColumns.push("graduated = ?");
        updateArgs.push(graduated);
      }
      if (hasMentorEmail) {
        updateColumns.push("mentor_id = ?");
        updateArgs.push(mentorId);
      }
      if (hasCurrentSemester && hasCurrentSemesterInput) {
        updateColumns.push("current_semester = ?");
        updateArgs.push(currentSemester);
      }
      if (hasModifiedBy && modifiedByUserId) {
        updateColumns.push("modified_by = ?");
        updateArgs.push(modifiedByUserId);
      }
      if (hasModifiedAt) {
        updateColumns.push("modified_at = current_timestamp");
      }
      if (updateColumns.length > 0) {
        await db.execute({
          sql: `update students
                set ${updateColumns.join(", ")}
                where user_id = ?`,
          args: [...updateArgs, userId]
        });
      }
      succeeded += 1;
      continue;
    }

    const insertColumns = ["user_id", "registration_number", "batch"];
    const insertArgs: Array<string | number | null> = [userId, resolvedRegistrationNumber, batchValue];
    if (hasPlanOfStudyCode) {
      insertColumns.push("plan_of_study_code");
      insertArgs.push(planOfStudyCode);
    }
    if (hasProgramme) {
      insertColumns.push("programme");
      insertArgs.push(program);
    }
    if (hasGraduated) {
      insertColumns.push("graduated");
      insertArgs.push(graduated);
    }
    if (hasMentorEmail) {
      insertColumns.push("mentor_id");
      insertArgs.push(mentorId);
    }
    if (hasCurrentSemester) {
      insertColumns.push("current_semester");
      insertArgs.push(hasCurrentSemesterInput ? currentSemester : 1);
    }
    if (hasModifiedBy) {
      insertColumns.push("modified_by");
      insertArgs.push(modifiedByUserId || null);
    }
    const placeholders = insertColumns.map(() => "?").join(", ");
    await db.execute({
      sql: `insert into students(${insertColumns.join(", ")})
            values(${placeholders})`,
      args: insertArgs
    });
    succeeded += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Unknown row import error";
      const rowLabel = rowEmail || normalizeText(row.email) || `row-${i + 2}`;
      errors.push(`Row ${i + 2} (${rowLabel}): ${message}`);
    }
  }
  return {
    succeeded,
    failed,
    errors,
    total: rows.length,
  };
}
