import { getDb } from "../../core/db";
import type { Env } from "../../core/types";

export async function revokeAllSessionsForUser(env: Env, identifier: string) {
  const raw = String(identifier ?? "").trim().toLowerCase();
  if (!raw) {
    throw new Error("User identifier is required.");
  }

  const db = getDb(env);
  const user = await db.execute({
    sql: `select ua.id as user_account_id
          from user_accounts ua
          left join auth_credentials ac on ac.user_account_id = ua.id
          where ua.active = 1 and (
            lower(ua.email) = ? or
            lower(ua.subject) = ? or
            lower(ac.username) = ?
          )
          limit 1`,
    args: [raw, raw, raw]
  });

  const userAccountId = String(user.rows[0]?.user_account_id ?? "");
  if (!userAccountId) {
    throw new Error("User not found.");
  }

  const countRes = await db.execute({
    sql: "select count(*) as count from auth_sessions where user_account_id = ? and revoked_at is null and datetime(expires_at) > datetime('now')",
    args: [userAccountId]
  });
  const activeSessionCount = Number(countRes.rows[0]?.count ?? 0);

  await db.execute({
    sql: "update auth_sessions set revoked_at = current_timestamp where user_account_id = ? and revoked_at is null",
    args: [userAccountId]
  });

  return {
    ok: true,
    identifier: raw,
    revokedSessions: activeSessionCount,
    targetAccountRef: userAccountId
  };
}
