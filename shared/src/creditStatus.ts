/**
 * Canonical credit-status types, constants, and computation.
 *
 * This is the single source of truth used by every frontend and backend that
 * needs to classify a student's credit progress.  Import from this module;
 * do not duplicate the logic elsewhere.
 */

// ── Types & constants ─────────────────────────────────────────────────────────

export type CreditStatus = "complete" | "on-track" | "marginal" | "alarming" | "off-track";

export const CREDIT_STATUSES = [
  "complete",
  "on-track",
  "marginal",
  "alarming",
  "off-track",
] as const satisfies readonly CreditStatus[];

export const CREDIT_STATUS_LABELS: Record<CreditStatus, string> = {
  "complete":  "Complete",
  "on-track":  "On Track",
  "marginal":  "Marginal",
  "alarming":  "Alarming",
  "off-track": "Off Track",
};

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * Classify a student's overall credit progress, or a single credit category,
 * into one of five status bands.
 *
 * Parameters
 * ----------
 * target
 *   Total credits/units required (degree total, or a single category total).
 *
 * earned
 *   Total credits/units actually earned so far.
 *
 * expected
 *   Cumulative credits/units that should have been earned by the start of the
 *   current semester — i.e. the sum of planned credits/units for every semester
 *   that has already passed.  Used only for per-category calls (no `categories`
 *   argument) to compute the single-category deficit.
 *
 * categories  (optional)
 *   Per-category { earned, required, expected } triples.  When supplied the
 *   function computes status from the sum of per-category deficits rather than
 *   a single overall deficit, giving a more accurate picture.  Omit for
 *   per-category calls.
 *
 * Status bands
 * ------------
 * complete  — earned >= target AND every category with a non-zero requirement
 *             is also fully satisfied (when `categories` is provided).
 *
 * on-track  — Not yet complete.  No per-category deficit: every category with
 *             a non-zero expected value has earned >= expected (cumulative).
 *             Cross-semester compensation within a category counts; cross-
 *             category compensation does NOT.
 *
 * marginal  — At least one category has a deficit, but total_deficit ≤ 3 % of
 *             `target`.
 *
 * alarming  — total_deficit is between 3 % and 10 % of `target` (exclusive on
 *             the low end, inclusive on the high end).
 *
 * off-track — total_deficit > 10 % of `target`.
 *
 * total_deficit = Σ max(0, cat.expected − cat.earned) across all categories,
 * or simply max(0, expected − earned) for per-category calls.
 */
export function computeCreditStatus(
  target: number,
  earned: number,
  expected: number,
  categories?: Array<{ earned: number; required: number; expected: number }>,
): CreditStatus {
  if (target <= 0) return "complete";

  const allCatsComplete =
    !categories ||
    categories.every((c) => c.required <= 0 || c.earned >= c.required);

  if (earned >= target && allCatsComplete) return "complete";

  if (categories && categories.length > 0) {
    const onTrack = categories.every((c) => c.required <= 0 || c.earned >= c.expected);
    if (onTrack) return "on-track";
    const totalDeficit = categories.reduce((sum, c) => sum + Math.max(0, c.expected - c.earned), 0);
    const pct = totalDeficit / target;
    if (pct <= 0.03) return "marginal";
    if (pct <= 0.10) return "alarming";
    return "off-track";
  } else {
    const deficit = Math.max(0, expected - earned);
    if (deficit === 0) return "on-track";
    const pct = deficit / target;
    if (pct <= 0.03) return "marginal";
    if (pct <= 0.10) return "alarming";
    return "off-track";
  }
}
