import { getDb } from "../../core/db";
import type { Env } from "../../core/types";
import type { StudentScope } from "../auth/authorization.service";
import { computeCreditStatus, CREDIT_STATUSES, CREDIT_STATUS_LABELS, type CreditStatus } from "#shared/creditStatus";
import { fetchPlansOfStudyFromJson } from "../plan-of-study/plan-of-study.service";
import { fetchRegulationsFromJson } from "../regulations/regulations.service";

// Reverse map: "On Track" → "on-track", "Complete" → "complete", etc.
const STATUS_LABEL_TO_KEY = new Map<string, CreditStatus>(
  CREDIT_STATUSES.map((s) => [CREDIT_STATUS_LABELS[s], s]),
);

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

export async function listStudentsByScope(
  env: Env,
  scope: StudentScope,
  limitRaw: string | null,
  cursorRaw: string | null,
  activeOnly = false,
) {
  const db = getDb(env);
  const limit = parseLimit(limitRaw);
  const cursor = String(cursorRaw ?? "").trim();
  const scoped = scopeWhere(scope);
  const whereWithCursor = cursor
    ? scoped.clause
      ? `${scoped.clause} and s.user_id > ? `
      : " where s.user_id > ? "
    : scoped.clause;
  const whereWithActivity = activeOnly
    ? `${whereWithCursor}${whereWithCursor ? " and " : " where "}coalesce(student_ua.active, 0) = 1 `
    : whereWithCursor;
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
            coalesce(nullif(trim(mentor_ua.full_name), ''), nullif(trim(mentor_ua.email), '')) as mentor_name,
            mentor_ua.email as mentor_email
          from students s
          left join user_accounts student_ua on student_ua.id = s.user_id
          left join user_accounts mentor_ua on mentor_ua.id = s.mentor_id
          ${whereWithActivity}
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
    mentor_name: row.mentor_name == null ? null : String(row.mentor_name),
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
            coalesce(sum(case when coalesce(ss.status, 'On Track') = 'On Track' then 1 else 0 end), 0) as on_track_count,
            coalesce(sum(case when coalesce(ss.status, 'On Track') = 'Complete' then 1 else 0 end), 0) as complete_count,
            coalesce(sum(case when coalesce(ss.status, 'On Track') = 'Marginal' then 1 else 0 end), 0) as marginal_count,
            coalesce(sum(case when coalesce(ss.status, 'On Track') = 'Alarming' then 1 else 0 end), 0) as alarming_count,
            coalesce(sum(case when coalesce(ss.status, 'On Track') = 'Off Track' then 1 else 0 end), 0) as off_track_count
          from students s
          left join student_credit_status_summary ss on ss.student_id = s.user_id
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
): Promise<Array<{ studentId: string; totalCredits: number; totalUnits: number; byCategory: Record<string, number>; status: CreditStatus | null }>> {
  if (studentIds.length === 0) return [];
  const db = getDb(env);
  const placeholders = studentIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `select
            student_id,
            coalesce(earned_credits, 0) as total_credits,
            coalesce(earned_units, 0) as total_units,
            coalesce(category_totals_json, '{}') as category_totals_json,
            status
          from student_credit_status_summary
          where student_id in (${placeholders})`,
    args: studentIds as Array<string | number | null>,
  });

  const byStudentCategory = new Map<string, Record<string, number>>();
  const totalCreditsByStudent = new Map<string, number>();
  const totalUnitsByStudent = new Map<string, number>();
  const statusByStudent = new Map<string, CreditStatus>();
  for (const row of result.rows) {
    const studentId = String(row.student_id ?? "");
    if (!studentId) continue;
    const rawCategoryTotals = String(row.category_totals_json ?? "{}");
    let parsedCategoryTotals: Record<string, unknown> = {};
    try {
      parsedCategoryTotals = JSON.parse(rawCategoryTotals) as Record<string, unknown>;
    } catch {
      parsedCategoryTotals = {};
    }
    const normalizedCategoryTotals: Record<string, number> = {};
    for (const [categoryId, rawValue] of Object.entries(parsedCategoryTotals)) {
      const numericValue = Number(rawValue ?? 0);
      if (!Number.isFinite(numericValue)) continue;
      normalizedCategoryTotals[String(categoryId)] = toTwoDecimalNumber(numericValue);
    }
    byStudentCategory.set(studentId, normalizedCategoryTotals);
    totalCreditsByStudent.set(studentId, toTwoDecimalNumber(Number(row.total_credits ?? 0)));
    totalUnitsByStudent.set(studentId, toTwoDecimalNumber(Number(row.total_units ?? 0)));
    const statusKey = STATUS_LABEL_TO_KEY.get(String(row.status ?? ""));
    if (statusKey) statusByStudent.set(studentId, statusKey);
  }

  return studentIds.map((id) => {
    const studentId = String(id ?? "");
    return {
      studentId,
      totalCredits: totalCreditsByStudent.get(studentId) ?? 0,
      totalUnits: totalUnitsByStudent.get(studentId) ?? 0,
      byCategory: byStudentCategory.get(studentId) ?? {},
      status: statusByStudent.get(studentId) ?? null,
    };
  });
}

