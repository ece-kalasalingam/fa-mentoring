export type ApiResult = {
  ok: boolean;
  error?: string;
  message?: string;
  token?: string;
  expiresInHours?: number;
  csrfToken?: string;
  hasTables?: boolean;
  tableCount?: number;
  principal?: {
    subject: string;
    fullName?: string;
    isSuperuser?: boolean;
    email?: string;
    roles: string[];
    permissions: string[];
    provider: string;
  } | null;
  profile?: {
    subject: string;
    email: string | null;
    fullName: string | null;
    roles: string[];
    provider: string;
    username: string | null;
  } | null;
  rows?: Array<Record<string, unknown>>;
  totalLiveUsers?: number;
  page?: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  bootstrap?: {
    autoInitializedNow: boolean;
    appliedMigrations: number;
    localAdmin?: {
      username: string;
      password: string;
    };
  } | null;
  hasConnection?: boolean;
  hasSeedData?: boolean;
  setupComplete?: boolean;
  setupCompletedAt?: string | null;
  hasSuperAdmin?: boolean;
  hasCredentials?: boolean;
  setupLocked?: boolean;
  cookieConfig?: {
    name: string;
    secure: boolean;
    sameSite: string;
    sessionHours: number;
  };
  requestContext?: {
    requestHost: string;
    requestOrigin: string;
  };
  warnings?: string[];
  fullNameBackfilledUsers?: number;
  migrations?: {
    ok: boolean;
    appliedMigrations?: number;
    pendingMigrations?: string[];
    currentSchemaVersion?: string | null;
  };
  generatedAt?: string;
  mitigations?: {
    needsMitigations: boolean;
    pendingCount: number;
    pendingMigrations: string[];
    message: string;
  };
  system?: {
    hasTables: boolean;
    tableCount: number;
    currentSchemaVersion: string | null;
  };
  auth?: {
    totalUsers: number | null;
    totalGuests: number | null;
    activeUsers: number | null;
    activeSessions: number | null;
    successfulLogins48h: number | null;
    failedLogins48h: number | null;
  };
  students?: {
    totalStudents: number | null;
    onTrackStudents: number | null;
    atRiskStudents: number | null;
    avgRiskScore: number | null;
  };
  logging?: {
    errorLogs48h: number | null;
    warnLogs48h: number | null;
  };
  activeUserRows?: Array<{
    subject: string;
    email: string | null;
    fullName: string | null;
    username: string | null;
    roles: string[];
    sessionCount: number;
    lastSeenAt: string;
    latestExpiry: string;
  }>;
  userRows?: Array<{
    subject: string;
    provider: string;
    email: string | null;
    fullName: string | null;
    username: string | null;
    roles: string[];
    active: boolean;
    isSuperuser: boolean;
    createdAt: string | null;
    lastLoginAt: string | null;
  }>;
  revokedSessions?: number;
  identifier?: string;
  revokedOwnSession?: boolean;
  otherSessions?: number;
  sessions?: Array<{
    id: string;
    createdAt: string | null;
    lastSeenAt: string | null;
    expiresAt: string | null;
    isCurrent: boolean;
  }>;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";
let csrfTokenMemory = "";

export function setCsrfToken(token: string) {
  csrfTokenMemory = token;
}

export async function callApi(path: string, method: "GET" | "POST", token?: string, body?: unknown): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (method === "POST" && csrfTokenMemory) {
    headers["x-csrf-token"] = csrfTokenMemory;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include"
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as ApiResult;
}
