import { getDb } from "../../core/db";
import type { Env } from "../../core/types";

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function decodeCursor(cursorParam: string | null): string {
  if (!cursorParam) {
    return "";
  }
  try {
    return atob(cursorParam.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return "";
  }
}

function encodeCursor(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

type ReadUsersOptions = {
  limitParam: string | null;
  cursorParam: string | null;
  searchParam?: string | null;
};

export async function readUsers(env: Env, options: ReadUsersOptions) {
  const db = getDb(env);
  const limit = Math.min(100, Math.max(1, parsePositiveInt(options.limitParam, 20)));
  const subjectCursor = decodeCursor(options.cursorParam);
  const searchText = String(options.searchParam ?? "").trim().toLowerCase();
  const searchLike = searchText ? `%${searchText}%` : "";
  const sqlParts: string[] = [
    `select
      ua.subject as subject,
      ua.provider as provider,
      ua.email as email,
      ua.full_name as full_name,
      ua.roles_json as roles_json,
      ua.active as active,
      ua.is_superuser as is_superuser,
      ua.created_at as created_at,
      ua.last_login_at as last_login_at,
      ac.username as username
    from user_accounts ua
    left join auth_credentials ac on ac.user_account_id = ua.id and ac.active = 1
    where ua.is_superuser = 0
      and (? = '' or ua.subject > ?)`
  ];
  const args: Array<string | number | null> = [subjectCursor, subjectCursor];

  if (searchLike) {
    sqlParts.push(
      `and (
        lower(coalesce(ua.full_name, '')) like ?
        or lower(coalesce(ua.email, '')) like ?
        or lower(coalesce(ac.username, '')) like ?
        or lower(coalesce(ua.subject, '')) like ?
      )`
    );
    args.push(searchLike, searchLike, searchLike, searchLike);
  }
  sqlParts.push("order by ua.subject asc");
  sqlParts.push("limit ?");
  args.push(limit + 1);

  const rowsRes = await db.execute({
    sql: sqlParts.join("\n"),
    args
  });

  const rows = rowsRes.rows.slice(0, limit).map((row) => ({
    subject: String(row.subject),
    provider: String(row.provider),
    email: row.email ? String(row.email) : null,
    fullName: row.full_name ? String(row.full_name) : null,
    username: row.username ? String(row.username) : null,
    roles: JSON.parse(String(row.roles_json ?? "[]")) as string[],
    active: Number(row.active ?? 0) === 1,
    isSuperuser: Number(row.is_superuser ?? 0) === 1,
    createdAt: row.created_at ? String(row.created_at) : null,
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null
  }));

  const hasMore = rowsRes.rows.length > limit;
  const last = rows[rows.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.subject) : null;

  return {
    rows,
    page: {
      limit,
      hasMore,
      nextCursor
    }
  };
}
