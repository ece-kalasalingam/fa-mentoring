/**
 * Returns up to 2 initials from a display name.
 * Two+ words → first letter of first + last word.
 * One word → first two characters.
 * Empty string → "?".
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export const ROLE_COLORS: Record<string, "error" | "warning" | "secondary" | "primary" | "success" | "default"> = {
  admin: "error",
  moderator: "warning",
  head: "secondary",
  faculty: "primary",
  student: "success",
  guest: "default",
};

// Shared MUI table prop objects — spread these into MaterialReactTable props to keep
// visual style consistent across all table instances.
export const MUI_TABLE_PAPER_PROPS = {
  elevation: 0,
  sx: { border: "1px solid", borderColor: "divider", borderRadius: 2 },
} as const;

export const MUI_TABLE_CONTAINER_PROPS = { sx: { overflowX: "auto" } } as const;

export const MUI_TABLE_BODY_PROPS = {
  sx: { "& tr:nth-of-type(odd) > td": { backgroundColor: "action.hover" } },
} as const;

export const MUI_TABLE_HEAD_CELL_PROPS = {
  sx: { fontWeight: 700, fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)", py: 1.25, whiteSpace: "nowrap" },
} as const;

export const MUI_TABLE_BODY_CELL_PROPS = { sx: { py: 1 } } as const;

export { computeCreditStatus } from "#shared/creditStatus";
import { computeCreditStatus } from "#shared/creditStatus";
import type { PlanOfStudy, Regulation } from "./types";

export function normalizeCredits(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function formatCredits(value: number): string {
  const normalized = normalizeCredits(value);
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  return normalized.toFixed(2);
}

/**
 * Splits semester-keyed earned credits into past-semester "earned" (< currentSem)
 * and current-semester "onStudy" (=== currentSem). Semesters after currentSem are ignored.
 */
export function aggregateEarnedCredits(
  earnedBySemCat: Record<string | number, Record<string, number>>,
  currentSem: number,
): { earned: Record<string, number>; onStudy: Record<string, number> } {
  const earned: Record<string, number> = {};
  const onStudy: Record<string, number> = {};
  for (const [semKey, semData] of Object.entries(earnedBySemCat)) {
    const sem = Number(semKey);
    const target = sem < currentSem ? earned : sem === currentSem ? onStudy : null;
    if (!target) continue;
    for (const [cat, credits] of Object.entries(semData)) {
      target[cat] = (target[cat] ?? 0) + Number(credits);
    }
  }
  return { earned, onStudy };
}

// ── Per-student credit breakdown ──────────────────────────────────────────────

export type CategoryBreakdownRow = {
  code: string;
  name: string;
  /** Total credits/units required by the plan for this category. */
  planTotal: number;
  /** Credits/units earned in past semesters (< currentSem). */
  earnedPast: number;
  /** Credits/units earned in the current semester. */
  onStudy: number;
  /** Credits/units planned for past semesters — used for status computation. */
  expected: number;
};

export type StudentCreditBreakdown = {
  creditRows: CategoryBreakdownRow[];
  unitRows: CategoryBreakdownRow[];
  totalCreditsRequired: number;
  totalUnitsRequired: number;
  /** All-semester credits earned (earnedPast + onStudy) — matches the header "92+1" display. */
  totalCreditsEarned: number;
  totalUnitsEarned: number;
  totalCreditsOnStudy: number;
  totalUnitsOnStudy: number;
  totalCreditsExpected: number;
  totalUnitsExpected: number;
  overallStatus: import("#shared/creditStatus").CreditStatus;
};

/**
 * Single canonical function for computing per-category credit/unit breakdown from
 * a plan, regulation, and raw semester-keyed earned data.  Used by both the student
 * dashboard Credit Progress card and the individual student Analytics tab so both
 * surfaces always show identical numbers.
 */