type PlanMapEntry = {
  regulationCode: string;
  semesters: Array<{ semester: number; categories: Record<string, number> }>;
  totalCredits?: number;
  totalUnits?: number;
};

let planMapCache: Map<number, PlanMapEntry> | null = null;
let measureMapCache: Map<string, Map<string, "credits" | "units">> | null = null;
let schemaHealthCheckedAt = 0;
const SCHEMA_HEALTH_TTL_MS = 10 * 60 * 1000;

async function ensureStudentCreditDetailsSchemaHealthy(db: ReturnType<typeof getDb>): Promise<void> {
  const now = Date.now();
  if (now - schemaHealthCheckedAt < SCHEMA_HEALTH_TTL_MS) return;
  const legacyRef = await db.execute({
    sql: `select 1 as found
          from sqlite_master
          where sql is not null
            and lower(sql) like '%students_old_v5%'
          limit 1`
  }).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
  if (legacyRef.rows.length === 0) {
    schemaHealthCheckedAt = now;
    return;
  }

  await db.execute("begin");
  try {
    await db.execute("drop trigger if exists trg_student_credit_details_modified_at");
    await db.execute("alter table student_credit_details rename to student_credit_details_repair_old");
    await db.execute(`create table student_credit_details (
      enrollment_id integer primary key autoincrement,
      student_id text not null,
      category_id text(10) not null,
      semester_taken integer not null check (semester_taken > 0),
      credits real not null check (credits >= 0),
      status integer not null default 1 check (status in (0,1,2,3,4,5)),
      modified_by text,
      modified_at datetime not null default current_timestamp,
      constraint fk_credit_student_id
        foreign key (student_id) references students(user_id) on delete cascade,
      constraint fk_credit_modified_by
        foreign key (modified_by) references user_accounts(id) on delete set null,
      constraint uq_student_semester_category
        unique (student_id, category_id, semester_taken)
    )`);
    await db.execute(`insert into student_credit_details(enrollment_id, student_id, category_id, semester_taken, credits, status, modified_by, modified_at)
      select enrollment_id, student_id, category_id, semester_taken, credits, status, modified_by, modified_at
      from student_credit_details_repair_old`);
    await db.execute("drop table student_credit_details_repair_old");
    await db.execute("create index if not exists idx_credit_details_student on student_credit_details(student_id)");
    await db.execute("create index if not exists idx_credit_details_student_sem on student_credit_details(student_id, semester_taken)");
    await db.execute("create index if not exists idx_credit_details_student_category_status on student_credit_details(student_id, category_id, status)");
    await db.execute(`create trigger if not exists trg_student_credit_details_modified_at
      after update on student_credit_details
      for each row
      when new.modified_at = old.modified_at
      begin
        update student_credit_details
        set modified_at = current_timestamp
        where enrollment_id = new.enrollment_id;
      end`);
    await safeCommit(db);
    schemaHealthCheckedAt = Date.now();
  } catch (error) {
    await safeRollback(db);
    throw error;
  }
}

async function ensureSummaryReferenceCaches(): Promise<{
  plansByCode: Map<number, PlanMapEntry>;
  measureByRegulation: Map<string, Map<string, "credits" | "units">>;
}> {
  if (planMapCache && measureMapCache) {
    return { plansByCode: planMapCache, measureByRegulation: measureMapCache };
  }
  const [plansRes, regsRes] = await Promise.all([
    fetchPlansOfStudyFromJson().catch(() => ({ plansOfStudy: [] as Array<Record<string, unknown>> })),
    fetchRegulationsFromJson().catch(() => ({ regulations: [] as Array<Record<string, unknown>> })),
  ]);
  const plansByCode = new Map<number, PlanMapEntry>();
  for (const rawPlan of (plansRes.plansOfStudy ?? []) as Array<Record<string, unknown>>) {
    const planCode = Number(rawPlan.planCode ?? 0);
    const regulationCode = String(rawPlan.regulationCode ?? "");
    if (!Number.isInteger(planCode) || !regulationCode) continue;
    const semesters = Array.isArray(rawPlan.semesters)
      ? (rawPlan.semesters as Array<Record<string, unknown>>)
          .map((semester) => ({
            semester: Number(semester.semester ?? 0),
            categories: (semester.categories as Record<string, number>) ?? {},
          }))
          .filter((semester) => Number.isInteger(semester.semester) && semester.semester > 0)
      : [];
    plansByCode.set(planCode, {
      regulationCode,
      semesters,
      totalCredits: rawPlan.totalCredits == null ? undefined : Number(rawPlan.totalCredits),
      totalUnits: rawPlan.totalUnits == null ? undefined : Number(rawPlan.totalUnits),
    });
  }
  const measureByRegulation = new Map<string, Map<string, "credits" | "units">>();
  for (const rawReg of (regsRes.regulations ?? []) as Array<Record<string, unknown>>) {
    const regCode = String(rawReg.code ?? "");
    if (!regCode) continue;
    const categories = (((rawReg.curriculumStructure as Record<string, unknown> | undefined)?.categories ?? []) as Array<Record<string, unknown>>);
    const measureByCategory = new Map<string, "credits" | "units">();
    for (const category of categories) {
      const code = String(category.code ?? "");
      const measure = String(category.measure ?? "credits").toLowerCase() === "units" ? "units" : "credits";
      if (code) measureByCategory.set(code, measure);
    }
    measureByRegulation.set(regCode, measureByCategory);
  }
  planMapCache = plansByCode;
  measureMapCache = measureByRegulation;
  return { plansByCode, measureByRegulation };
}

