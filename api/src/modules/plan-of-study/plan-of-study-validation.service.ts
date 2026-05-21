import { fetchPlansOfStudyFromJson } from "./plan-of-study.service";
import { fetchRegulationsFromJson } from "../regulations/regulations.service";

type RegulationCreditRule =
  | { type: "fixed"; value: number }
  | { type: "minimum"; value: number }
  | { type: "maximum"; value: number }
  | { type: "range"; min: number; max: number };

type RegulationCategory = {
  code: string;
  name: string;
  measure: "credits" | "units";
  rule: RegulationCreditRule;
};

type Regulation = {
  code: string;
  name: string;
  curriculumStructure: {
    totalCreditsRequired: number;
    totalUnitsRequired?: number;
    categories: RegulationCategory[];
  };
};

type PlanOfStudy = {
  planCode: number;
  planName: string;
  regulationCode: string;
  semesters: Array<{
    semester: number;
    categories: Record<string, number>;
    totalCredits: number;
    totalUnits?: number;
  }>;
  categoryTotals?: Record<string, number>;
  totalCredits?: number;
  totalUnits?: number;
};

export type PlanValidationError = {
  code:
    | "REGULATION_NOT_FOUND"
    | "PLAN_TOTAL_MISMATCH"
    | "PLAN_TOTAL_UNITS_MISMATCH"
    | "PLAN_CATEGORY_CODE_INVALID"
    | "PLAN_CATEGORY_MISSING"
    | "PLAN_CATEGORY_RULE_VIOLATION"
    | "SEMESTER_TOTAL_MISMATCH"
    | "SEMESTER_TOTAL_UNITS_MISMATCH";
  message: string;
  planCode: number;
  planName: string;
  regulationCode: string;
  categoryCode?: string;
  semester?: number;
};

export type PlansValidationReport = {
  hasErrors: boolean;
  totalErrors: number;
  byPlan: Array<{
    planCode: number;
    planName: string;
    regulationCode: string;
    hasErrors: boolean;
    errors: PlanValidationError[];
  }>;
};

function satisfiesRule(value: number, rule: RegulationCreditRule): boolean {
  if (rule.type === "fixed") return value === rule.value;
  if (rule.type === "minimum") return value >= rule.value;
  if (rule.type === "maximum") return value <= rule.value;
  return value >= rule.min && value <= rule.max;
}

function ruleLabel(rule: RegulationCreditRule): string {
  if (rule.type === "fixed") return `exactly ${rule.value}`;
  if (rule.type === "minimum") return `at least ${rule.value}`;
  if (rule.type === "maximum") return `at most ${rule.value}`;
  return `between ${rule.min} and ${rule.max}`;
}

