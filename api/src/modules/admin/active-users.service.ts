import { getDb } from "../../core/db";
import type { Env } from "../../core/types";

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function decodeCursor(cursorParam: string | null): { lastSeenAt: string; subject: string } {
  if (!cursorParam) {
    return { lastSeenAt: "", subject: "" };
  }
  try {
    const decoded = atob(cursorParam.replace(/-/g, "+").replace(/_/g, "/"));
    const [lastSeenAt, subject] = decoded.split("|");
    return { lastSeenAt: String(lastSeenAt ?? ""), subject: String(subject ?? "") };
  } catch {
    return { lastSeenAt: "", subject: "" };
  }
}

function encodeCursor(lastSeenAt: string, subject: string): string {
  return btoa(`${lastSeenAt}|${subject}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function readActiveUsers(env: Env, limitParam: string | null, cursorParam: string | null) {
  const db = getDb(env);
  const limit = Math.min(100, Math.max(1, parsePositiveInt(limitParam, 20)));
  const { lastSeenAt, subject } = decodeCursor(cursorParam);

  const res = await db.execute({
    sql: `with active_sessions as (
            select
              user_account_id,
              count(*) as session_count,
              max(last_seen_at) as last_seen_at,
              max(expires_at) as latest_expiry
            from auth_sessions
            where revoked_at is null and datetime(expires_at) > datetime('now')
            group by user_account_id
          )
          select
            ua.subject as subject,
            ua.email as email,
            ua.full_name as full_name,
            ua.roles_json as roles_json,
            ac.username as username,
            active_sessions.session_count as session_count,
            active_sessions.last_seen_at as last_seen_at,
            active_sessions.latest_expiry as latest_expiry
          from active_sessions
          join user_accounts ua on ua.id = active_sessions.user_account_id and ua.active = 1 and ua.is_superuser = 0
          left join auth_credentials ac on ac.user_account_id = ua.id and ac.active = 1
          where (
            ? = ''
            or active_sessions.last_seen_at < ?
            or (active_sessions.last_seen_at = ? and ua.subject > ?)
          )
          order by active_sessions.last_seen_at desc, ua.subject asc
          limit ?`,
    args: [lastSeenAt, lastSeenAt, lastSeenAt, subject, limit + 1]
  });

  const rows = res.rows.slice(0, limit).map((row) => ({
    subject: String(row.subject),
    email: row.email ? String(row.email) : null,
    fullName: row.full_name ? String(row.full_name) : null,
    username: row.username ? String(row.username) : null,
    roles: JSON.parse(String(row.roles_json ?? "[]")) as string[],
    sessionCount: Number(row.session_count ?? 0),
    lastSeenAt: String(row.last_seen_at ?? ""),
    latestExpiry: String(row.latest_expiry ?? "")
  }));
  const hasMore = res.rows.length > limit;
  const last = rows[rows.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.lastSeenAt, last.subject) : null;
  const totalRes = await db.execute({
    sql: `with active_sessions as (
            select user_account_id
            from auth_sessions
            where revoked_at is null and datetime(expires_at) > datetime('now')
            group by user_account_id
          )
          select count(*) as total_live_users
          from active_sessions
          join user_accounts ua on ua.id = active_sessions.user_account_id
          where ua.active = 1 and ua.is_superuser = 0`
  });
  const totalLiveUsers = Number(totalRes.rows[0]?.total_live_users ?? 0);

  return {
    rows,
    totalLiveUsers,
    page: {
      limit,
      hasMore,
      nextCursor
    }
  };
}