export async function getStudentCredits(env: Env, studentId: string) {
  const db = getDb(env);
  await ensureStudentCreditDetailsSchemaHealthy(db);
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

export async function getStudentUnits(env: Env, studentId: string) {
  const db = getDb(env);
  await ensureStudentCreditDetailsSchemaHealthy(db);
  const result = await db.execute({
    sql: `select category_id, coalesce(sum(credits), 0) as units_earned
          from student_credit_details
          where student_id = ?
            and status = 5
          group by category_id
          order by category_id asc`,
    args: [studentId],
  });
  return result.rows.map((row) => ({
    categoryId: String(row.category_id ?? ""),
    unitsEarned: toTwoDecimalNumber(Number(row.units_earned ?? 0)),
  }));
}

export async function assertStudentCanAccessOwnUserId(env: Env, studentEmail: string, studentId: string) {
  const db = getDb(env);
  const result = await db.execute({
    sql: `select 1
          from students s
          inner join user_accounts student_ua on student_ua.id = s.user_id
          where s.user_id = ?
            and lower(trim(student_ua.email)) = ?
            and student_ua.active = 1
          limit 1`,
    args: [studentId, String(studentEmail).trim().toLowerCase()],
  });
  if (result.rows.length === 0) {
    throw new Error("Forbidden");
  }
}

export async function assertStudentCanAccessOwnUserIds(env: Env, studentEmail: string, studentIds: string[]) {
  const db = getDb(env);
  const normalizedEmail = String(studentEmail).trim().toLowerCase();
  const scopedStudentIds = Array.from(
    new Set(
      studentIds
        .map((id) => String(id ?? "").trim())
        .filter((id) => id.length > 0)
    )
  );
  if (!normalizedEmail || scopedStudentIds.length === 0) return;
  const placeholders = scopedStudentIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `select distinct s.user_id
          from students s
          inner join user_accounts student_ua on student_ua.id = s.user_id
          where s.user_id in (${placeholders})
            and lower(trim(student_ua.email)) = ?
            and student_ua.active = 1`,
    args: [...scopedStudentIds, normalizedEmail],
  });
  const allowedIds = new Set(result.rows.map((row) => String(row.user_id ?? "").trim()).filter((id) => id.length > 0));
  if (allowedIds.size !== scopedStudentIds.length) {
    throw new Error("Forbidden");
  }
}