export async function validatePlansOfStudyAgainstRegulations(): Promise<PlansValidationReport> {
  const plansData = await fetchPlansOfStudyFromJson();
  const regsData = await fetchRegulationsFromJson();
  const plans = (plansData.plansOfStudy ?? []) as PlanOfStudy[];
  const regulations = (regsData.regulations ?? []) as Regulation[];
  const regulationByCode = new Map(regulations.map((r) => [r.code, r]));

  const byPlan = plans.map((plan) => {
    const errors: PlanValidationError[] = [];
    const regulation = regulationByCode.get(plan.regulationCode);
    const computedCategoryTotals = (plan.semesters ?? []).reduce<Record<string, number>>((acc, semester) => {
      for (const [code, rawValue] of Object.entries(semester.categories ?? {})) {
        const value = Number(rawValue ?? 0);
        acc[code] = (acc[code] ?? 0) + value;
      }
      return acc;
    }, {});
    const computedPlanTotalCredits = (plan.semesters ?? []).reduce(
      (acc, semester) => acc + Number(semester.totalCredits ?? 0),
      0
    );
    const computedPlanTotalUnits = (plan.semesters ?? []).reduce(
      (acc, semester) => acc + Number(semester.totalUnits ?? 0),
      0
    );

    if (!regulation) {
      errors.push({
        code: "REGULATION_NOT_FOUND",
        message: `Regulation '${plan.regulationCode}' not found for plan '${plan.planCode}'.`,
        planCode: plan.planCode,
        planName: plan.planName,
        regulationCode: plan.regulationCode,
      });
      return {
        planCode: plan.planCode,
        planName: plan.planName,
        regulationCode: plan.regulationCode,
        hasErrors: true,
        errors,
      };
    }

    if (computedPlanTotalCredits !== Number(regulation.curriculumStructure.totalCreditsRequired ?? 0)) {
      errors.push({
        code: "PLAN_TOTAL_MISMATCH",
        message: `Plan total ${computedPlanTotalCredits} does not match regulation total ${regulation.curriculumStructure.totalCreditsRequired}.`,
        planCode: plan.planCode,
        planName: plan.planName,
        regulationCode: plan.regulationCode,
      });
    }
    if (computedPlanTotalUnits !== Number(regulation.curriculumStructure.totalUnitsRequired ?? 0)) {
      errors.push({
        code: "PLAN_TOTAL_UNITS_MISMATCH",
        message: `Plan units total ${computedPlanTotalUnits} does not match regulation units total ${regulation.curriculumStructure.totalUnitsRequired ?? 0}.`,
        planCode: plan.planCode,
        planName: plan.planName,
        regulationCode: plan.regulationCode,
      });
    }

    for (const semester of plan.semesters ?? []) {
      const regulationByCode = new Map((regulation.curriculumStructure.categories ?? []).map((c) => [c.code, c]));
      let creditsSum = 0;
      let unitsSum = 0;
      for (const [code, raw] of Object.entries(semester.categories ?? {})) {
        const value = Number(raw ?? 0);
        const measure = regulationByCode.get(code)?.measure ?? "credits";
        if (measure === "units") unitsSum += value;
        else creditsSum += value;
      }
      if (Number(semester.totalCredits ?? 0) !== creditsSum) {
        errors.push({
          code: "SEMESTER_TOTAL_MISMATCH",
          message: `Semester ${semester.semester} credits total ${semester.totalCredits} does not match credit-category sum ${creditsSum}.`,
          planCode: plan.planCode,
          planName: plan.planName,
          regulationCode: plan.regulationCode,
          semester: semester.semester,
        });
      }
      if (Number(semester.totalUnits ?? 0) !== unitsSum) {
        errors.push({
          code: "SEMESTER_TOTAL_UNITS_MISMATCH",
          message: `Semester ${semester.semester} units total ${semester.totalUnits ?? 0} does not match units-category sum ${unitsSum}.`,
          planCode: plan.planCode,
          planName: plan.planName,
          regulationCode: plan.regulationCode,
          semester: semester.semester,
        });
      }
    }

    const regulationCategories = regulation.curriculumStructure.categories ?? [];
    const regulationCodes = new Set(regulationCategories.map((c) => c.code));
    const planCategoryCodes = new Set(Object.keys(computedCategoryTotals));
    const semesterCategoryCodes = new Set(
      (plan.semesters ?? []).flatMap((semester) => Object.keys(semester.categories ?? {}))
    );

    for (const code of planCategoryCodes) {
      if (!regulationCodes.has(code)) {
        errors.push({
          code: "PLAN_CATEGORY_CODE_INVALID",
          message: `Category code '${code}' is not defined in regulation '${plan.regulationCode}'.`,
          planCode: plan.planCode,
          planName: plan.planName,
          regulationCode: plan.regulationCode,
          categoryCode: code,
        });
      }
    }
    for (const code of semesterCategoryCodes) {
      if (!regulationCodes.has(code)) {
        errors.push({
          code: "PLAN_CATEGORY_CODE_INVALID",
          message: `Category code '${code}' is not defined in regulation '${plan.regulationCode}' (found in semester allocation).`,
          planCode: plan.planCode,
          planName: plan.planName,
          regulationCode: plan.regulationCode,
          categoryCode: code,
        });
      }
    }

    for (const category of regulationCategories) {
      if (!planCategoryCodes.has(category.code)) {
        errors.push({
          code: "PLAN_CATEGORY_MISSING",
          message: `Required category '${category.code}' is missing from plan semester allocations.`,
          planCode: plan.planCode,
          planName: plan.planName,
          regulationCode: plan.regulationCode,
          categoryCode: category.code,
        });
        continue;
      }
      const value = Number(computedCategoryTotals[category.code] ?? 0);
      if (!satisfiesRule(value, category.rule)) {
        errors.push({
          code: "PLAN_CATEGORY_RULE_VIOLATION",
          message: `Category '${category.code}' has ${value} ${category.measure}; expected ${ruleLabel(category.rule)}.`,
          planCode: plan.planCode,
          planName: plan.planName,
          regulationCode: plan.regulationCode,
          categoryCode: category.code,
        });
      }
    }

    return {
      planCode: plan.planCode,
      planName: plan.planName,
      regulationCode: plan.regulationCode,
      hasErrors: errors.length > 0,
      errors,
    };
  });

  const totalErrors = byPlan.reduce((acc, plan) => acc + plan.errors.length, 0);
  return {
    hasErrors: totalErrors > 0,
    totalErrors,
    byPlan,
  };
}
