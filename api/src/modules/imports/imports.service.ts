import { getDb } from "../../core/db";
import { normalizeEmail, normalizeText, toYear } from "../../core/csv";
import type { CsvImportRow, Env } from "../../core/types";
import { fetchPlansOfStudyFromJson } from "../plan-of-study/plan-of-study.service";

const SQLITE_MAX_IN_PARAMS = 900;

function chunkValues<T>(values: T[], chunkSize: number): T[][] {
  if (values.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }
  return chunks;
}

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
  const updatedStudentUserIds = new Set<string>();
  const uniqueRowEmails = Array.from(
    new Set(
      rows
        .map((row) => normalizeEmail(row.email))
        .filter((email) => email.length > 0)
    )
  );
  const studentAccountByEmail = new Map<string, string>();
  for (const emailChunk of chunkValues(uniqueRowEmails, SQLITE_MAX_IN_PARAMS)) {
    const placeholders = emailChunk.map(() => "?").join(", ");
    const studentAccountsRes = await db.execute({
      sql: `select lower(trim(email)) as email_key, id
            from user_accounts
            where active = 1
              and lower(trim(email)) in (${placeholders})`,
      args: emailChunk
    });
    for (const accountRow of studentAccountsRes.rows) {
      const emailKey = String(accountRow.email_key ?? "").trim().toLowerCase();
      const userId = String(accountRow.id ?? "").trim();
      if (emailKey && userId) {
        studentAccountByEmail.set(emailKey, userId);
      }
    }
  }

  const knownUserIds = Array.from(new Set(Array.from(studentAccountByEmail.values())));
  const existingStudentByUserId = new Map<
    string,
    { registrationNumber: string; planOfStudyCode: number | null; batch: number | null }
  >();
  for (const userIdChunk of chunkValues(knownUserIds, SQLITE_MAX_IN_PARAMS)) {
    const placeholders = userIdChunk.map(() => "?").join(", ");
    const existingStudentsRes = await db.execute({
      sql: `select user_id, registration_number, plan_of_study_code, batch
            from students
            where user_id in (${placeholders})`,
      args: userIdChunk,
    });
    for (const existingRow of existingStudentsRes.rows) {
      const userId = String(existingRow.user_id ?? "").trim();
      if (!userId) continue;
      existingStudentByUserId.set(userId, {
        registrationNumber: normalizeText(existingRow.registration_number),
        planOfStudyCode:
          existingRow.plan_of_study_code == null ? null : Number(existingRow.plan_of_study_code),
        batch: existingRow.batch == null ? null : Number(existingRow.batch),
      });
    }
  }

  const mentorFacultyByEmail = new Map<string, string>();
  const uniqueMentorEmails = Array.from(
    new Set(
      rows
        .map((row) => normalizeEmail(row.mentorEmail ?? row.mentor_email))
        .filter((email) => email.length > 0)
    )
  );
  for (const mentorEmailChunk of chunkValues(uniqueMentorEmails, SQLITE_MAX_IN_PARAMS)) {
    const placeholders = mentorEmailChunk.map(() => "?").join(", ");
    const mentorRes = await db.execute({
      sql: `select lower(trim(ua.email)) as email_key, ua.id
            from user_accounts ua
            where ua.active = 1
              and lower(trim(ua.email)) in (${placeholders})
              and exists (
                select 1
                from json_each(case when json_valid(ua.roles_json) then ua.roles_json else '[]' end) r
                where lower(trim(cast(r.value as text))) = 'faculty'
              )`,
      args: mentorEmailChunk,
    });
    for (const mentorRow of mentorRes.rows) {
      const emailKey = String(mentorRow.email_key ?? "").trim().toLowerCase();
      const mentorId = String(mentorRow.id ?? "").trim();
      if (emailKey && mentorId) {
        mentorFacultyByEmail.set(emailKey, mentorId);
      }
    }
  }

  let restrictedAllowedStudentIds: Set<string> | null = null;
  if (restrictedMentorEmail && knownUserIds.length > 0) {
    restrictedAllowedStudentIds = new Set<string>();
    for (const userIdChunk of chunkValues(knownUserIds, SQLITE_MAX_IN_PARAMS)) {
      const placeholders = userIdChunk.map(() => "?").join(", ");
      const scopedStudentsRes = await db.execute({
        sql: `select distinct s.user_id
              from students s
              inner join user_accounts student_ua on student_ua.id = s.user_id
              inner join user_accounts mentor_ua on mentor_ua.id = s.mentor_id
              where s.user_id in (${placeholders})
                and student_ua.active = 1
                and lower(trim(mentor_ua.email)) = ?`,
        args: [...userIdChunk, restrictedMentorEmail],
      });
      for (const scopedRow of scopedStudentsRes.rows) {
        const scopedUserId = String(scopedRow.user_id ?? "").trim();
        if (scopedUserId) restrictedAllowedStudentIds.add(scopedUserId);
      }
    }
  }

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

    const userId = String(studentAccountByEmail.get(email) ?? "").trim();
    if (!userId) {
      throw new Error(`Student account not found in user_accounts: ${email}`);
    }
    if (restrictedMentorEmail && restrictedAllowedStudentIds && !restrictedAllowedStudentIds.has(userId)) {
        throw new Error(`Faculty can only update active students they are mentoring: ${email}`);
    }
    const existingStudent = existingStudentByUserId.get(userId) ?? null;
    const hasExistingStudent = existingStudent != null;
    const existingRegistrationNumber = existingStudent?.registrationNumber ?? "";
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
      const numericExistingBatch = existingStudent?.batch ?? null;
      batchValue = Number.isInteger(numericExistingBatch) ? numericExistingBatch : 2010;
    }
    if (batchValue != null && (batchValue < 2010 || batchValue > 2040)) {
      throw new Error(`Batch must be between 2010 and 2040 for email ${email}`);
    }

    const existingPlanOfStudyCode = existingStudent?.planOfStudyCode ?? null;
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
      mentorId = String(mentorFacultyByEmail.get(mentorEmail) ?? "").trim() || null;
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
      updatedStudentUserIds.add(userId);
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
    updatedStudentUserIds.add(userId);
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
    updatedStudentUserIds: Array.from(updatedStudentUserIds),
  };
}