async function recomputeStudentCreditSummaryWithDb(
  db: ReturnType<typeof getDb>,
  studentIdRaw: string,
  options?: { recomputeBatch?: boolean }
): Promise<number | null> {
  const recomputeBatch = options?.recomputeBatch ?? true;
  const studentId = String(studentIdRaw ?? "").trim();
  if (!studentId) return null;
  const summaryRes = await db.execute({
    sql: `with per_category as (
            select
              student_id,
              category_id,
              coalesce(sum(credits), 0) as total_value,
              coalesce(sum(case when coalesce(status, 0) = 5 then credits else 0 end), 0) as unit_value,
              coalesce(sum(case when coalesce(status, 0) = 5 then 0 else credits end), 0) as credit_value
            from student_credit_details
            where student_id = ?
            group by student_id, category_id
          ),
          totals as (
            select
              coalesce(sum(credit_value), 0) as earned_credits,
              coalesce(sum(unit_value), 0) as earned_units,
              coalesce(sum(total_value), 0) as earned_total
            from per_category
          ),
          cats as (
            select coalesce(json_group_object(category_id, total_value), '{}') as category_totals_json
            from per_category
          )
          select
            s.user_id as student_id,
            coalesce(s.batch, 2010) as batch,
            s.plan_of_study_code as plan_of_study_code,
            coalesce(s.current_semester, 1) as current_semester,
            coalesce(t.earned_credits, 0) as earned_credits,
            coalesce(t.earned_units, 0) as earned_units,
            coalesce(t.earned_total, 0) as earned_total,
            coalesce(c.category_totals_json, '{}') as category_totals_json
          from students s
          left join totals t on 1 = 1
          left join cats c on 1 = 1
          where s.user_id = ?
          limit 1`,
    args: [studentId, studentId],
  });
  const row = summaryRes.rows[0];
  if (!row) return null;
  const { plansByCode, measureByRegulation } = await ensureSummaryReferenceCaches();
  const planCode = row.plan_of_study_code == null ? null : Number(row.plan_of_study_code);
  const currentSemester = Number(row.current_semester ?? 1);
  const categoryTotalsJson = String(row.category_totals_json ?? "{}");
  let categoryTotals: Record<string, number> = {};
  try {
    categoryTotals = JSON.parse(categoryTotalsJson) as Record<string, number>;
  } catch {
    categoryTotals = {};
  }
  const plan = planCode == null ? null : plansByCode.get(planCode) ?? null;
  const measureByCategory = plan ? (measureByRegulation.get(plan.regulationCode) ?? new Map<string, "credits" | "units">()) : new Map<string, "credits" | "units">();
  const categoryRequired: Record<string, number> = {};
  const categoryExpected: Record<string, number> = {};
  let requiredCredits = 0;
  let requiredUnits = 0;
  let expectedCredits = 0;
  let expectedUnits = 0;
  if (plan) {
    for (const semester of plan.semesters) {
      for (const [categoryCode, rawValue] of Object.entries(semester.categories ?? {})) {
        const numeric = Number(rawValue ?? 0);
        if (!Number.isFinite(numeric) || numeric <= 0) continue;
        categoryRequired[categoryCode] = (categoryRequired[categoryCode] ?? 0) + numeric;
        if ((measureByCategory.get(categoryCode) ?? "credits") === "units") {
          requiredUnits += numeric;
        } else {
          requiredCredits += numeric;
        }
        if (semester.semester >= currentSemester) continue;
        categoryExpected[categoryCode] = (categoryExpected[categoryCode] ?? 0) + numeric;
        if ((measureByCategory.get(categoryCode) ?? "credits") === "units") {
          expectedUnits += numeric;
        } else {
          expectedCredits += numeric;
        }
      }
    }
  }
  const earnedCredits = toTwoDecimalNumber(Number(row.earned_credits ?? 0));
  const earnedUnits = toTwoDecimalNumber(Number(row.earned_units ?? 0));
  const earnedTotal = toTwoDecimalNumber(Number(row.earned_total ?? 0));
  const requiredTotal = toTwoDecimalNumber(requiredCredits + requiredUnits);
  const expectedTotal = toTwoDecimalNumber(expectedCredits + expectedUnits);
  let deficitCredits = 0;
  let deficitUnits = 0;
  const categoryStatusBase = Object.entries(categoryRequired)
    .filter(([, req]) => req > 0)
    .map(([code, req]) => {
      const earned = Number(categoryTotals[code] ?? 0);
      const expected = Number(categoryExpected[code] ?? 0);
      const shortage = Math.max(0, expected - earned);
      if ((measureByCategory.get(code) ?? "credits") === "units") {
        deficitUnits += shortage;
      } else {
        deficitCredits += shortage;
      }
      return { earned, required: req, expected };
    });
  const overallStatus = computeCreditStatus(requiredTotal, earnedTotal, expectedTotal, categoryStatusBase);
  const statusLabel =
    overallStatus === "complete" ? "Complete"
    : overallStatus === "on-track" ? "On Track"
    : overallStatus === "marginal" ? "Marginal"
    : overallStatus === "alarming" ? "Alarming"
    : "Off Track";
  await db.execute({
    sql: `insert into student_credit_status_summary(
            student_id,
            batch,
            plan_of_study_code,
            current_semester,
            earned_credits,
            earned_units,
            earned_total,
            required_credits,
            required_units,
            required_total,
            expected_credits,
            expected_units,
            expected_total,
            deficit_credits,
            deficit_units,
            deficit_total,
            status,
            category_totals_json,
            category_required_json,
            category_expected_json,
            computed_at,
            updated_at
          )
          values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp, current_timestamp)
          on conflict(student_id) do update set
            batch = excluded.batch,
            plan_of_study_code = excluded.plan_of_study_code,
            current_semester = excluded.current_semester,
            earned_credits = excluded.earned_credits,
            earned_units = excluded.earned_units,
            earned_total = excluded.earned_total,
            required_credits = excluded.required_credits,
            required_units = excluded.required_units,
            required_total = excluded.required_total,
            expected_credits = excluded.expected_credits,
            expected_units = excluded.expected_units,
            expected_total = excluded.expected_total,
            deficit_credits = excluded.deficit_credits,
            deficit_units = excluded.deficit_units,
            deficit_total = excluded.deficit_total,
            status = excluded.status,
            category_totals_json = excluded.category_totals_json,
            category_required_json = excluded.category_required_json,
            category_expected_json = excluded.category_expected_json,
            computed_at = current_timestamp,
            updated_at = current_timestamp`,
    args: [
      String(row.student_id ?? ""),
      Number(row.batch ?? 2010),
      planCode,
      currentSemester,
      earnedCredits,
      earnedUnits,
      earnedTotal,
      toTwoDecimalNumber(requiredCredits),
      toTwoDecimalNumber(requiredUnits),
      requiredTotal,
      toTwoDecimalNumber(expectedCredits),
      toTwoDecimalNumber(expectedUnits),
      expectedTotal,
      toTwoDecimalNumber(deficitCredits),
      toTwoDecimalNumber(deficitUnits),
      toTwoDecimalNumber(deficitCredits + deficitUnits),
      statusLabel,
      categoryTotalsJson,
      JSON.stringify(categoryRequired),
      JSON.stringify(categoryExpected),
    ],
  });
  const touchedBatch = Number(row.batch ?? 2010);
  if (recomputeBatch) {
    await recomputeBatchStatusSummaryByBatchWithDb(db, touchedBatch);
  }
  return touchedBatch;
}

