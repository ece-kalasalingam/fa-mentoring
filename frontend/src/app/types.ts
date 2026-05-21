import type { ReactElement } from "react";

export type Principal = {
  subject: string;
  email?: string;
  fullName?: string;
  isSuperuser?: boolean;
  roles: string[];
  provider: string;
};

export type MyAccount = {
  subject: string;
  email: string | null;
  fullName: string | null;
  roles: string[];
  provider: string;
  username: string | null;
};

export type MySession = {
  id: string;
  createdAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string | null;
  isCurrent: boolean;
};

export type AdminDashboard = {
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
    isTurso?: boolean;
    turso?: {
      rowsRead: number | null;
      rowsWritten: number | null;
      storageBytes: number | null;
      bytesSynced: number | null;
    } | null;
  };
  auth?: {
    totalUsers: number | null;
    totalGuests: number | null;
    activeUsers: number | null;
    activeSessions: number | null;
    successfulLogins48h: number | null;
    failedLogins48h: number | null;
    loginTimeline48h?: Array<{
      hourTs: string;
      successCount: number;
      failedCount: number;
    }> | null;
  };
  logging?: {
    errorLogs48h: number | null;
    warnLogs48h: number | null;
  };
  curriculumValidation?: PlansValidationReport;
};

export type LogRow = {
  ts: string;
  level: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  principalSubject: string | null;
  authProvider: string | null;
  event: string;
  meta: Record<string, unknown> | null;
};

export type ActiveUserRow = {
  subject: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  roles: string[];
  sessionCount: number;
  lastSeenAt: string;
  latestExpiry: string;
};

export type UserRow = {
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
};

export type StudentDirectoryRow = {
  userId: string;
  fullName: string;
  email: string;
  registrationNumber: string;
  planOfStudyCode: number | null;
  currentSemester: number | null;
  batch: number | null;
  programme: number | null;
  graduated: "Yes" | "No";
  mentorName: string;
  modifiedByName: string;
  modifiedAt: string | null;
};

export type FacultyStudentRow = {
  userId: string;
  registrationNumber: string | null;
  planOfStudyCode: number | null;
  currentSemester: number | null;
  batch: number | null;
  programme: number | null;
  graduated: "Yes" | "No";
  fullName: string | null;
  email: string | null;
  studentActive: boolean;
  mentorEmail: string | null;
};

export type FacultyMentoredStudentMinimal = {
  userId: string;
  email: string;
  registrationNumber: string;
  fullName: string;
  planOfStudyCode: number | null;
};

export type FacultyCreditTableRow = {
  registrationNumber: string | null;
  graduated: "Yes" | "No";
  categoryId: string;
  semester: number;
  credits: number;
  modifiedByUsername: string | null;
  modifiedAt: string | null;
};

export type FailedLoginRow = {
  attemptRef: number;
  username: string;
  ipAddress: string;
  success: boolean;
  attemptedAt: string;
};

export type RegulationCreditRule =
  | { type: "fixed"; value: number }
  | { type: "minimum"; value: number }
  | { type: "maximum"; value: number }
  | { type: "range"; min: number; max: number };

export type RegulationCategory = {
  code: string;
  name: string;
  rule: RegulationCreditRule;
};

export type Regulation = {
  code: string;
  name: string;
  curriculumStructure: {
    totalCreditsRequired: number;
    categories: RegulationCategory[];
  };
};

export type PlanOfStudy = {
  planCode: number;
  planName: string;
  regulationCode: string;
  semesters: Array<{
    semester: number;
    categories: Record<string, number>;
    totalCredits: number;
  }>;
  categoryTotals?: Record<string, number>;
  totalCredits?: number;
};

export type PlanValidationError = {
  code:
    | "REGULATION_NOT_FOUND"
    | "PLAN_TOTAL_MISMATCH"
    | "PLAN_CATEGORY_CODE_INVALID"
    | "PLAN_CATEGORY_MISSING"
    | "PLAN_CATEGORY_RULE_VIOLATION"
    | "SEMESTER_TOTAL_MISMATCH";
  message: string;
  planCode: number;
  planName: string;
  regulationCode: string;
  categoryCode?: string;
  semester?: number;
};

export type PlansValidationReport = {
  hasErrors: boolean;
  totalErrors: number;
  byPlan: Array<{
    planCode: number;
    planName: string;
    regulationCode: string;
    hasErrors: boolean;
    errors: PlanValidationError[];
  }>;
};

export type CreditStatus = "complete" | "on-track" | "marginal" | "off-track";

export type StudentCreditSummary = {
  target: number;
  earned: number;
  expected: number;
  deficit: number;
  status: CreditStatus;
};

export type LogTypeFilter = "status5xx" | "status4xx" | "slow";

export type NavLeaf = { id: string; label: string; icon: ReactElement; active: boolean; disabled?: boolean; onClick: () => void };
export type NavGroup = { id: string; label: string; icon: ReactElement; children: NavLeaf[] };
export type NavItem = NavLeaf | NavGroup;
export type NavSection = { label: string; items: NavItem[] };

export type GoogleCredentialResponse = { credential?: string };

export type AdminCacheKey =
  | "dashboard"
  | "logs:error:first"
  | "logs:warn:first"
  | "activity:first"
  | "active-users:first"
  | "login-activity:first"
  | "users:first"
  | "students-directory:first"
  | "faculty-students:first";

export type AdminCacheEntry = { cachedAt: number; payload: unknown };

