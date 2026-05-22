import { getDb } from "../../core/db";
import type { Env } from "../../core/types";

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEvent = {
  level: LogLevel;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  principalSubject?: string | null;
  authProvider?: string | null;
  event: string;
  meta?: Record<string, unknown>;
};

function toInt(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function toFloat(raw: string | undefined, fallback: number): number {
  const value = Number.parseFloat(String(raw ?? "").trim());
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, value));
}

function toBool(raw: string | undefined, fallback: boolean): boolean {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) {
    return fallback;
  }
  if (value === "1" || value === "true" || value === "yes" || value === "on") {
    return true;
  }
  if (value === "0" || value === "false" || value === "no" || value === "off") {
    return false;
  }
  return fallback;
}

function getLogConfig(env: Env) {
  const retentionDays = Math.min(7, toInt(env.LOG_RETENTION_DAYS, 7));
  const maxRows = Math.min(500, toInt(env.LOG_MAX_ROWS, 500));
  return {
    retentionDays,
    maxRows,
    disableSuccessRequests: toBool(env.LOG_DISABLE_SUCCESS_REQUESTS, true),
    infoSampleRate: toFloat(env.LOG_INFO_SAMPLE_RATE, 0.05),
    pruneEveryNWrites: toInt(env.LOG_PRUNE_EVERY_N_WRITES, 200)
  };
}

function truncate(value: string, max = 500): string {
  return value.length > max ? value.slice(0, max) : value;
}

function safeMetaJson(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) {
    return null;
  }
  const json = JSON.stringify(meta);
  return truncate(json, 2000);
}

async function pruneLogs(env: Env): Promise<void> {
  const db = getDb(env);
  const config = getLogConfig(env);
  await db.execute({
    sql: "delete from app_logs where ts < datetime('now', ?)",
    args: [`-${config.retentionDays} days`]
  });
  await db.execute({
    sql: "delete from app_logs where id not in (select id from app_logs order by id desc limit ?)",
    args: [config.maxRows]
  });
}

async function enforceHardLogRetentionAndCap(env: Env): Promise<void> {
  const db = getDb(env);
  const config = getLogConfig(env);
  await db.execute({
    sql: "delete from app_logs where ts < datetime('now', ?)",
    args: [`-${config.retentionDays} days`]
  });
  await db.execute({
    sql: `delete from app_logs
          where id in (
            select id
            from app_logs
            order by ts desc, id desc
            limit -1 offset ?
          )`,
    args: [config.maxRows]
  });
}

function isAlwaysKeepEvent(event: string): boolean {
  return (
    event.startsWith("auth.") ||
    event.startsWith("request.unauthorized") ||
    event.startsWith("request.forbidden") ||
    event.startsWith("request.csrf_failed") ||
    event.startsWith("setup.") ||
    event.startsWith("logs.")
  );
}

function shouldPersistLog(env: Env, log: LogEvent): boolean {
  const config = getLogConfig(env);
  if (log.level === "error" || log.level === "warn") {
    return true;
  }
  if (isAlwaysKeepEvent(log.event)) {
    return true;
  }
  if (config.disableSuccessRequests && log.event === "request.completed" && log.statusCode < 400) {
    return false;
  }
  if (log.level === "info") {
    return Math.random() < config.infoSampleRate;
  }
  return true;
}

let writeCounter = 0;

export async function writeLog(env: Env, log: LogEvent): Promise<void> {
  if (!shouldPersistLog(env, log)) {
    return;
  }

  const db = getDb(env);
  const config = getLogConfig(env);
  await db.execute({
    sql: `insert into app_logs(
      level, request_id, method, path, status_code, duration_ms, principal_subject, auth_provider, event, meta_json
    ) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      log.level,
      truncate(log.requestId, 64),
      truncate(log.method.toUpperCase(), 16),
      truncate(log.path, 256),
      Math.max(0, Math.floor(log.statusCode)),
      Math.max(0, Math.floor(log.durationMs)),
      log.principalSubject ? truncate(log.principalSubject, 128) : null,
      log.authProvider ? truncate(log.authProvider, 64) : null,
      truncate(log.event, 128),
      safeMetaJson(log.meta)
    ]
  });
  writeCounter += 1;
  if (writeCounter % config.pruneEveryNWrites === 0) {
    await enforceHardLogRetentionAndCap(env);
    await pruneLogs(env);
  }
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function readRecentLogs(
  env: Env,
  limitParam: string | null,
  cursorParam: string | null,
  levelParam?: string | null,
  sinceHoursParam?: string | null
) {
  const db = getDb(env);
  const limit = Math.min(100, Math.max(1, parsePositiveInt(limitParam, 20)));
  const normalizedLevel = String(levelParam ?? "").trim().toLowerCase();
  const levelFilter = ["debug", "info", "warn", "error"].includes(normalizedLevel) ? normalizedLevel : "";
  const rawSinceHours = String(sinceHoursParam ?? "").trim().toLowerCase();
  const disableSinceWindow = rawSinceHours === "all";
  const sinceHours = disableSinceWindow ? 0 : Math.min(24 * 30, Math.max(1, parsePositiveInt(sinceHoursParam ?? null, 24)));
  const sinceExpr = disableSinceWindow ? "" : `-${sinceHours} hours`;
  let cursorTs = "";
  let cursorRequestId = "";
  if (cursorParam) {
    try {
      const decoded = atob(cursorParam.replace(/-/g, "+").replace(/_/g, "/"));
      const [ts, requestId] = decoded.split("|");
      cursorTs = String(ts ?? "");
      cursorRequestId = String(requestId ?? "");
    } catch {
      cursorTs = "";
      cursorRequestId = "";
    }
  }

  const rowsRes = await db.execute({
    sql: `select ts, level, request_id, method, path, status_code, duration_ms, principal_subject, auth_provider, event, meta_json
          from app_logs
          where (
            ? = ''
            or level = ?
          )
          and (
            ? = ''
            or ts >= datetime('now', ?)
          )
          and (
            ? = ''
            or ts < ?
            or (ts = ? and request_id < ?)
          )
          order by ts desc, request_id desc
          limit ?`,
    args: [levelFilter, levelFilter, sinceExpr, sinceExpr, cursorTs, cursorTs, cursorTs, cursorRequestId, limit + 1]
  });

  const rows = rowsRes.rows.slice(0, limit).map((row) => ({
    ts: String(row.ts),
    level: String(row.level),
    requestId: String(row.request_id),
    method: String(row.method),
    path: String(row.path),
    statusCode: Number(row.status_code),
    durationMs: Number(row.duration_ms),
    principalSubject: row.principal_subject ? String(row.principal_subject) : null,
    authProvider: row.auth_provider ? String(row.auth_provider) : null,
    event: String(row.event),
    meta: row.meta_json ? JSON.parse(String(row.meta_json)) : null
  }));

  const hasMore = rowsRes.rows.length > limit;
  const last = rows[rows.length - 1];
  const nextCursor = hasMore && last ? btoa(`${last.ts}|${last.requestId}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "") : null;

  return {
    rows,
    page: {
      limit,
      hasMore,
      nextCursor
    }
  };
}

export async function clearAllLogs(env: Env): Promise<number> {
  const db = getDb(env);
  const countRes = await db.execute({ sql: "select count(*) as c from app_logs" });
  const cleared = Number(countRes.rows[0]?.c ?? 0);
  await db.execute({ sql: "delete from app_logs" });
  return cleared;
}