export async function recomputeStudentCreditSummary(env: Env, studentId: string): Promise<void> {
  const db = getDb(env);
  await recomputeStudentCreditSummaryWithDb(db, studentId, { recomputeBatch: true });
}

export async function recomputeStudentCreditSummaries(env: Env, studentIds: string[]): Promise<void> {
  const db = getDb(env);
  const uniqueIds = Array.from(new Set(studentIds.map((id) => String(id ?? "").trim()).filter((id) => id.length > 0)));
  if (uniqueIds.length === 0) return;
  const touchedBatches = new Set<number>();
  for (const studentId of uniqueIds) {
    const touchedBatch = await recomputeStudentCreditSummaryWithDb(db, studentId, { recomputeBatch: false });
    if (touchedBatch != null && Number.isFinite(touchedBatch)) {
      touchedBatches.add(touchedBatch);
    }
  }
  for (const batch of touchedBatches) {
    await recomputeBatchStatusSummaryByBatchWithDb(db, batch);
  }
}

async function recomputeBatchStatusSummaryByBatchWithDb(db: ReturnType<typeof getDb>, batch: number): Promise<void> {
  if (!Number.isFinite(batch)) return;
  await db.execute({
    sql: `insert or replace into batch_credit_status_summary(
            batch, scope_type, scope_key,
            total_active, in_progress_count, passed_out_count,
            complete_count, on_track_count, marginal_count, alarming_count, off_track_count,
            complete_pct, on_track_pct, marginal_pct, alarming_pct, off_track_pct,
            computed_at, updated_at
          )
          with scoped as (
            select
              s.batch,
              'head' as scope_type,
              'all' as scope_key,
              s.graduated,
              coalesce(ss.status, 'On Track') as status
            from students s
            inner join user_accounts ua on ua.id = s.user_id and ua.active = 1
            left join student_credit_status_summary ss on ss.student_id = s.user_id
            where s.batch = ?
            union all
            select
              s.batch,
              'moderator' as scope_type,
              'all' as scope_key,
              s.graduated,
              coalesce(ss.status, 'On Track') as status
            from students s
            inner join user_accounts ua on ua.id = s.user_id and ua.active = 1
            left join student_credit_status_summary ss on ss.student_id = s.user_id
            where s.batch = ?
            union all
            select
              s.batch,
              'faculty' as scope_type,
              s.mentor_id as scope_key,
              s.graduated,
              coalesce(ss.status, 'On Track') as status
            from students s
            inner join user_accounts ua on ua.id = s.user_id and ua.active = 1
            left join student_credit_status_summary ss on ss.student_id = s.user_id
            where s.batch = ?
              and s.mentor_id is not null
          ),
          grouped as (
            select
              batch,
              scope_type,
              scope_key,
              count(*) as total_active,
              coalesce(sum(case when coalesce(graduated, 0) = 0 then 1 else 0 end), 0) as in_progress_count,
              coalesce(sum(case when coalesce(graduated, 0) = 1 then 1 else 0 end), 0) as passed_out_count,
              coalesce(sum(case when status = 'Complete' then 1 else 0 end), 0) as complete_count,
              coalesce(sum(case when status = 'On Track' then 1 else 0 end), 0) as on_track_count,
              coalesce(sum(case when status = 'Marginal' then 1 else 0 end), 0) as marginal_count,
              coalesce(sum(case when status = 'Alarming' then 1 else 0 end), 0) as alarming_count,
              coalesce(sum(case when status = 'Off Track' then 1 else 0 end), 0) as off_track_count
            from scoped
            group by batch, scope_type, scope_key
          )
          select
            batch,
            scope_type,
            scope_key,
            total_active,
            in_progress_count,
            passed_out_count,
            complete_count,
            on_track_count,
            marginal_count,
            alarming_count,
            off_track_count,
            case when total_active > 0 then round((complete_count * 100.0) / total_active, 2) else 0 end as complete_pct,
            case when total_active > 0 then round((on_track_count * 100.0) / total_active, 2) else 0 end as on_track_pct,
            case when total_active > 0 then round((marginal_count * 100.0) / total_active, 2) else 0 end as marginal_pct,
            case when total_active > 0 then round((alarming_count * 100.0) / total_active, 2) else 0 end as alarming_pct,
            case when total_active > 0 then round((off_track_count * 100.0) / total_active, 2) else 0 end as off_track_pct,
            current_timestamp,
            current_timestamp
          from grouped`,
    args: [batch, batch, batch],
  });
}

