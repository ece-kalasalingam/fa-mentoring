import type { Env } from "../../core/types";

export type TursoUsageStats = {
  rowsRead: number | null;
  rowsWritten: number | null;
  storageBytes: number | null;
  bytesSynced: number | null;
};

export type TursoUsageDebug = {
  configured: boolean;
  orgName: string | null;
  databaseName: string | null;
  requestUrl: string | null;
  httpStatus: number | null;
  parseOk: boolean;
  reason: string | null;
  tokenFingerprint: string | null;
  responseSnippet: string | null;
  cloudfrontRequestId: string | null;
  cloudfrontPop: string | null;
};

export type TursoUsageResult = {
  stats: TursoUsageStats | null;
  debug: TursoUsageDebug;
};

type UnknownRecord = Record<string, unknown>;

function toRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function deriveDatabaseName(databaseUrl: string, orgName: string): string | null {
  const trimmedUrl = String(databaseUrl ?? "").trim();
  const trimmedOrg = String(orgName ?? "").trim();
  if (!trimmedUrl || !trimmedOrg) return null;
  try {
    const host = trimmedUrl.replace(/^libsql:\/\//, "").split("/")[0] ?? "";
    const subdomain = host.split(".")[0] ?? "";
    if (!subdomain) return null;
    const orgSuffix = `-${trimmedOrg}`;
    return subdomain.endsWith(orgSuffix) ? subdomain.slice(0, -orgSuffix.length) : subdomain;
  } catch {
    return null;
  }
}

function parseTursoUsagePayload(raw: unknown): TursoUsageStats | null {
  const root = toRecord(raw);
  if (!root) return null;

  const databaseUsage = toRecord(toRecord(root.database)?.usage);
  const totalUsage = toRecord(root.total);
  const usage = databaseUsage ?? totalUsage;
  if (!usage) return null;

  return {
    rowsRead: toNullableNumber(usage.rows_read),
    rowsWritten: toNullableNumber(usage.rows_written),
    storageBytes: toNullableNumber(usage.storage_bytes),
    bytesSynced: toNullableNumber(usage.bytes_synced),
  };
}

export function isTursoUsageConfigured(env: Env): boolean {
  return Boolean(
    String(env.TURSO_DATABASE_URL ?? "").trim() &&
    String(env.TURSO_ORG_NAME ?? "").trim() &&
    String(env.TURSO_API_TOKEN ?? "").trim()
  );
}

export async function fetchTursoUsageStats(env: Env): Promise<TursoUsageStats | null> {
  if (!isTursoUsageConfigured(env)) return null;
  const orgName = String(env.TURSO_ORG_NAME ?? "").trim();
  const apiToken = String(env.TURSO_API_TOKEN ?? "").trim();
  const databaseName = deriveDatabaseName(String(env.TURSO_DATABASE_URL ?? ""), orgName);
  if (!databaseName) return null;

  try {
    const response = await fetch(
      `https://api.turso.tech/v1/organizations/${orgName}/databases/${databaseName}/usage`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as unknown;
    return parseTursoUsagePayload(payload);
  } catch {
    return null;
  }
}

export async function fetchTursoUsageDebug(env: Env): Promise<TursoUsageDebug> {
  const configured = isTursoUsageConfigured(env);
  const orgName = String(env.TURSO_ORG_NAME ?? "").trim() || null;
  const apiToken = String(env.TURSO_API_TOKEN ?? "").trim();
  const databaseName = deriveDatabaseName(String(env.TURSO_DATABASE_URL ?? ""), String(env.TURSO_ORG_NAME ?? "")) ?? null;
  const requestUrl = orgName && databaseName
    ? `https://api.turso.tech/v1/organizations/${orgName}/databases/${databaseName}/usage`
    : null;
  const tokenFingerprint = apiToken ? `...${apiToken.slice(-8)}` : null;

  if (!configured) {
    return { configured, orgName, databaseName, requestUrl, httpStatus: null, parseOk: false, reason: "NOT_CONFIGURED", tokenFingerprint, responseSnippet: null, cloudfrontRequestId: null, cloudfrontPop: null };
  }
  if (!databaseName) {
    return { configured, orgName, databaseName, requestUrl, httpStatus: null, parseOk: false, reason: "DB_NAME_DERIVATION_FAILED", tokenFingerprint, responseSnippet: null, cloudfrontRequestId: null, cloudfrontPop: null };
  }

  try {
    const response = await fetch(requestUrl!, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
        "User-Agent": "fa-mentoring-worker/1.0 (+turso-usage)"
      }
    });
    const cloudfrontRequestId = response.headers.get("x-amz-cf-id");
    const cloudfrontPop = response.headers.get("x-amz-cf-pop");
    if (!response.ok) {
      let responseSnippet: string | null = null;
      try {
        const text = await response.text();
        responseSnippet = text ? text.slice(0, 300) : null;
      } catch {
        responseSnippet = null;
      }
      return {
        configured,
        orgName,
        databaseName,
        requestUrl,
        httpStatus: response.status,
        parseOk: false,
        reason: "HTTP_NOT_OK",
        tokenFingerprint,
        responseSnippet,
        cloudfrontRequestId,
        cloudfrontPop,
      };
    }
    const payload = (await response.json()) as unknown;
    const parsed = parseTursoUsagePayload(payload);
    return {
      configured,
      orgName,
      databaseName,
      requestUrl,
      httpStatus: response.status,
      parseOk: Boolean(parsed),
      reason: parsed ? null : "PARSE_FAILED",
      tokenFingerprint,
      responseSnippet: null,
      cloudfrontRequestId,
      cloudfrontPop,
    };
  } catch {
    return {
      configured,
      orgName,
      databaseName,
      requestUrl,
      httpStatus: null,
      parseOk: false,
      reason: "FETCH_FAILED",
      tokenFingerprint,
      responseSnippet: null,
      cloudfrontRequestId: null,
      cloudfrontPop: null,
    };
  }
}

