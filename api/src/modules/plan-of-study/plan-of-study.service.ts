import plansCatalog from "../../data/plan-of-study.json";

type PlanOfStudySemester = {
  semester: number;
  categories: Record<string, number>;
  totalCredits: number;
};

type PlanOfStudy = {
  planCode: number;
  planName: string;
  regulationCode: string;
  semesters: PlanOfStudySemester[];
  categoryTotals?: Record<string, number>;
  totalCredits?: number;
};

type PlansOfStudyCatalog = {
  plansOfStudy: PlanOfStudy[];
};

export async function fetchPlansOfStudyFromJson() {
  const catalog = plansCatalog as PlansOfStudyCatalog;
  return {
    plansOfStudy: catalog.plansOfStudy ?? [],
  };
}