export async function readBatchStatusSummaryByScope(
  env: Env,
  scope: StudentScope,
  options?: { preferredScopeType?: "head" | "moderator" | "faculty" }
): Promise<Array<{
  batch: number;
  totalActive: number;
  inProgressCount: number;
  passedOutCount: number;
  completeCount: number;
  onTrackCount: number;
  marginalCount: number;
  alarmingCount: number;
  offTrackCount: number;
}>> {
  const db = getDb(env);
  let scopeType: "head" | "moderator" | "faculty" | null = null;
  let scopeKey = "all";
  if (scope.type === "mentor") {
    scopeType = "faculty";
    const mentorRes = await db.execute({
      sql: `select id from user_accounts where lower(trim(email)) = ? and active = 1 limit 1`,
      args: [scope.mentorEmail],
    });
    scopeKey = String(mentorRes.rows[0]?.id ?? "").trim();
    if (!scopeKey) return [];
  } else if (scope.type === "all") {
    scopeType = options?.preferredScopeType === "moderator" ? "moderator" : "head";
  } else {
    return [];
  }
  const res = await db.execute({
    sql: `select
            batch,
            total_active,
            in_progress_count,
            passed_out_count,
            complete_count,
            on_track_count,
            marginal_count,
            alarming_count,
            off_track_count
          from batch_credit_status_summary
          where scope_type = ?
            and scope_key = ?
          order by batch asc`,
    args: [scopeType, scopeKey],
  });
  return res.rows.map((row) => ({
    batch: Number(row.batch ?? 0),
    totalActive: Number(row.total_active ?? 0),
    inProgressCount: Number(row.in_progress_count ?? 0),
    passedOutCount: Number(row.passed_out_count ?? 0),
    completeCount: Number(row.complete_count ?? 0),
    onTrackCount: Number(row.on_track_count ?? 0),
    marginalCount: Number(row.marginal_count ?? 0),
    alarmingCount: Number(row.alarming_count ?? 0),
    offTrackCount: Number(row.off_track_count ?? 0),
  }));
}

export type StudentCreditTableRow = {
  registrationNumber: string | null;
  studentId: string;
  graduated: "Yes" | "No";
  categoryId: string;
  semester: number;
  credits: number;
  modifiedByUsername: string | null;
  modifiedAt: string | null;
};

export type StudentCreditTableFilters = {
  registrationNumber?: string | null;
  categoryId?: string | null;
  graduated?: "Yes" | "No" | null;
  modifiedByUsername?: string | null;
  semester?: number | null;
};

