import { getDb } from "../../core/db";
import type { Env } from "../../core/types";

export async function fetchRegulations(env: Env) {
  const db = getDb(env);
  const regs = await db.execute("select code, name, duration_years, total_credits_required, active from regulations order by code");
  const categories = await db.execute(
    "select regulation_code, category_code, category_name, min_credits from regulation_category_requirements order by regulation_code, category_code"
  );
  return { regulations: regs.rows, categories: categories.rows };
}