export async function fetchTursoUsageWithDebug(env: Env): Promise<TursoUsageResult> {
  const configured = isTursoUsageConfigured(env);
  const orgName = String(env.TURSO_ORG_NAME ?? "").trim() || null;
  const apiToken = String(env.TURSO_API_TOKEN ?? "").trim();
  const databaseName = deriveDatabaseName(String(env.TURSO_DATABASE_URL ?? ""), String(env.TURSO_ORG_NAME ?? "")) ?? null;
  const requestUrl = orgName && databaseName
    ? `https://api.turso.tech/v1/organizations/${orgName}/databases/${databaseName}/usage`
    : null;
  const tokenFingerprint = apiToken ? `...${apiToken.slice(-8)}` : null;

  if (!configured) {
    return {
      stats: null,
      debug: { configured, orgName, databaseName, requestUrl, httpStatus: null, parseOk: false, reason: "NOT_CONFIGURED", tokenFingerprint, responseSnippet: null, cloudfrontRequestId: null, cloudfrontPop: null }
    };
  }
  if (!databaseName) {
    return {
      stats: null,
      debug: { configured, orgName, databaseName, requestUrl, httpStatus: null, parseOk: false, reason: "DB_NAME_DERIVATION_FAILED", tokenFingerprint, responseSnippet: null, cloudfrontRequestId: null, cloudfrontPop: null }
    };
  }

  try {
    const response = await fetch(requestUrl!, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
        "User-Agent": "fa-mentoring-worker/1.0 (+turso-usage)"
      }
    });
    const cloudfrontRequestId = response.headers.get("x-amz-cf-id");
    const cloudfrontPop = response.headers.get("x-amz-cf-pop");

    if (!response.ok) {
      let responseSnippet: string | null = null;
      try {
        const text = await response.text();
        responseSnippet = text ? text.slice(0, 300) : null;
      } catch {
        responseSnippet = null;
      }
      return {
        stats: null,
        debug: {
          configured,
          orgName,
          databaseName,
          requestUrl,
          httpStatus: response.status,
          parseOk: false,
          reason: "HTTP_NOT_OK",
          tokenFingerprint,
          responseSnippet,
          cloudfrontRequestId,
          cloudfrontPop,
        }
      };
    }

    const payload = (await response.json()) as unknown;
    const parsed = parseTursoUsagePayload(payload);
    return {
      stats: parsed,
      debug: {
        configured,
        orgName,
        databaseName,
        requestUrl,
        httpStatus: response.status,
        parseOk: Boolean(parsed),
        reason: parsed ? null : "PARSE_FAILED",
        tokenFingerprint,
        responseSnippet: null,
        cloudfrontRequestId,
        cloudfrontPop,
      }
    };
  } catch {
    return {
      stats: null,
      debug: {
        configured,
        orgName,
        databaseName,
        requestUrl,
        httpStatus: null,
        parseOk: false,
        reason: "FETCH_FAILED",
        tokenFingerprint,
        responseSnippet: null,
        cloudfrontRequestId: null,
        cloudfrontPop: null,
      }
    };
  }
}