export type StudentCreditTablePage = {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

export async function listStudentCreditTableByScope(
  env: Env,
  scope: StudentScope,
  activeOnly = false,
  options?: {
    limitRaw?: string | null;
    offsetRaw?: string | null;
    filters?: StudentCreditTableFilters;
  },
): Promise<{ rows: StudentCreditTableRow[]; page: StudentCreditTablePage }> {
  const db = getDb(env);
  const limit = parseLimit(options?.limitRaw ?? null);
  const offsetParsed = Number.parseInt(String(options?.offsetRaw ?? ""), 10);
  const offset = Number.isFinite(offsetParsed) && offsetParsed > 0 ? offsetParsed : 0;
  const registrationNumberFilter = String(options?.filters?.registrationNumber ?? "").trim().toLowerCase();
  const categoryIdFilter = String(options?.filters?.categoryId ?? "").trim().toLowerCase();
  const modifiedByFilter = String(options?.filters?.modifiedByUsername ?? "").trim().toLowerCase();
  const semesterFilter = Number(options?.filters?.semester ?? 0);
  const graduatedFilterRaw = String(options?.filters?.graduated ?? "").trim().toLowerCase();
  const graduatedFilter =
    graduatedFilterRaw === "yes" ? 1
    : graduatedFilterRaw === "no" ? 0
    : null;
  const scoped = scopeWhere(scope);
  const whereClauses: string[] = [];
  const args: Array<string | number | null> = [...scoped.args];
  if (scoped.clause) {
    const normalized = scoped.clause.replace(/^\s*where\s+/i, "").trim();
    if (normalized) whereClauses.push(normalized);
  }
  if (activeOnly) {
    whereClauses.push("coalesce(student_ua.active, 0) = 1");
  }
  if (registrationNumberFilter) {
    whereClauses.push("lower(coalesce(s.registration_number, '')) like ?");
    args.push(`%${registrationNumberFilter}%`);
  }
  if (categoryIdFilter) {
    whereClauses.push("lower(coalesce(scd.category_id, '')) like ?");
    args.push(`%${categoryIdFilter}%`);
  }
  if (modifiedByFilter) {
    whereClauses.push("lower(coalesce(modifier.full_name, modifier.email, modifier.subject, '')) like ?");
    args.push(`%${modifiedByFilter}%`);
  }
  if (Number.isFinite(semesterFilter) && semesterFilter > 0) {
    whereClauses.push("scd.semester_taken = ?");
    args.push(semesterFilter);
  }
  if (graduatedFilter !== null) {
    whereClauses.push("coalesce(s.graduated, 0) = ?");
    args.push(graduatedFilter);
  }
  const whereSql = whereClauses.length > 0 ? `where ${whereClauses.join(" and ")}` : "";

  const countRes = await db.execute({
    sql: `select count(*) as total
          from student_credit_details scd
          inner join students s on s.user_id = scd.student_id
          left join user_accounts student_ua on student_ua.id = s.user_id
          left join user_accounts modifier on modifier.id = scd.modified_by
          ${whereSql}`,
    args,
  });
  const total = Number(countRes.rows[0]?.total ?? 0);

  const result = await db.execute({
    sql: `select
            s.user_id as student_id,
            s.registration_number,
            s.graduated,
            scd.category_id,
            scd.semester_taken,
            scd.credits,
            coalesce(nullif(trim(modifier.full_name), ''), nullif(trim(modifier.email), ''), nullif(trim(modifier.subject), '')) as modified_by_username,
            scd.modified_at
          from student_credit_details scd
          inner join students s on s.user_id = scd.student_id
          left join user_accounts student_ua on student_ua.id = s.user_id
          left join user_accounts modifier on modifier.id = scd.modified_by
          ${whereSql}
          order by s.registration_number asc, scd.semester_taken asc, scd.category_id asc
          limit ? offset ?`,
    args: [...args, limit, offset],
  });
  const rows: StudentCreditTableRow[] = result.rows.map((row) => ({
    studentId: String(row.student_id ?? "").trim(),
    registrationNumber: row.registration_number == null ? null : String(row.registration_number),
    graduated: Number(row.graduated ?? 0) === 1 ? "Yes" : "No",
    categoryId: String(row.category_id ?? ""),
    semester: Number(row.semester_taken ?? 0),
    credits: toTwoDecimalNumber(Number(row.credits ?? 0)),
    modifiedByUsername: row.modified_by_username == null ? null : String(row.modified_by_username),
    modifiedAt: row.modified_at == null ? null : String(row.modified_at),
  }));
  return {
    rows,
    page: {
      limit,
      offset,
      total,
      hasMore: offset + rows.length < total,
    },
  };
}

type CreditEntry = { categoryId: string; semesterTaken: number; credits: number };
type UnitEntry = { categoryId: string; unitsEarned: number };
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
): Promise<{
  imported: number;
  failed: number;
  errors: string[];
  updatedStudentUserIds: string[];
  summaryRowsUpdated: number;
}> {
  const db = getDb(env);
  await ensureStudentCreditDetailsSchemaHealthy(db);
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
  const updatedStudentUserIds: string[] = [];
  for (const [userId, entries] of byUser) {
    await upsertStudentCredits(env, userId, entries, modifiedById, writeMode, allowClearAll, { recomputeSummary: false });
    updatedStudentUserIds.push(userId);
    imported += 1;
  }

  if (updatedStudentUserIds.length > 0) {
    await recomputeStudentCreditSummaries(env, updatedStudentUserIds);
  }

  // Fail-safe verification: ensure every touched student has a summary row.
  let summaryRowsUpdated = 0;
  if (updatedStudentUserIds.length > 0) {
    const placeholders = updatedStudentUserIds.map(() => "?").join(", ");
    const summaryCountRes = await db.execute({
      sql: `select count(*) as c
            from student_credit_status_summary
            where student_id in (${placeholders})`,
      args: updatedStudentUserIds,
    });
    summaryRowsUpdated = Number(summaryCountRes.rows[0]?.c ?? 0);

    if (summaryRowsUpdated !== updatedStudentUserIds.length) {
      // One retry pass to self-heal transient/partial states.
      await recomputeStudentCreditSummaries(env, updatedStudentUserIds);
      const retryCountRes = await db.execute({
        sql: `select count(*) as c
              from student_credit_status_summary
              where student_id in (${placeholders})`,
        args: updatedStudentUserIds,
      });
      summaryRowsUpdated = Number(retryCountRes.rows[0]?.c ?? 0);
      if (summaryRowsUpdated !== updatedStudentUserIds.length) {
        throw new Error(
          `Bulk import consistency check failed: expected ${updatedStudentUserIds.length} student summary rows, found ${summaryRowsUpdated}.`,
        );
      }
    }
  }

  return { imported, failed: unknownRegs.size, errors, updatedStudentUserIds, summaryRowsUpdated };
}

