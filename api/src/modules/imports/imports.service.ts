import { getDb } from "../../core/db";
import { normalizeEmail, normalizeText, toYear } from "../../core/csv";
import type { CsvImportRow, Env } from "../../core/types";

export async function importRegulationsAndCategories(env: Env, rows: CsvImportRow[]) {
  const db = getDb(env);
  await db.execute("BEGIN");
  try {
    for (const row of rows) {
      const code = normalizeText(row.regulation_code);
      const name = normalizeText(row.regulation_name);
      const durationYears = Number.parseInt(normalizeText(row.duration_years), 10);
      const totalCredits = Number.parseInt(normalizeText(row.total_credits_required), 10);
      const categoryCode = normalizeText(row.category_code).toUpperCase();
      const categoryName = normalizeText(row.category_name);
      const minCredits = Number.parseFloat(normalizeText(row.min_credits));

      if (!code || !name || !categoryCode || !categoryName) {
        throw new Error("Missing required regulation/category values");
      }

      await db.execute({
        sql: `insert into regulations(code, name, duration_years, total_credits_required, active, updated_at)
              values(?, ?, ?, ?, 1, current_timestamp)
              on conflict(code) do update set
                name = excluded.name,
                duration_years = excluded.duration_years,
                total_credits_required = excluded.total_credits_required,
                updated_at = current_timestamp`,
        args: [code, name, durationYears, totalCredits]
      });

      await db.execute({
        sql: `insert into regulation_category_requirements(regulation_code, category_code, category_name, min_credits)
              values(?, ?, ?, ?)
              on conflict(regulation_code, category_code) do update set
                category_name = excluded.category_name,
                min_credits = excluded.min_credits`,
        args: [code, categoryCode, categoryName, minCredits]
      });
    }

    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export async function importFaculty(env: Env, rows: CsvImportRow[]) {
  const db = getDb(env);

  for (const row of rows) {
    const employeeId = normalizeText(row.employee_id);
    const name = normalizeText(row.name);
    const email = normalizeEmail(row.email);
    const department = normalizeText(row.department);

    if (!employeeId || !name || !email) {
      throw new Error("Missing required faculty fields");
    }

    await db.execute({
      sql: `insert into faculty_profiles(employee_id, name, email, department, active, updated_at)
            values(?, ?, ?, ?, 1, current_timestamp)
            on conflict(email) do update set
              employee_id = excluded.employee_id,
              name = excluded.name,
              department = excluded.department,
              active = 1,
              updated_at = current_timestamp`,
      args: [employeeId, name, email, department]
    });
  }
}

export async function importStudents(env: Env, rows: CsvImportRow[]) {
  const db = getDb(env);

  for (const row of rows) {
    const rollNo = normalizeText(row.roll_no);
    const fullName = normalizeText(row.name);
    const email = normalizeEmail(row.email);
    const program = normalizeText(row.program);
    const batchStartYear = toYear(row.batch_start_year);
    const mentorEmail = normalizeEmail(row.mentor_email);

    if (!rollNo || !fullName || !email || !program || !mentorEmail) {
      throw new Error("Missing required student fields");
    }

    const mentor = await db.execute({
      sql: "select 1 as ok from faculty_profiles where email = ? limit 1",
      args: [mentorEmail]
    });
    if (mentor.rows.length === 0) {
      throw new Error(`Mentor not found in faculty_profiles: ${mentorEmail}`);
    }

    await db.execute({
      sql: `insert into students(roll_no, full_name, email, program, batch_start_year, mentor_email, completion_status, risk_score, updated_at)
            values(?, ?, ?, ?, ?, ?, 'On Track', 0, current_timestamp)
            on conflict(email) do update set
              roll_no = excluded.roll_no,
              full_name = excluded.full_name,
              program = excluded.program,
              batch_start_year = excluded.batch_start_year,
              mentor_email = excluded.mentor_email,
              updated_at = current_timestamp`,
      args: [rollNo, fullName, email, program, batchStartYear, mentorEmail]
    });
  }
}

export async function importPlanOfStudy(env: Env, rows: CsvImportRow[]) {
  const db = getDb(env);

  if (rows.length === 0) {
    throw new Error("CSV is empty");
  }

  const firstReg = normalizeText(rows[0].regulation_code);
  const codes = new Set(rows.map((r) => normalizeText(r.regulation_code)));
  if (codes.size !== 1) {
    throw new Error("All rows must contain one regulation_code per import");
  }

  const expectedCategoriesRes = await db.execute({
    sql: "select category_code, min_credits from regulation_category_requirements where regulation_code = ?",
    args: [firstReg]
  });
  if (expectedCategoriesRes.rows.length === 0) {
    throw new Error(`No category requirements found for regulation_code: ${firstReg}`);
  }

  const expected = new Map<string, number>();
  for (const row of expectedCategoriesRes.rows) {
    expected.set(String(row.category_code), Number(row.min_credits));
  }

  const actual = new Map<string, number>();
  const parsedRows = rows.map((row) => {
    const regulationCode = normalizeText(row.regulation_code);
    const program = normalizeText(row.program);
    const batchStartYear = toYear(row.batch_start_year);
    const semesterNo = Number.parseInt(normalizeText(row.semester_no), 10);
    const categoryCode = normalizeText(row.category_code).toUpperCase();
    const plannedCredits = Number.parseFloat(normalizeText(row.planned_credits));

    if (!regulationCode || !program || !semesterNo || !categoryCode || !Number.isFinite(plannedCredits)) {
      throw new Error("Invalid/missing plan row values");
    }

    actual.set(categoryCode, (actual.get(categoryCode) ?? 0) + plannedCredits);
    return { regulationCode, program, batchStartYear, semesterNo, categoryCode, plannedCredits };
  });

  const actualCodes = [...actual.keys()].sort();
  const expectedCodes = [...expected.keys()].sort();
  if (actualCodes.join(",") !== expectedCodes.join(",")) {
    throw new Error("category_code mismatch with regulation category requirements");
  }

  for (const [code, needed] of expected.entries()) {
    const got = Number((actual.get(code) ?? 0).toFixed(2));
    const req = Number(needed.toFixed(2));
    if (got !== req) {
      throw new Error(`Category total mismatch for ${code}: planned=${got}, required=${req}`);
    }
  }

  const first = parsedRows[0];
  await db.execute("BEGIN");
  try {
    await db.execute({
      sql: `insert into regulation_plans(regulation_code, program, batch_start_year, version, active)
            values(?, ?, ?, 1, 1)
            on conflict(regulation_code, program, batch_start_year, version) do update set active = 1`,
      args: [first.regulationCode, first.program, first.batchStartYear]
    });

    const plan = await db.execute({
      sql: `select id from regulation_plans
            where regulation_code = ? and program = ? and batch_start_year = ? and version = 1 limit 1`,
      args: [first.regulationCode, first.program, first.batchStartYear]
    });

    const planId = Number(plan.rows[0]?.id);
    if (!planId) {
      throw new Error("Unable to resolve plan id");
    }

    await db.execute({ sql: "delete from regulation_semester_category_plan where plan_id = ?", args: [planId] });

    for (const row of parsedRows) {
      await db.execute({
        sql: `insert into regulation_semester_category_plan(plan_id, semester_no, category_code, planned_credits)
              values(?, ?, ?, ?)
              on conflict(plan_id, semester_no, category_code) do update set planned_credits = excluded.planned_credits`,
        args: [planId, row.semesterNo, row.categoryCode, row.plannedCredits]
      });
    }

    await db.execute("COMMIT");
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}
