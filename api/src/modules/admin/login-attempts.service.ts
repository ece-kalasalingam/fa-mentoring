import { getDb } from "../../core/db";
import type { Env } from "../../core/types";

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function decodeCursor(cursorParam: string | null): { attemptedAt: string; attemptId: number } {
  if (!cursorParam) {
    return { attemptedAt: "", attemptId: 0 };
  }
  try {
    const decoded = atob(cursorParam.replace(/-/g, "+").replace(/_/g, "/"));
    const [attemptedAt, attemptId] = decoded.split("|");
    return { attemptedAt: String(attemptedAt ?? ""), attemptId: Number.parseInt(String(attemptId ?? "0"), 10) || 0 };
  } catch {
    return { attemptedAt: "", attemptId: 0 };
  }
}

function encodeCursor(attemptedAt: string, attemptId: number): string {
  return btoa(`${attemptedAt}|${attemptId}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function readLoginAttempts(
  env: Env,
  limitParam: string | null,
  cursorParam: string | null,
  successParam: string | null,
  sinceHoursParam: string | null
) {
  const db = getDb(env);
  const limit = Math.min(100, Math.max(1, parsePositiveInt(limitParam, 20)));
  const sinceHours = Math.min(24 * 30, Math.max(1, parsePositiveInt(sinceHoursParam, 24)));
  const successFilterRaw = String(successParam ?? "").trim();
  const successFilter = successFilterRaw === "0" || successFilterRaw === "1" ? Number.parseInt(successFilterRaw, 10) : -1;
  const cursor = decodeCursor(cursorParam);

  const res = await db.execute({
    sql: `select id, username, ip_address, success, attempted_at
          from auth_login_attempts
          where attempted_at >= datetime('now', ?)
            and (? = -1 or success = ?)
            and (
              ? = ''
              or attempted_at < ?
              or (attempted_at = ? and id < ?)
            )
          order by attempted_at desc, id desc
          limit ?`,
    args: [`-${sinceHours} hours`, successFilter, successFilter, cursor.attemptedAt, cursor.attemptedAt, cursor.attemptedAt, cursor.attemptId, limit + 1]
  });

  const rows = res.rows.slice(0, limit).map((row) => ({
    attemptRef: Number(row.id ?? 0),
    username: String(row.username ?? ""),
    ipAddress: String(row.ip_address ?? ""),
    success: Number(row.success ?? 0) === 1,
    attemptedAt: String(row.attempted_at ?? "")
  }));
  const hasMore = res.rows.length > limit;
  const last = rows[rows.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.attemptedAt, last.attemptRef) : null;

  return {
    rows,
    page: {
      limit,
      hasMore,
      nextCursor
    }
  };
}