export async function upsertStudentCredits(
  env: Env,
  studentId: string,
  entries: CreditEntry[],
  modifiedById: string | null,
  writeMode: CreditWriteMode,
  allowClearAll: boolean,
  options?: { recomputeSummary?: boolean },
) {
  const db = getDb(env);
  await ensureStudentCreditDetailsSchemaHealthy(db);
  const normalizedStudentId = String(studentId ?? "").trim();
  if (!normalizedStudentId) {
    throw new Error("studentId is required");
  }
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
      for (const { categoryId, semesterTaken, credits } of positiveEntries) {
        await db.execute({
          sql: `insert into student_credit_details (student_id, category_id, semester_taken, credits, modified_by)
                values (?, ?, ?, ?, ?)
                on conflict(student_id, category_id, semester_taken) do update set
                  credits = excluded.credits,
                  modified_by = excluded.modified_by,
                  modified_at = current_timestamp`,
          args: [normalizedStudentId, categoryId, semesterTaken, credits, modifiedById],
        });
      }
      if (positiveEntries.length > 0) {
        const valuePlaceholders = positiveEntries.map(() => "(?, ?)").join(", ");
        const keepArgs: Array<string | number | null> = [];
        for (const entry of positiveEntries) {
          keepArgs.push(entry.categoryId, entry.semesterTaken);
        }
        await db.execute({
          sql: `delete from student_credit_details
                where student_id = ?
                  and coalesce(status, 0) != 5
                  and (category_id, semester_taken) not in (${valuePlaceholders})`,
          args: [normalizedStudentId, ...keepArgs],
        });
      } else {
        await db.execute({
          sql: `delete from student_credit_details
                where student_id = ?
                  and coalesce(status, 0) != 5`,
          args: [normalizedStudentId],
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
          args: [normalizedStudentId, categoryId, semesterTaken, credits, modifiedById],
        });
      }
    }
    await safeCommit(db);
  } catch (error) {
    await safeRollback(db);
    throw error;
  }
  if (options?.recomputeSummary !== false) {
    await recomputeStudentCreditSummaryWithDb(db, normalizedStudentId);
  }
}

export async function upsertStudentUnits(
  env: Env,
  studentId: string,
  entries: UnitEntry[],
  modifiedById: string | null,
  writeMode: CreditWriteMode,
  allowClearAll: boolean,
) {
  const db = getDb(env);
  await ensureStudentCreditDetailsSchemaHealthy(db);
  const normalizedStudentId = String(studentId ?? "").trim();
  if (!normalizedStudentId) {
    throw new Error("studentId is required");
  }
  if (writeMode !== "replace_all" && writeMode !== "patch") {
    throw new Error("writeMode must be one of: replace_all, patch");
  }
  const normalizedEntries = entries.map((e) => ({
    ...e,
    unitsEarned: toTwoDecimalNumber(Number(e.unitsEarned ?? 0)),
  }));
  const positiveEntries = normalizedEntries.filter((e) => e.unitsEarned > 0);
  await db.execute("begin");
  try {
    if (writeMode === "replace_all") {
      if (positiveEntries.length === 0 && !allowClearAll) {
        throw new Error("replace_all with empty units requires allowClearAll=true");
      }
      for (const { categoryId, unitsEarned } of positiveEntries) {
        await db.execute({
          sql: `insert into student_credit_details (student_id, category_id, semester_taken, credits, status, modified_by)
                values (?, ?, 1, ?, 5, ?)
                on conflict(student_id, category_id, semester_taken) do update set
                  credits = excluded.credits,
                  status = excluded.status,
                  modified_by = excluded.modified_by,
                  modified_at = current_timestamp`,
          args: [normalizedStudentId, categoryId, unitsEarned, modifiedById],
        });
      }
      if (positiveEntries.length > 0) {
        const valuePlaceholders = positiveEntries.map(() => "(?)").join(", ");
        const keepArgs = positiveEntries.map((entry) => entry.categoryId);
        await db.execute({
          sql: `delete from student_credit_details
                where student_id = ?
                  and status = 5
                  and category_id not in (${valuePlaceholders})`,
          args: [normalizedStudentId, ...keepArgs],
        });
      } else {
        await db.execute({
          sql: `delete from student_credit_details
                where student_id = ?
                  and status = 5`,
          args: [normalizedStudentId],
        });
      }
    } else {
      for (const { categoryId, unitsEarned } of positiveEntries) {
        await db.execute({
          sql: `insert into student_credit_details (student_id, category_id, semester_taken, credits, status, modified_by)
                values (?, ?, 1, ?, 5, ?)
                on conflict(student_id, category_id, semester_taken) do update set
                  credits = excluded.credits,
                  status = excluded.status,
                  modified_by = excluded.modified_by,
                  modified_at = current_timestamp`,
          args: [normalizedStudentId, categoryId, unitsEarned, modifiedById],
        });
      }
    }
    await safeCommit(db);
  } catch (error) {
    await safeRollback(db);
    throw error;
  }
  await recomputeStudentCreditSummaryWithDb(db, normalizedStudentId);
}