export function computeStudentCreditBreakdown(
  plan: PlanOfStudy,
  regulation: Regulation | null,
  earnedBySemCat: Record<string | number, Record<string, number>>,
  currentSem: number,
): StudentCreditBreakdown {
  const categoryOrder =
    regulation?.curriculumStructure.categories.map((c) => c.code) ??
    [...new Set(plan.semesters.flatMap((s) => Object.keys(s.categories ?? {})))];

  const measureByCode: Record<string, "credits" | "units"> = {};
  const nameByCode: Record<string, string> = {};
  for (const cat of regulation?.curriculumStructure.categories ?? []) {
    measureByCode[cat.code] = cat.measure ?? "credits";
    nameByCode[cat.code] = cat.name;
  }

  // Accumulate plan totals and expected (past-semester planned) per category.
  const planTotals: Record<string, number> = {};
  const expectedByCat: Record<string, number> = {};
  for (const sem of plan.semesters) {
    for (const [code, val] of Object.entries(sem.categories ?? {})) {
      planTotals[code] = (planTotals[code] ?? 0) + Number(val);
      if (sem.semester < currentSem) {
        expectedByCat[code] = (expectedByCat[code] ?? 0) + Number(val);
      }
    }
  }

  // Split earned by past sems vs current sem.
  const earnedPastByCat: Record<string, number> = {};
  const onStudyByCat: Record<string, number> = {};
  for (const [semKey, semData] of Object.entries(earnedBySemCat)) {
    const sem = Number(semKey);
    const target = sem < currentSem ? earnedPastByCat : sem === currentSem ? onStudyByCat : null;
    if (!target) continue;
    for (const [code, val] of Object.entries(semData)) {
      target[code] = (target[code] ?? 0) + Number(val);
    }
  }

  const creditRows: CategoryBreakdownRow[] = [];
  const unitRows: CategoryBreakdownRow[] = [];
  let totalCreditsRequired = 0, totalUnitsRequired = 0;
  let totalCreditsEarned = 0, totalUnitsEarned = 0;
  let totalCreditsOnStudy = 0, totalUnitsOnStudy = 0;
  let totalCreditsExpected = 0, totalUnitsExpected = 0;

  for (const code of categoryOrder) {
    const pt = planTotals[code] ?? 0;
    const ep = earnedPastByCat[code] ?? 0;
    const os = onStudyByCat[code] ?? 0;
    if (pt === 0 && ep === 0 && os === 0) continue;
    const exp = expectedByCat[code] ?? 0;
    const row: CategoryBreakdownRow = {
      code,
      name: nameByCode[code] ?? code,
      planTotal: normalizeCredits(pt),
      earnedPast: normalizeCredits(ep),
      onStudy: normalizeCredits(os),
      expected: normalizeCredits(exp),
    };
    if ((measureByCode[code] ?? "credits") === "units") {
      unitRows.push(row);
      totalUnitsRequired += pt;
      totalUnitsEarned += ep + os;
      totalUnitsOnStudy += os;
      totalUnitsExpected += exp;
    } else {
      creditRows.push(row);
      totalCreditsRequired += pt;
      totalCreditsEarned += ep + os;
      totalCreditsOnStudy += os;
      totalCreditsExpected += exp;
    }
  }

  // Prefer the regulation's declared totals when available.
  if (regulation?.curriculumStructure.totalCreditsRequired != null) {
    totalCreditsRequired = regulation.curriculumStructure.totalCreditsRequired;
  }
  if (regulation?.curriculumStructure.totalUnitsRequired != null) {
    totalUnitsRequired = regulation.curriculumStructure.totalUnitsRequired;
  }

  const allCatStatuses = [...creditRows, ...unitRows].map((r) => ({
    earned: r.earnedPast + r.onStudy,
    required: r.planTotal,
    expected: r.expected,
  }));
  const overallStatus = computeCreditStatus(
    totalCreditsRequired + totalUnitsRequired,
    totalCreditsEarned + totalUnitsEarned,
    totalCreditsExpected + totalUnitsExpected,
    allCatStatuses,
  );

  return {
    creditRows,
    unitRows,
    totalCreditsRequired: normalizeCredits(totalCreditsRequired),
    totalUnitsRequired: normalizeCredits(totalUnitsRequired),
    totalCreditsEarned: normalizeCredits(totalCreditsEarned),
    totalUnitsEarned: normalizeCredits(totalUnitsEarned),
    totalCreditsOnStudy: normalizeCredits(totalCreditsOnStudy),
    totalUnitsOnStudy: normalizeCredits(totalUnitsOnStudy),
    totalCreditsExpected: normalizeCredits(totalCreditsExpected),
    totalUnitsExpected: normalizeCredits(totalUnitsExpected),
    overallStatus,
  };
}

export const MUI_TABLE_PAGINATION_PROPS_BASE = [
  { label: "10", value: 10 },
  { label: "25", value: 25 },
  { label: "50", value: 50 },
] as const;
