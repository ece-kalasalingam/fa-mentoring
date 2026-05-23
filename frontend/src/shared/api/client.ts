export type ApiResult = {
  ok: boolean;
  error?: string;
  details?: string;
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
  mentorNameOptions?: string[];
  programmes?: Array<{ id: number; name: string }>;
  regulations?: Array<{
    code: string;
    name: string;
    curriculumStructure: {
      totalCreditsRequired: number;
      totalUnitsRequired?: number;
      categories: Array<{
        code: string;
        name: string;
        measure: "credits" | "units";
        rule:
          | { type: "fixed"; value: number }
          | { type: "minimum"; value: number }
          | { type: "maximum"; value: number }
          | { type: "range"; min: number; max: number };
      }>;
    };
  }>;
  plansOfStudy?: Array<{
    planCode: number;
    planName: string;
    regulationCode: string;
    semesters: Array<{
      semester: number;
      categories: Record<string, number>;
      totalCredits: number;
      totalUnits?: number;
    }>;
    categoryTotals?: Record<string, number>;
    totalCredits?: number;
    totalUnits?: number;
  }>;
  validation?: {
    hasErrors: boolean;
    totalErrors: number;
    byPlan: Array<{
      planCode: number;
      planName: string;
      regulationCode: string;
      hasErrors: boolean;
      errors: Array<{
        code:
          | "REGULATION_NOT_FOUND"
          | "PLAN_TOTAL_MISMATCH"
          | "PLAN_TOTAL_UNITS_MISMATCH"
          | "PLAN_CATEGORY_CODE_INVALID"
          | "PLAN_CATEGORY_MISSING"
          | "PLAN_CATEGORY_RULE_VIOLATION"
          | "SEMESTER_TOTAL_MISMATCH"
          | "SEMESTER_TOTAL_UNITS_MISMATCH";
        message: string;
        planCode: number;
        planName: string;
        regulationCode: string;
        categoryCode?: string;
        semester?: number;
      }>;
    }>;
  };
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
  appliedNow?: number;
  hasMore?: boolean;
  pendingMigrations?: string[];
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
  curriculumValidation?: {
    hasErrors: boolean;
    totalErrors: number;
    byPlan: Array<{
      planCode: number;
      planName: string;
      regulationCode: string;
      hasErrors: boolean;
      errors: Array<{
        code:
          | "REGULATION_NOT_FOUND"
          | "PLAN_TOTAL_MISMATCH"
          | "PLAN_TOTAL_UNITS_MISMATCH"
          | "PLAN_CATEGORY_CODE_INVALID"
          | "PLAN_CATEGORY_MISSING"
          | "PLAN_CATEGORY_RULE_VIOLATION"
          | "SEMESTER_TOTAL_MISMATCH"
          | "SEMESTER_TOTAL_UNITS_MISMATCH";
        message: string;
        planCode: number;
        planName: string;
        regulationCode: string;
        categoryCode?: string;
        semester?: number;
      }>;
    }>;
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
  creditDetails?: Array<{ categoryId: string; semesterTaken: number; credits: number }>;
  unitDetails?: Array<{ categoryId: string; unitsEarned: number }>;
  imported?: number;
  failed?: number;
  total?: number;
  errors?: string[];
  updatedStudentUserIds?: string[];
  summaries?: Array<{ studentId: string; totalCredits: number }>;
}

function resolveApiBase(): string {
  const productionApiBase = "https://spris-api.eceklu.in";
  const configured = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  const isBrowser = typeof window !== "undefined";
  const host = isBrowser ? window.location.hostname : "";
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  const fallback = isLocalHost ? "http://localhost:8787" : productionApiBase;
  const candidate = configured || fallback;

  // Safety rail: never allow a non-local page to call localhost APIs.
  if (!isLocalHost && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(candidate)) {
    if (isBrowser) {
      // eslint-disable-next-line no-console
      console.warn(`Blocked localhost API base on non-local host (${host}); using ${productionApiBase} instead.`);
    }
    return productionApiBase;
  }

  return candidate;
}

const API_BASE = resolveApiBase();
export function toApiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
let csrfTokenMemory = "";
const inFlightGetRequests = new Map<string, Promise<ApiResult>>();
const DB_READ_ESTIMATE_SESSION_KEY = "fa_db_read_estimate_total_v1";

function estimateDbReads(path: string, method: "GET" | "POST", body: unknown): number {
  if (method === "GET") {
    if (path.startsWith("/api/students/batch-summary")) return 1;
    if (path.startsWith("/api/student-credit-table")) return 1;
    if (path.startsWith("/api/students?")) return 1;
    if (path.startsWith("/api/admin/dashboard")) return 3;
    if (path.startsWith("/api/admin/users")) return 2;
    if (path.startsWith("/api/admin/active-users")) return 2;
    if (path.startsWith("/api/admin/login-attempts")) return 2;
    if (path.startsWith("/api/logs")) return 2;
    if (path.startsWith("/api/students-directory")) return 2;
    if (path.startsWith("/api/auth/me")) return 1;
    return 1;
  }
  if (path === "/api/student-credits/summaries" && Array.isArray((body as { studentIds?: unknown[] } | undefined)?.studentIds)) {
    return 1;
  }
  // Writes still read some lookup rows; keep an intentionally conservative estimate.
  if (path.includes("/set-active")) return 3;
  if (path.includes("/update")) return 3;
  return 1;
}

function incrementAndLogEstimatedDbReads(path: string, method: "GET" | "POST", body: unknown): void {
  if (typeof window === "undefined") return;
  const delta = Math.max(0, Math.round(estimateDbReads(path, method, body)));
  const previous = Number.parseInt(window.sessionStorage.getItem(DB_READ_ESTIMATE_SESSION_KEY) ?? "0", 10);
  const safePrev = Number.isFinite(previous) ? previous : 0;
  const total = safePrev + delta;
  window.sessionStorage.setItem(DB_READ_ESTIMATE_SESSION_KEY, String(total));
}

export function setCsrfToken(token: string) {
  csrfTokenMemory = token;
}

export async function callApi(path: string, method: "GET" | "POST", token?: string, body?: unknown): Promise<ApiResult> {
  const dedupeKey = method === "GET" && !token && body === undefined ? `${method}:${path}` : null;
  if (dedupeKey) {
    const inFlight = inFlightGetRequests.get(dedupeKey);
    if (inFlight) {
      return inFlight;
    }
  }

  const execute = async (): Promise<ApiResult> => {
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
  const jsonBody = (await res.json()) as ApiResult;
  incrementAndLogEstimatedDbReads(path, method, body);
  return jsonBody;
  };

  if (!dedupeKey) {
    return execute();
  }

  const promise = execute().finally(() => {
    inFlightGetRequests.delete(dedupeKey);
  });
  inFlightGetRequests.set(dedupeKey, promise);
  return promise;
}
