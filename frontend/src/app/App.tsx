import { Fragment, Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Alert, AppBar, Avatar, Box, Button, Card, CardContent, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, FormControl, IconButton, InputLabel, LinearProgress, Link, List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Select, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Toolbar, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SettingsIcon from "@mui/icons-material/Settings";
import BuildIcon from "@mui/icons-material/Build";
import StorageIcon from "@mui/icons-material/Storage";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import GroupIcon from "@mui/icons-material/Group";
import HistoryIcon from "@mui/icons-material/History";
import LockPersonIcon from "@mui/icons-material/LockPerson";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ErrorIcon from "@mui/icons-material/Error";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import ComputerIcon from "@mui/icons-material/Computer";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SchoolIcon from "@mui/icons-material/School";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EditIcon from "@mui/icons-material/Edit";
import EmailIcon from "@mui/icons-material/Email";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { callApi, setCsrfToken } from "../shared/api/client";
import { APP_NAME_FULL, APP_NAME_SHORT, ORG_NAME } from "../shared/branding";
import {
  ACTIVITY_LOGS_PAGE_SIZE,
  ADMIN_CACHE_TTL_MS,
  ADMIN_DRAWER_WIDTH,
  STATUS_AUTO_HIDE_MS,
  INACTIVITY_LOGOUT_MS,
  INACTIVITY_WARN_BEFORE_MS,
  GOOGLE_CLIENT_ID,
  GOOGLE_IDP_SCRIPT_SRC,
  TAB_SESSION_MARKER_KEY,
  SESSION_REGULATIONS_CACHE_KEY,
  SESSION_PLAN_OF_STUDY_CACHE_KEY,
  SESSION_PLAN_VALIDATION_CACHE_KEY,
  SESSION_PROGRAMMES_CACHE_KEY,
  SESSION_FACULTY_MENTORED_MINIMAL_KEY,
  CREDIT_STATUS_LABELS,
} from "./constants";
import { formatIst, formatIstHourMinute } from "./dateTime";
import { parseCsvRecords } from "./csv";
import { computeCreditStatus, formatCredits, getInitials, normalizeCredits, ROLE_COLORS } from "./utils";
import { DateTimeProvider } from "./dateTimeContext";
import type {
  ActiveUserRow,
  AdminCacheEntry,
  AdminCacheKey,
  AdminDashboard,
  CreditStatus,
  FailedLoginRow,
  FacultyCreditTableRow,
  FacultyStudentRow,
  FacultyMentoredStudentMinimal,
  GoogleCredentialResponse,
  LogRow,
  LogTypeFilter,
  MyAccount,
  MySession,
  NavLeaf,
  NavSection,
  PlanOfStudy,
  PlansValidationReport,
  Regulation,
  StudentDirectoryRow,
  Principal,
  UserRow
} from "./types";

const ManageUsersTable = lazy(() => import("./ManageUsersTable"));
const ActiveUsersTable = lazy(() => import("./ActiveUsersTable"));
const FailedLoginsTable = lazy(() => import("./FailedLoginsTable"));
const StudentsDirectoryTable = lazy(() => import("./StudentsDirectoryTable"));
const StudentCreditsView = lazy(() => import("./StudentCreditsView"));
const FacultyCreditDetailsTable = lazy(() => import("./FacultyCreditDetailsTable"));
const FacultyAnalyticsReport = lazy(() => import("./FacultyAnalyticsReport"));
const LOCAL_DENSE_CACHE_PREFIX = "fa_dense_cache_v1";
const STATIC_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const STUDENT_SUMMARY_CACHE_TTL_MS = 10 * 60 * 1000;
const ADMIN_CACHE_KEYS: AdminCacheKey[] = [
  "dashboard",
  "logs:error:first",
  "logs:warn:first",
  "activity:first",
  "active-users:first",
  "login-activity:first",
  "users:first",
  "students-directory:first",
  "faculty-students:first",
  "moderator-students:first",
  "head-students:first",
];
type BrowserCacheEnvelope<T> = {
  cachedAt: number;
  payload: T;
  sessionKey: string;
};

function App() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Loading...");
  const [setupStateLoaded, setSetupStateLoaded] = useState(false);
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [hasSuperAdmin, setHasSuperAdmin] = useState(false);
  const [setupLocked, setSetupLocked] = useState(false);
  const [wizardState, setWizardState] = useState({
    hasConnection: false,
    hasTables: false,
    hasCredentials: false,
    setupComplete: false
  });

  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [showLocalLogin, setShowLocalLogin] = useState(!GOOGLE_CLIENT_ID);

  const [bootstrapKey, setBootstrapKey] = useState("");
  const [adminUser, setAdminUser] = useState("admin");
  const [adminPass, setAdminPass] = useState("");
  const [myAccount, setMyAccount] = useState<MyAccount | null>(null);
  const [otherSessionsCount, setOtherSessionsCount] = useState(0);
  const [sessionTakenOver, setSessionTakenOver] = useState(false);
  const [fullNameInput, setFullNameInput] = useState("");
  const [editingMyName, setEditingMyName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileAnchorEl, setProfileAnchorEl] = useState<HTMLElement | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [menuAnchors, setMenuAnchors] = useState<Record<string, HTMLElement | null>>({});
  const [accountView, setAccountView] = useState<"profile" | "password" | "sessions">("profile");
  const [mySessions, setMySessions] = useState<MySession[]>([]);
  const [superView, setSuperView] = useState<"dashboard" | "regulations" | "students-directory" | "student-credits" | "faculty-credit-table" | "account" | "logs" | "activity-logs" | "active-users" | "all-users" | "login-activity">("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [logRows, setLogRows] = useState<LogRow[]>([]);
  const [logCursor, setLogCursor] = useState<string | null>(null);
  const [logHasMore, setLogHasMore] = useState(false);
  const [logLevel, setLogLevel] = useState<"error" | "warn">("error");
  const [logTypeFilters, setLogTypeFilters] = useState<LogTypeFilter[]>([]);
  const [activityLogRows, setActivityLogRows] = useState<LogRow[]>([]);
  const [activityLogCursor, setActivityLogCursor] = useState<string | null>(null);
  const [activityLogHasMore, setActivityLogHasMore] = useState(false);
  const [activityLogPage, setActivityLogPage] = useState(1);
  const [activityLevelFilters, setActivityLevelFilters] = useState<string[]>([]);
  const [activityStatusFilters, setActivityStatusFilters] = useState<string[]>([]);
  const [activityEventFilters, setActivityEventFilters] = useState<string[]>([]);
  const [activeUserRows, setActiveUserRows] = useState<ActiveUserRow[]>([]);
  const [activeUserCursor, setActiveUserCursor] = useState<string | null>(null);
  const [activeUserHasMore, setActiveUserHasMore] = useState(false);
  const [activeLiveUsersCount, setActiveLiveUsersCount] = useState(0);
  const [loginActivityRows, setLoginActivityRows] = useState<FailedLoginRow[]>([]);
  const [loginActivityCursor, setLoginActivityCursor] = useState<string | null>(null);
  const [loginActivityHasMore, setLoginActivityHasMore] = useState(false);
  const [userRows, setUserRows] = useState<UserRow[]>([]);
  const [studentDirectoryRows, setStudentDirectoryRows] = useState<StudentDirectoryRow[]>([]);
  const [selectedStudentForCredits, setSelectedStudentForCredits] = useState<StudentDirectoryRow | null>(null);
  const [studentEarnedCreditsByUser, setStudentEarnedCreditsByUser] = useState<Record<string, Record<number, Record<string, number>>>>({});
  const [studentSavedCreditsByUser, setStudentSavedCreditsByUser] = useState<Record<string, Record<number, Record<string, number>>>>({});
  const [studentEarnedUnitsByUser, setStudentEarnedUnitsByUser] = useState<Record<string, Record<string, number>>>({});
  const [studentSavedUnitsByUser, setStudentSavedUnitsByUser] = useState<Record<string, Record<string, number>>>({});
  const [studentCreditsSaving, setStudentCreditsSaving] = useState(false);
  const [studentCreditTotals, setStudentCreditTotals] = useState<Record<string, number>>({});
  const [studentUnitTotals, setStudentUnitTotals] = useState<Record<string, number>>({});
  // Per-category earned totals returned by the summary API — used for the Complete category
  // check in creditSummaries when detailed per-semester saves are not yet loaded.
  const [studentSummaryCatEarned, setStudentSummaryCatEarned] = useState<Record<string, Record<string, number>>>({});
  const [creditTotalsLoaded, setCreditTotalsLoaded] = useState(false);
  const [facultyStudentRows, setFacultyStudentRows] = useState<FacultyStudentRow[]>([]);
  const [facultyCreditTableRows, setFacultyCreditTableRows] = useState<FacultyCreditTableRow[]>([]);
  const [moderatorStudentRows, setModeratorStudentRows] = useState<FacultyStudentRow[]>([]);
  const [moderatorCreditTableRows, setModeratorCreditTableRows] = useState<FacultyCreditTableRow[]>([]);
  const [headStudentRows, setHeadStudentRows] = useState<FacultyStudentRow[]>([]);
  const [expandedDashboardSections, setExpandedDashboardSections] = useState<Set<"head" | "moderator" | "faculty">>(new Set());
  const [loadedDashboardSections, setLoadedDashboardSections] = useState<Set<"head" | "moderator" | "faculty">>(new Set());
  const [, setFacultyMentoredMinimalRows] = useState<FacultyMentoredStudentMinimal[]>([]);
  const [mentorNameOptions, setMentorNameOptions] = useState<string[]>([]);
  const [programmeOptions, setProgrammeOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [studentSelfPlanOfStudyCode, setStudentSelfPlanOfStudyCode] = useState<number | null>(null);
  const [studentSelfDirectoryRows, setStudentSelfDirectoryRows] = useState<StudentDirectoryRow[]>([]);
  const [regulationTab, setRegulationTab] = useState(0);
  const [plansOfStudy, setPlansOfStudy] = useState<PlanOfStudy[]>([]);
  const [plansValidationReport, setPlansValidationReport] = useState<PlansValidationReport | null>(null);
  const [planOfStudyTab, setPlanOfStudyTab] = useState(0);
  const [studentsDirectoryCursor, setStudentsDirectoryCursor] = useState<string | null>(null);
  const [studentsDirectoryHasMore, setStudentsDirectoryHasMore] = useState(false);
  const [studentsDirectoryGraduatedFilter, setStudentsDirectoryGraduatedFilter] = useState<"Yes" | "No" | null>(null);
  const [studentsDirectoryCreditStatusFilter, setStudentsDirectoryCreditStatusFilter] = useState<CreditStatus | null>(null);
  const [studentsDirectoryBatchFilter, setStudentsDirectoryBatchFilter] = useState<number | null>(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoles, setNewUserRoles] = useState<string[]>(["student"]);
  const [addUserErrors, setAddUserErrors] = useState<{ fullName?: string; username?: string; password?: string }>({});
  const [bulkCsvFileName, setBulkCsvFileName] = useState("");
  const [bulkStatusCsvFileName, setBulkStatusCsvFileName] = useState("");
  const [userGlobalFilter, setUserGlobalFilter] = useState("");
  const [apiError, setApiError] = useState<{ message: string; retryFn: (() => Promise<void>) | null } | null>(null);
  const [csvImportResult, setCsvImportResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null);
  const [studentCsvImportResult, setStudentCsvImportResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);
  const [prevSuperView, setPrevSuperView] = useState<typeof superView | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<UserRow | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState("");
  const sessionCheckRef = useRef<{ checkedAt: number; ok: boolean }>({ checkedAt: 0, ok: false });
  const strictRevalidateRef = useRef(0);
  const tabIdRef = useRef("");
  const authSyncInFlightRef = useRef(false);
  const googleIdpInitializedRef = useRef(false);
  const lastActivityAtRef = useRef(Date.now());
  const inactivityWarnedRef = useRef(false);
  const inactivityLogoutInFlightRef = useRef(false);
  const adminReadCacheRef = useRef<Partial<Record<AdminCacheKey, AdminCacheEntry>>>({});
  const adminCacheSessionKeyRef = useRef<string | null>(null);
  const studentSummaryCacheRef = useRef<Record<string, AdminCacheEntry>>({});
  const studentSummaryCacheKeysRef = useRef<Set<string>>(new Set());

  function toFacultyMentoredMinimalRows(rows: FacultyStudentRow[]): FacultyMentoredStudentMinimal[] {
    return rows
      .filter((row) => row.studentActive)
      .map((row) => ({
        userId: row.userId,
        email: String(row.email ?? "").trim(),
        registrationNumber: String(row.registrationNumber ?? "").trim(),
        fullName: String(row.fullName ?? "").trim(),
        planOfStudyCode: row.planOfStudyCode,
      }));
  }

  const isSuperAdmin = useMemo(() => Boolean(principal?.isSuperuser), [principal]);
  const isAdmin = useMemo(() => Boolean(principal?.roles.includes("admin")), [principal]);
  const hasStudentRole = useMemo(() => Boolean(principal?.roles.includes("student")), [principal]);
  const hasFacultyRole = useMemo(() => Boolean(principal?.roles.includes("faculty")), [principal]);
  const hasHeadRole = useMemo(() => Boolean(principal?.roles.includes("head")), [principal]);
  const hasModeratorRole = useMemo(() => Boolean(principal?.roles.includes("moderator")), [principal]);
  const hasGuestRole = useMemo(() => Boolean(principal?.roles.includes("guest")), [principal]);
  const isStudentOnlySession = useMemo(
    () => hasStudentRole && !(isAdmin || hasFacultyRole || hasHeadRole || hasModeratorRole),
    [hasStudentRole, isAdmin, hasFacultyRole, hasHeadRole, hasModeratorRole],
  );
  const hasScopedStudentDashboardRole = useMemo(
    () => hasFacultyRole || hasModeratorRole || hasHeadRole,
    [hasFacultyRole, hasModeratorRole, hasHeadRole],
  );
  const isScopedStudentDashboardOnly = useMemo(
    () => hasScopedStudentDashboardRole && !(isAdmin || hasHeadRole),
    [hasScopedStudentDashboardRole, isAdmin, hasHeadRole],
  );
  const multipleScopedRoles = useMemo(
    () => [hasHeadRole, hasModeratorRole, hasFacultyRole].filter(Boolean).length > 1,
    [hasHeadRole, hasModeratorRole, hasFacultyRole],
  );

  function navigateTo(view: typeof superView) {
    setApiError(null);
    setPrevSuperView(superView);
    setSuperView(view);
  }

  function goBack() {
    if (prevSuperView) {
      setApiError(null);
      setSuperView(prevSuperView);
      setPrevSuperView(null);
    }
  }

  const theme = useTheme();
  const echartsTheme = theme.palette.mode === "dark" ? "dark" : undefined;
  const isDark = theme.palette.mode === "dark";
  const shellColors = {
    pageBg: isDark ? "grey.950" : "grey.100",
    appBarBg: "background.paper",
    drawerBg: "background.paper",
    border: "divider",
    surface: "background.paper",
    textPrimary: "text.primary",
    textSecondary: "text.secondary",
    iconSurface: isDark ? "rgba(148, 163, 184, 0.18)" : "rgba(100, 116, 139, 0.12)",
    iconColor: "text.secondary",
  };
  const canEditOwnProfile = useMemo(() => {
    if (!principal) return false;
    return !principal.roles.includes("guest") && !principal.roles.includes("student");
  }, [principal]);
  const hasLocalPasswordAccount = myAccount?.provider === "local" && Boolean(myAccount?.username);
  const isEligibleRoleForPasswordTab = useMemo(() => {
    if (!principal) return false;
    if (isSuperAdmin) return false;
    return principal.roles.includes("admin") || principal.roles.includes("faculty") || principal.roles.includes("moderator");
  }, [principal, isSuperAdmin]);
  const canChangeOwnPassword = isEligibleRoleForPasswordTab && hasLocalPasswordAccount;
  useEffect(() => {
    if (!status || status === "Loading...") return;
    const timeoutId = window.setTimeout(() => {
      setStatus((current) => (current === status ? "" : current));
    }, STATUS_AUTO_HIDE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [status]);

  function getCachedAdminPayload<T>(key: AdminCacheKey, ttlMs: number): T | null {
    const entry = adminReadCacheRef.current[key];
    if (entry && Date.now() - entry.cachedAt <= ttlMs) {
      return entry.payload as T;
    }
    const sessionKey = adminCacheSessionKeyRef.current;
    if (!sessionKey) return null;
    const cached = readLocalScopedCache<T>(key, sessionKey, ttlMs);
    if (!cached) return null;
    adminReadCacheRef.current[key] = { cachedAt: Date.now(), payload: cached };
    return cached;
  }

  function setCachedAdminPayload<T>(key: AdminCacheKey, payload: T) {
    adminReadCacheRef.current[key] = { cachedAt: Date.now(), payload };
    const sessionKey = adminCacheSessionKeyRef.current;
    if (!sessionKey) return;
    writeLocalScopedCache(key, sessionKey, payload);
  }

  function invalidateAdminCache(keys?: AdminCacheKey[]) {
    const sessionKey = adminCacheSessionKeyRef.current;
    const shouldInvalidateSummaries = !keys || keys.some((key) =>
      key === "dashboard"
      || key === "students-directory:first"
      || key === "faculty-students:first"
      || key === "moderator-students:first"
      || key === "head-students:first"
    );
    if (!keys) {
      adminReadCacheRef.current = {};
      if (sessionKey) {
        for (const key of ADMIN_CACHE_KEYS) {
          removeLocalScopedCache(key, sessionKey);
        }
      }
      if (shouldInvalidateSummaries) {
        invalidateStudentSummaryCache();
      }
      return;
    }
    for (const key of keys) {
      delete adminReadCacheRef.current[key];
      if (sessionKey) {
        removeLocalScopedCache(key, sessionKey);
      }
    }
    if (shouldInvalidateSummaries) {
      invalidateStudentSummaryCache();
    }
  }

  function getStudentSummaryCacheKey(roleContext: "all" | "faculty" | "moderator" | "head" | "self", studentIds: string[]): string {
    const normalizedIds = Array.from(new Set(studentIds.map((id) => String(id ?? "").trim()).filter((id) => id.length > 0))).sort();
    return `student-summaries:${roleContext}:${normalizedIds.join(",")}`;
  }

  function readStudentSummaryCache<T>(cacheKey: string): T | null {
    const inMemory = studentSummaryCacheRef.current[cacheKey];
    if (inMemory && Date.now() - inMemory.cachedAt <= STUDENT_SUMMARY_CACHE_TTL_MS) {
      return inMemory.payload as T;
    }
    const sessionKey = adminCacheSessionKeyRef.current;
    if (!sessionKey) return null;
    const cached = readLocalScopedCache<T>(cacheKey, sessionKey, STUDENT_SUMMARY_CACHE_TTL_MS);
    if (cached == null) return null;
    studentSummaryCacheRef.current[cacheKey] = { cachedAt: Date.now(), payload: cached };
    studentSummaryCacheKeysRef.current.add(cacheKey);
    return cached;
  }

  function writeStudentSummaryCache<T>(cacheKey: string, payload: T): void {
    studentSummaryCacheRef.current[cacheKey] = { cachedAt: Date.now(), payload };
    studentSummaryCacheKeysRef.current.add(cacheKey);
    const sessionKey = adminCacheSessionKeyRef.current;
    if (!sessionKey) return;
    writeLocalScopedCache(cacheKey, sessionKey, payload);
  }

  function invalidateStudentSummaryCache(): void {
    const sessionKey = adminCacheSessionKeyRef.current;
    for (const cacheKey of studentSummaryCacheKeysRef.current) {
      delete studentSummaryCacheRef.current[cacheKey];
      if (sessionKey) {
        removeLocalScopedCache(cacheKey, sessionKey);
      }
    }
    studentSummaryCacheKeysRef.current.clear();
  }

  function getPrincipalCacheSessionKey(nextPrincipal: Principal | null | undefined): string | null {
    if (!nextPrincipal) return null;
    return `${nextPrincipal.provider}|${nextPrincipal.subject}`;
  }

  function bindAdminCacheToSession(nextPrincipal: Principal | null | undefined) {
    const nextKey = getPrincipalCacheSessionKey(nextPrincipal);
    if (adminCacheSessionKeyRef.current !== nextKey) {
      clearSessionDataCaches(adminCacheSessionKeyRef.current);
      invalidateAdminCache();
      invalidateStudentSummaryCache();
      adminCacheSessionKeyRef.current = nextKey;
    }
  }

  function getLocalScopedCacheStorageKey(key: string, sessionKey: string): string {
    return `${LOCAL_DENSE_CACHE_PREFIX}:${sessionKey}:${key}`;
  }

  function readLocalScopedCache<T>(key: string, sessionKey: string, ttlMs: number): T | null {
    try {
      const storageKey = getLocalScopedCacheStorageKey(key, sessionKey);
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as BrowserCacheEnvelope<T>;
      if (!parsed || typeof parsed.cachedAt !== "number" || parsed.sessionKey !== sessionKey) return null;
      if (Date.now() - parsed.cachedAt > ttlMs) return null;
      return parsed.payload;
    } catch {
      return null;
    }
  }

  function writeLocalScopedCache<T>(key: string, sessionKey: string, payload: T) {
    try {
      const storageKey = getLocalScopedCacheStorageKey(key, sessionKey);
      const envelope: BrowserCacheEnvelope<T> = {
        cachedAt: Date.now(),
        payload,
        sessionKey,
      };
      localStorage.setItem(storageKey, JSON.stringify(envelope));
    } catch {
      // Best-effort cache write; ignore storage quota or availability errors.
    }
  }

  function removeLocalScopedCache(key: string, sessionKey: string) {
    try {
      localStorage.removeItem(getLocalScopedCacheStorageKey(key, sessionKey));
    } catch {
      // Ignore localStorage unavailability.
    }
  }

  function readSessionJson<T>(key: string): T | null {
    const sessionKey = adminCacheSessionKeyRef.current;
    if (!sessionKey) return null;
    return readLocalScopedCache<T>(key, sessionKey, STATIC_CACHE_TTL_MS);
  }

  function writeSessionJson<T>(key: string, payload: T) {
    const sessionKey = adminCacheSessionKeyRef.current;
    if (!sessionKey) return;
    writeLocalScopedCache(key, sessionKey, payload);
  }

  function clearSessionDataCaches(sessionKey?: string | null) {
    const resolvedSessionKey = sessionKey ?? adminCacheSessionKeyRef.current;
    if (!resolvedSessionKey) return;
    removeLocalScopedCache(SESSION_REGULATIONS_CACHE_KEY, resolvedSessionKey);
    removeLocalScopedCache(SESSION_PLAN_OF_STUDY_CACHE_KEY, resolvedSessionKey);
    removeLocalScopedCache(SESSION_PLAN_VALIDATION_CACHE_KEY, resolvedSessionKey);
    removeLocalScopedCache(SESSION_PROGRAMMES_CACHE_KEY, resolvedSessionKey);
  }

  const userSummary = useMemo(() => {
    const total = userRows.length;
    const active = userRows.filter((row) => row.active).length;
    const disabled = total - active;
    const loaded = total;
    const neverLoggedIn = userRows.filter((row) => !row.lastLoginAt || row.lastLoginAt === row.createdAt).length;
    return { total, active, disabled, loaded, neverLoggedIn };
  }, [userRows]);
  useEffect(() => {
    if (!hasSuperAdmin || principal || !GOOGLE_CLIENT_ID) {
      return;
    }
    const setupGoogleButton = () => {
      const googleApi = (window as unknown as {
        google?: {
          accounts?: {
            id?: {
              initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
              renderButton: (container: HTMLElement, options: Record<string, unknown>) => void;
            };
          };
        };
      }).google;
      const container = document.getElementById("google-signin-button");
      if (!googleApi?.accounts?.id || !container) {
        return;
      }
      if (!googleIdpInitializedRef.current) {
        googleApi.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: GoogleCredentialResponse) => {
            void onGoogleCredential(response);
          },
        });
        googleIdpInitializedRef.current = true;
      }
      container.innerHTML = "";
      googleApi.accounts.id.renderButton(container, {
        theme: "outline",
        size: "large",
        width: container.offsetWidth || 360,
        text: "signin_with",
      });
    };

    const existing = document.querySelector(`script[src="${GOOGLE_IDP_SCRIPT_SRC}"]`) as HTMLScriptElement | null;
    if (existing) {
      setupGoogleButton();
      return;
    }
    const script = document.createElement("script");
    script.src = GOOGLE_IDP_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = setupGoogleButton;
    document.head.appendChild(script);
  }, [hasSuperAdmin, principal]);
  const dashboardLoginSuccess = Number(dashboard?.auth?.successfulLogins48h ?? 0);
  const dashboardLoginFailed = Number(dashboard?.auth?.failedLogins48h ?? 0);
  const dashboardLoginTotal = dashboardLoginSuccess + dashboardLoginFailed;
  const dashboardLoginTimeline = dashboard?.auth?.loginTimeline48h ?? [];
  const dashboardLoginTimelineLabelsRaw = dashboardLoginTimeline.map((point) => {
    return formatIstHourMinute(String(point.hourTs ?? ""));
  });
  const dashboardLoginTimelineSuccessRaw = dashboardLoginTimeline.map((point) => Number(point.successCount ?? 0));
  const dashboardLoginTimelineFailedRaw = dashboardLoginTimeline.map((point) => Number(point.failedCount ?? 0));
  const dashboardLoginTimelineFirstActiveIndex = dashboardLoginTimeline.findIndex((point) => Number(point.successCount ?? 0) > 0 || Number(point.failedCount ?? 0) > 0);
  const dashboardLoginTimelineLastActiveIndex = (() => {
    for (let i = dashboardLoginTimeline.length - 1; i >= 0; i -= 1) {
      const point = dashboardLoginTimeline[i];
      if (Number(point.successCount ?? 0) > 0 || Number(point.failedCount ?? 0) > 0) {
        return i;
      }
    }
    return -1;
  })();
  const dashboardLoginTimelineWindowStart =
    dashboardLoginTimelineFirstActiveIndex >= 0 ? Math.max(0, dashboardLoginTimelineFirstActiveIndex - 1) : 0;
  const dashboardLoginTimelineWindowEnd =
    dashboardLoginTimelineLastActiveIndex >= 0 ? Math.min(dashboardLoginTimeline.length - 1, dashboardLoginTimelineLastActiveIndex + 1) : dashboardLoginTimeline.length - 1;
  const dashboardLoginTimelineLabels = dashboardLoginTimelineLabelsRaw.slice(
    dashboardLoginTimelineWindowStart,
    dashboardLoginTimelineWindowEnd + 1
  );
  const dashboardLoginTimelineSuccess = dashboardLoginTimelineSuccessRaw
    .slice(dashboardLoginTimelineWindowStart, dashboardLoginTimelineWindowEnd + 1)
    .map((value) => (value > 0 ? value : null));
  const dashboardLoginTimelineFailed = dashboardLoginTimelineFailedRaw
    .slice(dashboardLoginTimelineWindowStart, dashboardLoginTimelineWindowEnd + 1)
    .map((value) => (value > 0 ? value : null));
  const dashboardErrorLogs = Number(dashboard?.logging?.errorLogs48h ?? 0);
  const dashboardWarnLogs = Number(dashboard?.logging?.warnLogs48h ?? 0);
  const visibleRegulations = useMemo(() => {
    if (!isStudentOnlySession) {
      return regulations;
    }
    if (!Number.isInteger(studentSelfPlanOfStudyCode) || Number(studentSelfPlanOfStudyCode) <= 0) {
      return [];
    }
    const studentPlan = plansOfStudy.find((plan) => Number(plan.planCode) === Number(studentSelfPlanOfStudyCode));
    if (!studentPlan) {
      return [];
    }
    return regulations.filter((regulation) => regulation.code === studentPlan.regulationCode);
  }, [isStudentOnlySession, plansOfStudy, regulations, studentSelfPlanOfStudyCode]);
  const activeStudentPlan = useMemo(() => {
    if (!isStudentOnlySession) return null;
    if (!Number.isInteger(studentSelfPlanOfStudyCode) || Number(studentSelfPlanOfStudyCode) <= 0) return null;
    return plansOfStudy.find((plan) => Number(plan.planCode) === Number(studentSelfPlanOfStudyCode)) ?? null;
  }, [isStudentOnlySession, plansOfStudy, studentSelfPlanOfStudyCode]);
  const selectedRegulationCode = useMemo(() => {
    if (visibleRegulations.length === 0) return null;
    const activeIndex = Math.min(regulationTab, visibleRegulations.length - 1);
    const active = visibleRegulations[activeIndex];
    return active?.code ?? null;
  }, [visibleRegulations, regulationTab]);
  const filteredPlansOfStudy = useMemo(() => {
    if (isStudentOnlySession) {
      return activeStudentPlan ? [activeStudentPlan] : [];
    }
    if (!selectedRegulationCode) return [];
    return plansOfStudy.filter((plan) => plan.regulationCode === selectedRegulationCode);
  }, [activeStudentPlan, isStudentOnlySession, plansOfStudy, selectedRegulationCode]);

  const studentSelf = useMemo(() => studentSelfDirectoryRows[0] ?? null, [studentSelfDirectoryRows]);

  const studentSelfCreditSummary = useMemo(() => {
    if (!isStudentOnlySession || !studentSelf || !activeStudentPlan) return null;
    const userId = studentSelf.userId;
    const creditsLoaded = studentEarnedCreditsByUser[userId] !== undefined;
    const earnedBySemCat = studentEarnedCreditsByUser[userId] ?? {};
    const currentSem = studentSelf.currentSemester ?? 1;
    const activeRegulation = regulations.find((r) => r.code === activeStudentPlan.regulationCode) ?? null;
    const measureByCategory: Record<string, "credits" | "units"> = {};
    for (const category of activeRegulation?.curriculumStructure.categories ?? []) {
      measureByCategory[category.code] = category.measure ?? "credits";
    }

    let totalRequired = 0;
    let totalExpected = 0;
    const categoryRequired: Record<string, number> = {};
    const categoryExpected: Record<string, number> = {};
    for (const sem of activeStudentPlan.semesters) {
      for (const [cat, req] of Object.entries(sem.categories)) {
        if ((measureByCategory[cat] ?? "credits") !== "credits") continue;
        totalRequired += Number(req);
        categoryRequired[cat] = (categoryRequired[cat] ?? 0) + Number(req);
        if (sem.semester < currentSem) {
          categoryExpected[cat] = (categoryExpected[cat] ?? 0) + Number(req);
          totalExpected += Number(req);
        }
      }
    }

    const categoryEarned: Record<string, number> = {};
    let totalEarned = 0;
    for (const semData of Object.values(earnedBySemCat)) {
      for (const [cat, credits] of Object.entries(semData)) {
        categoryEarned[cat] = (categoryEarned[cat] ?? 0) + credits;
        totalEarned += credits;
      }
    }

    const normRequired = normalizeCredits(totalRequired);
    const normEarned = normalizeCredits(totalEarned);
    const completionPct = normRequired > 0 ? Math.round((normEarned / normRequired) * 100) : 0;

    const categoryList = Object.keys(categoryRequired)
      .filter((code) => (categoryRequired[code] ?? 0) > 0)
      .map((code) => ({
        code,
        required: normalizeCredits(categoryRequired[code] ?? 0),
        earned: normalizeCredits(categoryEarned[code] ?? 0),
        expected: normalizeCredits(categoryExpected[code] ?? 0),
      }));

    const overallStatus = computeCreditStatus(
      totalRequired,
      totalEarned,
      totalExpected,
      categoryList,
    );

    const categories = categoryList
      .map((c) => ({
        ...c,
        status: computeCreditStatus(c.required, c.earned, c.expected),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    return { totalRequired: normRequired, totalEarned: normEarned, completionPct, overallStatus, categories, creditsLoaded };
  }, [isStudentOnlySession, studentSelf, activeStudentPlan, studentEarnedCreditsByUser, regulations]);
  const regulationTabMax = Math.max(visibleRegulations.length - 1, 0);
  const planOfStudyTabMax = Math.max(filteredPlansOfStudy.length - 1, 0);
  const safeRegulationTab = Math.min(regulationTab, regulationTabMax);
  const safePlanOfStudyTab = Math.min(planOfStudyTab, planOfStudyTabMax);
  const planOfStudyOptions = useMemo(
    () =>
      plansOfStudy
        .map((plan) => ({ code: Number(plan.planCode), name: String(plan.planName ?? "").trim() || `Plan ${plan.planCode}` }))
        .filter((item) => Number.isInteger(item.code))
        .sort((a, b) => a.code - b.code),
    [plansOfStudy]
  );
  const planSemesterBounds = useMemo<Record<number, { min: number; max: number }>>(
    () =>
      plansOfStudy.reduce<Record<number, { min: number; max: number }>>((acc, plan) => {
        const semesters = Array.isArray(plan.semesters)
          ? plan.semesters
              .map((item) => Number(item.semester))
              .filter((value) => Number.isFinite(value) && Number.isInteger(value))
          : [];
        if (semesters.length > 0) {
          acc[plan.planCode] = {
            min: Math.min(...semesters),
            max: Math.max(...semesters),
          };
        }
        return acc;
      }, {}),
    [plansOfStudy]
  );
  const selectedStudentPlan = useMemo(() => {
    const code = Number(selectedStudentForCredits?.planOfStudyCode ?? 0);
    if (!Number.isInteger(code) || code <= 0) return null;
    return plansOfStudy.find((plan) => Number(plan.planCode) === code) ?? null;
  }, [plansOfStudy, selectedStudentForCredits]);
  const selectedStudentRegulation = useMemo(() => {
    if (!selectedStudentPlan) return null;
    return regulations.find((reg) => reg.code === selectedStudentPlan.regulationCode) ?? null;
  }, [regulations, selectedStudentPlan]);

  const loginActivityChartOption = useMemo<EChartsOption>(() => {
    return {
      tooltip: { trigger: "axis" },
      legend: {
        formatter: (name: string) => {
          if (name === "Success") return `Success (${dashboardLoginSuccess})`;
          if (name === "Failed") return `Failed (${dashboardLoginFailed})`;
          return name;
        },
      },
      xAxis: {
        type: "category",
        data: dashboardLoginTimelineLabels,
      },
      yAxis: {
        type: "value",
      },
      series: [
        {
          name: "Success",
          type: "line",
          connectNulls: true,
          data: dashboardLoginTimelineSuccess,
        },
        {
          name: "Failed",
          type: "line",
          connectNulls: true,
          data: dashboardLoginTimelineFailed,
        },
      ],
    };
  }, [dashboardLoginFailed, dashboardLoginSuccess, dashboardLoginTimelineFailed, dashboardLoginTimelineLabels, dashboardLoginTimelineSuccess]);
  const loginActivityChartEvents = useMemo(
    () => ({
      click: (params: { seriesName?: string; value?: number }) => {
        const normalizedSeries = String(params?.seriesName ?? "").toLowerCase();
        const value = Number(params?.value ?? 0);
        if (value <= 0) return;
        if (normalizedSeries === "success") {
          void openLoginActivity();
          return;
        }
        if (normalizedSeries === "failed") {
          void openLoginActivity();
        }
      },
    }),
    []
  );
  const displayName = useMemo(() => {
    if (!principal) return "";
    const raw = principal.fullName?.trim() || principal.email?.trim() || principal.subject.trim();
    return raw.startsWith("local-") ? raw.slice("local-".length) : raw;
  }, [principal]);
  const userAccountMenuItems: Array<{ id: string; label: string; icon: ReactElement; onClick: () => void }> = [
    {
      id: "account-profile",
      label: "My Account",
      icon: <PersonIcon fontSize="small" />,
      onClick: () => {
        navigateTo("account");
        setAccountView("profile");
        setProfileAnchorEl(null);
        setMobileOpen(false);
        void ensureActiveServerSession();
      },
    },
    {
      id: "account-signout",
      label: "Sign Out",
      icon: <LogoutIcon fontSize="small" />,
      onClick: () => {
        setProfileAnchorEl(null);
        setMobileOpen(false);
        void logout();
      },
    },
  ];
  const activityLevelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of activityLogRows) {
      const key = (row.level ?? "").toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [activityLogRows]);
  const activityLevelOptions = useMemo(() => Array.from(activityLevelCounts.keys()).sort(), [activityLevelCounts]);
  const toStatusFamily = (statusCode: number): string => {
    if (statusCode >= 100 && statusCode < 600) {
      return `${Math.floor(statusCode / 100)}xx`;
    }
    return "other";
  };
  const activityStatusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of activityLogRows) {
      const family = toStatusFamily(row.statusCode);
      counts.set(family, (counts.get(family) ?? 0) + 1);
    }
    return counts;
  }, [activityLogRows]);
  const activityStatusOptions = useMemo(() => {
    const ordered = ["1xx", "2xx", "3xx", "4xx", "5xx", "other"];
    return ordered.filter((key) => (activityStatusCounts.get(key) ?? 0) > 0);
  }, [activityStatusCounts]);
  const hasAnyActivityLevelFilter = activityLevelFilters.length > 0;
  const hasAnyActivityStatusFilter = activityStatusFilters.length > 0;
  const hasAnyActivityEventFilter = activityEventFilters.length > 0;
  const toggleActivityLevelFilter = (level: string) => {
    setActivityLevelFilters((prev) => (prev.includes(level) ? prev.filter((v) => v !== level) : [...prev, level]));
  };
  const toggleActivityStatusFilter = (status: string) => {
    setActivityStatusFilters((prev) => (prev.includes(status) ? prev.filter((v) => v !== status) : [...prev, status]));
  };
  const activityFilteredRows = useMemo(() => {
    return activityLogRows.filter((row) => {
      const level = (row.level ?? "").toLowerCase();
      const statusFamily = toStatusFamily(row.statusCode);
      const event = String(row.event ?? "").trim();
      const levelMatch = !hasAnyActivityLevelFilter || activityLevelFilters.includes(level);
      const statusMatch = !hasAnyActivityStatusFilter || activityStatusFilters.includes(statusFamily);
      const eventMatch = !hasAnyActivityEventFilter || activityEventFilters.includes(event);
      return levelMatch && statusMatch && eventMatch;
    });
  }, [activityLogRows, activityLevelFilters, activityStatusFilters, activityEventFilters, hasAnyActivityLevelFilter, hasAnyActivityStatusFilter, hasAnyActivityEventFilter]);
  const activityLoadedPages = useMemo(
    () => Math.max(1, Math.ceil(activityFilteredRows.length / ACTIVITY_LOGS_PAGE_SIZE)),
    [activityFilteredRows.length]
  );
  const hasAnyLogTypeFilter = logTypeFilters.length > 0;
  const isLogTypeSelected = (key: LogTypeFilter) => logTypeFilters.includes(key);
  const toggleLogTypeFilter = (key: LogTypeFilter) => {
    setLogTypeFilters((prev) => (prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]));
  };
  const visibleLogRows = useMemo(() => {
    if (!hasAnyLogTypeFilter) {
      return logRows;
    }
    return logRows.filter((row) => logTypeFilters.every((filter) => {
      if (filter === "status5xx") return row.statusCode >= 500;
      if (filter === "status4xx") return row.statusCode >= 400 && row.statusCode < 500;
      return row.durationMs > 1000;
    }));
  }, [hasAnyLogTypeFilter, logRows, logTypeFilters]);
  const visibleLogRowsByType = useMemo(() => ({
    status5xx: visibleLogRows.filter((row) => row.statusCode >= 500),
    status4xx: visibleLogRows.filter((row) => row.statusCode >= 400 && row.statusCode < 500),
    slow: visibleLogRows.filter((row) => row.durationMs > 1000),
  }), [visibleLogRows]);
  const activityVisibleRows = useMemo(() => {
    const start = (activityLogPage - 1) * ACTIVITY_LOGS_PAGE_SIZE;
    const end = start + ACTIVITY_LOGS_PAGE_SIZE;
    return activityFilteredRows.slice(start, end);
  }, [activityFilteredRows, activityLogPage]);
  const activityVisibleCumulativeCount = useMemo(
    () => Math.min(activityFilteredRows.length, activityLogPage * ACTIVITY_LOGS_PAGE_SIZE),
    [activityFilteredRows.length, activityLogPage]
  );
  useEffect(() => {
    setActivityLogPage(1);
  }, [activityLevelFilters, activityStatusFilters, activityEventFilters]);
  useEffect(() => {
    if (activityLogPage > activityLoadedPages) {
      setActivityLogPage(activityLoadedPages);
    }
  }, [activityLogPage, activityLoadedPages]);
  const shouldShowSetupPage = setupStateLoaded && !wizardState.setupComplete;


  async function refreshCsrf() {
    const res = await callApi("/api/auth/csrf", "GET");
    if (res.ok && res.csrfToken) {
      setCsrfToken(res.csrfToken);
    }
  }

  async function loadWizardStatus() {
    const res = await callApi("/api/setup/wizard-status", "GET");
    if (!res.ok) {
      setStatus(`Unable to load wizard status: ${res.error ?? "Unknown error"}`);
      setSetupStateLoaded(true);
      return;
    }
    setWizardState({
      hasConnection: Boolean(res.hasConnection),
      hasTables: Boolean(res.hasTables),
      hasCredentials: Boolean(res.hasCredentials),
      setupComplete: Boolean(res.setupComplete)
    });
    setHasSuperAdmin(Boolean(res.hasSuperAdmin));
    setSetupLocked(Boolean(res.setupLocked));
    setSetupStateLoaded(true);
  }

  async function loadSessionPrincipal() {
    const me = await callApi("/api/auth/me", "GET");
    if (me.ok && me.principal) {
      const nextPrincipal = me.principal as Principal;
      bindAdminCacheToSession(nextPrincipal);
      setPrincipal(nextPrincipal);
      sessionCheckRef.current = { checkedAt: Date.now(), ok: true };
      await refreshCsrf();
      setStatus("Logged in");
    } else {
      bindAdminCacheToSession(null);
      sessionCheckRef.current = { checkedAt: Date.now(), ok: false };
      clearSessionDataCaches();
    }
  }

  async function ensureActiveServerSession(): Promise<boolean> {
    if (sessionStorage.getItem(TAB_SESSION_MARKER_KEY) !== "1") {
      bindAdminCacheToSession(null);
      clearSessionDataCaches();
      setPrincipal(null);
      setMyAccount(null);
      setOtherSessionsCount(0);
      setStatus("Session not active in this tab. Please sign in again.");
      return false;
    }
    if (sessionTakenOver) {
      bindAdminCacheToSession(null);
      setStatus("Session moved to another tab. Please sign in again.");
      return false;
    }
    const now = Date.now();
    // Reduce DB reads: trust a successful server check for 30s.
    if (sessionCheckRef.current.ok && now - sessionCheckRef.current.checkedAt < 30_000) {
      return true;
    }
    const me = await callApi("/api/auth/me", "GET");
    if (me.ok && me.principal) {
      bindAdminCacheToSession(me.principal as Principal);
      sessionCheckRef.current = { checkedAt: now, ok: true };
      return true;
    }
    sessionCheckRef.current = { checkedAt: now, ok: false };
    bindAdminCacheToSession(null);
    clearSessionDataCaches();
    setPrincipal(null);
    setMyAccount(null);
    setOtherSessionsCount(0);
    setOpenGroups({});
    setMenuAnchors({});
    setStatus("Session expired. Please sign in again.");
    return false;
  }

  async function loadMyAccount() {
    const res = await callApi("/api/auth/my-account", "GET");
    if (res.ok && res.profile) {
      const profile = res.profile as MyAccount;
      setMyAccount(profile);
      setFullNameInput(profile.fullName ?? "");
    }
  }

  async function revalidateSessionStrict() {
    const now = Date.now();
    if (now - strictRevalidateRef.current < 45_000) {
      return;
    }
    strictRevalidateRef.current = now;
    if (sessionStorage.getItem(TAB_SESSION_MARKER_KEY) !== "1") {
      sessionCheckRef.current = { checkedAt: Date.now(), ok: false };
      bindAdminCacheToSession(null);
      clearSessionDataCaches();
      setPrincipal(null);
      setMyAccount(null);
      setOtherSessionsCount(0);
      setOpenGroups({});
      setMenuAnchors({});
      setStatus("Session not active in this tab. Please sign in again.");
      return;
    }
    if (authSyncInFlightRef.current) {
      return;
    }
    authSyncInFlightRef.current = true;
    try {
      const me = await callApi("/api/auth/me", "GET");
      if (me.ok && me.principal && !sessionTakenOver) {
        const nextPrincipal = me.principal as Principal;
        bindAdminCacheToSession(nextPrincipal);
        setPrincipal(nextPrincipal);
        sessionCheckRef.current = { checkedAt: Date.now(), ok: true };
        return;
      }
      sessionCheckRef.current = { checkedAt: Date.now(), ok: false };
      bindAdminCacheToSession(null);
      clearSessionDataCaches();
      setPrincipal(null);
      setMyAccount(null);
      setOtherSessionsCount(0);
      setOpenGroups({});
      setMenuAnchors({});
      setStatus("Session expired. Please sign in again.");
    } finally {
      authSyncInFlightRef.current = false;
    }
  }

  async function loadOtherSessionsCount() {
    const res = await callApi("/api/auth/other-sessions-count", "GET");
    if (!res.ok) {
      setOtherSessionsCount(0);
      return;
    }
    setOtherSessionsCount(Math.max(0, Number(res.otherSessions ?? 0)));
  }

  async function loadMySessions() {
    const res = await callApi("/api/auth/sessions", "GET");
    if (!res.ok) {
      setMySessions([]);
      return;
    }
    setMySessions(Array.isArray(res.sessions) ? (res.sessions as MySession[]) : []);
  }

  async function loadDashboard(options?: { force?: boolean }) {
    const force = Boolean(options?.force);
    const cacheKey: AdminCacheKey = "dashboard";
    if (!force) {
      const cached = getCachedAdminPayload<AdminDashboard>(cacheKey, ADMIN_CACHE_TTL_MS.dashboard);
      if (cached) {
        setDashboard(cached);
        return;
      }
    }
    const endpoint = force ? "/api/admin/dashboard?force=1" : "/api/admin/dashboard";
    const res = await callApi(endpoint, "GET");
    if (!res.ok) {
      const msg = `Unable to load dashboard: ${res.error ?? "Unknown error"}`;
      setStatus(msg);
      setApiError({ message: msg, retryFn: () => loadDashboard({ force: true }) });
      return;
    }
    if (res.ok) {
      const nextDashboard: AdminDashboard = {
        generatedAt: res.generatedAt,
        mitigations: res.mitigations,
        system: res.system,
        auth: res.auth,
        logging: res.logging,
        curriculumValidation: res.curriculumValidation as PlansValidationReport | undefined,
      };
      setDashboard(nextDashboard);
      setCachedAdminPayload(cacheKey, nextDashboard);
    }
  }

  async function loadLogs(level: "error" | "warn", cursor?: string | null, options?: { force?: boolean }) {
    const force = Boolean(options?.force);
    const firstPageKey: AdminCacheKey = level === "error" ? "logs:error:first" : "logs:warn:first";
    if (!cursor && !force) {
      const cached = getCachedAdminPayload<{ rows: LogRow[]; nextCursor: string | null; hasMore: boolean }>(firstPageKey, ADMIN_CACHE_TTL_MS.logs);
      if (cached) {
        setLogRows(cached.rows);
        setLogCursor(cached.nextCursor);
        setLogHasMore(cached.hasMore);
        return;
      }
    }
    const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const res = await callApi(`/api/logs?limit=20&sinceHours=48&level=${level}${cursorQuery}`, "GET");
    if (!res.ok) {
      const msg = `Unable to load logs: ${res.error ?? "Unknown error"}`;
      setStatus(msg);
      setApiError({ message: msg, retryFn: () => loadLogs(level) });
      return;
    }
    const rows = (res.rows ?? []) as unknown as LogRow[];
    setLogRows((prev) => (cursor ? [...prev, ...rows] : rows));
    setLogCursor(res.page?.nextCursor ?? null);
    setLogHasMore(Boolean(res.page?.hasMore));
    if (!cursor) {
      setCachedAdminPayload(firstPageKey, {
        rows,
        nextCursor: res.page?.nextCursor ?? null,
        hasMore: Boolean(res.page?.hasMore),
      });
    }
  }

  async function loadActivityLogs(cursor?: string | null, options?: { force?: boolean }): Promise<{ ok: boolean; rowsAdded: number }> {
    const force = Boolean(options?.force);
    const cacheKey: AdminCacheKey = "activity:first";
    if (!cursor && !force) {
      const cached = getCachedAdminPayload<{ rows: LogRow[]; nextCursor: string | null; hasMore: boolean }>(cacheKey, ADMIN_CACHE_TTL_MS.activityLogs);
      if (cached) {
        setActivityLogRows(cached.rows);
        setActivityLogCursor(cached.nextCursor);
        setActivityLogHasMore(cached.hasMore);
        setActivityLogPage(1);
        return { ok: true, rowsAdded: cached.rows.length };
      }
    }
    const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const res = await callApi(`/api/logs?limit=50&sinceHours=all${cursorQuery}`, "GET");
    if (!res.ok) {
      const msg = `Unable to load activity logs: ${res.error ?? "Unknown error"}`;
      setStatus(msg);
      setApiError({ message: msg, retryFn: async () => { await loadActivityLogs(); } });
      return { ok: false, rowsAdded: 0 };
    }
    const rows = (res.rows ?? []) as unknown as LogRow[];
    setActivityLogRows((prev) => (cursor ? [...prev, ...rows] : rows));
    setActivityLogCursor(res.page?.nextCursor ?? null);
    setActivityLogHasMore(Boolean(res.page?.hasMore));
    if (!cursor) {
      setActivityLogPage(1);
      setCachedAdminPayload(cacheKey, {
        rows,
        nextCursor: res.page?.nextCursor ?? null,
        hasMore: Boolean(res.page?.hasMore),
      });
    }
    return { ok: true, rowsAdded: rows.length };
  }

  async function goToNextActivityPage() {
    const nextPage = activityLogPage + 1;
    const startIndexForNext = (nextPage - 1) * ACTIVITY_LOGS_PAGE_SIZE;
    if (activityLogRows.length > startIndexForNext) {
      setActivityLogPage(nextPage);
      return;
    }
    if (!activityLogHasMore || !activityLogCursor) {
      return;
    }
    const fetchRes = await loadActivityLogs(activityLogCursor);
    if (fetchRes.ok && fetchRes.rowsAdded > 0) {
      setActivityLogPage(nextPage);
    }
  }

  async function clearLogs() {
    if (!(await ensureActiveServerSession())) {
      return;
    }
    const confirmed = window.confirm("Clear all application logs?");
    if (!confirmed) {
      return;
    }
    setBusy(true);
    setStatus("Clearing logs...");
    try {
      const res = await callApi("/api/logs/clear", "POST");
      if (!res.ok) {
        setStatus(`Clear logs failed: ${res.error ?? "Unknown error"}`);
        return;
      }
      setLogRows([]);
      setLogCursor(null);
      setLogHasMore(false);
      invalidateAdminCache(["dashboard", "logs:error:first", "logs:warn:first", "activity:first"]);
      setStatus(res.message ?? "Logs cleared.");
    } finally {
      setBusy(false);
    }
  }

  async function loadActiveUsers(cursor?: string | null, options?: { force?: boolean }) {
    const force = Boolean(options?.force);
    const cacheKey: AdminCacheKey = "active-users:first";
    if (!cursor && !force) {
      const cached = getCachedAdminPayload<{ rows: ActiveUserRow[]; nextCursor: string | null; hasMore: boolean; totalLiveUsers: number }>(cacheKey, ADMIN_CACHE_TTL_MS.activeUsers);
      if (cached) {
        setActiveUserRows(cached.rows);
        setActiveUserCursor(cached.nextCursor);
        setActiveUserHasMore(cached.hasMore);
        setActiveLiveUsersCount(cached.totalLiveUsers);
        return;
      }
    }
    const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const res = await callApi(`/api/admin/active-users?limit=20${cursorQuery}`, "GET");
    if (!res.ok) {
      const msg = `Unable to load active users: ${res.error ?? "Unknown error"}`;
      setStatus(msg);
      setApiError({ message: msg, retryFn: () => loadActiveUsers() });
      return;
    }
    const rows = (res.rows ?? []) as unknown as ActiveUserRow[];
    setActiveUserRows((prev) => (cursor ? [...prev, ...rows] : rows));
    setActiveUserCursor(res.page?.nextCursor ?? null);
    setActiveUserHasMore(Boolean(res.page?.hasMore));
    setActiveLiveUsersCount(Number(res.totalLiveUsers ?? 0));
    if (!cursor) {
      setCachedAdminPayload(cacheKey, {
        rows,
        nextCursor: res.page?.nextCursor ?? null,
        hasMore: Boolean(res.page?.hasMore),
        totalLiveUsers: Number(res.totalLiveUsers ?? 0),
      });
    }
  }

  async function loadLoginActivity(cursor?: string | null, options?: { force?: boolean }) {
    const force = Boolean(options?.force);
    const cacheKey: AdminCacheKey = "login-activity:first";
    if (!cursor && !force) {
      const cached = getCachedAdminPayload<{ rows: FailedLoginRow[]; nextCursor: string | null; hasMore: boolean }>(cacheKey, ADMIN_CACHE_TTL_MS.failedLogins);
      if (cached) {
        setLoginActivityRows(cached.rows);
        setLoginActivityCursor(cached.nextCursor);
        setLoginActivityHasMore(cached.hasMore);
        return;
      }
    }
    const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const res = await callApi(`/api/admin/login-attempts?limit=20&sinceHours=48${cursorQuery}`, "GET");
    if (!res.ok) {
      const msg = `Unable to load login activity: ${res.error ?? "Unknown error"}`;
      setStatus(msg);
      setApiError({ message: msg, retryFn: () => loadLoginActivity() });
      return;
    }
    const rows = (res.rows ?? []) as unknown as FailedLoginRow[];
    setLoginActivityRows((prev) => (cursor ? [...prev, ...rows] : rows));
    setLoginActivityCursor(res.page?.nextCursor ?? null);
    setLoginActivityHasMore(Boolean(res.page?.hasMore));
    if (!cursor) {
      setCachedAdminPayload(cacheKey, {
        rows,
        nextCursor: res.page?.nextCursor ?? null,
        hasMore: Boolean(res.page?.hasMore),
      });
    }
  }

  async function openLoginActivity() {
    if (!(await ensureActiveServerSession())) {
      return;
    }
    navigateTo("login-activity");
    await loadLoginActivity();
  }

  async function loadUsers(cursor?: string | null, options?: { force?: boolean }) {
    const force = Boolean(options?.force);
    const cacheKey: AdminCacheKey = "users:first";
    if (!cursor && !force) {
      const cached = getCachedAdminPayload<{ rows: UserRow[]; nextCursor: string | null; hasMore: boolean }>(cacheKey, ADMIN_CACHE_TTL_MS.users);
      if (cached) {
        setUserRows(cached.rows);
        return;
      }
    }
    const searchParam = userGlobalFilter.trim();
    const fetchUsersPage = async (pageCursor?: string | null) => {
      const query = new URLSearchParams();
      query.set("limit", "100");
      if (pageCursor) query.set("cursor", pageCursor);
      if (searchParam) query.set("q", searchParam);
      return callApi(`/api/admin/users?${query.toString()}`, "GET");
    };

    if (cursor) {
      const res = await fetchUsersPage(cursor);
      if (!res.ok) {
        const msg = `Unable to load users: ${res.error ?? "Unknown error"}`;
        setStatus(msg);
        setApiError({ message: msg, retryFn: () => loadUsers() });
        return;
      }
      const rows = (res.rows ?? []) as unknown as UserRow[];
      setUserRows((prev) => [...prev, ...rows]);
      return;
    }

    const allRows: UserRow[] = [];
    let nextCursor: string | null = null;
    let hasMore = true;
    let pageSafety = 0;
    while (hasMore && pageSafety < 1000) {
      const res = await fetchUsersPage(nextCursor);
      if (!res.ok) {
        const msg = `Unable to load users: ${res.error ?? "Unknown error"}`;
        setStatus(msg);
        setApiError({ message: msg, retryFn: () => loadUsers() });
        return;
      }
      const rows = (res.rows ?? []) as unknown as UserRow[];
      allRows.push(...rows);
      nextCursor = res.page?.nextCursor ?? null;
      hasMore = Boolean(res.page?.hasMore && nextCursor);
      pageSafety += 1;
    }
    setUserRows(allRows);
    setCachedAdminPayload(cacheKey, {
      rows: allRows,
      nextCursor,
      hasMore,
    });
  }

  async function loadRegulations(options?: { force?: boolean }) {
    const force = Boolean(options?.force);
    if (!force) {
      const cached = readSessionJson<Regulation[]>(SESSION_REGULATIONS_CACHE_KEY);
      if (Array.isArray(cached) && cached.length > 0) {
        setRegulations(cached);
        return;
      }
    }
    const res = await callApi("/api/regulations", "GET");
    if (!res.ok) {
      const msg = `Unable to load regulations: ${res.error ?? "Unknown error"}`;
      setStatus(msg);
      setApiError({ message: msg, retryFn: () => loadRegulations() });
      return;
    }
    const nextRegulations = (res.regulations ?? []) as Regulation[];
    setRegulations(nextRegulations);
    writeSessionJson(SESSION_REGULATIONS_CACHE_KEY, nextRegulations);
  }

  async function loadPlansOfStudy(options?: { force?: boolean }) {
    const force = Boolean(options?.force);
    if (!force) {
      const cached = readSessionJson<PlanOfStudy[]>(SESSION_PLAN_OF_STUDY_CACHE_KEY);
      const cachedValidation = readSessionJson<PlansValidationReport>(SESSION_PLAN_VALIDATION_CACHE_KEY);
      if (Array.isArray(cached) && cached.length > 0) {
        setPlansOfStudy(cached);
        setPlansValidationReport(cachedValidation ?? null);
        return;
      }
    }
    const res = await callApi("/api/plans-of-study", "GET");
    if (!res.ok) {
      const msg = `Unable to load plans of study: ${res.error ?? "Unknown error"}`;
      setStatus(msg);
      setApiError({ message: msg, retryFn: () => loadPlansOfStudy() });
      return;
    }
    const nextPlans = (res.plansOfStudy ?? []) as PlanOfStudy[];
    const nextValidation = (res.validation ?? null) as PlansValidationReport | null;
    setPlansOfStudy(nextPlans);
    setPlansValidationReport(nextValidation);
    writeSessionJson(SESSION_PLAN_OF_STUDY_CACHE_KEY, nextPlans);
    if (nextValidation) {
      writeSessionJson(SESSION_PLAN_VALIDATION_CACHE_KEY, nextValidation);
    } else {
      const sessionKey = adminCacheSessionKeyRef.current;
      if (sessionKey) {
        removeLocalScopedCache(SESSION_PLAN_VALIDATION_CACHE_KEY, sessionKey);
      }
    }
  }

  async function loadStudentsDirectory(cursor?: string | null, options?: { force?: boolean }) {
    const force = Boolean(options?.force);
    if (!cursor && programmeOptions.length === 0) {
      await loadProgrammes();
    }
    const cacheKey: AdminCacheKey = "students-directory:first";
    if (!cursor && !force) {
      const cached = getCachedAdminPayload<{ rows: StudentDirectoryRow[]; nextCursor: string | null; hasMore: boolean; mentorNameOptions: string[] }>(cacheKey, ADMIN_CACHE_TTL_MS.users);
      if (cached) {
        setStudentDirectoryRows(cached.rows);
        setStudentsDirectoryCursor(cached.nextCursor);
        setStudentsDirectoryHasMore(cached.hasMore);
        setMentorNameOptions(Array.isArray(cached.mentorNameOptions) ? cached.mentorNameOptions : []);
        return;
      }
    }
    const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
    const res = await callApi(`/api/students-directory?limit=100${cursorQuery}`, "GET");
    if (!res.ok) {
      const msg = `Unable to load students directory: ${res.error ?? "Unknown error"}`;
      setStatus(msg);
      setApiError({ message: msg, retryFn: () => loadStudentsDirectory() });
      return;
    }
    const rows = (res.rows ?? []) as unknown as StudentDirectoryRow[];
    const nextMentorOptions = Array.isArray(res.mentorNameOptions) ? res.mentorNameOptions.map((value) => String(value)).filter((value) => value.trim().length > 0) : [];
    setStudentDirectoryRows((prev) => (cursor ? [...prev, ...rows] : rows));
    setStudentsDirectoryCursor(res.page?.nextCursor ?? null);
    setStudentsDirectoryHasMore(Boolean(res.page?.hasMore));
    setMentorNameOptions(nextMentorOptions);
    if (!cursor) {
      setCachedAdminPayload(cacheKey, {
        rows,
        nextCursor: res.page?.nextCursor ?? null,
        hasMore: Boolean(res.page?.hasMore),
        mentorNameOptions: nextMentorOptions,
      });
    }
  }

  async function loadScopedStudents(
    roleContext: "faculty" | "moderator" | "head",
    options?: { force?: boolean },
  ): Promise<FacultyStudentRow[]> {
    const force = Boolean(options?.force);
    const cacheKey: AdminCacheKey = roleContext === "faculty"
      ? "faculty-students:first"
      : roleContext === "moderator"
        ? "moderator-students:first"
        : "head-students:first";
    if (!force) {
      const cached = getCachedAdminPayload<FacultyStudentRow[]>(cacheKey, ADMIN_CACHE_TTL_MS.facultyStudents);
      if (cached) {
        if (roleContext === "faculty") {
          setFacultyStudentRows(cached);
          const minimalFromCached = toFacultyMentoredMinimalRows(cached);
          setFacultyMentoredMinimalRows(minimalFromCached);
          writeSessionJson(SESSION_FACULTY_MENTORED_MINIMAL_KEY, minimalFromCached);
        } else if (roleContext === "moderator") {
          setModeratorStudentRows(cached);
        } else {
          setHeadStudentRows(cached);
        }
        return cached;
      }
    }
    const endpoint = force
      ? `/api/students?limit=100&roleContext=${roleContext}&force=1`
      : `/api/students?limit=100&roleContext=${roleContext}`;
    const res = await callApi(endpoint, "GET");
    if (!res.ok) {
      const scopeLabel = roleContext === "faculty" ? "mentored students" : "active students";
      setStatus(`Unable to load ${scopeLabel}: ${res.error ?? "Unknown error"}`);
      return [];
    }
    const rows = Array.isArray(res.rows) ? res.rows : [];
    const normalizedRows: FacultyStudentRow[] = rows.map((row) => {
      const data = row as Record<string, unknown>;
      return {
        userId: String(data.userId ?? data.user_id ?? ""),
        registrationNumber: data.registration_number == null ? null : String(data.registration_number),
        planOfStudyCode: data.plan_of_study_code == null ? null : Number(data.plan_of_study_code),
        currentSemester: data.current_semester == null ? null : Number(data.current_semester),
        batch: data.batch == null ? null : Number(data.batch),
        programme: data.programme == null ? null : Number(data.programme),
        graduated: String(data.graduated ?? "").trim().toLowerCase() === "yes" ? "Yes" : "No",
        fullName: data.full_name == null ? null : String(data.full_name),
        email: data.email == null ? null : String(data.email),
        studentActive: Number(data.student_active ?? 0) === 1,
        mentorEmail: data.mentor_email == null ? null : String(data.mentor_email),
      };
    });
    if (roleContext === "faculty") {
      setFacultyStudentRows(normalizedRows);
      const minimalRows: FacultyMentoredStudentMinimal[] = toFacultyMentoredMinimalRows(normalizedRows);
      setFacultyMentoredMinimalRows(minimalRows);
      writeSessionJson(SESSION_FACULTY_MENTORED_MINIMAL_KEY, minimalRows);
    } else if (roleContext === "moderator") {
      setModeratorStudentRows(normalizedRows);
    } else {
      setHeadStudentRows(normalizedRows);
    }
    setCachedAdminPayload(cacheKey, normalizedRows);
    return normalizedRows;
  }

  async function loadStudentSelfPlanOfStudy(options?: { force?: boolean }) {
    const force = Boolean(options?.force);
    if (!force && (studentSelfPlanOfStudyCode !== null || studentSelfDirectoryRows.length > 0)) {
      return;
    }
    const res = await callApi("/api/students?limit=1", "GET");
    if (!res.ok) return;
    const row = Array.isArray(res.rows) && res.rows.length > 0 ? (res.rows[0] as Record<string, unknown>) : null;
    const codeRaw = row?.plan_of_study_code;
    const code = codeRaw == null ? null : Number(codeRaw);
    setStudentSelfPlanOfStudyCode(Number.isInteger(code) && Number(code) > 0 ? Number(code) : null);
    if (row) {
      setStudentSelfDirectoryRows([{
        userId: String(row.userId ?? row.user_id ?? "").trim(),
        fullName: String(row.full_name ?? "").trim() || "Unnamed Student",
        email: String(row.email ?? "").trim(),
        registrationNumber: String(row.registration_number ?? "").trim() || "Not Allotted",
        planOfStudyCode: code == null || !Number.isInteger(code) ? null : Number(code),
        currentSemester: row.current_semester == null ? 1 : Number(row.current_semester),
        batch: row.batch == null ? null : Number(row.batch),
        programme: row.programme == null ? null : Number(row.programme),
        graduated: String(row.graduated ?? "").trim().toLowerCase() === "yes" ? "Yes" : "No",
        mentorName: String(row.mentor_name ?? row.mentor_full_name ?? row.mentor_email ?? "").trim(),
        modifiedByName: "",
        modifiedAt: null,
      }]);
    } else {
      setStudentSelfDirectoryRows([]);
    }
  }

  async function loadScopedCreditTable(roleContext: "faculty" | "moderator") {
    const res = await callApi(`/api/student-credit-table?roleContext=${roleContext}`, "GET");
    if (!res.ok) {
      const msg = `Unable to load student credit table: ${res.error ?? "Unknown error"}`;
      setStatus(msg);
      setApiError({ message: msg, retryFn: () => loadScopedCreditTable(roleContext) });
      return;
    }
    const rows = Array.isArray(res.rows) ? res.rows : [];
    const normalizedRows: FacultyCreditTableRow[] = rows.map((row) => {
      const data = row as Record<string, unknown>;
      return {
        registrationNumber: data.registrationNumber == null ? null : String(data.registrationNumber),
        graduated: String(data.graduated ?? "").trim().toLowerCase() === "yes" || Number(data.graduated ?? 0) === 1 ? "Yes" : "No",
        categoryId: String(data.categoryId ?? ""),
        semester: Number(data.semester ?? 0),
        credits: normalizeCredits(Number(data.credits ?? 0)),
        modifiedByUsername: data.modifiedByUsername == null ? null : String(data.modifiedByUsername),
        modifiedAt: data.modifiedAt == null ? null : String(data.modifiedAt),
      };
    });
    if (roleContext === "faculty") {
      setFacultyCreditTableRows(normalizedRows);
    } else {
      setModeratorCreditTableRows(normalizedRows);
    }
  }

  async function loadFacultyStudents(options?: { force?: boolean }) {
    return loadScopedStudents("faculty", options);
  }

  async function loadModeratorStudents(options?: { force?: boolean }) {
    return loadScopedStudents("moderator", options);
  }
  async function loadHeadStudents(options?: { force?: boolean }) {
    return loadScopedStudents("head", options);
  }

  function handleDashboardSectionToggle(section: "head" | "moderator" | "faculty") {
    setExpandedDashboardSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) { next.delete(section); } else { next.add(section); }
      return next;
    });
    if (!loadedDashboardSections.has(section)) {
      setLoadedDashboardSections((prev) => new Set([...prev, section]));
      const loadFn = section === "head" ? loadHeadStudents : section === "moderator" ? loadModeratorStudents : loadFacultyStudents;
      void loadFn();
    }
  }

  async function loadFacultyCreditTable() {
    await loadScopedCreditTable("faculty");
  }

  async function loadModeratorCreditTable() {
    await loadScopedCreditTable("moderator");
  }


  async function loadPrimaryScopedStudents(options?: { force?: boolean }) {
    if (scopedDashboardRoleContext === "moderator") {
      await loadModeratorStudents(options);
      return;
    }
    await loadFacultyStudents(options);
  }

  async function loadPrimaryScopedCreditTable() {
    if (scopedDashboardRoleContext === "moderator") {
      await loadModeratorCreditTable();
      return;
    }
    await loadFacultyCreditTable();
  }

  function blurActiveElement() {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
  }
  function openStudentCredits(row: StudentDirectoryRow) {
    setSelectedStudentForCredits(row);
    navigateTo("student-credits");
    if (row.userId && !(row.userId in studentSavedCreditsByUser)) {
      void loadStudentCredits(row.userId);
    }
  }
  async function loadStudentCreditSummaries(userIds: string[]) {
    if (userIds.length === 0) return;
    const summaryRoleContext: "all" | "faculty" | "moderator" | "head" | "self" =
      isStudentOnlySession
        ? "self"
        : (isScopedStudentDashboardOnly
            ? (scopedDashboardRoleContext === "moderator" ? "moderator" : "faculty")
            : (hasHeadRole ? "head" : "all"));
    const cacheKey = getStudentSummaryCacheKey(summaryRoleContext, userIds);
    const cached = readStudentSummaryCache<Array<{ studentId: string; totalCredits: number; totalUnits?: number; byCategory?: Record<string, number> }>>(cacheKey);
    const result = cached
      ? { ok: true, summaries: cached }
      : await callApi("/api/student-credits/summaries", "POST", undefined, { studentIds: userIds });
    if (!cached && result.ok && Array.isArray(result.summaries)) {
      writeStudentSummaryCache(cacheKey, result.summaries as Array<{ studentId: string; totalCredits: number; totalUnits?: number; byCategory?: Record<string, number> }>);
    }
    if (result.ok && Array.isArray(result.summaries)) {
      const planByCode = new Map(plansOfStudy.map((plan) => [plan.planCode, plan]));
      const regulationByCode = new Map(regulations.map((regulation) => [regulation.code, regulation]));
      const studentById = new Map(studentsDirectorySourceRows.map((student) => [student.userId, student]));
      const totals: Record<string, number> = {};
      const unitTotals: Record<string, number> = {};
      const summaryCatEarned: Record<string, Record<string, number>> = {};
      for (const item of result.summaries as Array<{ studentId: string; totalCredits: number; totalUnits?: number; byCategory?: Record<string, number> }>) {
        const studentId = String(item.studentId ?? "");
        if (!studentId) continue;
        const student = studentById.get(studentId);
        const plan = student?.planOfStudyCode ? planByCode.get(student.planOfStudyCode) : null;
        const regulation = plan ? regulationByCode.get(plan.regulationCode) : null;
        const measureByCategory = new Map(
          (regulation?.curriculumStructure.categories ?? []).map((category) => [category.code, category.measure ?? "credits"]),
        );
        const byCategory = item.byCategory ?? {};
        const hasByCategory = Object.keys(byCategory).length > 0;

        if (hasByCategory) {
          let creditSum = 0;
          let unitSum = 0;
          const catMap: Record<string, number> = {};
          for (const [categoryCode, rawValue] of Object.entries(byCategory)) {
            const value = Number(rawValue ?? 0);
            if (!Number.isFinite(value) || value <= 0) continue;
            catMap[categoryCode] = normalizeCredits(value);
            if ((measureByCategory.get(categoryCode) ?? "credits") === "units") {
              unitSum += value;
            } else {
              creditSum += value;
            }
          }
          totals[studentId] = normalizeCredits(creditSum);
          unitTotals[studentId] = normalizeCredits(unitSum);
          summaryCatEarned[studentId] = catMap;
          continue;
        }

        totals[studentId] = normalizeCredits(Number(item.totalCredits ?? 0));
        unitTotals[studentId] = normalizeCredits(Number(item.totalUnits ?? 0));
      }
      setStudentCreditTotals(totals);
      setStudentUnitTotals(unitTotals);
      setStudentSummaryCatEarned((prev) => ({ ...prev, ...summaryCatEarned }));
      setCreditTotalsLoaded(true);
    }
  }

  async function loadStudentCredits(userId: string) {
    const result = await callApi(`/api/student-credits?studentId=${encodeURIComponent(userId)}`, "GET");
    if (result.ok && result.creditDetails) {
      const bySemester: Record<number, Record<string, number>> = {};
      for (const { semesterTaken, categoryId, credits } of result.creditDetails) {
        (bySemester[semesterTaken] ??= {})[categoryId] = normalizeCredits(Number(credits ?? 0));
      }
      const byUnitCategory: Record<string, number> = {};
      for (const { categoryId, unitsEarned } of result.unitDetails ?? []) {
        byUnitCategory[categoryId] = normalizeCredits(Number(unitsEarned ?? 0));
      }
      setStudentSavedCreditsByUser((prev) => ({ ...prev, [userId]: bySemester }));
      setStudentEarnedCreditsByUser((prev) => ({ ...prev, [userId]: bySemester }));
      setStudentSavedUnitsByUser((prev) => ({ ...prev, [userId]: byUnitCategory }));
      setStudentEarnedUnitsByUser((prev) => ({ ...prev, [userId]: byUnitCategory }));
    } else {
      setStudentSavedCreditsByUser((prev) => ({ ...prev, [userId]: {} }));
      setStudentSavedUnitsByUser((prev) => ({ ...prev, [userId]: {} }));
    }
  }
  async function saveStudentCredits(userId: string) {
    const draft = studentEarnedCreditsByUser[userId] ?? {};
    const draftUnits = studentEarnedUnitsByUser[userId] ?? {};
    const entries: Array<{ categoryId: string; semesterTaken: number; credits: number }> = [];
    for (const [sem, bySem] of Object.entries(draft)) {
      for (const [categoryId, credits] of Object.entries(bySem)) {
        entries.push({ categoryId, semesterTaken: Number(sem), credits: normalizeCredits(Number(credits)) });
      }
    }
    const unitEntries: Array<{ categoryId: string; unitsEarned: number }> = [];
    setStudentCreditsSaving(true);
    try {
      const result = await callApi("/api/student-credits", "POST", undefined, {
        studentId: userId,
        writeMode: "replace_all",
        allowClearAll: true,
        entries,
        unitEntries,
      });
      if (result.ok) {
        setStudentSavedCreditsByUser((prev) => ({ ...prev, [userId]: draft }));
        setStudentSavedUnitsByUser((prev) => ({ ...prev, [userId]: draftUnits }));
        invalidateAdminCache(["dashboard"]);
      }
    } finally {
      setStudentCreditsSaving(false);
    }
  }
  function setStudentEarnedCredit(userId: string, semester: number, categoryCode: string, value: number) {
    const normalized = normalizeCredits(Number(value));
    setStudentEarnedCreditsByUser((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] ?? {}),
        [semester]: {
          ...((prev[userId] ?? {})[semester] ?? {}),
          [categoryCode]: normalized,
        },
      },
    }));
  }


  async function loadFacultyMentoredMinimalFromSession() {
    const cached = readSessionJson<FacultyMentoredStudentMinimal[]>(SESSION_FACULTY_MENTORED_MINIMAL_KEY);
    if (Array.isArray(cached)) {
      setFacultyMentoredMinimalRows(
        cached
          .map((item) => ({
            userId: String(item.userId ?? "").trim(),
            email: String(item.email ?? "").trim(),
            registrationNumber: String(item.registrationNumber ?? "").trim(),
            fullName: String(item.fullName ?? "").trim(),
            planOfStudyCode:
              item.planOfStudyCode == null
                ? null
                : Number(item.planOfStudyCode),
          }))
          .filter((item) => item.userId && item.fullName)
      );
    }
  }

  async function openScopedStudentsDirectory(
    scope: "faculty" | "moderator" | "head",
    graduatedFilter?: "Yes" | "No" | null,
    creditStatusFilter?: CreditStatus | null,
    batchFilter?: number | null,
  ) {
    setStudentsDirectoryGraduatedFilter(graduatedFilter ?? null);
    setStudentsDirectoryCreditStatusFilter(creditStatusFilter ?? null);
    setStudentsDirectoryBatchFilter(batchFilter ?? null);
    navigateTo("students-directory");
    await loadProgrammes();
    await loadRegulations();
    await loadPlansOfStudy();
    if (isStudentOnlySession) {
      await loadStudentSelfPlanOfStudy({ force: true });
      return;
    }
    if (isScopedStudentDashboardOnly) {
      if (scope === "moderator") {
        await loadModeratorStudents();
        return;
      }
      await loadFacultyStudents();
      return;
    }
    await loadStudentsDirectory();
  }
  function setStudentEarnedUnit(userId: string, categoryCode: string, value: number) {
    const normalized = normalizeCredits(Number(value));
    setStudentEarnedUnitsByUser((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] ?? {}),
        [categoryCode]: normalized,
      },
    }));
  }

  async function loadProgrammes(options?: { force?: boolean }) {
    const force = Boolean(options?.force);
    if (!force) {
      const cached = readSessionJson<Array<{ id: number; name: string }>>(SESSION_PROGRAMMES_CACHE_KEY);
      if (Array.isArray(cached) && cached.length > 0) {
        setProgrammeOptions(cached);
        return;
      }
    }
    const res = await callApi("/api/programmes", "GET");
    if (!res.ok) {
      setStatus(`Unable to load programmes: ${res.error ?? "Unknown error"}`);
      return;
    }
    const next = Array.isArray(res.programmes)
      ? res.programmes
          .map((item) => ({
            id: Number((item as { id?: unknown }).id),
            name: String((item as { name?: unknown }).name ?? "").trim(),
          }))
          .filter((item) => Number.isInteger(item.id) && item.name.length > 0)
          .sort((a, b) => a.id - b.id)
      : [];
    setProgrammeOptions(next);
    writeSessionJson(SESSION_PROGRAMMES_CACHE_KEY, next);
  }

  async function submitStudentsDirectoryRows(
    updates: Array<
      Pick<StudentDirectoryRow, "userId" | "registrationNumber" | "planOfStudyCode" | "currentSemester" | "batch" | "programme" | "graduated" | "mentorName">
    >
  ) {
    if (updates.length === 0) return;
    const validUpdates = updates.filter((update) => String(update.userId ?? "").trim().length > 0);
    if (validUpdates.length === 0) {
      setStatus("Unable to save: selected row is missing student identity. Refresh and try again.");
      return;
    }
    if (validUpdates.length !== updates.length) {
      setStatus("Skipped one or more invalid rows without student identity.");
    }
    if (!(await ensureActiveServerSession())) return;
    const payload = validUpdates.map((update) => ({
      userId: update.userId,
      registrationNumber: String(update.registrationNumber ?? "").trim() || "Not Allotted",
      planOfStudyCode: typeof update.planOfStudyCode === "number" && Number.isInteger(update.planOfStudyCode) ? update.planOfStudyCode : null,
      currentSemester: typeof update.currentSemester === "number" && Number.isInteger(update.currentSemester) && update.currentSemester > 0 ? update.currentSemester : 1,
      batch: typeof update.batch === "number" && Number.isFinite(update.batch) ? update.batch : 2010,
      programme: typeof update.programme === "number" && Number.isInteger(update.programme) ? update.programme : 0,
      graduated: String(update.graduated ?? "No").trim().toLowerCase() === "yes" ? "Yes" : "No",
      mentorName: String(update.mentorName ?? "").trim(),
    }));
    try {
      setBusy(true);
      const res = await callApi("/api/students-directory/update-batch", "POST", undefined, { updates: payload });
      if (!res.ok) {
        throw new Error(res.error ?? "Student batch update failed");
      }
      setStatus(`Students updated (${payload.length} row${payload.length === 1 ? "" : "s"}).`);
      invalidateAdminCache(["students-directory:first", "faculty-students:first", "moderator-students:first", "head-students:first", "dashboard"]);
      if (isScopedStudentDashboardOnly) {
        await loadPrimaryScopedStudents({ force: true });
      } else {
        await loadStudentsDirectory(undefined, { force: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Inline student update failed";
      setStatus(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }

  async function importStudentsFromCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!(await ensureActiveServerSession())) return;
    const csvText = await file.text();
    const parsedRows = parseCsvRecords(csvText).filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
    if (parsedRows.length < 2) {
      setStatus("CSV must contain a header row and at least one student row.");
      return;
    }
    const headers = parsedRows[0].map((h) => String(h ?? "").trim().toLowerCase().replace(/\s+/g, "_"));
    const headerIndex = new Map<string, number>();
    headers.forEach((h, i) => headerIndex.set(h, i));
    if (!headerIndex.has("email")) {
      setStatus("CSV is missing required column: email");
      return;
    }
    const optionalHeaderGroups = [
      ["registration_number"],
      ["plan_of_study_code"],
      ["programme"],
      ["current_semester"],
      ["batch"],
      ["graduated"],
      ["mentor_email", "mentorEmail"],
    ];
    const hasAtLeastOneOptionalHeader = optionalHeaderGroups.some((group) => group.some((key) => headerIndex.has(key)));
    if (!hasAtLeastOneOptionalHeader) {
      setStatus(
        "CSV must include at least one optional student column header: registration_number, plan_of_study_code, programme, current_semester, batch, graduated, or mentor_email."
      );
      return;
    }

    const hasHeader = (key: string) => headerIndex.has(key);
    const isFacultyOnly = isScopedStudentDashboardOnly;
    if (isFacultyOnly && (hasHeader("programme") || hasHeader("mentor_email") || hasHeader("mentorEmail"))) {
      setStatus("Faculty CSV cannot include programme or mentor_email columns.");
      return;
    }
    const readCell = (row: string[], key: string) => {
      const idx = headerIndex.get(key);
      return idx == null ? "" : String(row[idx] ?? "").trim();
    };

    const payloadRows = parsedRows.slice(1).map((row) => ({
      email: readCell(row, "email").toLowerCase(),
      registration_number: readCell(row, "registration_number"),
      plan_of_study_code: readCell(row, "plan_of_study_code"),
      programme: readCell(row, "programme"),
      current_semester: readCell(row, "current_semester"),
      batch: readCell(row, "batch"),
      graduated: readCell(row, "graduated"),
      mentor_email: readCell(row, "mentor_email") || readCell(row, "mentorEmail"),
    })).filter((row) => row.email.length > 0);

    if (payloadRows.length === 0) {
      setStatus("No valid student rows found in CSV.");
      return;
    }

    const normalizedRows = payloadRows.map((row) => {
      const next: Record<string, string> = { email: row.email };
      if (hasHeader("registration_number")) next.registration_number = row.registration_number;
      if (hasHeader("plan_of_study_code")) next.plan_of_study_code = row.plan_of_study_code;
      if (hasHeader("programme")) next.programme = row.programme;
      if (hasHeader("current_semester")) next.current_semester = row.current_semester;
      if (hasHeader("batch")) next.batch = row.batch;
      if (hasHeader("graduated")) next.graduated = row.graduated;
      if (hasHeader("mentor_email") || hasHeader("mentorEmail")) next.mentor_email = row.mentor_email;
      return next;
    });

    setBusy(true);
    setStatus("Importing students from CSV...");
    try {
      const res = await callApi("/api/import/students", "POST", undefined, { rows: normalizedRows });
      if (!res.ok) {
        setStatus(`Student import failed: ${res.error ?? "Unknown error"}`);
        return;
      }
      const imported = Number(res.imported ?? 0);
      const failed = Number(res.failed ?? 0);
      const errors = Array.isArray(res.errors) ? res.errors.map((item) => String(item)) : [];
      setStatus(`Student import complete. Imported: ${imported}, Failed: ${failed}.`);
      if (failed > 0) {
        blurActiveElement();
        setStudentCsvImportResult({ imported, failed, errors });
      }
      invalidateAdminCache(["students-directory:first", "faculty-students:first", "moderator-students:first", "head-students:first", "dashboard"]);
      if (isScopedStudentDashboardOnly) {
        await loadPrimaryScopedStudents({ force: true });
      } else {
        await loadStudentsDirectory(undefined, { force: true });
        if (hasFacultyRole) {
          await loadFacultyStudents({ force: true });
        }
        if (hasModeratorRole) {
          await loadModeratorStudents({ force: true });
        }
      }
    } finally {
      setBusy(false);
    }
  }


  useEffect(() => {
    if (!principal || !isAdmin || superView !== "all-users") return;
    const timeoutId = window.setTimeout(() => {
      void loadUsers(undefined, { force: true });
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [userGlobalFilter, principal, isAdmin, superView]);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    const normalizedRoles = Array.from(
      new Set(
        newUserRoles
          .map((role) => String(role ?? "").trim().toLowerCase())
          .filter((role): role is string => role.length > 0)
      )
    );
    const payloadRoles = normalizedRoles.length > 0 ? normalizedRoles : ["guest"];
    const payload = {
      fullName: newUserFullName.trim(),
      email: newUserEmail.trim(),
      username: newUserUsername.trim(),
      password: newUserPassword,
      roles: payloadRoles
    };
    const errors: { fullName?: string; username?: string; password?: string } = {};
    if (!payload.fullName) errors.fullName = "Full name is required.";
    if (!payload.username) {
      errors.username = "Username is required.";
    } else {
      const normalizedUsername = payload.username.toLowerCase();
      const isClassicUsername = /^[a-z0-9_.-]+$/.test(normalizedUsername);
      const isEmailUsername = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedUsername);
      if (!isClassicUsername && !isEmailUsername) {
        errors.username = "Enter a valid username or email address.";
      }
    }
    if (!payload.password) {
      errors.password = "Password is required.";
    } else if (payload.password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }
    if (Object.keys(errors).length > 0) {
      setAddUserErrors(errors);
      return;
    }
    setAddUserErrors({});
    if (!(await ensureActiveServerSession())) {
      return;
    }
    setBusy(true);
    setStatus("Creating user...");
    try {
      const res = await callApi("/api/admin/users", "POST", undefined, payload);
      if (!res.ok) {
        setStatus(`Create user failed: ${res.error ?? "Unknown error"}`);
        return;
      }
      setStatus("User created.");
      setNewUserFullName("");
      setNewUserEmail("");
      setNewUserUsername("");
      setNewUserPassword("");
      setNewUserRoles(["student"]);
      setAddUserErrors({});
      setShowAddUserForm(false);
      invalidateAdminCache(["users:first", "dashboard"]);
      await loadUsers(undefined, { force: true });
    } finally {
      setBusy(false);
    }
  }


  async function createUsersFromCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!(await ensureActiveServerSession())) {
      return;
    }
    setBulkCsvFileName(file.name);
    const csvText = await file.text();
    const parsedRows = parseCsvRecords(csvText).filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
    if (parsedRows.length < 2) {
      setStatus("CSV must contain a header row and at least one user row.");
      return;
    }
    const headers = parsedRows[0].map((header) => String(header ?? "").trim().toLowerCase().replace(/\s+/g, ""));
    const headerIndex = new Map<string, number>();
    headers.forEach((header, index) => headerIndex.set(header, index));
    const requiredHeaders = ["fullname", "username", "password"];
    for (const requiredHeader of requiredHeaders) {
      if (!headerIndex.has(requiredHeader)) {
        setStatus(`CSV is missing required column: ${requiredHeader}`);
        return;
      }
    }

    let createdCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    setBusy(true);
    setStatus("Creating users from CSV...");
    try {
      for (let i = 1; i < parsedRows.length; i += 1) {
        const row = parsedRows[i];
        const fullName = String(row[headerIndex.get("fullname") ?? -1] ?? "").trim();
        const username = String(row[headerIndex.get("username") ?? -1] ?? "").trim();
        const password = String(row[headerIndex.get("password") ?? -1] ?? "");
        const email = String(row[headerIndex.get("email") ?? -1] ?? "").trim();
        const role = String(row[headerIndex.get("role") ?? -1] ?? "student").trim() || "student";
        if (!fullName || !username || !password) {
          failedCount += 1;
          errors.push(`Row ${i + 1}: missing fullName/username/password`);
          continue;
        }
        const payload = { fullName, username, password, email, role };
        const res = await callApi("/api/admin/users", "POST", undefined, payload);
        if (!res.ok) {
          failedCount += 1;
          errors.push(`Row ${i + 1}: ${res.error ?? "Unknown error"}`);
          continue;
        }
        createdCount += 1;
      }
      if (createdCount > 0) {
        invalidateAdminCache(["users:first", "dashboard"]);
        await loadUsers(undefined, { force: true });
      }
      setStatus(`CSV import complete. Created: ${createdCount}, Failed: ${failedCount}.`);
      if (errors.length > 0) {
        blurActiveElement();
        setCsvImportResult({ created: createdCount, failed: failedCount, errors });
      }
    } finally {
      setBusy(false);
    }
  }

  type EditableUserRow = Partial<Pick<UserRow, "subject" | "fullName" | "email" | "username" | "roles" | "active">>;

  async function processUserGridRowUpdate(
    newRow: EditableUserRow,
    oldRow: EditableUserRow,
    options?: { suppressReload?: boolean; suppressStatus?: boolean }
  ) {
    if (!(await ensureActiveServerSession())) {
      throw new Error("Session expired");
    }
    const subject = String(newRow.subject || oldRow.subject || "");
    const source = userRows.find((u) => u.subject === subject);
    if (!source) {
      return oldRow;
    }
    const nextFullName = String(newRow.fullName ?? "").trim();
    const currentFullName = String(source.fullName ?? source.email ?? source.subject).trim();
    const normalizeRoles = (input: unknown): string[] => {
      const roles = Array.isArray(input) ? input : [];
      const normalized = roles
        .map((role) => String(role ?? "").trim().toLowerCase())
        .filter((role): role is string => role.length > 0);
      const unique = Array.from(new Set(normalized));
      return unique.length > 0 ? unique : ["guest"];
    };
    const nextRoles = normalizeRoles(newRow.roles ?? source.roles);
    const currentRoles = normalizeRoles(source.roles);
    const nextActive = Boolean(newRow.active);
    const currentActive = Boolean(source.active);

    const nextEmail = newRow.email !== undefined ? String(newRow.email).trim().toLowerCase() : undefined;
    const currentEmail = String(source.email ?? "").trim().toLowerCase();
    const nextUsername = newRow.username !== undefined ? String(newRow.username).trim().toLowerCase() : undefined;
    const currentUsername = String(source.username ?? "").trim().toLowerCase();

    const emailChanged = nextEmail !== undefined && nextEmail !== currentEmail;
    const usernameChanged = nextUsername !== undefined && nextUsername !== currentUsername;

    if (nextFullName !== currentFullName || nextRoles.join("|") !== currentRoles.join("|") || emailChanged || usernameChanged) {
      const body: Record<string, unknown> = {
        subject,
        fullName: nextFullName,
        roles: nextRoles,
      };
      if (emailChanged) body.email = nextEmail;
      if (usernameChanged) body.username = nextUsername;
      const res = await callApi("/api/admin/users/update", "POST", undefined, body);
      if (!res.ok) {
        throw new Error(res.error ?? "User update failed");
      }
    }

    if (nextActive !== currentActive) {
      const res = await callApi("/api/admin/users/set-active", "POST", undefined, {
        subject,
        active: nextActive
      });
      if (!res.ok) {
        throw new Error(res.error ?? "User status update failed");
      }
    }

    if (!options?.suppressStatus) {
      setStatus("User updated.");
    }
    if (!options?.suppressReload) {
      invalidateAdminCache(["users:first", "dashboard", "active-users:first"]);
      await loadUsers(undefined, { force: true });
    }
    return newRow;
  }

  function resetUserPassword(row: UserRow) {
    if (row.provider !== "local") {
      setStatus("Password reset is available only for local users.");
      return;
    }
    setResetPasswordTarget(row);
    setResetPasswordValue("");
    setResetPasswordConfirm("");
    setResetPasswordError("");
  }

  async function submitPasswordReset() {
    if (!resetPasswordTarget) return;
    if (resetPasswordValue.length < 8) {
      setResetPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (resetPasswordValue !== resetPasswordConfirm) {
      setResetPasswordError("Passwords do not match.");
      return;
    }
    if (!(await ensureActiveServerSession())) return;
    setBusy(true);
    setStatus("Resetting password...");
    try {
      const res = await callApi("/api/admin/users/reset-password", "POST", undefined, {
        subject: resetPasswordTarget.subject,
        newPassword: resetPasswordValue,
      });
      if (!res.ok) {
        setResetPasswordError(res.error ?? "Unknown error");
        return;
      }
      setStatus("Password reset completed.");
      setResetPasswordTarget(null);
    } finally {
      setBusy(false);
    }
  }

  async function updateUserStatusesFromCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!(await ensureActiveServerSession())) {
      return;
    }
    setBulkStatusCsvFileName(file.name);
    const csvText = await file.text();
    const parsedRows = parseCsvRecords(csvText).filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
    if (parsedRows.length < 2) {
      setStatus("CSV must contain a header row and at least one user row.");
      return;
    }
    const headers = parsedRows[0].map((header) => String(header ?? "").trim().toLowerCase().replace(/\s+/g, ""));
    const headerIndex = new Map<string, number>();
    headers.forEach((header, index) => headerIndex.set(header, index));
    if (!headerIndex.has("username")) {
      setStatus("CSV is missing required column: username");
      return;
    }
    const statusKey = headerIndex.has("active")
      ? "active"
      : headerIndex.has("status")
        ? "status"
        : "";
    if (!statusKey) {
      setStatus("CSV must include status column: active or status");
      return;
    }

    const parseActive = (raw: string): boolean | null => {
      const value = raw.trim().toLowerCase();
      if (["1", "true", "active", "enabled", "yes"].includes(value)) return true;
      if (["0", "false", "inactive", "disabled", "no"].includes(value)) return false;
      return null;
    };

    const updates: Array<{ username: string; active: boolean }> = [];
    for (let i = 1; i < parsedRows.length; i += 1) {
      const row = parsedRows[i];
      const username = String(row[headerIndex.get("username") ?? -1] ?? "").trim().toLowerCase();
      const parsedActive = parseActive(String(row[headerIndex.get(statusKey) ?? -1] ?? ""));
      if (!username || parsedActive == null) {
        continue;
      }
      updates.push({ username, active: parsedActive });
    }
    if (updates.length === 0) {
      setStatus("No valid status rows found. Use columns: username and active/status.");
      return;
    }
    if (updates.length > 100) {
      setStatus("CSV has too many status rows. Maximum supported per upload is 100.");
      return;
    }

    setBusy(true);
    setStatus("Updating user statuses from CSV...");
    try {
      const res = await callApi("/api/admin/users/set-active-batch", "POST", undefined, { updates });
      if (!res.ok) {
        setStatus(`Status CSV update failed: ${res.error ?? "Unknown error"}`);
        return;
      }
      invalidateAdminCache(["users:first", "dashboard", "active-users:first"]);
      await loadUsers(undefined, { force: true });
      setStatus(`Status CSV update complete. Updated: ${updates.length}.`);
    } finally {
      setBusy(false);
    }
  }

  async function submitUserRows(updates: Array<{ row: UserRow; patch: Partial<{ fullName: string; email: string; username: string; roles: string[]; active: boolean }> }>) {
    if (updates.length === 0) return;
    if (!(await ensureActiveServerSession())) return;
    try {
      setBusy(true);
      for (const item of updates) {
        const nextRow: EditableUserRow = {
          subject: item.row.subject,
          fullName: item.patch.fullName ?? (item.row.fullName || item.row.email || item.row.subject),
          roles: item.patch.roles ?? (item.row.roles.length > 0 ? item.row.roles : ["guest"]),
          active: item.patch.active ?? item.row.active,
          ...(item.patch.email !== undefined ? { email: item.patch.email } : {}),
          ...(item.patch.username !== undefined ? { username: item.patch.username } : {}),
        };
        const oldRow: EditableUserRow = {
          subject: item.row.subject,
          fullName: item.row.fullName || item.row.email || item.row.subject,
          roles: item.row.roles.length > 0 ? item.row.roles : ["guest"],
          active: item.row.active,
        };
        await processUserGridRowUpdate(nextRow, oldRow, { suppressReload: true, suppressStatus: true });
      }
      invalidateAdminCache(["users:first", "dashboard", "active-users:first"]);
      await loadUsers(undefined, { force: true });
      setStatus(`Users updated (${updates.length} row${updates.length === 1 ? "" : "s"}).`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "User batch update failed");
    } finally {
      setBusy(false);
    }
  }


  useEffect(() => {
    let tabId = sessionStorage.getItem("fa_tab_id") ?? "";
    if (!tabId) {
      tabId = crypto.randomUUID();
      sessionStorage.setItem("fa_tab_id", tabId);
    }
    tabIdRef.current = tabId;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "fa_last_login_tab") {
        return;
      }
      if (!event.newValue || event.newValue === tabIdRef.current) {
        return;
      }
      setSessionTakenOver(true);
      sessionCheckRef.current = { checkedAt: Date.now(), ok: false };
      bindAdminCacheToSession(null);
      clearSessionDataCaches();
      setPrincipal(null);
      setMyAccount(null);
      setOtherSessionsCount(0);
      setOpenGroups({});
      setMenuAnchors({});
      setStatus("Session moved to another tab. Please sign in again.");
      sessionStorage.removeItem(TAB_SESSION_MARKER_KEY);
      clearSessionDataCaches();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const onPageShow = () => {
      void revalidateSessionStrict();
    };
    const onPopState = () => {
      void revalidateSessionStrict();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void revalidateSessionStrict();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sessionTakenOver]);

  useEffect(() => {
    if (!principal) {
      inactivityWarnedRef.current = false;
      inactivityLogoutInFlightRef.current = false;
      return;
    }

    const touchActivity = () => {
      lastActivityAtRef.current = Date.now();
      inactivityWarnedRef.current = false;
    };

    const onActivity = () => {
      if (sessionStorage.getItem(TAB_SESSION_MARKER_KEY) !== "1") return;
      if (sessionTakenOver) return;
      touchActivity();
    };

    const activityEvents: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }

    touchActivity();
    const timerId = window.setInterval(() => {
      if (!principal) return;
      if (sessionStorage.getItem(TAB_SESSION_MARKER_KEY) !== "1") return;
      if (sessionTakenOver) return;

      const now = Date.now();
      const idleMs = now - lastActivityAtRef.current;
      const warnAtMs = INACTIVITY_LOGOUT_MS - INACTIVITY_WARN_BEFORE_MS;

      if (!inactivityWarnedRef.current && idleMs >= warnAtMs && idleMs < INACTIVITY_LOGOUT_MS) {
        inactivityWarnedRef.current = true;
        const idleMinutes = Math.max(0, Math.floor(warnAtMs / 60_000));
        const graceMinutes = Math.max(1, Math.floor(INACTIVITY_WARN_BEFORE_MS / 60_000));
        const keepSession = window.confirm(`You have been inactive for ${idleMinutes} minute${idleMinutes === 1 ? "" : "s"}. You will be signed out in ${graceMinutes} minute${graceMinutes === 1 ? "" : "s"} due to inactivity.\n\nPress OK to stay signed in.`);
        if (keepSession) {
          touchActivity();
          void revalidateSessionStrict();
        }
      }

      if (idleMs >= INACTIVITY_LOGOUT_MS && !inactivityLogoutInFlightRef.current) {
        inactivityLogoutInFlightRef.current = true;
        void logout("Logged out due to 15 minutes of inactivity.");
      }
    }, 1000);

    return () => {
      window.clearInterval(timerId);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, onActivity);
      }
    };
  }, [principal, sessionTakenOver]);

  useEffect(() => {
    void (async () => {
      setBusy(true);
      try {
        await loadWizardStatus();
        if (sessionStorage.getItem(TAB_SESSION_MARKER_KEY) === "1") {
          await loadSessionPrincipal();
          await loadMyAccount();
          await loadOtherSessionsCount();
          await loadMySessions();
        } else {
          setStatus("Please sign in.");
        }
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      setSuperView("dashboard");
      return;
    }
    if (!isSuperAdmin) {
      setOpenGroups({});
      setMenuAnchors({});
      setSuperView("dashboard");
      setDashboard(null);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (accountView === "password" && !canChangeOwnPassword) {
      setAccountView("profile");
    }
  }, [accountView, canChangeOwnPassword]);

  useEffect(() => {
    if (!principal || superView !== "dashboard" || !(isAdmin || hasHeadRole)) {
      return;
    }
    void loadDashboard();
  }, [principal, superView, isAdmin, hasHeadRole]);

  useEffect(() => {
    if (!principal || superView !== "dashboard" || !hasScopedStudentDashboardRole) return;
    const first = hasHeadRole ? "head" : hasModeratorRole ? "moderator" : "faculty";
    setExpandedDashboardSections(new Set([first]));
    setLoadedDashboardSections(new Set([first]));
    const loadFn = first === "head" ? loadHeadStudents : first === "moderator" ? loadModeratorStudents : loadFacultyStudents;
    void loadFn();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [principal, superView, hasScopedStudentDashboardRole, hasFacultyRole, hasModeratorRole, hasHeadRole]);

  useEffect(() => {
    if (!principal || superView !== "dashboard" || !isStudentOnlySession) return;
    void (async () => {
      await loadStudentSelfPlanOfStudy();
      await loadProgrammes();
      await loadRegulations();
      await loadPlansOfStudy();
    })();
  }, [principal, superView, isStudentOnlySession]);

  useEffect(() => {
    if (!isStudentOnlySession || studentSelfDirectoryRows.length === 0) return;
    const userId = studentSelfDirectoryRows[0].userId;
    if (!userId || studentEarnedCreditsByUser[userId] !== undefined) return;
    void loadStudentCredits(userId);
  }, [isStudentOnlySession, studentSelfDirectoryRows, studentEarnedCreditsByUser]);

  useEffect(() => {
    if (!principal || superView !== "regulations") {
      return;
    }
    void loadRegulations();
    void loadPlansOfStudy();
    if (isStudentOnlySession) {
      void loadStudentSelfPlanOfStudy();
    }
  }, [principal, superView, isStudentOnlySession]);

  useEffect(() => {
    if (!principal) {
      setStudentSelfPlanOfStudyCode(null);
      setStudentSelfDirectoryRows([]);
    }
  }, [principal]);

  useEffect(() => {
    if (!principal || superView !== "students-directory") {
      return;
    }
    if (isStudentOnlySession) {
      void loadStudentSelfPlanOfStudy();
    }
    if (programmeOptions.length > 0) {
      if (plansOfStudy.length > 0 && regulations.length > 0) {
        return;
      }
      if (regulations.length === 0) {
        void loadRegulations();
      }
      void loadPlansOfStudy();
      return;
    }
    void (async () => {
      await loadProgrammes();
      await loadRegulations();
      await loadPlansOfStudy();
    })();
  }, [principal, superView, programmeOptions.length, plansOfStudy.length, regulations.length, isStudentOnlySession]);

  useEffect(() => {
    if (!principal || superView !== "students-directory" || !hasScopedStudentDashboardRole) {
      return;
    }
    void loadFacultyMentoredMinimalFromSession();
    if (hasFacultyRole) {
      void loadFacultyStudents();
    }
    if (hasModeratorRole) {
      void loadModeratorStudents();
    }
    if (hasHeadRole) {
      void loadHeadStudents();
    }
  }, [principal, superView, hasScopedStudentDashboardRole, hasFacultyRole, hasModeratorRole, hasHeadRole]);

  const facultyGraduatedCount = useMemo(
    () => facultyStudentRows.filter((student) => student.studentActive && student.graduated === "Yes").length,
    [facultyStudentRows]
  );
  const facultyNotGraduatedCount = useMemo(
    () => facultyStudentRows.filter((student) => student.studentActive && student.graduated !== "Yes").length,
    [facultyStudentRows]
  );
  const facultyMetricCardCount = useMemo(
    () => [facultyNotGraduatedCount, facultyGraduatedCount].filter((value) => value !== 0).length,
    [facultyNotGraduatedCount, facultyGraduatedCount],
  );
  const moderatorGraduatedCount = useMemo(
    () => moderatorStudentRows.filter((student) => student.studentActive && student.graduated === "Yes").length,
    [moderatorStudentRows]
  );
  const moderatorNotGraduatedCount = useMemo(
    () => moderatorStudentRows.filter((student) => student.studentActive && student.graduated !== "Yes").length,
    [moderatorStudentRows]
  );
  const moderatorMetricCardCount = useMemo(
    () => [moderatorNotGraduatedCount, moderatorGraduatedCount].filter((value) => value !== 0).length,
    [moderatorNotGraduatedCount, moderatorGraduatedCount],
  );
  const headGraduatedCount = useMemo(
    () => headStudentRows.filter((student) => student.studentActive && student.graduated === "Yes").length,
    [headStudentRows]
  );
  const headNotGraduatedCount = useMemo(
    () => headStudentRows.filter((student) => student.studentActive && student.graduated !== "Yes").length,
    [headStudentRows]
  );
  const headMetricCardCount = useMemo(
    () => [headNotGraduatedCount, headGraduatedCount].filter((value) => value !== 0).length,
    [headNotGraduatedCount, headGraduatedCount],
  );
  const headBatchCount = useMemo(
    () => new Set(headStudentRows.map((s) => s.batch).filter(Boolean)).size,
    [headStudentRows],
  );
  const moderatorBatchCount = useMemo(
    () => new Set(moderatorStudentRows.map((s) => s.batch).filter(Boolean)).size,
    [moderatorStudentRows],
  );

  const scopedDashboardRoleContext = useMemo<"faculty" | "moderator" | null>(() => {
    if (hasFacultyRole) return "faculty";
    if (hasModeratorRole) return "moderator";
    return null;
  }, [hasFacultyRole, hasModeratorRole]);
  const scopedDashboardStudentRows = useMemo(
    () => (scopedDashboardRoleContext === "moderator" ? moderatorStudentRows : facultyStudentRows),
    [scopedDashboardRoleContext, moderatorStudentRows, facultyStudentRows],
  );
  const scopedDashboardCreditRows = useMemo(
    () => (scopedDashboardRoleContext === "moderator" ? moderatorCreditTableRows : facultyCreditTableRows),
    [scopedDashboardRoleContext, moderatorCreditTableRows, facultyCreditTableRows],
  );
  const facultyStudentsDirectoryRows = useMemo<StudentDirectoryRow[]>(
    () => {
      return scopedDashboardStudentRows
        .filter((student) => student.studentActive)
        .map((student) => ({
          userId: student.userId,
          fullName: student.fullName?.trim() || "Unnamed Student",
          email: student.email?.trim() || "",
          registrationNumber: student.registrationNumber?.trim() || "Not Allotted",
          planOfStudyCode: student.planOfStudyCode,
          currentSemester: student.currentSemester ?? 1,
          batch: student.batch,
          programme: student.programme,
          graduated: student.graduated,
          mentorName: scopedDashboardRoleContext === "moderator" ? "Assigned Mentor" : (principal?.fullName?.trim() || "Assigned Faculty"),
          modifiedByName: "",
          modifiedAt: null,
        }));
    },
    [scopedDashboardStudentRows, scopedDashboardRoleContext, principal?.fullName]
  );
  const studentsDirectorySourceRows = useMemo<StudentDirectoryRow[]>(
    () => (isStudentOnlySession
      ? studentSelfDirectoryRows
      : (isScopedStudentDashboardOnly ? facultyStudentsDirectoryRows : studentDirectoryRows)),
    [isStudentOnlySession, studentSelfDirectoryRows, isScopedStudentDashboardOnly, facultyStudentsDirectoryRows, studentDirectoryRows],
  );
  useEffect(() => {
    if (!selectedStudentForCredits?.userId) return;
    const sourceRows = studentsDirectorySourceRows;
    const updated = sourceRows.find((row) => row.userId === selectedStudentForCredits.userId);
    if (updated) setSelectedStudentForCredits(updated);
  }, [studentsDirectorySourceRows, selectedStudentForCredits]);

  // Updated by StudentsDirectoryTable whenever the user sorts/filters — persists after the table unmounts
  const [creditNavRows, setCreditNavRows] = useState<StudentDirectoryRow[]>([]);
  const creditNavFallback = useMemo(() => studentsDirectorySourceRows, [studentsDirectorySourceRows]);
  // Use the table's sorted+filtered list when available; fall back to raw source on first load
  const effectiveCreditNavRows = creditNavRows.length > 0 ? creditNavRows : creditNavFallback;

  const creditSummaries = useMemo(() => {
    const result: Record<string, import("./types").StudentCreditSummary> = {};
    const seenIds = new Set<string>();
    const planByCode = new Map(plansOfStudy.map((plan) => [plan.planCode, plan]));
    const regulationByCode = new Map(regulations.map((regulation) => [regulation.code, regulation]));
    for (const student of studentsDirectorySourceRows) {
      if (!student.userId || seenIds.has(student.userId)) continue;
      seenIds.add(student.userId);
      if (!student.planOfStudyCode) continue;
      // Only compute once bulk totals have been fetched (so 0 means "really 0", not "not loaded")
      const hasDetailedCredits = student.userId in studentSavedCreditsByUser;
      const hasDetailedUnits = student.userId in studentSavedUnitsByUser;
      if (!hasDetailedCredits && !hasDetailedUnits && !creditTotalsLoaded) continue;
      const plan = planByCode.get(student.planOfStudyCode);
      if (!plan) continue;
      const regulation = regulationByCode.get(plan.regulationCode);
      const measureByCategory = new Map(
        (regulation?.curriculumStructure.categories ?? []).map((category) => [category.code, category.measure ?? "credits"]),
      );
      const targetCredits = Number(regulation?.curriculumStructure.totalCreditsRequired ?? plan.totalCredits ?? 0);
      const targetUnits = Number(regulation?.curriculumStructure.totalUnitsRequired ?? plan.totalUnits ?? 0);
      const target = targetCredits + targetUnits;
      if (target === 0) continue;
      const detailedCreditBuckets = studentSavedCreditsByUser[student.userId] ?? {};
      let earnedCredits = 0;
      let earnedUnits = 0;
      const earnedUnitCategoriesFromCredits = new Set<string>();
      const categoryEarned: Record<string, number> = {};
      if (hasDetailedCredits) {
        for (const semData of Object.values(detailedCreditBuckets)) {
          for (const [categoryCode, value] of Object.entries(semData)) {
            const num = Number(value ?? 0);
            categoryEarned[categoryCode] = (categoryEarned[categoryCode] ?? 0) + num;
            if ((measureByCategory.get(categoryCode) ?? "credits") === "units") {
              earnedUnits += num;
              earnedUnitCategoriesFromCredits.add(categoryCode);
            } else {
              earnedCredits += num;
            }
          }
        }
      } else {
        earnedCredits = Number(studentCreditTotals[student.userId] ?? 0);
      }
      if (hasDetailedUnits) {
        for (const [categoryCode, value] of Object.entries(studentSavedUnitsByUser[student.userId] ?? {})) {
          // Avoid double counting when the same unit category is already present in credit detail rows.
          if (earnedUnitCategoriesFromCredits.has(categoryCode)) continue;
          const num = Number(value ?? 0);
          categoryEarned[categoryCode] = (categoryEarned[categoryCode] ?? 0) + num;
          earnedUnits += num;
        }
      } else {
        earnedUnits += Number(studentUnitTotals[student.userId] ?? 0);
      }
      const earned = earnedCredits + earnedUnits;
      const currentSem = student.currentSemester ?? 1;
      let expectedCredits = 0;
      let expectedUnits = 0;
      const categoryRequired: Record<string, number> = {};
      const categoryExpected: Record<string, number> = {};
      for (const semester of plan.semesters) {
        for (const [categoryCode, value] of Object.entries(semester.categories ?? {})) {
          const numeric = Number(value ?? 0);
          if (numeric <= 0) continue;
          categoryRequired[categoryCode] = (categoryRequired[categoryCode] ?? 0) + numeric;
          if (semester.semester >= currentSem) continue;
          categoryExpected[categoryCode] = (categoryExpected[categoryCode] ?? 0) + numeric;
          if ((measureByCategory.get(categoryCode) ?? "credits") === "units") {
            expectedUnits += numeric;
          } else {
            expectedCredits += numeric;
          }
        }
      }
      const expected = expectedCredits + expectedUnits;

      // Effective per-category earned: detailed saves take priority; fall back to the
      // per-category totals returned by the summary API when detailed saves are absent.
      const summaryCat = studentSummaryCatEarned[student.userId];
      const effectiveCategoryEarned: Record<string, number> = summaryCat ? { ...summaryCat } : {};
      for (const [code, val] of Object.entries(categoryEarned)) effectiveCategoryEarned[code] = val;
      const hasCategoryData = hasDetailedCredits || hasDetailedUnits || summaryCat !== undefined;

      // Deficit columns: cumulative sum of per-category shortfalls so that a student who has
      // earned enough total credits but missed specific category requirements shows a non-zero
      // deficit. Falls back to target-vs-earned when only bulk totals are available.
      let deficitCredits: number;
      let deficitUnits: number;
      if (hasCategoryData) {
        deficitCredits = 0;
        deficitUnits = 0;
        for (const [code, req] of Object.entries(categoryRequired)) {
          if (req <= 0) continue;
          const shortage = Math.max(0, req - (effectiveCategoryEarned[code] ?? 0));
          if ((measureByCategory.get(code) ?? "credits") === "units") {
            deficitUnits += shortage;
          } else {
            deficitCredits += shortage;
          }
        }
      } else {
        deficitCredits = Math.max(0, targetCredits - earnedCredits);
        deficitUnits = Math.max(0, targetUnits - earnedUnits);
      }
      const deficit = deficitCredits + deficitUnits;
      // Category-level breakdown for the Complete check — available whenever we have
      // per-category data from either detailed saves or the summary API.
      const allCategoryStatuses = hasCategoryData
        ? Object.keys(categoryRequired)
            .filter((code) => categoryRequired[code] > 0)
            .map((code) => ({
              earned: effectiveCategoryEarned[code] ?? 0,
              required: categoryRequired[code],
              expected: categoryExpected[code] ?? 0,
            }))
        : undefined;
      const status = computeCreditStatus(target, earned, expected, allCategoryStatuses);
      result[student.userId] = {
        target,
        earned,
        expected,
        deficit,
        deficitCredits: normalizeCredits(deficitCredits),
        deficitUnits: normalizeCredits(deficitUnits),
        targetCredits: normalizeCredits(targetCredits),
        targetUnits: normalizeCredits(targetUnits),
        earnedCredits: normalizeCredits(earnedCredits),
        earnedUnits: normalizeCredits(earnedUnits),
        status,
      };
    }
    return result;
  }, [studentSavedCreditsByUser, studentSavedUnitsByUser, studentCreditTotals, studentUnitTotals, studentSummaryCatEarned, creditTotalsLoaded, studentsDirectorySourceRows, plansOfStudy, regulations]);
  const selectedStudentIndex = selectedStudentForCredits
    ? effectiveCreditNavRows.findIndex((r) => r.userId === selectedStudentForCredits.userId)
    : -1;

  useEffect(() => {
    if (filteredPlansOfStudy.length === 0) {
      if (planOfStudyTab !== 0) setPlanOfStudyTab(0);
      return;
    }
    if (planOfStudyTab > filteredPlansOfStudy.length - 1) {
      setPlanOfStudyTab(0);
    }
  }, [filteredPlansOfStudy.length, planOfStudyTab]);

  // Load credit totals for all visible students whenever the directory list changes
  useEffect(() => {
    if (!principal) return;
    const sourceRows = studentsDirectorySourceRows;
    const userIds = sourceRows.map((r) => r.userId).filter((id) => id.length > 0);
    if (userIds.length > 0) void loadStudentCreditSummaries(userIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [principal, studentsDirectorySourceRows.map((row) => row.userId).join("|")]);

  async function runStep(path: string, label: string, body?: unknown) {
    if (principal) {
      if (!(await ensureActiveServerSession())) {
        return false;
      }
    }
    if (setupLocked && !isSuperAdmin) {
      setStatus("Setup is locked. Login as super admin.");
      return false;
    }
    setBusy(true);
    setStatus(`${label}...`);
    try {
      const res = await callApi(path, "POST", undefined, body);
      setStatus(res.ok ? `${label} complete` : `${label} failed: ${res.error ?? "Unknown error"}`);
      if (res.ok) {
        invalidateAdminCache();
      }
      await loadWizardStatus();
      return res.ok;
    } catch (error) {
      setStatus(`${label} failed: ${error instanceof Error ? error.message : "Network or server error"}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function runMigrationsInBatches() {
    if (principal) {
      if (!(await ensureActiveServerSession())) {
        return false;
      }
    }
    if (setupLocked && !isSuperAdmin) {
      setStatus("Setup is locked. Login as super admin.");
      return false;
    }
    setBusy(true);
    setStatus("Database setup...");
    try {
      let totalApplied = 0;
      for (let batch = 1; batch <= 50; batch += 1) {
        const res = await callApi("/api/setup/run-migrations", "POST");
        if (!res.ok) {
          setStatus(`Database setup failed: ${res.error ?? "Unknown error"}`);
          return false;
        }
        const appliedNow = Math.max(0, Number(res.appliedNow ?? 0));
        totalApplied += appliedNow;
        const pendingCount = Array.isArray(res.pendingMigrations) ? res.pendingMigrations.length : 0;
        if (!res.hasMore || pendingCount === 0) {
          setStatus(`Database setup complete (${totalApplied} migration batch${totalApplied === 1 ? "" : "es"} processed).`);
          await loadWizardStatus();
          return true;
        }
        setStatus(`Database setup in progress... ${pendingCount} migration${pendingCount === 1 ? "" : "s"} remaining.`);
      }
      setStatus("Database setup paused after 50 batches. Click Run Migrations again.");
      await loadWizardStatus();
      return false;
    } catch (error) {
      setStatus(`Database setup failed: ${error instanceof Error ? error.message : "Network or server error"}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onCreateSuperAdmin(e: FormEvent) {
    e.preventDefault();
    if (!bootstrapKey.trim() || !adminUser.trim() || !adminPass) {
      setStatus("Enter bootstrap key, username, and password");
      return;
    }
    const ok = await runStep("/api/setup/create-super-admin", "Creating super admin", {
      bootstrapKey: bootstrapKey.trim(),
      username: adminUser.trim(),
      password: adminPass
    });
    if (ok) {
      setStatus("Super admin created. You can now log in.");
      setBootstrapKey("");
      setAdminPass("");
    }
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    if (!loginUser.trim() || !loginPass) {
      setStatus("Enter username and password");
      return;
    }
    setBusy(true);
    setStatus("Signing in...");
    try {
      const res = await callApi("/api/auth/login", "POST", undefined, {
        username: loginUser.trim(),
        password: loginPass
      });
      if (!res.ok) {
        setStatus(`Login failed: ${res.error ?? "Unknown error"}`);
        return;
      }
      await finalizeSuccessfulLogin();
    } finally {
      setBusy(false);
    }
  }

  async function finalizeSuccessfulLogin() {
    sessionStorage.setItem(TAB_SESSION_MARKER_KEY, "1");
    localStorage.setItem("fa_last_login_tab", tabIdRef.current || crypto.randomUUID());
    setSessionTakenOver(false);
    setOpenGroups({});
    setMenuAnchors({});
    setPrevSuperView(null);
    setSuperView("dashboard");
    lastActivityAtRef.current = Date.now();
    inactivityWarnedRef.current = false;
    inactivityLogoutInFlightRef.current = false;
    await loadSessionPrincipal();
    await loadMyAccount();
    await loadOtherSessionsCount();
    await loadMySessions();
    await loadRegulations();
    await loadPlansOfStudy();
  }

  async function onGoogleCredential(response: GoogleCredentialResponse) {
    const idToken = String(response?.credential ?? "");
    if (!idToken) {
      setStatus("Google sign-in failed: missing credential.");
      return;
    }
    setBusy(true);
    setStatus("Signing in with Google...");
    try {
      const res = await callApi("/api/auth/google", "POST", undefined, { idToken });
      if (!res.ok) {
        setStatus(`Google login failed: ${res.error ?? "Unknown error"}`);
        return;
      }
      await finalizeSuccessfulLogin();
    } finally {
      setBusy(false);
    }
  }

  async function logout(reason?: string) {
    await callApi("/api/auth/logout", "POST");
    sessionCheckRef.current = { checkedAt: Date.now(), ok: false };
    setSessionTakenOver(false);
    inactivityWarnedRef.current = false;
    inactivityLogoutInFlightRef.current = false;
    sessionStorage.removeItem(TAB_SESSION_MARKER_KEY);
    clearSessionDataCaches();
    invalidateAdminCache();
    bindAdminCacheToSession(null);
    setPrincipal(null);
    setMyAccount(null);
    setMySessions([]);
    setOtherSessionsCount(0);
    setOpenGroups({});
    setMenuAnchors({});
    setPrevSuperView(null);
    setSuperView("dashboard");
    setStatus(reason ?? "Logged out");
  }

  async function saveMyAccountName() {
    const current = String(myAccount?.fullName ?? "").trim();
    const next = String(fullNameInput ?? "").trim();
    if (current === next) {
      setEditingMyName(false);
      return;
    }
    const res = await callApi("/api/auth/my-account", "POST", undefined, { fullName: fullNameInput });
    if (!res.ok) {
      setStatus(`Profile update failed: ${res.error ?? "Unknown error"}`);
      return;
    }
    setMyAccount((prev) => (prev ? { ...prev, fullName: next } : prev));
    setPrincipal((prev) => (prev ? { ...prev, fullName: next } : prev));
    setStatus("Profile updated");
    setEditingMyName(false);
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const res = await callApi("/api/auth/change-password", "POST", undefined, {
      currentPassword,
      newPassword
    });
    if (!res.ok) {
      setStatus(`Password change failed: ${res.error ?? "Unknown error"}`);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setStatus("Password updated");
  }

  async function logoutOtherSessions() {
    if (!(await ensureActiveServerSession())) {
      return;
    }
    setBusy(true);
    try {
      const res = await callApi("/api/auth/logout-other-sessions", "POST");
      if (!res.ok) {
        setStatus(`Failed to logout other sessions: ${res.error ?? "Unknown error"}`);
        return;
      }
      setStatus(`Logged out ${res.revokedSessions ?? 0} other active session(s).`);
      invalidateAdminCache(["active-users:first", "dashboard"]);
      await loadOtherSessionsCount();
      await loadMySessions();
    } finally {
      setBusy(false);    }
  }

  async function runSuperAdminMitigations() {
    if (!(await ensureActiveServerSession())) {
      return;
    }
    setBusy(true);
    setStatus("Running super admin mitigations...");
    try {
      const res = await callApi("/api/setup/run-mitigations", "POST");
      if (!res.ok) {
        setStatus(`Mitigations failed: ${res.error ?? "Unknown error"}`);
        return;
      }
      await loadWizardStatus();
      await loadSessionPrincipal();
      invalidateAdminCache();
      await loadDashboard({ force: true });
      setStatus(
        `Mitigations complete. Migrations applied: ${res.migrations?.appliedMigrations ?? 0}, users backfilled: ${res.fullNameBackfilledUsers ?? 0}`
      );
    } finally {
      setBusy(false);
      setOpenGroups({});
    }
  }

  async function logoutUserAllSessionsByIdentifier(rawIdentifier: string) {
    if (!(await ensureActiveServerSession())) {
      return;
    }
    const identifier = rawIdentifier.trim();
    if (!identifier) {
      setStatus("Enter username, email, or subject.");
      return;
    }
    setBusy(true);
    setStatus("Revoking active sessions...");
    try {
      const res = await callApi("/api/admin/users/logout-all-sessions", "POST", undefined, { identifier });
      if (!res.ok) {
        setStatus(`Session revoke failed: ${res.error ?? "Unknown error"}`);
        return;
      }
      if (res.revokedOwnSession) {
        bindAdminCacheToSession(null);
        setPrincipal(null);
        setMyAccount(null);
        setOtherSessionsCount(0);
        setOpenGroups({});
        setMenuAnchors({});
        setStatus("Your active sessions were revoked. You have been signed out.");
        return;
      }
      setStatus(`Revoked ${res.revokedSessions ?? 0} active session(s) for ${res.identifier ?? identifier}.`);
      invalidateAdminCache(["active-users:first", "dashboard"]);
    } finally {
      setBusy(false);
      setOpenGroups({});
    }
  }

  const navSections: NavSection[] = [
    ...(principal ? [{
      label: "Overview",
      items: [{
        id: "dashboard",
        label: "Dashboard",
        icon: <DashboardIcon fontSize="small" />,
        active: superView === "dashboard",
        onClick: () => {
          void (async () => {
            if (await ensureActiveServerSession()) {
              navigateTo("dashboard");
              if (isAdmin) {
                await loadDashboard();
              }
            }
          })();
        },
      }],
    }] : []),
    ...((principal && (hasFacultyRole || hasHeadRole || hasModeratorRole || isAdmin)) ? [{
      label: "Academics",
      items: [
        {
          id: "academic",
          label: "Academic",
          icon: <SchoolIcon fontSize="small" />,
          children: [
            {
              id: "regulations",
              label: "Regulations",
              icon: <MenuBookIcon fontSize="small" />,
              active: superView === "regulations",
              onClick: () => {
                void (async () => {
                  if (await ensureActiveServerSession()) {
                    navigateTo("regulations");
                    await loadRegulations();
                    await loadPlansOfStudy();
                  }
                })();
              },
            },
            ...((isAdmin || hasHeadRole || hasModeratorRole || hasFacultyRole) ? [{
              id: "students-directory",
              label: "Students",
              icon: <GroupIcon fontSize="small" />,
              active: superView === "students-directory",
              onClick: () => {
                void (async () => {
                  if (await ensureActiveServerSession()) {
                    setStudentsDirectoryGraduatedFilter(null);
                    setStudentsDirectoryCreditStatusFilter(null);
                    setStudentsDirectoryBatchFilter(null);
                    navigateTo("students-directory");
                    await loadProgrammes({ force: true });
                    await loadPlansOfStudy();
                    if (isStudentOnlySession) {
                      await loadStudentSelfPlanOfStudy({ force: true });
                    } else if (isScopedStudentDashboardOnly) {
                      await loadPrimaryScopedStudents();
                    } else {
                      await loadStudentsDirectory();
                    }
                  }
                })();
              },
            }] : []),
            ...((isScopedStudentDashboardOnly) ? [{
              id: "faculty-credit-table",
              label: "Student Credit Table",
              icon: <ReceiptLongIcon fontSize="small" />,
              active: superView === "faculty-credit-table",
              onClick: () => {
                void (async () => {
                  if (await ensureActiveServerSession()) {
                    navigateTo("faculty-credit-table");
                    await loadPrimaryScopedCreditTable();
                  }
                })();
              },
            }] : []),
          ],
        },
      ],
    }] : []),
    ...(isAdmin ? [{
      label: "Administration",
      items: [
        {
          id: "system",
          label: "System",
          icon: <SettingsIcon fontSize="small" />,
          children: [
            {
              id: "logs",
              label: "View System Logs",
              icon: <ReceiptLongIcon fontSize="small" />,
              active: superView === "logs",
              onClick: () => {
                void (async () => {
                  if (await ensureActiveServerSession()) {
                    navigateTo("logs");
                    setLogLevel("error");
                    await loadLogs("error");
                  }
                })();
              },
            },
            {
              id: "activity-logs",
              label: "View Activity Logs",
              icon: <HistoryIcon fontSize="small" />,
              active: superView === "activity-logs",
              onClick: () => {
                void (async () => {
                  if (await ensureActiveServerSession()) {
                    navigateTo("activity-logs");
                    await loadActivityLogs();
                  }
                })();
              },
            },
            ...(isSuperAdmin && dashboard?.mitigations?.needsMitigations ? [{
              id: "mitigations",
              label: "Run Recent Mitigations",
              icon: <BuildIcon fontSize="small" />,
              active: false as const,
              disabled: busy,
              onClick: () => {
                void (async () => {
                  if (await ensureActiveServerSession()) {
                    await runSuperAdminMitigations();
                  }
                })();
              },
            }] : []),
            ...(isSuperAdmin ? [{
              id: "seed-data",
              label: "Seed Data (Dve)",
              icon: <StorageIcon fontSize="small" />,
              active: false as const,
              disabled: busy,
              onClick: () => {
                if (!window.confirm("Seed data into the database? This cannot be undone.")) return;
                void runStep("/api/setup/seed-data", "Seed data");
              },
            }] : []),
            ...(isSuperAdmin ? [{
              id: "clear-logs",
              label: "Clear Logs",
              icon: <DeleteSweepIcon fontSize="small" />,
              active: false as const,
              disabled: busy,
              onClick: () => { void clearLogs(); },
            }] : []),
          ],
        },
        {
          id: "user-management",
          label: "User Management",
          icon: <GroupIcon fontSize="small" />,
          children: [
          {
            id: "all-users",
            label: "Manage Users",
            icon: <GroupIcon fontSize="small" />,
            active: superView === "all-users",
            onClick: () => {
              void (async () => {
                if (await ensureActiveServerSession()) {
                  navigateTo("all-users");
                  await loadUsers();
                }
              })();
            },
          },
          {
            id: "login-activity",
            label: "Login Activity",
            icon: <LockPersonIcon fontSize="small" />,
            active: superView === "login-activity",
            onClick: () => {
              void (async () => {
                if (await ensureActiveServerSession()) {
                  navigateTo("login-activity");
                  await loadLoginActivity();
                }
              })();
            },
          },
          {
            id: "active-users",
            label: "Active Users",
            icon: <PersonIcon fontSize="small" />,
            active: superView === "active-users",
            onClick: () => {
              void (async () => {
                if (await ensureActiveServerSession()) {
                  navigateTo("active-users");
                  await loadActiveUsers();
                }
              })();
            },
          },
          ],
        },
      ],
    }] : []),
  ];

  const adminPageSx = {
    pageCard: { boxShadow: "none", border: "none", backgroundImage: "none" },
    pageStack: { spacing: 3 },
    headerPanel: {
      p: { xs: 2, sm: 2.5 },
      borderRadius: 2,
      border: "1px solid",
      borderColor: "divider",
      bgcolor: "action.hover",
    },
    sectionPanel: { p: 2, borderRadius: 2 },
  } as const;

  const renderSidebarNav = () => (
    <List
      sx={{
        width: ADMIN_DRAWER_WIDTH,
        px: 1.25,
        pb: 1.5,
        "& .MuiListItemButton-root": {
          borderRadius: "6px",
          px: 1.5,
          py: 0.875,
          mb: 0.25,
        },
        "& .MuiListItemButton-root.Mui-selected": {
          bgcolor: "action.selected",
          "&:hover": { bgcolor: "action.selected" },
        },
        "& .MuiListItemIcon-root": {
          minWidth: 34,
          color: "text.secondary",
        },
      }}
    >
      {navSections.map((section, sIdx) => (
        <Fragment key={section.label}>
          <Typography
            variant="overline"
            sx={{
              px: 1.5,
              pt: sIdx === 0 ? 1 : 1.5,
              pb: 0.5,
              display: "block",
              fontSize: "0.6rem",
              fontWeight: 700,
              letterSpacing: 1.2,
              color: "text.disabled",
            }}
          >
            {section.label}
          </Typography>
          {section.items.map((item) =>
            "children" in item ? (
              <Fragment key={item.id}>
                <ListItemButton
                  selected={item.children.some((c) => c.active)}
                  onClick={() =>
                    setOpenGroups((prev) => ({
                      ...prev,
                      [item.id]: !(prev[item.id] ?? item.children.some((c) => c.active)),
                    }))
                  }
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: "0.875rem" } } }} />
                  <ChevronRightIcon
                    fontSize="small"
                    sx={{
                      color: "text.disabled",
                      transform:
                        (openGroups[item.id] ?? item.children.some((c) => c.active))
                          ? "rotate(90deg)"
                          : "none",
                      transition: "transform 0.2s",
                    }}
                  />
                </ListItemButton>
                <Collapse
                  in={openGroups[item.id] ?? item.children.some((c) => c.active)}
                  timeout="auto"
                  unmountOnExit
                >
                  <List
                    component="div"
                    disablePadding
                    sx={{
                      ml: 2.5,
                      mr: 0.5,
                      borderLeft: "2px solid",
                      borderColor: "divider",
                    }}
                  >
                    {item.children.map((child) => (
                      <ListItemButton
                        key={child.id}
                        sx={{ pl: 2 }}
                        selected={child.active}
                        disabled={child.disabled}
                        onClick={child.onClick}
                      >
                        <ListItemIcon>{child.icon}</ListItemIcon>
                        <ListItemText
                          primary={child.label}
                          slotProps={{ primary: { sx: { fontSize: "0.8rem" } } }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </Fragment>
            ) : (
              <ListItemButton
                key={item.id}
                selected={(item as NavLeaf).active}
                disabled={(item as NavLeaf).disabled}
                onClick={(item as NavLeaf).onClick}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: "0.875rem" } } }} />
              </ListItemButton>
            )
          )}
        </Fragment>
      ))}
    </List>
  );


  const topBarNav = (
    <Stack sx={{ flexDirection: "row", gap: 0.5, display: { xs: "none", lg: "flex" } }}>
      {navSections.flatMap((section) =>
        section.items.map((item) => {
          if ("children" in item) {
            const isActive = item.children.some((c) => c.active);
            const anchorEl = menuAnchors[item.id] ?? null;
            return (
              <Fragment key={item.id}>
                <Button
                  color="inherit"
                  size="small"
                  endIcon={
                    <ChevronRightIcon
                      fontSize="small"
                      sx={{
                        transform: Boolean(anchorEl) || isActive ? "rotate(270deg)" : "rotate(90deg)",
                        transition: "transform 0.2s",
                      }}
                    />
                  }
                  sx={{
                    textTransform: "none",
                    fontSize: "0.875rem",
                    color: isActive ? shellColors.textPrimary : shellColors.textSecondary,
                    fontWeight: isActive ? 600 : 400,
                    bgcolor: isActive ? "action.selected" : "transparent",
                    "&:hover": { bgcolor: isActive ? "action.selected" : undefined },
                  }}
                  onClick={(e) =>
                    setMenuAnchors((prev) => ({ ...prev, [item.id]: e.currentTarget }))
                  }
                >
                  {item.label}
                </Button>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={() =>
                    setMenuAnchors((prev) => ({ ...prev, [item.id]: null }))
                  }
                >
                  {item.children.map((child) => (
                    <MenuItem
                      key={child.id}
                      disabled={child.disabled}
                      selected={child.active}
                      sx={{
                        fontSize: "0.8rem",
                        "&.Mui-selected": { bgcolor: "action.selected" },
                        "&.Mui-selected:hover": { bgcolor: "action.selected" },
                      }}
                      onClick={() => {
                        setMenuAnchors((prev) => ({ ...prev, [item.id]: null }));
                        child.onClick();
                      }}
                    >
                      <ListItemIcon>{child.icon}</ListItemIcon>
                      {child.label}
                    </MenuItem>
                  ))}
                </Menu>
              </Fragment>
            );
          }
          const leaf = item as NavLeaf;
          return (
            <Button
              key={leaf.id}
              color="inherit"
              size="small"
              sx={{
                textTransform: "none",
                fontSize: "0.875rem",
                color: leaf.active ? shellColors.textPrimary : shellColors.textSecondary,
                fontWeight: leaf.active ? 600 : 400,
                bgcolor: leaf.active ? "action.selected" : "transparent",
                "&:hover": { bgcolor: leaf.active ? "action.selected" : undefined },
              }}
              onClick={leaf.onClick}
            >
              {leaf.label}
            </Button>
          );
        })
      )}
    </Stack>
  );

  if (!setupStateLoaded) {
    return (
      <Box component="main" sx={{ maxWidth: 760, mx: "auto", px: 2, py: 4 }}>
        <Typography variant="h4">{APP_NAME_FULL}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Loading application...
        </Typography>
      </Box>
    );
  }

  if (shouldShowSetupPage) {
    return (
      <Box component="main" sx={{ maxWidth: 760, mx: "auto", px: 2, py: 4, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Typography variant="h4">{APP_NAME_FULL}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Initial setup
        </Typography>
        <Stack spacing={2} sx={{ flex: 1 }}>
          <Card><CardContent>
            <Typography variant="h6">Step 1: Check Connections</Typography>
            <Typography variant="body2" color="text.secondary">{wizardState.hasConnection ? "Connection verified." : "Not checked yet."}</Typography>
            <Button
              disabled={busy || (setupLocked && !isSuperAdmin)}
              onClick={() => void runStep("/api/setup/check-connections", "Connection check")}
              type="button"
            >
              Check Connections
            </Button>
          </CardContent></Card>

          <Card><CardContent>
            <Typography variant="h6">Step 2: Database Setup</Typography>
            <Typography variant="body2" color="text.secondary">{wizardState.hasTables ? "Tables are set up." : "Tables not set up."}</Typography>
            <Button
              disabled={busy || (setupLocked && !isSuperAdmin)}
              onClick={() => void runMigrationsInBatches()}
              type="button"
            >
              Run Migrations
            </Button>
          </CardContent></Card>
          <Card><CardContent>
            <Typography variant="h6">Step 3: Create Super Admin</Typography>
            <Typography variant="body2" color="text.secondary">Enter private bootstrap key and create first admin account. This marks setup complete.</Typography>
            <form onSubmit={onCreateSuperAdmin}>
              <TextField variant="standard" size="small" type="password" label="Bootstrap key" value={bootstrapKey} onChange={(e) => setBootstrapKey(e.target.value)} />
              <Box sx={{ height: 1 }} />
              <TextField variant="standard" size="small" type="text" label="Admin username" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} />
              <Box sx={{ height: 1 }} />
              <TextField variant="standard" size="small" type="password" label="Admin password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
              <Box sx={{ mt: 2 }}>
                <Button variant="contained" disabled={busy || (setupLocked && !isSuperAdmin)} type="submit">
                  Create Super Admin
                </Button>
              </Box>
            </form>
            {setupLocked && !isSuperAdmin ? <Typography color="warning.main">Setup is locked. Login as super admin to continue.</Typography> : null}
          </CardContent></Card>
        </Stack>
        <Box sx={{ mt: "auto", pt: 1.5, pb: 0.5, borderTop: "1px solid", borderColor: "divider" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="caption" color="text.disabled" aria-live="polite" aria-atomic="true">{status}</Typography>
            <Typography variant="caption" color="text.disabled" sx={{ ml: "auto", textAlign: "right" }}>
              {`© ${new Date().getFullYear()} ${ORG_NAME}`}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <DateTimeProvider formatIst={formatIst}>
    <Box sx={{ minHeight: "100vh", bgcolor: shellColors.pageBg, color: shellColors.textPrimary }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          display: { xs: "none", md: "block" },
          bgcolor: shellColors.appBarBg,
          borderBottom: "1px solid",
          borderColor: shellColors.border,
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ minHeight: 66, gap: 2 }}>
          <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
            <Box component="img" src="/favicons/android-chrome-1024x1024.png" alt={APP_NAME_SHORT} sx={{ width: 24, height: 24 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {APP_NAME_SHORT}
            </Typography>
          </Stack>
          {principal ? topBarNav : null}
          <Box sx={{ flexGrow: 1 }} />
          {principal ? (
            <Stack sx={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
              <Button
                type="button"
                size="small"
                onClick={(e) => {
                  setProfileAnchorEl(e.currentTarget);
                }}
                sx={{ textTransform: "none", color: shellColors.textPrimary, borderColor: shellColors.border, gap: 0.75 }}
                variant="outlined"
              >
                <Avatar sx={{ width: 22, height: 22, fontSize: "0.6rem", bgcolor: "primary.main" }}>
                  {getInitials(displayName)}
                </Avatar>
                {displayName}
              </Button>
              <Menu
                anchorEl={profileAnchorEl}
                open={Boolean(profileAnchorEl)}
                onClose={() => {
                  setProfileAnchorEl(null);
                }}
              >
                {userAccountMenuItems.map((item) => (
                  <MenuItem
                    key={item.id}
                    sx={{ fontSize: "0.8rem" }}
                    onClick={item.onClick}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    {item.label}
                  </MenuItem>
                ))}
              </Menu>
            </Stack>
          ) : (
            <Chip label="Not signed in" />
          )}
        </Toolbar>
      </AppBar>
      {principal ? (
        <Box component="nav">
          {!isStudentOnlySession ? (
            <Drawer
              variant="permanent"
              sx={{
                display: { xs: "none", md: "block" },
                "& .MuiDrawer-paper": {
                  width: ADMIN_DRAWER_WIDTH,
                  boxSizing: "border-box",
                  bgcolor: shellColors.drawerBg,
                  color: shellColors.textPrimary,
                  borderRight: "1px solid",
                  borderColor: shellColors.border,
                  top: 66,
                  height: "calc(100% - 66px)",
                  overflowX: "hidden",
                  scrollbarWidth: "none",
                  "&::-webkit-scrollbar": { display: "none" },
                },
              }}
              open
            >
              <Box sx={{ py: 0.5 }}>
                {renderSidebarNav()}
              </Box>
            </Drawer>
          ) : null}
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: "block", md: "none" },
              "& .MuiDrawer-paper": {
                width: ADMIN_DRAWER_WIDTH,
                boxSizing: "border-box",
                bgcolor: shellColors.drawerBg,
                color: shellColors.textPrimary,
              }
            }}
          >
            <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <Toolbar sx={{ minHeight: 62, gap: 1 }}>
                <Box component="img" src="/favicons/android-chrome-1024x1024.png" alt={APP_NAME_SHORT} sx={{ width: 20, height: 20 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{APP_NAME_SHORT}</Typography>
              </Toolbar>
              <Box sx={{ py: 0.5 }}>
                {renderSidebarNav()}
              </Box>
              <Box sx={{ mt: "auto", py: 0.5, borderTop: "1px solid", borderColor: shellColors.border }}>
                <Box sx={{ px: 2, py: 1, display: "flex", alignItems: "center", gap: 1 }}>
                  <Avatar sx={{ width: 22, height: 22, fontSize: "0.6rem", bgcolor: "primary.main" }}>
                    {getInitials(displayName)}
                  </Avatar>
                  <Typography variant="body2" sx={{ fontSize: "0.875rem", fontWeight: 500 }}>
                    {displayName}
                  </Typography>
                </Box>
                <List sx={{ py: 0 }}>
                  {userAccountMenuItems.map((item) => (
                    <ListItemButton key={item.id} onClick={item.onClick}>
                      <ListItemIcon>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            </Box>
          </Drawer>
        </Box>
      ) : null}
      <Box
        component="main"
        sx={{
          ml: principal && !isStudentOnlySession ? { md: `${ADMIN_DRAWER_WIDTH}px` } : 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          px: { xs: 1.5, sm: 2.5, md: 3.25 },
          py: { xs: 1.5, md: 2 },
          "& .MuiCard-root": {
            bgcolor: shellColors.surface,
            border: "1px solid",
            borderColor: shellColors.border,
            boxShadow: "none",
            color: shellColors.textPrimary,
            borderRadius: 2.5,
          },
          "& .MuiTypography-colorTextSecondary": { color: shellColors.textSecondary },
          "& .MuiTableCell-root": { borderColor: "divider" },
        }}
      >
        <Toolbar sx={{ display: { xs: "none", md: "flex" } }} />
        {principal ? (
          <Box sx={{ display: { xs: "flex", md: "none" }, mb: 1.25 }}>
            <IconButton
              color="inherit"
              onClick={() => setMobileOpen((v) => !v)}
              sx={{ bgcolor: shellColors.iconSurface, color: shellColors.iconColor }}
            >
              <MenuIcon />
            </IconButton>
          </Box>
        ) : null}
        <Box sx={{ flex: 1 }}>
        {(!hasSuperAdmin || !wizardState.hasCredentials) && (
          <Card><CardContent>
            <Typography variant="h6">Complete Access Setup</Typography>
            <Typography variant="body2" color="text.secondary">Database is initialized. Create the first super admin to unlock login.</Typography>
            <form onSubmit={onCreateSuperAdmin}>
              <TextField variant="standard" size="small" type="password" label="Bootstrap key" value={bootstrapKey} onChange={(e) => setBootstrapKey(e.target.value)} />
              <Box sx={{ height: 1 }} />
              <TextField variant="standard" size="small" type="text" label="Admin username" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} />
              <Box sx={{ height: 1 }} />
              <TextField variant="standard" size="small" type="password" label="Admin password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
              <Box sx={{ mt: 2 }}>
                <Button variant="contained" disabled={busy || (setupLocked && !isSuperAdmin)} type="submit">
                  Create Super Admin
                </Button>
              </Box>
            </form>
            {setupLocked && !isSuperAdmin ? <Typography color="warning.main">Setup is locked. Login as super admin to continue.</Typography> : null}
          </CardContent></Card>
        )}

        {hasSuperAdmin && !principal && (
          <Box sx={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex" }}>

            {/* Left branding panel — desktop only */}
            <Box
              sx={{
                display: { xs: "none", md: "flex" },
                flex: 1,
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                background: "linear-gradient(160deg, #0d1b5e 0%, #1a3a8a 55%, #2d52a0 100%)",
                color: "#fff",
                p: 6,
                gap: 2,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Box sx={{ position: "absolute", width: 450, height: 450, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.07)", top: -100, left: -100 }} />
              <Box sx={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)", bottom: -70, right: -70 }} />
              <Box component="img" src="/favicons/android-chrome-1024x1024.png" alt={APP_NAME_SHORT} sx={{ width: 96, height: 96, mb: 1, position: "relative" }} />
              <Typography variant="h3" align="center" sx={{ fontWeight: 800, letterSpacing: -0.5, position: "relative" }}>{APP_NAME_SHORT}</Typography>
              <Typography variant="subtitle1" align="center" sx={{ opacity: 0.82, maxWidth: 340, position: "relative" }}>{APP_NAME_FULL}</Typography>
              <Box sx={{ width: 48, height: 3, borderRadius: 2, bgcolor: "rgba(255,255,255,0.38)", my: 0.5, position: "relative" }} />
              <Typography variant="body2" align="center" sx={{ opacity: 0.65, letterSpacing: 1.2, textTransform: "uppercase", fontSize: "0.7rem", position: "relative" }}>{ORG_NAME}</Typography>
              <Typography variant="body2" align="center" sx={{ opacity: 0.48, position: "relative" }}>Academic Management Portal</Typography>
            </Box>

            {/* Right form panel */}
            <Box
              sx={{
                width: { xs: "100%", md: 500 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                bgcolor: "background.paper",
                borderLeft: 1,
                borderColor: "divider",
                p: { xs: 3, sm: 5 },
              }}
            >
              {/* Mobile-only branding */}
              <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column", alignItems: "center", mb: 4, gap: 0.5 }}>
                <Box component="img" src="/favicons/android-chrome-1024x1024.png" alt={APP_NAME_SHORT} sx={{ width: 48, height: 48, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }} align="center">{APP_NAME_SHORT}</Typography>
                <Typography variant="body2" color="text.secondary" align="center">{ORG_NAME}</Typography>
              </Box>

              <Box sx={{ width: "100%", maxWidth: 360 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }} align="center" gutterBottom>Welcome back</Typography>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>Sign in to continue</Typography>

                <Stack spacing={2}>
                  {GOOGLE_CLIENT_ID ? (
                    <Box sx={{ display: "flex", justifyContent: "center" }}>
                      <Box id="google-signin-button" sx={{ width: "100%" }} />
                    </Box>
                  ) : null}

                  {GOOGLE_CLIENT_ID ? (
                    <Divider><Typography variant="caption" color="text.disabled">or</Typography></Divider>
                  ) : null}

                  {GOOGLE_CLIENT_ID && !showLocalLogin ? (
                    <Typography align="center" component="div">
                      <Link component="button" variant="caption" color="text.secondary" underline="hover" onClick={() => setShowLocalLogin(true)} sx={{ fontSize: "0.65rem" }}>
                        Sign in with username &amp; password
                      </Link>
                    </Typography>
                  ) : (
                    <Collapse in={showLocalLogin} unmountOnExit>
                      <form onSubmit={onLogin} aria-label="Sign in with username and password">
                        <Stack spacing={2}>
                          <TextField label="Username" fullWidth autoComplete="username" value={loginUser} onChange={(e) => setLoginUser(e.target.value)}
                            slotProps={{ htmlInput: { sx: { "&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus": { WebkitBoxShadow: `0 0 0 1000px ${theme.palette.background.paper} inset`, WebkitTextFillColor: theme.palette.text.primary } } } }}
                          />
                          <TextField label="Password" fullWidth type="password" autoComplete="current-password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)}
                            slotProps={{ htmlInput: { sx: { "&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus": { WebkitBoxShadow: `0 0 0 1000px ${theme.palette.background.paper} inset`, WebkitTextFillColor: theme.palette.text.primary } } } }}
                          />
                          <Button fullWidth variant="contained" size="large" disabled={busy} type="submit">Sign In</Button>
                          {GOOGLE_CLIENT_ID ? (
                            <Box sx={{ textAlign: "center" }}>
                              <Button variant="text" size="small" startIcon={<ChevronLeftIcon />} onClick={() => setShowLocalLogin(false)}>
                                Back to sign-in options
                              </Button>
                            </Box>
                          ) : null}
                        </Stack>
                      </form>
                    </Collapse>
                  )}
                </Stack>

                <Divider sx={{ mt: 3 }} />
                <Typography variant="caption" color="text.disabled" align="center" sx={{ display: "block", mt: 1.5 }}>{APP_NAME_FULL}</Typography>
                <Typography variant="caption" color="text.disabled" align="center" sx={{ display: "block", mt: 0.5 }}>
                  {`© ${new Date().getFullYear()} ${ORG_NAME}`}
                </Typography>
              </Box>
            </Box>

          </Box>
        )}

        {principal && apiError ? (
          <Alert
            severity="error"
            action={
              apiError.retryFn ? (
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => { setApiError(null); void apiError.retryFn?.(); }}
                >
                  Retry
                </Button>
              ) : undefined
            }
            onClose={() => setApiError(null)}
            sx={{ mb: 2 }}
          >
            {apiError.message}
          </Alert>
        ) : null}

        {principal && prevSuperView !== null ? (
          <Box sx={{ mb: 1 }}>
            <Button
              type="button"
              size="small"
              startIcon={<ChevronLeftIcon />}
              onClick={goBack}
              sx={{ fontWeight: 500 }}
            >
              Back
            </Button>
          </Box>
        ) : null}

        {principal && superView === "dashboard" ? (
          <Box>
            <Box sx={{ ...adminPageSx.headerPanel, mb: 2.5 }}>
              <Stack
                sx={{
                  flexDirection: { xs: "column", sm: "row" },
                  justifyContent: "space-between",
                  alignItems: { xs: "flex-start", sm: "flex-start" },
                  gap: 1.25,
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Welcome, {displayName}!</Typography>
                  <Typography variant="body2" color="text.secondary">Have a productive day!</Typography>
                </Box>
                <Box sx={{ textAlign: { xs: "left", sm: "right" }, mt: { xs: 0, sm: 0.25 } }}>
                  {isAdmin ? (
                    <Tooltip title="Refresh dashboard" arrow>
                      <span>
                        <IconButton
                          size="small"
                          aria-label="Refresh admin dashboard"
                          onClick={() => { void loadDashboard({ force: true }); }}
                          disabled={busy}
                          sx={{ mb: 0.25 }}
                        >
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : null}
                  <Typography variant="body2" color="text.secondary">
                    {new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date())}
                  </Typography>
                  {isAdmin && dashboard?.generatedAt ? (
                    <Typography variant="caption" color="text.disabled" sx={{ display: "block" }}>
                      Refreshed {formatIst(dashboard.generatedAt)}
                    </Typography>
                  ) : null}
                </Box>
              </Stack>
              <Box sx={{ mt: 1.25, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                {principal.roles.map((role) => (
                  <Chip key={role} size="small" label={role} color={ROLE_COLORS[role] ?? "default"} />
                ))}
                {isSuperAdmin ? <Chip size="small" color="error" label="superadmin" /> : null}
              </Box>
            </Box>

            {isAdmin ? (
              dashboard ? (
                <>
                  {isSuperAdmin && dashboard.mitigations?.needsMitigations ? (
                    <Alert
                      severity="warning"
                      sx={{ mb: 2.5 }}
                      action={(
                        <Button
                          type="button"
                          size="small"
                          variant="outlined"
                          color="warning"
                          startIcon={<BuildIcon fontSize="small" />}
                          disabled={busy}
                          onClick={() => { void runSuperAdminMitigations(); }}
                        >
                          Run Mitigations
                        </Button>
                      )}
                    >
                      {dashboard.mitigations.message}
                      {dashboard.mitigations.pendingMigrations.length > 0
                        ? ` — Pending: ${dashboard.mitigations.pendingMigrations.join(", ")}`
                        : ""}
                    </Alert>
                  ) : null}
                  {dashboard.curriculumValidation?.hasErrors ? (
                    <Alert severity="error" sx={{ mb: 2.5 }}>
                      {`Plan-of-study validation found ${dashboard.curriculumValidation.totalErrors} issue(s) across ${
                        dashboard.curriculumValidation.byPlan.filter((plan) => plan.hasErrors).length
                      } plan(s).`}
                        <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                        {dashboard.curriculumValidation.byPlan
                          .flatMap((plan) => plan.errors.map((error) => ({ planCode: plan.planCode, planName: plan.planName, message: error.message })))
                          .slice(0, 5)
                          .map((item, idx) => (
                            <Box component="li" key={`${item.planCode}-${idx}`}>
                              <Typography variant="body2">{`${item.planName} (Code ${item.planCode}): ${item.message}`}</Typography>
                            </Box>
                          ))}
                      </Box>
                    </Alert>
                  ) : null}

                  {/* Live platform metrics — not time-limited */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: `repeat(${Math.max(1, [(dashboard.auth?.totalUsers ?? 0), (dashboard.auth?.totalGuests ?? 0), (dashboard.auth?.activeUsers ?? 0), (dashboard.system?.tableCount ?? 0)].filter(v => v !== 0).length)}, minmax(0, 1fr))` },
                      gap: 2,
                      mb: 3
                    }}
                  >
                    {(dashboard.auth?.totalUsers ?? 0) !== 0 ? (
                      <Paper variant="outlined" sx={{ borderRadius: 2, px: 3, py: 2.5 }}>
                        <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1, display: "block" }}>
                          Total Users
                        </Typography>
                        <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.5 }}>
                          {(dashboard.auth?.totalUsers ?? 0).toLocaleString()}
                        </Typography>
                        <Button
                          type="button"
                          size="small"
                          endIcon={<ArrowForwardIcon />}
                          sx={{ p: 0, mt: 0.5 }}
                          onClick={() => { void (async () => { if (await ensureActiveServerSession()) { navigateTo("all-users"); await loadUsers(); } })(); }}
                        >
                          View all accounts
                        </Button>
                      </Paper>
                    ) : null}
                    {dashboard.auth?.totalGuests !== 0 ? (
                      <Paper variant="outlined" sx={{ borderRadius: 2, px: 3, py: 2.5 }}>
                        <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1, display: "block" }}>
                          Total Guests
                        </Typography>
                        <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.5 }}>
                          {(dashboard.auth?.totalGuests ?? 0).toLocaleString()}
                        </Typography>
                        <Button
                          type="button"
                          size="small"
                          endIcon={<ArrowForwardIcon />}
                          sx={{ p: 0, mt: 0.5 }}
                          onClick={() => {
                            void (async () => {
                              if (await ensureActiveServerSession()) {
                                setUserGlobalFilter("guest");
                                navigateTo("all-users");
                              }
                            })();
                          }}
                        >
                          View guest accounts
                        </Button>
                      </Paper>
                    ) : null}
                    {(dashboard.auth?.activeUsers ?? 0) !== 0 ? (
                      <Paper variant="outlined" sx={{ borderRadius: 2, px: 3, py: 2.5 }}>
                        <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1, display: "block" }}>
                          Active Users
                        </Typography>
                        <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.5 }}>
                          {(dashboard.auth?.activeUsers ?? 0).toLocaleString()}
                        </Typography>
                        <Button
                          type="button"
                          size="small"
                          endIcon={<ArrowForwardIcon />}
                          sx={{ p: 0, mt: 0.5 }}
                          onClick={() => { void (async () => { if (await ensureActiveServerSession()) { navigateTo("active-users"); await loadActiveUsers(); } })(); }}
                        >
                          View active sessions
                        </Button>
                      </Paper>
                    ) : null}
                    {(dashboard.system?.tableCount ?? 0) !== 0 ? (
                      <Paper variant="outlined" sx={{ borderRadius: 2, px: 3, py: 2.5 }}>
                        <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1, display: "block" }}>
                          System DB
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2, mt: 0.5 }}>
                          {(dashboard.system?.tableCount ?? 0).toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                          tables
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5 }}>
                          Schema: {dashboard.system?.currentSchemaVersion ?? "n/a"}
                        </Typography>
                      </Paper>
                    ) : null}
                  </Box>

                  {dashboard.system?.isTurso && dashboard.system?.turso ? (
                    <Paper variant="outlined" sx={{ borderRadius: 2, px: 3, py: 2.5, mt: 2 }}>
                      <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1, display: "block" }}>
                        Turso DB · Billing Cycle Usage
                      </Typography>
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 2.5, mt: 1.5 }}>
                        {[
                          { label: "Reads", value: dashboard.system!.turso!.rowsRead ?? 0, max: 500_000_000, isBytes: false },
                          { label: "Writes", value: dashboard.system!.turso!.rowsWritten ?? 0, max: 10_000_000, isBytes: false },
                          { label: "Syncs", value: dashboard.system!.turso!.bytesSynced ?? 0, max: 3_000_000_000, isBytes: true },
                          { label: "Storage", value: dashboard.system!.turso!.storageBytes ?? 0, max: 5_000_000_000, isBytes: true },
                        ].map(({ label, value, max, isBytes }) => {
                          const pct = Math.min(100, (value / max) * 100);
                          const fmt = (n: number) => isBytes
                            ? (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} KB` : `${n} B`)
                            : (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`);
                          return (
                            <Box key={label}>
                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}>
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>{label}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {fmt(value)}{" "}
                                  <Typography component="span" variant="caption" color="text.disabled">/ {fmt(max)}</Typography>
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={pct}
                                color={pct > 80 ? "error" : pct > 50 ? "warning" : "primary"}
                                sx={{ height: 6, borderRadius: 1 }}
                                aria-label={`${label}: ${pct.toFixed(1)}% of quota used`}
                              />
                              <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.25, textAlign: "right" }}>
                                {pct.toFixed(1)}%
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </Paper>
                  ) : null}

                  {/* Section separator — 48-hour window */}
                  <Divider textAlign="left" sx={{ mb: 2.5 }}>
                    <Chip
                      label="Updates from yesterday · last 48 hours"
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: "0.7rem", fontWeight: 500 }}
                    />
                  </Divider>

                  {/* Activity highlights list + login timeline chart */}
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "5fr 7fr" }, gap: 2 }}>
                    <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                      <List disablePadding>
                        <ListItemButton
                          onClick={() => { void openLoginActivity(); }}
                          sx={{ px: 2, py: 1.5 }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            <Box sx={{ p: 0.75, borderRadius: 1.25, bgcolor: "primary.main", color: "primary.contrastText", display: "flex" }}>
                              <LockPersonIcon fontSize="small" />
                            </Box>
                          </ListItemIcon>
                          <ListItemText
                            primary={`${dashboardLoginTotal.toLocaleString()} login attempts`}
                            secondary={`${dashboardLoginSuccess.toLocaleString()} succeeded · ${dashboardLoginFailed.toLocaleString()} failed`}
                            slotProps={{
                              primary: { sx: { fontSize: "0.875rem", fontWeight: 600 } },
                              secondary: { sx: { fontSize: "0.75rem" } },
                            }}
                          />
                          <ChevronRightIcon fontSize="small" sx={{ color: "text.disabled" }} />
                        </ListItemButton>
                        <Divider component="li" />
                        <ListItemButton
                          onClick={() => {
                            void (async () => {
                              if (await ensureActiveServerSession()) {
                                navigateTo("logs");
                                setLogLevel("error");
                                await loadLogs("error");
                              }
                            })();
                          }}
                          sx={{ px: 2, py: 1.5 }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            <Box sx={{ p: 0.75, borderRadius: 1.25, bgcolor: "error.main", color: "error.contrastText", display: "flex" }}>
                              <ErrorIcon fontSize="small" />
                            </Box>
                          </ListItemIcon>
                          <ListItemText
                            primary={`${dashboardErrorLogs.toLocaleString()} error logs`}
                            secondary="Open system logs"
                            slotProps={{
                              primary: { sx: { fontSize: "0.875rem", fontWeight: 600 } },
                              secondary: { sx: { fontSize: "0.75rem" } },
                            }}
                          />
                          <ChevronRightIcon fontSize="small" sx={{ color: "text.disabled" }} />
                        </ListItemButton>
                        <Divider component="li" />
                        <ListItemButton
                          onClick={() => {
                            void (async () => {
                              if (await ensureActiveServerSession()) {
                                navigateTo("logs");
                                setLogLevel("warn");
                                await loadLogs("warn");
                              }
                            })();
                          }}
                          sx={{ px: 2, py: 1.5 }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            <Box sx={{ p: 0.75, borderRadius: 1.25, bgcolor: "warning.main", color: "warning.contrastText", display: "flex" }}>
                              <WarningAmberIcon fontSize="small" />
                            </Box>
                          </ListItemIcon>
                          <ListItemText
                            primary={`${dashboardWarnLogs.toLocaleString()} warning logs`}
                            secondary="Open system logs"
                            slotProps={{
                              primary: { sx: { fontSize: "0.875rem", fontWeight: 600 } },
                              secondary: { sx: { fontSize: "0.75rem" } },
                            }}
                          />
                          <ChevronRightIcon fontSize="small" sx={{ color: "text.disabled" }} />
                        </ListItemButton>
                      </List>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="subtitle2">Login Activity Timeline</Typography>
                      <Typography variant="caption" color="text.secondary">X-axis in IST (UTC+05:30). Click a data point to jump to that filter.</Typography>
                      <Box
                        sx={{ height: 220, mt: 1 }}
                        role="img"
                        aria-label={`Login activity timeline: ${dashboardLoginTotal.toLocaleString()} total attempts — ${dashboardLoginSuccess.toLocaleString()} succeeded, ${dashboardLoginFailed.toLocaleString()} failed in the last 48 hours`}
                      >
                        <ReactECharts
                          theme={echartsTheme}
                          option={loginActivityChartOption}
                          notMerge
                          lazyUpdate
                          onEvents={loginActivityChartEvents}
                          style={{ height: "100%", width: "100%" }}
                        />
                      </Box>
                    </Paper>
                  </Box>

                </>
              ) : (
                <Typography variant="body2" color="text.secondary">Loading dashboard metrics...</Typography>
              )
            ) : null}

            {(hasStudentRole || hasFacultyRole || hasHeadRole || hasModeratorRole || hasGuestRole) ? (
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2, mt: isAdmin ? 2.5 : 0 }}>
                {hasHeadRole ? (
                  <Card sx={!(hasStudentRole || hasHeadRole) ? { gridColumn: { md: "1 / -1" } } : {}}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      {/* Dashboard header */}
                      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: (!multipleScopedRoles || expandedDashboardSections.has("head")) ? 3 : 0 }}>
                        <Box>
                          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.5 }}>
                            <DashboardIcon fontSize="small" color="primary" />
                            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                              Head Dashboard
                            </Typography>
                            <Chip label="Head" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: "0.65rem", borderRadius: 1 }} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            System-wide overview of all active student accounts
                          </Typography>
                        </Box>
                        <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                          <Tooltip title="Refresh all data">
                            <span>
                              <IconButton size="small" aria-label="Refresh head dashboard" onClick={() => { void loadHeadStudents({ force: true }); }} disabled={busy}>
                                <RefreshIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          {multipleScopedRoles && (
                            <IconButton size="small" aria-label={expandedDashboardSections.has("head") ? "Collapse head dashboard" : "Expand head dashboard"} onClick={() => handleDashboardSectionToggle("head")}>
                              <ExpandMoreIcon fontSize="small" sx={{ transform: expandedDashboardSections.has("head") ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }} />
                            </IconButton>
                          )}
                        </Stack>
                      </Stack>

                      <Collapse in={!multipleScopedRoles || expandedDashboardSections.has("head")}>
                      {/* Turso billing usage */}
                      {dashboard?.system?.isTurso && dashboard?.system?.turso ? (
                        <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, mb: 3 }}>
                          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 2 }}>
                            <StorageIcon sx={{ fontSize: "0.9rem", color: "text.secondary" }} />
                            <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.65rem", letterSpacing: 1.2 }}>
                              Turso DB · Billing Cycle Usage
                            </Typography>
                          </Stack>
                          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 2 }}>
                            {[
                              { label: "Reads", value: dashboard.system.turso.rowsRead ?? 0, max: 500_000_000, isBytes: false },
                              { label: "Writes", value: dashboard.system.turso.rowsWritten ?? 0, max: 10_000_000, isBytes: false },
                              { label: "Syncs", value: dashboard.system.turso.bytesSynced ?? 0, max: 3_000_000_000, isBytes: true },
                              { label: "Storage", value: dashboard.system.turso.storageBytes ?? 0, max: 5_000_000_000, isBytes: true },
                            ].map(({ label, value, max, isBytes }) => {
                              const pct = Math.min(100, (value / max) * 100);
                              const fmt = (n: number) => isBytes
                                ? (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} KB` : `${n} B`)
                                : (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`);
                              const barColor: "error" | "warning" | "success" = pct > 80 ? "error" : pct > 50 ? "warning" : "success";
                              return (
                                <Box key={label} sx={{ textAlign: "center" }}>
                                  <Typography variant="h5" sx={{ fontWeight: 700, color: `${barColor}.main`, lineHeight: 1.2 }}>
                                    {pct.toFixed(1)}%
                                  </Typography>
                                  <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mt: 0.25 }}>
                                    {label}
                                  </Typography>
                                  <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 0.75 }}>
                                    {fmt(value)} / {fmt(max)}
                                  </Typography>
                                  <LinearProgress
                                    variant="determinate"
                                    value={pct}
                                    color={barColor}
                                    sx={{ height: 5, borderRadius: 1 }}
                                    aria-label={`${label}: ${pct.toFixed(1)}% of quota used`}
                                  />
                                </Box>
                              );
                            })}
                          </Box>
                        </Paper>
                      ) : null}

                      {/* Student stat cards */}
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm: headMetricCardCount === 0 ? "1fr" : `repeat(${headMetricCardCount + 1}, minmax(0, 1fr))`,
                          },
                          gap: 2,
                          mb: 3,
                        }}
                      >
                        {headMetricCardCount > 0 ? (
                          <Paper
                            variant="outlined"
                            sx={{
                              borderRadius: 2,
                              px: 3,
                              py: 2.5,
                              borderColor: "primary.main",
                              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                            }}
                          >
                            <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 0.25 }}>
                              <GroupIcon sx={{ fontSize: "0.85rem", color: "primary.main" }} />
                              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1 }}>
                                Total Active
                              </Typography>
                            </Stack>
                            <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.5, color: "primary.main" }}>
                              {(headNotGraduatedCount + headGraduatedCount).toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                              Students enrolled
                            </Typography>
                          </Paper>
                        ) : null}
                        {headNotGraduatedCount !== 0 ? (
                          <Paper
                            variant="outlined"
                            sx={{
                              borderRadius: 2,
                              px: 3,
                              py: 2.5,
                              borderColor: "warning.main",
                              bgcolor: (theme) => alpha(theme.palette.warning.main, 0.04),
                            }}
                          >
                            <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 0.25 }}>
                              <SchoolIcon sx={{ fontSize: "0.85rem", color: "warning.main" }} />
                              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1 }}>
                                In Progress
                              </Typography>
                            </Stack>
                            <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.5, color: "warning.dark" }}>
                              {headNotGraduatedCount.toLocaleString()}
                            </Typography>
                            <Button type="button" size="small" color="warning" endIcon={<ArrowForwardIcon />} sx={{ p: 0, mt: 1 }} onClick={() => { setStudentsDirectoryGraduatedFilter("No"); setStudentsDirectoryCreditStatusFilter(null); setStudentsDirectoryBatchFilter(null); navigateTo("students-directory"); }}>
                              View students
                            </Button>
                          </Paper>
                        ) : null}
                        {headGraduatedCount !== 0 ? (
                          <Paper
                            variant="outlined"
                            sx={{
                              borderRadius: 2,
                              px: 3,
                              py: 2.5,
                              borderColor: "success.main",
                              bgcolor: (theme) => alpha(theme.palette.success.main, 0.04),
                            }}
                          >
                            <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 0.25 }}>
                              <SchoolIcon sx={{ fontSize: "0.85rem", color: "success.main" }} />
                              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1 }}>
                                Passed Out
                              </Typography>
                            </Stack>
                            <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.5, color: "success.dark" }}>
                              {headGraduatedCount.toLocaleString()}
                            </Typography>
                            <Button type="button" size="small" color="success" endIcon={<ArrowForwardIcon />} sx={{ p: 0, mt: 1 }} onClick={() => { setStudentsDirectoryGraduatedFilter("Yes"); setStudentsDirectoryCreditStatusFilter(null); setStudentsDirectoryBatchFilter(null); navigateTo("students-directory"); }}>
                              View passed out
                            </Button>
                          </Paper>
                        ) : null}
                        {headMetricCardCount === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            No student status metrics to show yet.
                          </Typography>
                        ) : null}
                      </Box>

                      {/* Batch status chart — width scales with batch count */}
                      {headStudentRows.length > 0 ? (
                        <Box sx={{ mb: 3, maxWidth: headBatchCount > 0 ? Math.min(headBatchCount * 320, 9999) : "100%" }}>
                          <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading chart...</Typography>}>
                            <FacultyAnalyticsReport
                              students={headStudentRows}
                              summaryCatEarned={studentSummaryCatEarned}
                              plansOfStudy={plansOfStudy}
                              regulations={regulations}
                              showBatchStatusByLabelCard
                              chartOnly
                            />
                          </Suspense>
                        </Box>
                      ) : null}

                      {/* Detailed batch analytics */}
                      <Divider sx={{ mb: 2.5 }}>
                        <Chip label="Batch Analytics" size="small" variant="outlined" />
                      </Divider>
                      <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading analytics...</Typography>}>
                        <FacultyAnalyticsReport
                          students={headStudentRows}
                          summaryCatEarned={studentSummaryCatEarned}
                          plansOfStudy={plansOfStudy}
                          regulations={regulations}
                          defaultExpandFirstBatch={false}
                          onViewStudents={(creditStatusFilter, batchFilter) => {
                            void openScopedStudentsDirectory("head", null, creditStatusFilter ?? undefined, batchFilter);
                          }}
                        />
                      </Suspense>
                      </Collapse>
                    </CardContent>
                  </Card>
                ) : null}
                {hasModeratorRole ? (
                  <Card sx={!(hasStudentRole || hasHeadRole) ? { gridColumn: { md: "1 / -1" } } : {}}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      {/* Dashboard header */}
                      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: (!multipleScopedRoles || expandedDashboardSections.has("moderator")) ? 3 : 0 }}>
                        <Box>
                          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.5 }}>
                            <DashboardIcon fontSize="small" color="primary" />
                            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                              Moderator Dashboard
                            </Typography>
                            <Chip label="Moderator" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: "0.65rem", borderRadius: 1 }} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            System-wide overview of all active student accounts
                          </Typography>
                        </Box>
                        <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                          <Tooltip title="Refresh all data">
                            <span>
                              <IconButton size="small" aria-label="Refresh moderator dashboard" onClick={() => { void loadModeratorStudents({ force: true }); }} disabled={busy}>
                                <RefreshIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          {multipleScopedRoles && (
                            <IconButton size="small" aria-label={expandedDashboardSections.has("moderator") ? "Collapse moderator dashboard" : "Expand moderator dashboard"} onClick={() => handleDashboardSectionToggle("moderator")}>
                              <ExpandMoreIcon fontSize="small" sx={{ transform: expandedDashboardSections.has("moderator") ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }} />
                            </IconButton>
                          )}
                        </Stack>
                      </Stack>

                      <Collapse in={!multipleScopedRoles || expandedDashboardSections.has("moderator")}>
                      {/* Student stat cards */}
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm: moderatorMetricCardCount === 0 ? "1fr" : `repeat(${moderatorMetricCardCount + 1}, minmax(0, 1fr))`,
                          },
                          gap: 2,
                          mb: 3,
                        }}
                      >
                        {moderatorMetricCardCount > 0 ? (
                          <Paper
                            variant="outlined"
                            sx={{
                              borderRadius: 2,
                              px: 3,
                              py: 2.5,
                              borderColor: "primary.main",
                              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                            }}
                          >
                            <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 0.25 }}>
                              <GroupIcon sx={{ fontSize: "0.85rem", color: "primary.main" }} />
                              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1 }}>
                                Total Active
                              </Typography>
                            </Stack>
                            <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.5, color: "primary.main" }}>
                              {(moderatorNotGraduatedCount + moderatorGraduatedCount).toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                              Students enrolled
                            </Typography>
                          </Paper>
                        ) : null}
                        {moderatorNotGraduatedCount !== 0 ? (
                          <Paper
                            variant="outlined"
                            sx={{
                              borderRadius: 2,
                              px: 3,
                              py: 2.5,
                              borderColor: "warning.main",
                              bgcolor: (theme) => alpha(theme.palette.warning.main, 0.04),
                            }}
                          >
                            <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 0.25 }}>
                              <SchoolIcon sx={{ fontSize: "0.85rem", color: "warning.main" }} />
                              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1 }}>
                                In Progress
                              </Typography>
                            </Stack>
                            <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.5, color: "warning.dark" }}>
                              {moderatorNotGraduatedCount.toLocaleString()}
                            </Typography>
                            <Button type="button" size="small" color="warning" endIcon={<ArrowForwardIcon />} sx={{ p: 0, mt: 1 }} onClick={() => { void openScopedStudentsDirectory("moderator", "No"); }}>
                              View students
                            </Button>
                          </Paper>
                        ) : null}
                        {moderatorGraduatedCount !== 0 ? (
                          <Paper
                            variant="outlined"
                            sx={{
                              borderRadius: 2,
                              px: 3,
                              py: 2.5,
                              borderColor: "success.main",
                              bgcolor: (theme) => alpha(theme.palette.success.main, 0.04),
                            }}
                          >
                            <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 0.25 }}>
                              <SchoolIcon sx={{ fontSize: "0.85rem", color: "success.main" }} />
                              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1 }}>
                                Passed Out
                              </Typography>
                            </Stack>
                            <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.5, color: "success.dark" }}>
                              {moderatorGraduatedCount.toLocaleString()}
                            </Typography>
                            <Button type="button" size="small" color="success" endIcon={<ArrowForwardIcon />} sx={{ p: 0, mt: 1 }} onClick={() => { void openScopedStudentsDirectory("moderator", "Yes"); }}>
                              View passed out
                            </Button>
                          </Paper>
                        ) : null}
                        {moderatorMetricCardCount === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            No student status metrics to show yet.
                          </Typography>
                        ) : null}
                      </Box>

                      {/* Batch status chart — width scales with batch count */}
                      {moderatorStudentRows.length > 0 ? (
                        <Box sx={{ mb: 3, maxWidth: moderatorBatchCount > 0 ? Math.min(moderatorBatchCount * 320, 9999) : "100%" }}>
                          <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading chart...</Typography>}>
                            <FacultyAnalyticsReport
                              students={moderatorStudentRows}
                              summaryCatEarned={studentSummaryCatEarned}
                              plansOfStudy={plansOfStudy}
                              regulations={regulations}
                              showBatchStatusByLabelCard
                              chartOnly
                            />
                          </Suspense>
                        </Box>
                      ) : null}

                      {/* Detailed batch analytics */}
                      <Divider sx={{ mb: 2.5 }}>
                        <Chip label="Batch Analytics" size="small" variant="outlined" />
                      </Divider>
                      <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading analytics...</Typography>}>
                        <FacultyAnalyticsReport
                          students={moderatorStudentRows}
                          summaryCatEarned={studentSummaryCatEarned}
                          plansOfStudy={plansOfStudy}
                          regulations={regulations}
                          defaultExpandFirstBatch={false}
                          onViewStudents={(creditStatusFilter, batchFilter) => {
                            void openScopedStudentsDirectory("moderator", null, creditStatusFilter ?? undefined, batchFilter);
                          }}
                        />
                      </Suspense>
                      </Collapse>
                    </CardContent>
                  </Card>
                ) : null}
                {hasFacultyRole ? (
                  <Card sx={!(hasStudentRole || hasHeadRole) ? { gridColumn: { md: "1 / -1" } } : {}}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      {/* Dashboard header */}
                      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: (!multipleScopedRoles || expandedDashboardSections.has("faculty")) ? 3 : 0 }}>
                        <Box>
                          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.5 }}>
                            <DashboardIcon fontSize="small" color="primary" />
                            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                              Faculty Dashboard
                            </Typography>
                            <Chip label="Faculty" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: "0.65rem", borderRadius: 1 }} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            Overview of students currently under your mentorship
                          </Typography>
                        </Box>
                        <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                          <Tooltip title="Refresh all data">
                            <span>
                              <IconButton size="small" aria-label="Refresh faculty dashboard" onClick={() => { void loadFacultyStudents({ force: true }); }} disabled={busy}>
                                <RefreshIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          {multipleScopedRoles && (
                            <IconButton size="small" aria-label={expandedDashboardSections.has("faculty") ? "Collapse faculty dashboard" : "Expand faculty dashboard"} onClick={() => handleDashboardSectionToggle("faculty")}>
                              <ExpandMoreIcon fontSize="small" sx={{ transform: expandedDashboardSections.has("faculty") ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }} />
                            </IconButton>
                          )}
                        </Stack>
                      </Stack>

                      <Collapse in={!multipleScopedRoles || expandedDashboardSections.has("faculty")}>
                      {/* Student stat cards */}
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm: facultyMetricCardCount === 0 ? "1fr" : `repeat(${facultyMetricCardCount + 1}, minmax(0, 1fr))`,
                          },
                          gap: 2,
                          mb: 3,
                        }}
                      >
                        {facultyMetricCardCount > 0 ? (
                          <Paper
                            variant="outlined"
                            sx={{
                              borderRadius: 2,
                              px: 3,
                              py: 2.5,
                              borderColor: "primary.main",
                              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                            }}
                          >
                            <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 0.25 }}>
                              <GroupIcon sx={{ fontSize: "0.85rem", color: "primary.main" }} />
                              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1 }}>
                                Total Mentored
                              </Typography>
                            </Stack>
                            <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.5, color: "primary.main" }}>
                              {(facultyNotGraduatedCount + facultyGraduatedCount).toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                              Students assigned to you
                            </Typography>
                          </Paper>
                        ) : null}
                        {facultyNotGraduatedCount !== 0 ? (
                          <Paper
                            variant="outlined"
                            sx={{
                              borderRadius: 2,
                              px: 3,
                              py: 2.5,
                              borderColor: "warning.main",
                              bgcolor: (theme) => alpha(theme.palette.warning.main, 0.04),
                            }}
                          >
                            <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 0.25 }}>
                              <SchoolIcon sx={{ fontSize: "0.85rem", color: "warning.main" }} />
                              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1 }}>
                                In Progress
                              </Typography>
                            </Stack>
                            <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.5, color: "warning.dark" }}>
                              {facultyNotGraduatedCount.toLocaleString()}
                            </Typography>
                            <Button type="button" size="small" color="warning" endIcon={<ArrowForwardIcon />} sx={{ p: 0, mt: 1 }} onClick={() => { void openScopedStudentsDirectory("faculty", "No"); }}>
                              View students
                            </Button>
                          </Paper>
                        ) : null}
                        {facultyGraduatedCount !== 0 ? (
                          <Paper
                            variant="outlined"
                            sx={{
                              borderRadius: 2,
                              px: 3,
                              py: 2.5,
                              borderColor: "success.main",
                              bgcolor: (theme) => alpha(theme.palette.success.main, 0.04),
                            }}
                          >
                            <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 0.25 }}>
                              <SchoolIcon sx={{ fontSize: "0.85rem", color: "success.main" }} />
                              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1 }}>
                                Passed Out
                              </Typography>
                            </Stack>
                            <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.5, color: "success.dark" }}>
                              {facultyGraduatedCount.toLocaleString()}
                            </Typography>
                            <Button type="button" size="small" color="success" endIcon={<ArrowForwardIcon />} sx={{ p: 0, mt: 1 }} onClick={() => { void openScopedStudentsDirectory("faculty", "Yes"); }}>
                              View passed out
                            </Button>
                          </Paper>
                        ) : null}
                        {facultyMetricCardCount === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            No student status metrics to show yet.
                          </Typography>
                        ) : null}
                      </Box>

                      {/* Detailed batch analytics */}
                      <Divider sx={{ mb: 2.5 }}>
                        <Chip label="Batch Analytics" size="small" variant="outlined" />
                      </Divider>
                      <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading analytics...</Typography>}>
                        <FacultyAnalyticsReport
                          students={facultyStudentRows}
                          summaryCatEarned={studentSummaryCatEarned}
                          plansOfStudy={plansOfStudy}
                          regulations={regulations}
                          onViewStudents={(creditStatusFilter, batchFilter) => {
                            void openScopedStudentsDirectory("faculty", null, creditStatusFilter ?? undefined, batchFilter);
                          }}
                        />
                      </Suspense>
                      </Collapse>
                    </CardContent>
                  </Card>
                ) : null}
                {hasStudentRole ? (
                  <Card>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      {/* Dashboard header */}
                      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
                        <Box>
                          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.5 }}>
                            <DashboardIcon fontSize="small" color="primary" />
                            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>My Dashboard</Typography>
                            <Chip label="Student" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: "0.65rem", borderRadius: 1 }} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            Your academic progress and profile at a glance
                          </Typography>
                        </Box>
                        <Tooltip title="Refresh">
                          <span>
                            <IconButton size="small" onClick={() => { void loadStudentSelfPlanOfStudy({ force: true }); }} disabled={busy}>
                              <RefreshIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>

                      {studentSelf ? (
                        <>
                          {/* Two-column layout: left = profile + plan of study, right = credit progress */}
                          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mb: 2.5 }}>

                            {/* Left column: profile + plan of study stacked */}
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

                              {/* Profile summary */}
                              <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
                                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                                  <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                      {studentSelf.fullName || "Student"}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                      {studentSelf.email}
                                    </Typography>
                                  </Box>
                                  <Chip
                                    label={studentSelf.graduated === "Yes" ? "Passed Out" : "Active"}
                                    size="small"
                                    color={studentSelf.graduated === "Yes" ? "success" : "primary"}
                                    variant="outlined"
                                    sx={{ height: 22, fontSize: "0.7rem", flexShrink: 0 }}
                                  />
                                </Stack>
                                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                                  {[
                                    { label: "Reg. Number", value: studentSelf.registrationNumber || "Not Allotted" },
                                    { label: "Batch", value: studentSelf.batch != null ? String(studentSelf.batch) : "—" },
                                    { label: "Semester", value: studentSelf.currentSemester != null ? `Sem ${studentSelf.currentSemester}` : "—" },
                                    { label: "Programme", value: programmeOptions.find((p) => p.id === studentSelf.programme)?.name ?? "—" },
                                    { label: "Mentor", value: studentSelf.mentorName || "—" },
                                    { label: "Plan of Study", value: activeStudentPlan?.planName ?? "—" },
                                  ].map(({ label, value }) => (
                                    <Box key={label}>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                        {label}
                                      </Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>{value}</Typography>
                                    </Box>
                                  ))}
                                </Box>
                              </Paper>

                              {/* Plan of study — semester overview */}
                              {activeStudentPlan ? (
                                <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, flex: 1 }}>
                                  <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                                    <Box>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Plan of Study</Typography>
                                      <Typography variant="caption" color="text.secondary">{activeStudentPlan.planName}</Typography>
                                    </Box>
                                    <Chip label={activeStudentPlan.regulationCode} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.65rem", fontFamily: "monospace" }} />
                                  </Stack>
                                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                    {activeStudentPlan.semesters.map((sem) => {
                                      const isCurrent = sem.semester === studentSelf.currentSemester;
                                      const isPast = studentSelf.currentSemester != null && sem.semester < studentSelf.currentSemester;
                                      return (
                                        <Box
                                          key={sem.semester}
                                          sx={{
                                            px: 1.5, py: 0.75, borderRadius: 1.5,
                                            border: "1px solid",
                                            borderColor: isCurrent ? "primary.main" : "divider",
                                            bgcolor: isCurrent ? (theme) => alpha(theme.palette.primary.main, 0.06) : isPast ? "action.hover" : "transparent",
                                            minWidth: 60, textAlign: "center",
                                          }}
                                        >
                                          <Typography variant="caption" sx={{ fontWeight: isCurrent ? 700 : 400, fontSize: "0.7rem", color: isCurrent ? "primary.main" : "text.secondary", display: "block" }}>
                                            Sem {sem.semester}
                                          </Typography>
                                          <Typography variant="caption" sx={{ fontSize: "0.68rem", color: "text.disabled" }}>
                                            {sem.totalCredits} cr
                                          </Typography>
                                        </Box>
                                      );
                                    })}
                                  </Box>
                                </Paper>
                              ) : null}

                            </Box>{/* end left column */}

                            {/* Right column: credit progress */}
                            {studentSelfCreditSummary ? (
                              <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5, height: "100%" }}>
                                {/* Header */}
                                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Credit Progress</Typography>
                                  <Chip
                                    label={CREDIT_STATUS_LABELS[studentSelfCreditSummary.overallStatus]}
                                    size="small"
                                    color={
                                      studentSelfCreditSummary.overallStatus === "complete" ? "success" :
                                      studentSelfCreditSummary.overallStatus === "on-track" ? "success" :
                                      studentSelfCreditSummary.overallStatus === "marginal" ? "primary" :
                                      studentSelfCreditSummary.overallStatus === "alarming" ? "warning" : "error"
                                    }
                                    sx={{ height: 20, fontSize: "0.65rem", borderRadius: 1 }}
                                  />
                                </Stack>
                                {/* Overall stat + bar */}
                                <Stack direction="row" sx={{ alignItems: "baseline", gap: 0.75, mb: 1 }}>
                                  <Typography
                                    variant="h4"
                                    sx={{
                                      fontWeight: 700,
                                      lineHeight: 1,
                                      color: studentSelfCreditSummary.overallStatus === "complete" ? "success.main" :
                                        studentSelfCreditSummary.overallStatus === "on-track" ? "success.main" :
                                        studentSelfCreditSummary.overallStatus === "marginal" ? "primary.main" :
                                        studentSelfCreditSummary.overallStatus === "alarming" ? "warning.main" : "error.main",
                                    }}
                                  >
                                    {formatCredits(studentSelfCreditSummary.totalEarned)}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    / {formatCredits(studentSelfCreditSummary.totalRequired)} cr
                                  </Typography>
                                  <Box sx={{ flex: 1 }} />
                                  <Typography variant="caption" color="text.secondary">
                                    {studentSelfCreditSummary.completionPct}% complete
                                  </Typography>
                                </Stack>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(100, studentSelfCreditSummary.completionPct)}
                                  color={
                                    studentSelfCreditSummary.overallStatus === "complete" ? "success" :
                                    studentSelfCreditSummary.overallStatus === "on-track" ? "success" :
                                    studentSelfCreditSummary.overallStatus === "marginal" ? "primary" :
                                    studentSelfCreditSummary.overallStatus === "alarming" ? "warning" : "error"
                                  }
                                  sx={{ height: 6, borderRadius: 1 }}
                                />
                                {/* Category rows */}
                                {studentSelfCreditSummary.categories.length > 0 && (
                                  <>
                                    <Divider sx={{ my: 2 }} />
                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                                      {studentSelfCreditSummary.categories.map((cat) => {
                                        const catName = visibleRegulations[0]?.curriculumStructure?.categories?.find((c) => c.code === cat.code)?.name ?? cat.code;
                                        const catPct = cat.required > 0 ? Math.round((cat.earned / cat.required) * 100) : 0;
                                        const catColor = cat.status === "complete" ? "success" : cat.status === "on-track" ? "success" : cat.status === "marginal" ? "primary" : cat.status === "alarming" ? "warning" : "error";
                                        const catColorMain = cat.status === "complete" ? "success.main" : cat.status === "on-track" ? "success.main" : cat.status === "marginal" ? "primary.main" : cat.status === "alarming" ? "warning.main" : "error.main";
                                        return (
                                          <Stack key={cat.code} direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                                            <Typography variant="caption" sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.72rem", color: catColorMain, flexShrink: 0, minWidth: 32 }}>
                                              {cat.code}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                              {catName}
                                            </Typography>
                                            <Box sx={{ width: 80, flexShrink: 0 }}>
                                              <LinearProgress variant="determinate" value={Math.min(100, catPct)} color={catColor} sx={{ height: 4, borderRadius: 1 }} />
                                            </Box>
                                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.67rem", flexShrink: 0, width: 60, textAlign: "right" }}>
                                              {formatCredits(cat.earned)}/{formatCredits(cat.required)} cr
                                            </Typography>
                                          </Stack>
                                        );
                                      })}
                                    </Box>
                                  </>
                                )}
                                {!studentSelfCreditSummary.creditsLoaded && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>Loading credit data...</Typography>
                                )}
                              </Paper>
                            ) : null}

                          </Box>{/* end two-column grid */}

                          {/* Quick actions */}
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <Button variant="outlined" size="small" endIcon={<ArrowForwardIcon />} onClick={() => { openStudentCredits(studentSelf); }}>
                              View My Credits
                            </Button>
                            <Button variant="outlined" size="small" endIcon={<ArrowForwardIcon />} onClick={() => { navigateTo("regulations"); }}>
                              View My Plan of Study
                            </Button>
                            <Button variant="outlined" size="small" endIcon={<ArrowForwardIcon />} onClick={() => { navigateTo("account"); setAccountView("profile"); }}>
                              My Profile
                            </Button>
                          </Stack>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">Loading your profile...</Typography>
                      )}
                    </CardContent>
                  </Card>
                ) : null}
                {hasGuestRole ? (
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Guest</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Guest access is limited. Use My Account for profile details.</Typography>
                    </CardContent>
                  </Card>
                ) : null}
              </Box>
            ) : null}
          </Box>
        ) : null}

        {principal && isAdmin && superView === "logs" ? (
          <Card sx={adminPageSx.pageCard}>
            <CardContent>
              <Box
                sx={{ ...adminPageSx.headerPanel, mb: 2 }}
              >
                <Stack
                  sx={{
                    flexDirection: { xs: "column", md: "row" },
                    alignItems: { xs: "stretch", md: "flex-start" },
                    justifyContent: "space-between",
                    gap: 1.5,
                  }}
                >
                  <Box>
                    <Typography variant="h6" gutterBottom={false}>System Logs</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Last 48 hours &mdash; {visibleLogRows.length} of {logRows.length} {logRows.length === 1 ? "entry" : "entries"}
                      {logHasMore ? " (more available)" : ""}
                    </Typography>
                  </Box>
                  <Stack
                    sx={{
                      flexDirection: { xs: "column", sm: "row" },
                      alignItems: { xs: "stretch", sm: "center" },
                      gap: 1,
                    }}
                  >
                    <ToggleButtonGroup
                      value={logLevel}
                      exclusive
                      size="small"
                      disabled={busy}
                      onChange={(_e, newLevel: "error" | "warn" | null) => {
                        if (!newLevel || newLevel === logLevel) return;
                        void (async () => {
                          setLogLevel(newLevel);
                          await loadLogs(newLevel);
                        })();
                      }}
                    >
                      <ToggleButton
                        value="error"
                        sx={{
                          gap: 0.5,
                          color: "error.main",
                          "&.Mui-selected": { bgcolor: "error.main", color: "error.contrastText", "&:hover": { bgcolor: "error.dark" } },
                        }}
                      >
                        <ErrorIcon fontSize="small" />
                        Errors
                      </ToggleButton>
                      <ToggleButton
                        value="warn"
                        sx={{
                          gap: 0.5,
                          color: "warning.main",
                          "&.Mui-selected": { bgcolor: "warning.main", color: "warning.contrastText", "&:hover": { bgcolor: "warning.dark" } },
                        }}
                      >
                        <WarningAmberIcon fontSize="small" />
                        Warnings
                      </ToggleButton>
                    </ToggleButtonGroup>
                    <Tooltip title="Refresh" arrow>
                      <span>
                        <IconButton
                          size="small"
                          disabled={busy}
                          onClick={() => { void loadLogs(logLevel, undefined, { force: true }); }}
                        >
                          <RefreshIcon
                            fontSize="small"
                            sx={{
                              "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
                              animation: busy ? "spin 0.8s linear infinite" : "none",
                            }}
                          />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>

                <Box sx={{ mt: 1.25, display: "flex", flexWrap: "wrap", gap: 0.75 }} role="group" aria-label="Log type filters">
                  <Chip
                    size="small"
                    clickable
                    onClick={() => setLogTypeFilters([])}
                    color={hasAnyLogTypeFilter ? "default" : "primary"}
                    variant={hasAnyLogTypeFilter ? "outlined" : "filled"}
                    label={`All: ${visibleLogRows.length}`}
                    aria-pressed={!hasAnyLogTypeFilter}
                  />
                  <Chip
                    size="small"
                    clickable
                    onClick={() => toggleLogTypeFilter("status5xx")}
                    variant={isLogTypeSelected("status5xx") ? "filled" : "outlined"}
                    color="error"
                    label={`5xx: ${visibleLogRowsByType.status5xx.length}`}
                    aria-pressed={isLogTypeSelected("status5xx")}
                  />
                  <Chip
                    size="small"
                    clickable
                    onClick={() => toggleLogTypeFilter("status4xx")}
                    variant={isLogTypeSelected("status4xx") ? "filled" : "outlined"}
                    color="warning"
                    label={`4xx: ${visibleLogRowsByType.status4xx.length}`}
                    aria-pressed={isLogTypeSelected("status4xx")}
                  />
                  <Chip
                    size="small"
                    clickable
                    onClick={() => toggleLogTypeFilter("slow")}
                    variant={isLogTypeSelected("slow") ? "filled" : "outlined"}
                    color="info"
                    label={`Slow >1s: ${visibleLogRowsByType.slow.length}`}
                    aria-pressed={isLogTypeSelected("slow")}
                  />
                </Box>
              </Box>

              {busy ? <LinearProgress sx={{ mb: 1.5, borderRadius: 1 }} /> : <Divider sx={{ mb: 1.5 }} />}

              {visibleLogRows.length === 0 ? (
                <Alert severity="success" variant="outlined" sx={{ mt: 1 }}>
                  {hasAnyLogTypeFilter
                    ? "No logs match the selected filters."
                    : `No ${logLevel === "error" ? "error" : "warning"} logs in the last 48 hours.`}
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520, borderRadius: 2 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ "& th": { bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" } }}>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Time</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>User / Subject</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>Level</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>Method</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>Route</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }} align="center">Status</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }} align="right">Duration</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>Event</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>Details</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {visibleLogRows.map((row, i) => (
                        <TableRow
                          key={`${row.ts}-${row.requestId}-${i}`}
                          hover
                          sx={{
                            "&:nth-of-type(odd)": { bgcolor: "action.hover" },
                            "& td": { borderColor: "divider", verticalAlign: "top" },
                          }}
                        >
                          <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.75rem", color: "text.secondary" }}>
                            {formatIst(row.ts)}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 130 }}>
                            <Tooltip title={row.principalSubject ?? "anonymous"} placement="top" arrow>
                              <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130, color: row.principalSubject ? "text.primary" : "text.disabled" }}>
                                {row.principalSubject ? (row.principalSubject.split("|").pop() ?? row.principalSubject) : "anon"}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={row.level.toUpperCase()}
                              size="small"
                              color={row.level === "error" ? "error" : row.level === "warn" ? "warning" : "default"}
                              sx={{ fontWeight: 700, fontSize: "0.65rem", height: 20 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={row.method}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: "0.65rem", height: 20, fontFamily: "monospace" }}
                            />
                          </TableCell>
                          <TableCell sx={{ maxWidth: 220 }}>
                            <Tooltip title={row.path} placement="top" arrow>
                              <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
                                {row.path}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={row.statusCode}
                              size="small"
                              color={row.statusCode >= 500 ? "error" : row.statusCode >= 400 ? "warning" : "success"}
                              sx={{ fontWeight: 700, fontSize: "0.65rem", height: 20 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ minWidth: 72 }}>
                              <Typography
                                variant="caption"
                                sx={{ fontFamily: "monospace" }}
                                color={row.durationMs > 1000 ? "error" : row.durationMs > 300 ? "warning.main" : "text.secondary"}
                              >
                                {row.durationMs} ms
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(100, (row.durationMs / 3000) * 100)}
                                color={row.durationMs > 1000 ? "error" : row.durationMs > 300 ? "warning" : "success"}
                                sx={{ height: 3, borderRadius: 1, mt: 0.25 }}
                                aria-label={`Request duration: ${row.durationMs}ms`}
                              />
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                              {row.event}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 200 }}>
                            {row.meta ? (
                              <Tooltip title={<Box component="pre" sx={{ m: 0, fontSize: "0.7rem" }}>{JSON.stringify(row.meta, null, 2)}</Box>} placement="left" arrow>
                                <Typography tabIndex={0} variant="caption" sx={{ fontFamily: "monospace", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200, cursor: "help" }}>
                                  {JSON.stringify(row.meta)}
                                </Typography>
                              </Tooltip>
                            ) : (
                              <Typography variant="caption" color="text.disabled">—</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {logHasMore ? (
                <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
                  <Button
                    type="button"
                    variant="outlined"
                    size="small"
                    disabled={busy}
                    onClick={() => { void loadLogs(logLevel, logCursor); }}
                  >
                    Load More
                  </Button>
                </Box>
              ) : visibleLogRows.length > 0 ? (
                <Typography variant="caption" color="text.disabled" sx={{ display: "block", textAlign: "center", mt: 1.5 }}>
                  All entries loaded
                </Typography>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {principal && isAdmin && superView === "activity-logs" ? (
          <Card sx={adminPageSx.pageCard}>
            <CardContent>
              <Box
                sx={{ ...adminPageSx.headerPanel, mb: 2 }}
              >
                <Stack
                  sx={{
                    flexDirection: { xs: "column", md: "row" },
                    alignItems: { xs: "stretch", md: "center" },
                    justifyContent: "space-between",
                    gap: 1.5,
                  }}
                >
                  <Box>
                    <Typography variant="h6" gutterBottom={false}>Activity Logs</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {activityVisibleCumulativeCount} of {activityFilteredRows.length} {activityFilteredRows.length === 1 ? "entry" : "entries"}
                      {hasAnyActivityLevelFilter || hasAnyActivityStatusFilter || hasAnyActivityEventFilter ? " (filtered)" : ""}
                      {activityLogHasMore ? " (more available)" : ""}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Chip
                      size="small"
                      color="primary"
                      variant="outlined"
                      label={`Page ${activityLogPage}`}
                    />
                    <Tooltip title="Refresh" arrow>
                      <span>
                        <IconButton
                          size="small"
                          aria-label="Refresh activity logs"
                          disabled={busy}
                          onClick={() => { void loadActivityLogs(undefined, { force: true }); }}
                        >
                          <RefreshIcon
                            fontSize="small"
                            sx={{
                              "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
                              animation: busy ? "spin 0.8s linear infinite" : "none",
                            }}
                          />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>
                <Box sx={{ mt: 1.25, display: "flex", flexWrap: "wrap", gap: 0.75 }} role="group" aria-label="Activity log filters">
                  <Chip
                    size="small"
                    clickable
                    color={!hasAnyActivityLevelFilter && !hasAnyActivityStatusFilter && !hasAnyActivityEventFilter ? "primary" : "default"}
                    variant={!hasAnyActivityLevelFilter && !hasAnyActivityStatusFilter && !hasAnyActivityEventFilter ? "filled" : "outlined"}
                    label={`Total: ${activityLogRows.length}`}
                    aria-pressed={!hasAnyActivityLevelFilter && !hasAnyActivityStatusFilter && !hasAnyActivityEventFilter}
                    onClick={() => {
                      setActivityLevelFilters([]);
                      setActivityStatusFilters([]);
                      setActivityEventFilters([]);
                    }}
                  />
                  {activityLevelOptions.map((level) => (
                    <Chip
                      key={level}
                      size="small"
                      clickable
                      color={level === "error" ? "error" : level === "warn" ? "warning" : "info"}
                      variant={activityLevelFilters.includes(level) ? "filled" : "outlined"}
                      label={`${level.toUpperCase()}: ${activityLevelCounts.get(level) ?? 0}`}
                      aria-pressed={activityLevelFilters.includes(level)}
                      onClick={() => toggleActivityLevelFilter(level)}
                    />
                  ))}
                  {activityStatusOptions.map((statusFamily) => (
                    <Chip
                      key={statusFamily}
                      size="small"
                      clickable
                      color={
                        statusFamily === "5xx"
                          ? "error"
                          : statusFamily === "4xx"
                            ? "warning"
                            : statusFamily === "2xx"
                              ? "success"
                              : "info"
                      }
                      variant={activityStatusFilters.includes(statusFamily) ? "filled" : "outlined"}
                      label={`${statusFamily}: ${activityStatusCounts.get(statusFamily) ?? 0}`}
                      aria-pressed={activityStatusFilters.includes(statusFamily)}
                      onClick={() => toggleActivityStatusFilter(statusFamily)}
                    />
                  ))}
                </Box>
              </Box>

              <Divider sx={{ mb: 1.5 }} />

              {activityVisibleRows.length === 0 ? (
                <Alert severity="info" variant="outlined" sx={{ mt: 1 }}>
                  {hasAnyActivityLevelFilter || hasAnyActivityStatusFilter || hasAnyActivityEventFilter
                    ? "No activity logs found for the selected Level/Status/Event filters."
                    : "No activity logs found."}
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 540, borderRadius: 2 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ "& th": { bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" } }}>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Time</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>User / Subject</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>Level</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>Action</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>Method</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>Route</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }} align="center">Status</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }} align="right">Duration</TableCell>
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>Details</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activityVisibleRows.map((row, i) => (
                        <TableRow
                          key={`${row.ts}-${row.requestId}-${i}`}
                          hover
                          sx={{
                            "&:nth-of-type(odd)": { bgcolor: "action.hover" },
                            "& td": { borderColor: "divider", verticalAlign: "top" },
                          }}
                        >
                          <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.75rem", color: "text.secondary" }}>
                            {formatIst(row.ts)}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 130 }}>
                            <Tooltip title={row.principalSubject ?? "anonymous"} placement="top" arrow>
                              <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130, color: row.principalSubject ? "text.primary" : "text.disabled" }}>
                                {row.principalSubject ? (row.principalSubject.split("|").pop() ?? row.principalSubject) : "anon"}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={row.level.toUpperCase()}
                              size="small"
                              color={row.level === "error" ? "error" : row.level === "warn" ? "warning" : "default"}
                              sx={{ fontWeight: 700, fontSize: "0.65rem", height: 20 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                              {row.event}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={row.method}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: "0.65rem", height: 20, fontFamily: "monospace" }}
                            />
                          </TableCell>
                          <TableCell sx={{ maxWidth: 220 }}>
                            <Tooltip title={row.path} placement="top" arrow>
                              <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
                                {row.path}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={row.statusCode}
                              size="small"
                              color={row.statusCode >= 500 ? "error" : row.statusCode >= 400 ? "warning" : "success"}
                              sx={{ fontWeight: 700, fontSize: "0.65rem", height: 20 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ minWidth: 72 }}>
                              <Typography
                                variant="caption"
                                sx={{ fontFamily: "monospace" }}
                                color={row.durationMs > 1000 ? "error" : row.durationMs > 300 ? "warning.main" : "text.secondary"}
                              >
                                {row.durationMs} ms
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(100, (row.durationMs / 3000) * 100)}
                                color={row.durationMs > 1000 ? "error" : row.durationMs > 300 ? "warning" : "success"}
                                sx={{ height: 3, borderRadius: 1, mt: 0.25 }}
                                aria-label={`Request duration: ${row.durationMs}ms`}
                              />
                            </Box>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 200 }}>
                            {row.meta ? (
                              <Tooltip title={<Box component="pre" sx={{ m: 0, fontSize: "0.7rem" }}>{JSON.stringify(row.meta, null, 2)}</Box>} placement="left" arrow>
                                <Typography tabIndex={0} variant="caption" sx={{ fontFamily: "monospace", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200, cursor: "help" }}>
                                  {JSON.stringify(row.meta)}
                                </Typography>
                              </Tooltip>
                            ) : (
                              <Typography variant="caption" color="text.disabled">—</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {activityFilteredRows.length > 0 ? (
                <Box sx={{ mt: 2, display: "flex", justifyContent: "center", gap: 1, alignItems: "center" }}>
                  <Button
                    type="button"
                    variant="outlined"
                    size="small"
                    startIcon={<ChevronLeftIcon />}
                    onClick={() => setActivityLogPage((p) => Math.max(1, p - 1))}
                    disabled={activityLogPage <= 1}
                  >
                    Previous
                  </Button>
                  <Typography component="span" variant="body2">Page {activityLogPage}</Typography>
                  <Button
                    type="button"
                    variant="outlined"
                    size="small"
                    endIcon={<ChevronRightIcon />}
                    onClick={() => {
                      void goToNextActivityPage();
                    }}
                    disabled={!activityLogHasMore && activityLogPage >= activityLoadedPages}
                  >
                    Next
                  </Button>
                </Box>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {principal && isAdmin && superView === "active-users" ? (
          <Card>
            <CardContent>
              <Stack spacing={adminPageSx.pageStack.spacing}>
                <Box sx={adminPageSx.headerPanel}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "flex-start" } }}
                  >
                    <Box>
                      <Typography variant="h6">Active Users</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Users with currently active sessions.
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "flex-end", alignSelf: { xs: "flex-start", sm: "flex-start" } }}>
                      <Tooltip title="Refresh" arrow>
                        <span>
                          <IconButton
                            size="small"
                            aria-label="Refresh active users"
                            disabled={busy}
                            onClick={() => { void loadActiveUsers(undefined, { force: true }); }}
                          >
                            <RefreshIcon
                              fontSize="small"
                              sx={{
                                "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
                                animation: busy ? "spin 0.8s linear infinite" : "none",
                              }}
                            />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.25, display: "block" }}>
                    {`${activeUserRows.length} records loaded · ${activeLiveUsersCount} live`}
                  </Typography>
                </Box>
                <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading active-users table...</Typography>}>
                  <ActiveUsersTable rows={activeUserRows} busy={busy} />
                </Suspense>
                {activeUserHasMore ? (
                  <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => {
                        void loadActiveUsers(activeUserCursor);
                      }}
                    >
                      Load More
                    </Button>
                  </Stack>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {principal && isAdmin && superView === "login-activity" ? (
          <Card>
            <CardContent>
              <Stack spacing={adminPageSx.pageStack.spacing}>
                <Box sx={adminPageSx.headerPanel}>
                  <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                    <Box>
                      <Typography variant="h6">Login Activity (48h)</Typography>
                      <Typography variant="body2" color="text.secondary">Recent successful and failed local login attempts.</Typography>
                    </Box>
                    <Tooltip title="Refresh" arrow>
                      <span>
                        <IconButton
                          size="small"
                          aria-label="Refresh login activity"
                          disabled={busy}
                          onClick={() => { void loadLoginActivity(undefined, { force: true }); }}
                        >
                          <RefreshIcon
                            fontSize="small"
                            sx={{
                              "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
                              animation: busy ? "spin 0.8s linear infinite" : "none",
                            }}
                          />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.25, display: "block" }}>
                    {`${loginActivityRows.length} records loaded.`}
                  </Typography>
                </Box>
                <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading failed-login table...</Typography>}>
                  <FailedLoginsTable rows={loginActivityRows} busy={busy} />
                </Suspense>
                {loginActivityHasMore ? (
                  <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => {
                        void loadLoginActivity(loginActivityCursor);
                      }}
                    >
                      Load More
                    </Button>
                  </Stack>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {principal && isAdmin && superView === "all-users" ? (
          <Card>
            <CardContent>
              <Stack spacing={adminPageSx.pageStack.spacing}>
                <Box sx={adminPageSx.headerPanel}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "flex-start" } }}
                  >
                    <Box>
                      <Typography variant="h6">All Users</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {userSummary.loaded} account{userSummary.loaded === 1 ? "" : "s"} loaded
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "flex-end", alignSelf: { xs: "flex-start", sm: "flex-start" } }}>
                      <Tooltip title="Refresh" arrow>
                        <span>
                          <IconButton
                            size="small"
                            aria-label="Refresh user list"
                            disabled={busy}
                            onClick={() => { void loadUsers(undefined, { force: true }); }}
                          >
                            <RefreshIcon
                              fontSize="small"
                              sx={{
                                "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
                                animation: busy ? "spin 0.8s linear infinite" : "none",
                              }}
                            />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Stack>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ mt: 1.25, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 1 }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Use table column filters and search to refine user results.
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignSelf: { xs: "flex-end", sm: "center" } }}>
                      <Button
                        component="label"
                        type="button"
                        variant="outlined"
                        disabled={busy}
                        sx={{ whiteSpace: "nowrap" }}
                      >
                        Bulk Update Status CSV
                        <input hidden accept=".csv,text/csv" type="file" onChange={updateUserStatusesFromCsvFile} />
                      </Button>
                      <Button
                        type="button"
                        variant={showAddUserForm ? "outlined" : "contained"}
                        startIcon={<PersonAddIcon />}
                        onClick={() => setShowAddUserForm((v) => !v)}
                        sx={{ whiteSpace: "nowrap" }}
                      >
                        {showAddUserForm ? "Hide User Form" : "Add User"}
                      </Button>
                    </Box>
                  </Stack>
                </Box>

                {showAddUserForm ? (
                  <Paper variant="outlined">
                    {/* Form header */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        p: 2.5,
                        bgcolor: "action.hover",
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <PersonAddIcon sx={{ color: "primary.main", fontSize: "1.1rem" }} />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Create Local Account</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Add a user with username and password credentials.
                        </Typography>
                      </Box>
                    </Box>

                    <form onSubmit={createUser} aria-label="Create local user account">
                      <Stack spacing={2.5} sx={{ p: 2.5 }}>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                          <TextField
                            variant="standard" size="small" fullWidth type="text" label="Full name *"
                            autoComplete="name" value={newUserFullName}
                            error={Boolean(addUserErrors.fullName)}
                            helperText={addUserErrors.fullName ?? " "}
                            onChange={(e) => { setNewUserFullName(e.target.value); setAddUserErrors((prev) => ({ ...prev, fullName: undefined })); }}
                          />
                          <TextField
                            variant="standard" size="small" fullWidth type="email" label="Email (optional)"
                            autoComplete="email" value={newUserEmail}
                            helperText=" "
                            onChange={(e) => setNewUserEmail(e.target.value)}
                          />
                          <TextField
                            variant="standard" size="small" fullWidth type="text" label="Username or email *"
                            autoComplete="username" value={newUserUsername}
                            error={Boolean(addUserErrors.username)}
                            helperText={addUserErrors.username ?? " "}
                            onChange={(e) => { setNewUserUsername(e.target.value.toLowerCase()); setAddUserErrors((prev) => ({ ...prev, username: undefined })); }}
                          />
                        </Stack>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                          <Box sx={{ flexGrow: 1, flexShrink: 1, flexBasis: "auto", minWidth: 0 }}>
                            <TextField
                              variant="standard" size="small" fullWidth type="password" label="Password *"
                              autoComplete="new-password" value={newUserPassword}
                              error={Boolean(addUserErrors.password)}
                              helperText={
                                addUserErrors.password
                                  ? addUserErrors.password
                                  : newUserPassword.length > 0
                                    ? newUserPassword.length < 8
                                      ? `${newUserPassword.length}/8 characters minimum`
                                      : "Strength: good"
                                    : " "
                              }
                              onChange={(e) => { setNewUserPassword(e.target.value); setAddUserErrors((prev) => ({ ...prev, password: undefined })); }}
                            />
                            {newUserPassword.length > 0 && (
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(100, (newUserPassword.length / 12) * 100)}
                                color={newUserPassword.length < 8 ? "error" : newUserPassword.length < 12 ? "warning" : "success"}
                                sx={{ mt: 0.5, height: 3, borderRadius: 2 }}
                              />
                            )}
                          </Box>
                          <FormControl variant="standard" size="small" fullWidth>
                            <InputLabel id="new-user-roles-label">Roles</InputLabel>
                            <Select
                              size="small"
                              labelId="new-user-roles-label"
                              label="Roles"
                              multiple
                              value={newUserRoles}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const nextRoles = (Array.isArray(raw) ? raw : [raw]).map((role) => String(role ?? ""));
                                setNewUserRoles(nextRoles);
                              }}
                            >
                              <MenuItem value="student">Student</MenuItem>
                              <MenuItem value="faculty">Faculty</MenuItem>
                              <MenuItem value="head">Head</MenuItem>
                              <MenuItem value="moderator">Moderator</MenuItem>
                              <MenuItem value="guest">Guest</MenuItem>
                              <MenuItem value="admin">Admin</MenuItem>
                            </Select>
                          </FormControl>
                        </Stack>
                        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                          <Button type="submit" variant="contained" startIcon={<PersonAddIcon />} disabled={busy}>
                            {busy ? "Creating..." : "Create User"}
                          </Button>
                        </Box>
                      </Stack>
                    </form>

                    {/* Bulk CSV import */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                        flexWrap: "wrap",
                        p: 2.5,
                        bgcolor: "action.hover",
                        borderTop: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          <b>Bulk import via CSV.</b> Required: <code>fullName</code>, <code>username</code>, <code>password</code>. Optional: <code>email</code>, <code>role</code>.
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                          <b>Bulk status CSV.</b> Required: <code>username</code> and <code>active</code> (or <code>status</code>) using values like <code>true/false</code> or <code>active/disabled</code>.
                        </Typography>
                        {bulkCsvFileName ? (
                          <Typography variant="caption" color="primary.main">
                            Selected: {bulkCsvFileName}
                          </Typography>
                        ) : null}
                      </Box>
                      <Button component="label" variant="outlined" size="small" disabled={busy}>
                        Import Users CSV
                        <input hidden accept=".csv,text/csv" type="file" onChange={createUsersFromCsvFile} />
                      </Button>
                    </Box>
                    {bulkStatusCsvFileName ? (
                      <Typography variant="caption" color="primary.main" sx={{ px: 2.5, pb: 1.25, display: "block" }}>
                        Status CSV selected: {bulkStatusCsvFileName}
                      </Typography>
                    ) : null}
                  </Paper>
                ) : null}

                <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading users table...</Typography>}>
                  <ManageUsersTable
                    rows={userRows}
                    busy={busy}
                    onResetPassword={(row) => resetUserPassword(row)}
                    onLogoutSessions={async (row) => {
                      const identifier = (row.email ?? row.username ?? row.subject ?? "").trim();
                      await logoutUserAllSessionsByIdentifier(identifier);
                    }}
                    onSubmitRows={async (updates) => {
                      await submitUserRows(updates);
                    }}
                  />
                </Suspense>
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {principal && (isAdmin || hasHeadRole || hasModeratorRole || hasFacultyRole || hasStudentRole) && superView === "students-directory" ? (
          <Card>
            <CardContent>
              <Stack spacing={adminPageSx.pageStack.spacing}>
                <Box sx={adminPageSx.headerPanel}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "flex-start" } }}
                  >
                    <Box>
                      <Typography variant="h6">Students Directory</Typography>
                      {!isStudentOnlySession ? (
                        <Typography variant="body2" color="text.secondary">
                          {isScopedStudentDashboardOnly
                            ? `${facultyStudentsDirectoryRows.length} active student account${facultyStudentsDirectoryRows.length === 1 ? "" : "s"} loaded`
                            : `${studentDirectoryRows.length} student account${studentDirectoryRows.length === 1 ? "" : "s"} loaded`}
                        </Typography>
                      ) : null}
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "flex-end", alignSelf: { xs: "flex-start", sm: "flex-start" } }}>
                      <Tooltip title="Refresh" arrow>
                        <span>
                          <IconButton
                            size="small"
                            aria-label="Refresh students directory"
                            disabled={busy}
                            onClick={() => {
                              void (async () => {
                                await loadProgrammes({ force: true });
                                if (isStudentOnlySession) {
                                  await loadStudentSelfPlanOfStudy({ force: true });
                                } else if (isScopedStudentDashboardOnly) {
                                  await loadPrimaryScopedStudents({ force: true });
                                } else {
                                  await loadStudentsDirectory(undefined, { force: true });
                                }
                              })();
                            }}
                          >
                            <RefreshIcon
                              fontSize="small"
                              sx={{
                                "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
                                animation: busy ? "spin 0.8s linear infinite" : "none",
                              }}
                            />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Stack>
                  {!isStudentOnlySession ? (
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.25, display: "block" }}>
                        Use table column filters and search to refine student results.
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                        Update student details CSV columns: required <code>email</code>; optional <code>registration_number</code>, <code>plan_of_study_code</code>, <code>programme</code>, <code>current_semester</code>, <code>batch</code>, <code>graduated</code>, <code>mentor_email</code>.
                      </Typography>
                    </>
                  ) : null}
                  {isScopedStudentDashboardOnly && !isStudentOnlySession ? (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      {scopedDashboardRoleContext === "moderator"
                        ? "Showing all active students."
                        : "Showing only your active mentoring students. Faculty CSV cannot include programme or mentor_email."}
                    </Typography>
                  ) : null}
                </Box>

                <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading students directory table...</Typography>}>
                  <StudentsDirectoryTable
                    rows={isStudentOnlySession ? studentSelfDirectoryRows : (isScopedStudentDashboardOnly ? facultyStudentsDirectoryRows : studentDirectoryRows)}
                    busy={busy}
                    initialGraduatedFilter={studentsDirectoryGraduatedFilter}
                    initialCreditStatusFilter={studentsDirectoryCreditStatusFilter}
                    initialBatchFilter={studentsDirectoryBatchFilter}
                    planOfStudyOptions={planOfStudyOptions}
                    planSemesterBounds={planSemesterBounds}
                    mentorNameOptions={mentorNameOptions}
                    programmeOptions={programmeOptions}
                    showMentorName={!isScopedStudentDashboardOnly}
                    showProgramme={!isScopedStudentDashboardOnly}
                    showModifiedAudit={(isAdmin || hasHeadRole || hasModeratorRole)}
                    canEdit={!isStudentOnlySession}
                    onOpenStudentCredits={(row) => openStudentCredits(row)}
                    onSubmitRows={async (updates) => {
                      if (!isStudentOnlySession) {
                        await submitStudentsDirectoryRows(updates);
                      }
                    }}
                    onImportStudentsCsv={isStudentOnlySession ? undefined : importStudentsFromCsvFile}
                    onImportCredits={isStudentOnlySession ? undefined : async (rows) => {
                      const result = await callApi("/api/student-credits/import-batch", "POST", undefined, {
                        writeMode: "replace_all",
                        allowClearAll: false,
                        rows,
                      });
                      if (result.ok) {
                        invalidateAdminCache(["dashboard", "students-directory:first", "faculty-students:first", "moderator-students:first", "head-students:first"]);
                      }
                      return {
                        imported: Number(result.imported ?? 0),
                        failed: Number(result.failed ?? 0),
                        errors: Array.isArray(result.errors) ? result.errors.map(String) : [],
                      };
                    }}
                    onVisibleRowsChange={setCreditNavRows}
                    creditSummaries={creditSummaries}
                  />
                </Suspense>
                {studentsDirectoryHasMore && !isScopedStudentDashboardOnly && !isStudentOnlySession ? (
                  <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                    <Button type="button" variant="outlined" onClick={() => { void loadStudentsDirectory(studentsDirectoryCursor); }}>
                      Load More
                    </Button>
                  </Stack>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {principal && superView === "regulations" ? (
          <Card>
            <CardContent>
              <Stack spacing={adminPageSx.pageStack.spacing}>
                <Box sx={adminPageSx.headerPanel}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "flex-start" } }}
                  >
                    <Box>
                      <Typography variant="h6">Regulations And Plans Of Study</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Curriculum structure, credit requirements, and batch plan distribution
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "flex-end", alignSelf: { xs: "flex-start", sm: "flex-start" } }}>
                      <Tooltip title="Refresh" arrow>
                        <span>
                          <IconButton
                            size="small"
                            aria-label="Refresh regulations"
                            disabled={busy}
                            onClick={() => {
                              void loadRegulations({ force: true });
                              void loadPlansOfStudy({ force: true });
                              if (isStudentOnlySession) {
                                void loadStudentSelfPlanOfStudy({ force: true });
                              }
                            }}
                          >
                            <RefreshIcon
                              fontSize="small"
                              sx={{
                                "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
                                animation: busy ? "spin 0.8s linear infinite" : "none",
                              }}
                            />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Stack>
                  {plansValidationReport?.hasErrors && !isStudentOnlySession ? (
                    <Alert severity="error" sx={{ mt: 1.5 }}>
                      {`Validation found ${plansValidationReport.totalErrors} issue(s).`}
                      <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                        {plansValidationReport.byPlan
                          .flatMap((plan) => plan.errors.map((error) => ({ planCode: plan.planCode, planName: plan.planName, message: error.message })))
                          .slice(0, 5)
                          .map((item, idx) => (
                            <Box component="li" key={`reg-validation-${item.planCode}-${idx}`}>
                              <Typography variant="body2">{`${item.planName} (Code ${item.planCode}): ${item.message}`}</Typography>
                            </Box>
                          ))}
                      </Box>
                    </Alert>
                  ) : null}
                </Box>

              {visibleRegulations.length > 0 ? (
                <Paper variant="outlined">
                    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                      <Tabs
                        value={safeRegulationTab}
                        onChange={(_, v: number) => { setRegulationTab(v); }}
                        variant="scrollable"
                        scrollButtons="auto"
                      >
                        {visibleRegulations.map((reg, i) => (
                          <Tab
                            key={reg.code}
                            value={i}
                            label={
                              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                                <span>{reg.code}</span>
                                <Chip
                                  label={`${formatCredits(reg.curriculumStructure.totalCreditsRequired)} cr`}
                                  size="small"
                                  sx={{ height: 18, fontSize: "0.68rem", pointerEvents: "none", mx: 0.25, my: 0.25 }}
                                />
                              </Stack>
                            }
                          />
                        ))}
                      </Tabs>
                    </Box>

                    {visibleRegulations.map((regulation, i) => {
                      if (i !== safeRegulationTab) return null;
                      const total = regulation.curriculumStructure.totalCreditsRequired;
                      const categories = regulation.curriculumStructure.categories;
                      const rangeCount = categories.filter((c) => c.rule.type === "range").length;

                      return (
                        <Box key={regulation.code} sx={{ p: 3 }}>
                          <Stack direction="row" sx={{ mb: 2.5, flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {regulation.name}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", ml: 0.5 }}>
                              <Chip label={`${formatCredits(total)} credits required`} size="small" color="primary" sx={{ m: 0.25 }} />
                              <Chip label={`${categories.length} categories`} size="small" variant="outlined" sx={{ m: 0.25 }} />
                              {rangeCount > 0 && (
                                <Chip label={`${rangeCount} flexible`} size="small" color="warning" variant="outlined" sx={{ m: 0.25 }} />
                              )}
                            </Stack>
                          </Stack>

                          <TableContainer component={Paper} variant="outlined">
                            <Table>
                              <TableHead>
                                <TableRow sx={{ "& .MuiTableCell-head": { bgcolor: "action.hover", fontWeight: 700 } }}>
                                  <TableCell>Code</TableCell>
                                  <TableCell>Category</TableCell>
                                  <TableCell align="right">Credits</TableCell>
                                  <TableCell sx={{ width: 140 }}>Share of Total</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {categories.map((category) => {
                                  const isRange = category.rule.type === "range";
                                  const creditsText = isRange
                                    ? `${(category.rule as { type: "range"; min: number; max: number }).min}–${(category.rule as { type: "range"; min: number; max: number }).max}`
                                    : formatCredits((category.rule as { type: string; value: number }).value);
                                  const barValue = isRange
                                    ? (((category.rule as { type: "range"; min: number; max: number }).min + (category.rule as { type: "range"; min: number; max: number }).max) / 2 / total) * 100
                                    : ((category.rule as { type: string; value: number }).value / total) * 100;

                                  return (
                                    <TableRow key={`${regulation.code}-${category.code}`} hover>
                                      <TableCell>
                                        <Chip
                                          label={category.code}
                                          size="small"
                                          variant="outlined"
                                          sx={{ fontFamily: "monospace", fontWeight: 600 }}
                                        />
                                      </TableCell>
                                      <TableCell>{category.name}</TableCell>
                                      <TableCell align="right">
                                        <Chip
                                          label={creditsText}
                                          size="small"
                                          color={isRange ? "warning" : "default"}
                                          variant={isRange ? "outlined" : "filled"}
                                          sx={{ fontWeight: 600, minWidth: 52 }}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Stack spacing={0.75}>
                                          <LinearProgress
                                            variant="determinate"
                                            value={barValue}
                                            color={isRange ? "warning" : "primary"}
                                            sx={{ height: 6, borderRadius: 3 }}
                                          />
                                          <Typography variant="caption" color="text.secondary">
                                            {Math.round(barValue)}%
                                          </Typography>
                                        </Stack>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      );
                    })}
                </Paper>
              ) : (
                <Paper variant="outlined" sx={{ p: 3 }}>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      {isStudentOnlySession
                        ? "No regulations found for your assigned plan of study."
                        : "No regulations found. Click Refresh to reload."}
                    </Typography>
                  </Box>
                </Paper>
              )}

              {filteredPlansOfStudy.length > 0 ? (
                <Paper variant="outlined">
                    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                      <Tabs
                        value={safePlanOfStudyTab}
                        onChange={(_, v: number) => { setPlanOfStudyTab(v); }}
                        variant="scrollable"
                        scrollButtons="auto"
                      >
                        {filteredPlansOfStudy.map((plan, i) => (
                          (() => {
                            const computedPlanTotalCredits = plan.semesters.reduce(
                              (acc, semester) => acc + Number(semester.totalCredits ?? 0),
                              0
                            );
                            return (
                          <Tab
                            key={plan.planCode}
                            value={i}
                            label={
                              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                                <span>{plan.planName}</span>
                                <Chip
                                  label={`${formatCredits(computedPlanTotalCredits)} cr`}
                                  size="small"
                                  sx={{ height: 18, fontSize: "0.68rem", pointerEvents: "none", mx: 0.25, my: 0.25 }}
                                />
                              </Stack>
                            }
                          />
                            );
                          })()
                        ))}
                      </Tabs>
                    </Box>
                    {filteredPlansOfStudy.map((plan, i) => {
                      if (i !== safePlanOfStudyTab) return null;
                      const regulation = regulations.find((r) => r.code === plan.regulationCode) ?? null;
                      const measureByCode = new Map<string, "credits" | "units">(
                        (regulation?.curriculumStructure.categories ?? []).map((c) => [c.code, c.measure ?? "credits"]),
                      );
                      const computedCategoryTotals = plan.semesters.reduce<Record<string, number>>((acc, semester) => {
                        Object.entries(semester.categories ?? {}).forEach(([code, rawValue]) => {
                          const value = Number(rawValue ?? 0);
                          acc[code] = (acc[code] ?? 0) + value;
                        });
                        return acc;
                      }, {});
                      const computedPlanTotalCredits = plan.semesters.reduce(
                        (acc, semester) => acc + Number(semester.totalCredits ?? 0),
                        0
                      );
                      const categoryCodes = Array.from(
                        new Set(plan.semesters.flatMap((semester) => Object.keys(semester.categories ?? {})))
                      );
                      const creditCategoryCodes = categoryCodes.filter((code) => (measureByCode.get(code) ?? "credits") === "credits");
                      const unitCategoryCodes = categoryCodes.filter((code) => (measureByCode.get(code) ?? "credits") === "units");
                      const categoryCodesOrdered = [...creditCategoryCodes, ...unitCategoryCodes];
                      const firstUnitColumnIndex = creditCategoryCodes.length;
                      return (
                        <Box key={plan.planCode} sx={{ p: 3 }}>
                          <Stack direction="row" sx={{ mb: 2.5, flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {plan.planName}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", ml: 0.5 }}>
                              <Chip label={`Code ${plan.planCode}`} size="small" variant="outlined" sx={{ m: 0.25 }} />
                              <Chip label={plan.regulationCode} size="small" variant="outlined" sx={{ m: 0.25 }} />
                              <Chip label={`${plan.semesters.length} semesters`} size="small" variant="outlined" sx={{ m: 0.25 }} />
                              <Chip label={`${formatCredits(computedPlanTotalCredits)} credits planned`} size="small" color="primary" sx={{ m: 0.25 }} />
                              {unitCategoryCodes.length > 0 && (
                                <Chip
                                  label={`${formatCredits(plan.semesters.reduce((acc, sem) => acc + Number(sem.totalUnits ?? 0), 0))} units planned`}
                                  size="small"
                                  color="secondary"
                                  variant="outlined"
                                  sx={{ m: 0.25 }}
                                />
                              )}
                            </Stack>
                          </Stack>

                          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ "& .MuiTableCell-head": { bgcolor: "background.default", fontWeight: 600, fontSize: "0.72rem", py: 0.75 } }}>
                                  <TableCell />
                                  <TableCell
                                    colSpan={Math.max(creditCategoryCodes.length, 1)}
                                    align="center"
                                    sx={{ color: "primary.main" }}
                                  >
                                    Credits
                                  </TableCell>
                                  {unitCategoryCodes.length > 0 && (
                                    <TableCell
                                      colSpan={unitCategoryCodes.length}
                                      align="center"
                                      sx={{ color: "secondary.main", borderLeft: "2px solid", borderLeftColor: "divider" }}
                                    >
                                      Non-credits
                                    </TableCell>
                                  )}
                                  <TableCell />
                                </TableRow>
                                <TableRow sx={{ "& .MuiTableCell-head": { bgcolor: "action.hover", fontWeight: 700 } }}>
                                  <TableCell>Semester</TableCell>
                                  {categoryCodesOrdered.map((code, idx) => (
                                    <TableCell
                                      key={`${plan.planCode}-${code}`}
                                      align="right"
                                      sx={idx === firstUnitColumnIndex && unitCategoryCodes.length > 0
                                        ? { borderLeft: "2px solid", borderLeftColor: "divider" }
                                        : undefined}
                                    >
                                      {code}
                                    </TableCell>
                                  ))}
                                  <TableCell align="right">Total</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {plan.semesters.map((semester) => (
                                  <TableRow key={`${plan.planCode}-sem-${semester.semester}`} hover>
                                    <TableCell>{semester.semester}</TableCell>
                                    {categoryCodesOrdered.map((code, idx) => (
                                      <TableCell
                                        key={`${plan.planCode}-sem-${semester.semester}-${code}`}
                                        align="right"
                                        sx={idx === firstUnitColumnIndex && unitCategoryCodes.length > 0
                                          ? { borderLeft: "2px solid", borderLeftColor: "divider" }
                                          : undefined}
                                      >
                                        {formatCredits(Number(semester.categories?.[code] ?? 0))}
                                      </TableCell>
                                    ))}
                                    <TableCell align="right">
                                      <Chip label={formatCredits(Number(semester.totalCredits ?? 0))} size="small" sx={{ m: 0.25 }} />
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow sx={{ "& .MuiTableCell-root": { fontWeight: 700 } }}>
                                  <TableCell>Total</TableCell>
                                  {categoryCodesOrdered.map((code, idx) => (
                                    <TableCell
                                      key={`${plan.planCode}-tot-${code}`}
                                      align="right"
                                      sx={idx === firstUnitColumnIndex && unitCategoryCodes.length > 0
                                        ? { borderLeft: "2px solid", borderLeftColor: "divider" }
                                        : undefined}
                                    >
                                      {formatCredits(Number(computedCategoryTotals[code] ?? 0))}
                                    </TableCell>
                                  ))}
                                  <TableCell align="right">
                                    <Chip label={formatCredits(computedPlanTotalCredits)} size="small" color="primary" sx={{ m: 0.25 }} />
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      );
                    })}
                </Paper>
              ) : (
                <Paper variant="outlined" sx={{ p: 3 }}>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      No plans of study found for the selected regulation. Click Refresh to reload.
                    </Typography>
                  </Box>
                </Paper>
              )}
              </Stack>
            </CardContent>
          </Card>
        ) : null}
        {principal && superView === "student-credits" ? (
          <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading student credits...</Typography>}>
            <StudentCreditsView
              student={selectedStudentForCredits ?? {
                userId: "",
                fullName: "",
                email: "",
                registrationNumber: "",
                planOfStudyCode: null,
                currentSemester: null,
                batch: null,
                programme: null,
                graduated: "No",
                mentorName: "",
                modifiedByName: "",
                modifiedAt: null,
              }}
              plan={selectedStudentPlan}
              regulation={selectedStudentRegulation}
              earnedCreditsBySemester={selectedStudentForCredits?.userId ? (studentEarnedCreditsByUser[selectedStudentForCredits.userId] ?? {}) : {}}
              savedCreditsBySemester={selectedStudentForCredits?.userId ? (studentSavedCreditsByUser[selectedStudentForCredits.userId] ?? {}) : {}}
              earnedUnitsByCategory={selectedStudentForCredits?.userId ? (studentEarnedUnitsByUser[selectedStudentForCredits.userId] ?? {}) : {}}
              savedUnitsByCategory={selectedStudentForCredits?.userId ? (studentSavedUnitsByUser[selectedStudentForCredits.userId] ?? {}) : {}}
              isSaving={studentCreditsSaving}
              studentIndex={selectedStudentIndex >= 0 ? selectedStudentIndex : undefined}
              studentCount={effectiveCreditNavRows.length > 1 ? effectiveCreditNavRows.length : undefined}
              onNavigate={(direction) => {
                const next = selectedStudentIndex + direction;
                if (next >= 0 && next < effectiveCreditNavRows.length) openStudentCredits(effectiveCreditNavRows[next]);
              }}
              onChangeEarnedCredit={(semester, categoryCode, value) => {
                const userId = selectedStudentForCredits?.userId;
                if (!userId) return;
                setStudentEarnedCredit(userId, semester, categoryCode, value);
              }}
              onChangeEarnedUnit={(categoryCode, value) => {
                const userId = selectedStudentForCredits?.userId;
                if (!userId) return;
                setStudentEarnedUnit(userId, categoryCode, value);
              }}
              onSaveEarnedCredits={() => {
                const userId = selectedStudentForCredits?.userId;
                if (userId) void saveStudentCredits(userId);
              }}
            />
          </Suspense>
        ) : null}

        {principal && superView === "faculty-credit-table" ? (
          <Card>
            <CardContent>
              <Stack spacing={adminPageSx.pageStack.spacing}>
                <Box sx={adminPageSx.headerPanel}>
                  <Typography variant="h6">Student Credit Table</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {scopedDashboardRoleContext === "moderator"
                      ? "Credits recorded for all active students."
                      : "Credits recorded for students under your faculty mentoring scope."}
                  </Typography>
                </Box>
                <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading student credit table...</Typography>}>
                  <FacultyCreditDetailsTable rows={scopedDashboardCreditRows} busy={busy} />
                </Suspense>
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {principal && myAccount && superView === "account" ? (
          <Card>
            <CardContent>
              <Stack spacing={adminPageSx.pageStack.spacing}>
                <Box sx={adminPageSx.headerPanel}>
                  <Typography variant="h6">My Account</Typography>
                  <Typography variant="body2" color="text.secondary">Account details.</Typography>
                </Box>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Tabs
                    value={accountView}
                    onChange={(_, value: "profile" | "password" | "sessions") => {
                      setAccountView(value);
                      if (value === "sessions") {
                        void loadOtherSessionsCount();
                        void loadMySessions();
                      }
                    }}
                    sx={{ mb: 1 }}
                  >
                    <Tab value="profile" label="Profile" />
                    {canChangeOwnPassword && hasLocalPasswordAccount ? <Tab value="password" label="Password" /> : null}
                    <Tab value="sessions" label="Sessions" />
                  </Tabs>
                  {accountView === "profile" ? (
                    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                      {/* Profile hero */}
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: { xs: "column", sm: "row" },
                          alignItems: { xs: "center", sm: "flex-start" },
                          gap: 2.5,
                          p: { xs: 2, sm: 2.5 },
                          borderRadius: 2,
                          background: (theme) =>
                            `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.light, 0.03)} 100%)`,
                          border: "1px solid",
                          borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
                          mb: 2.5,
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 76,
                            height: 76,
                            fontSize: "1.875rem",
                            fontWeight: 700,
                            bgcolor: "primary.main",
                            boxShadow: 3,
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(myAccount.fullName || myAccount.email || myAccount.username || "")}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0, textAlign: { xs: "center", sm: "left" } }}>
                          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                            {myAccount.fullName || myAccount.username || "—"}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {myAccount.email || "No email configured"}
                          </Typography>
                          <Box
                            sx={{
                              mt: 1.25,
                              display: "flex",
                              gap: 0.75,
                              flexWrap: "wrap",
                              justifyContent: { xs: "center", sm: "flex-start" },
                            }}
                          >
                            {myAccount.roles.map((role) => (
                              <Chip key={role} label={role} size="small" color={ROLE_COLORS[role] ?? "default"} />
                            ))}
                            {myAccount.provider ? (
                              <Chip
                                label={myAccount.provider.charAt(0).toUpperCase() + myAccount.provider.slice(1)}
                                size="small"
                                variant="outlined"
                              />
                            ) : null}
                          </Box>
                        </Box>
                        {canEditOwnProfile && !editingMyName ? (
                          <Button
                            type="button"
                            startIcon={<EditIcon />}
                            variant="outlined"
                            size="small"
                            sx={{ flexShrink: 0, alignSelf: { xs: "center", sm: "flex-start" } }}
                            onClick={() => {
                              setFullNameInput(myAccount.fullName ?? "");
                              setEditingMyName(true);
                            }}
                            disabled={busy}
                          >
                            Edit Profile
                          </Button>
                        ) : null}
                      </Box>

                      {/* Details list */}
                      <Paper variant="outlined">
                        <Stack divider={<Divider />}>
                          {/* Full Name */}
                          <Box sx={{ px: 2.5, py: 2, display: "flex", alignItems: "center", gap: 2 }}>
                            <PersonIcon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                                Full Name
                              </Typography>
                              {editingMyName && canEditOwnProfile ? (
                                <TextField
                                  variant="standard"
                                  size="small"
                                  fullWidth
                                  label="Full name"
                                  autoFocus
                                  value={fullNameInput}
                                  onChange={(e) => setFullNameInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void saveMyAccountName();
                                    if (e.key === "Escape") {
                                      setEditingMyName(false);
                                      setFullNameInput(myAccount.fullName ?? "");
                                    }
                                  }}
                                  disabled={busy}
                                />
                              ) : (
                                <Typography
                                  variant="body1"
                                  sx={{ fontWeight: myAccount.fullName ? 500 : 400 }}
                                  color={myAccount.fullName ? "text.primary" : "text.disabled"}
                                >
                                  {myAccount.fullName || "Not set"}
                                </Typography>
                              )}
                            </Box>
                            {editingMyName && canEditOwnProfile ? (
                              <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
                                <Button
                                  type="button"
                                  variant="contained"
                                  size="small"
                                  onClick={() => { void saveMyAccountName(); }}
                                  disabled={busy}
                                >
                                  Save
                                </Button>
                                <Button
                                  type="button"
                                  variant="outlined"
                                  size="small"
                                  onClick={() => {
                                    setEditingMyName(false);
                                    setFullNameInput(myAccount.fullName ?? "");
                                  }}
                                  disabled={busy}
                                >
                                  Cancel
                                </Button>
                              </Stack>
                            ) : null}
                          </Box>

                          {/* Email */}
                          <Box sx={{ px: 2.5, py: 2, display: "flex", alignItems: "center", gap: 2 }}>
                            <EmailIcon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                                Email Address
                              </Typography>
                              <Typography
                                variant="body1"
                                sx={{ fontWeight: myAccount.email ? 500 : 400 }}
                                color={myAccount.email ? "text.primary" : "text.disabled"}
                              >
                                {myAccount.email || "Not configured"}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Username */}
                          <Box sx={{ px: 2.5, py: 2, display: "flex", alignItems: "center", gap: 2 }}>
                            <AccountCircleIcon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                                Username
                              </Typography>
                              <Typography
                                variant="body1"
                                sx={{ fontWeight: myAccount.username ? 500 : 400 }}
                                color={myAccount.username ? "text.primary" : "text.disabled"}
                              >
                                {myAccount.username || "Not set"}
                              </Typography>
                            </Box>
                          </Box>
                        </Stack>
                      </Paper>
                    </Box>
                  ) : null}
                  {accountView === "password" && canChangeOwnPassword && myAccount.username ? (
                    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                      {/* Password section header */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          p: 2,
                          borderRadius: 2,
                          bgcolor: "action.hover",
                          border: "1px solid",
                          borderColor: "divider",
                          mb: 2.5,
                        }}
                      >
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            bgcolor: (theme) => alpha(theme.palette.warning.main, 0.12),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <LockPersonIcon sx={{ color: "warning.main" }} />
                        </Box>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Change Password</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Update your local account password. Choose something strong.
                          </Typography>
                        </Box>
                      </Box>

                      <form onSubmit={changePassword} aria-label="Change password">
                        <Paper variant="outlined" sx={{ mb: 2.5 }}>
                          <Stack divider={<Divider />}>
                            <Box sx={{ px: 2.5, py: 2, display: "flex", alignItems: "center", gap: 2 }}>
                              <PersonIcon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                                  Username
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 500 }}>{myAccount.username}</Typography>
                              </Box>
                            </Box>
                            <Box sx={{ px: 2.5, py: 2 }}>
                              <TextField
                                variant="standard"
                                size="small"
                                fullWidth
                                label="Current password"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                autoComplete="current-password"
                              />
                            </Box>
                            <Box sx={{ px: 2.5, py: 2 }}>
                              <TextField
                                variant="standard"
                                size="small"
                                fullWidth
                                label="New password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                autoComplete="new-password"
                              />
                            </Box>
                          </Stack>
                        </Paper>
                        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                          <Button type="submit" variant="contained" disabled={busy} startIcon={<LockPersonIcon />}>
                            Update Password
                          </Button>
                        </Box>
                      </form>
                    </Box>
                  ) : null}
                  {accountView === "password" && canChangeOwnPassword && !myAccount.username ? (
                    <Box sx={{ p: { xs: 2, sm: 2.5 }, display: "flex", alignItems: "center", gap: 2 }}>
                      <LockPersonIcon sx={{ color: "text.disabled" }} />
                      <Typography variant="body2" color="text.secondary">
                        No local password is configured for this account.
                      </Typography>
                    </Box>
                  ) : null}
                  {accountView === "sessions" ? (
                    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                      {/* Sessions header */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          p: 2,
                          borderRadius: 2,
                          bgcolor: "action.hover",
                          border: "1px solid",
                          borderColor: "divider",
                          mb: 2.5,
                        }}
                      >
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            bgcolor: (theme) => alpha(theme.palette.info.main, 0.12),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <HistoryIcon sx={{ color: "info.main" }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Active Sessions</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Your account sessions across devices and browsers.
                          </Typography>
                        </Box>
                        {otherSessionsCount > 0 ? (
                          <Chip label={`${otherSessionsCount} other`} size="small" variant="outlined" />
                        ) : null}
                      </Box>

                      {/* Session cards */}
                      <Stack spacing={2} sx={{ mb: 2.5 }}>
                        {mySessions.length === 0 ? (
                          <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
                            <Typography variant="body2" color="text.disabled">No active sessions found.</Typography>
                          </Paper>
                        ) : (
                          mySessions.map((session) => (
                            <Paper
                              key={session.id}
                              variant="outlined"
                              sx={{ borderColor: session.isCurrent ? "primary.main" : "divider" }}
                            >
                              <Box sx={{ p: 2.5, display: "flex", alignItems: "flex-start", gap: 2 }}>
                                <ComputerIcon
                                  sx={{
                                    color: session.isCurrent ? "primary.main" : "text.secondary",
                                    flexShrink: 0,
                                    mt: 0.25,
                                  }}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                      {session.isCurrent ? "This Device" : "Other Device"}
                                    </Typography>
                                    {session.isCurrent ? (
                                      <Chip label="Current" size="small" color="primary" />
                                    ) : null}
                                  </Box>
                                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 1.5, sm: 3 } }}>
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Created</Typography>
                                      <Typography variant="body2">{formatIst(session.createdAt)}</Typography>
                                    </Box>
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Last Seen</Typography>
                                      <Typography variant="body2">{formatIst(session.lastSeenAt)}</Typography>
                                    </Box>
                                    <Box>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Expires</Typography>
                                      <Typography variant="body2">{formatIst(session.expiresAt)}</Typography>
                                    </Box>
                                  </Box>
                                </Box>
                              </Box>
                            </Paper>
                          ))
                        )}
                      </Stack>

                      {/* Danger zone */}
                      {otherSessionsCount > 0 ? (
                        <Paper
                          variant="outlined"
                          sx={{
                            borderRadius: 2,
                            borderColor: (theme) => alpha(theme.palette.error.main, 0.35),
                            bgcolor: (theme) => alpha(theme.palette.error.main, 0.04),
                            p: 2.5,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 2,
                            flexWrap: "wrap",
                          }}
                        >
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }} color="error.main">
                              Sign out other sessions
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Remove access from {otherSessionsCount} other active session{otherSessionsCount !== 1 ? "s" : ""}.
                            </Typography>
                          </Box>
                          <Button
                            type="button"
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<LogoutIcon />}
                            disabled={busy}
                            onClick={() => { void logoutOtherSessions(); }}
                          >
                            Logout Other Sessions
                          </Button>
                        </Paper>
                      ) : null}
                    </Box>
                  ) : null}
                </Paper>
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        </Box>
        <Box sx={{ mt: "auto", pt: 1.5, pb: 0.5, borderTop: "1px solid", borderColor: "divider" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="caption" color="text.disabled" aria-live="polite" aria-atomic="true">{status}</Typography>
            <Typography variant="caption" color="text.disabled" sx={{ ml: "auto", textAlign: "right" }}>
              {`© ${new Date().getFullYear()} ${ORG_NAME}`}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Password reset dialog — replaces window.prompt() */}
      <Dialog
        open={Boolean(resetPasswordTarget)}
        onClose={() => setResetPasswordTarget(null)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="reset-password-dialog-title"
      >
        <DialogTitle id="reset-password-dialog-title">
          Reset Password
          {resetPasswordTarget ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {resetPasswordTarget.username || resetPasswordTarget.subject}
            </Typography>
          ) : null}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              label="New password"
              type="password"
              value={resetPasswordValue}
              onChange={(e) => { setResetPasswordValue(e.target.value); setResetPasswordError(""); }}
              error={Boolean(resetPasswordError)}
              helperText={
                resetPasswordError
                  ? resetPasswordError
                  : resetPasswordValue.length > 0 && resetPasswordValue.length < 8
                    ? `${resetPasswordValue.length}/8 characters minimum`
                    : resetPasswordValue.length >= 8
                      ? "Strength: good"
                      : "At least 8 characters"
              }
              slotProps={{ input: { autoComplete: "new-password" } }}
            />
            <TextField
              fullWidth
              label="Confirm new password"
              type="password"
              value={resetPasswordConfirm}
              onChange={(e) => { setResetPasswordConfirm(e.target.value); setResetPasswordError(""); }}
              error={Boolean(resetPasswordError && resetPasswordConfirm.length > 0)}
              helperText={
                resetPasswordConfirm.length > 0 && resetPasswordValue !== resetPasswordConfirm
                  ? "Passwords do not match"
                  : " "
              }
              slotProps={{ input: { autoComplete: "new-password" } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetPasswordTarget(null)} disabled={busy}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={busy || resetPasswordValue.length < 8 || resetPasswordValue !== resetPasswordConfirm}
            onClick={() => { void submitPasswordReset(); }}
          >
            Reset Password
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(csvImportResult)}
        onClose={() => setCsvImportResult(null)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="csv-import-result-dialog-title"
      >
        <DialogTitle id="csv-import-result-dialog-title">CSV Import Result</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {csvImportResult?.created ?? 0} created · {csvImportResult?.failed ?? 0} failed
          </Typography>
          {csvImportResult && csvImportResult.errors.length > 0 ? (
            <Box sx={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0.75 }}>
              {csvImportResult.errors.map((err, i) => (
                <Alert key={i} severity="warning" sx={{ py: 0.25 }}>{err}</Alert>
              ))}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCsvImportResult(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(studentCsvImportResult)}
        onClose={() => setStudentCsvImportResult(null)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="student-csv-import-result-dialog-title"
      >
        <DialogTitle id="student-csv-import-result-dialog-title">Student CSV Import Result</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {studentCsvImportResult?.imported ?? 0} imported · {studentCsvImportResult?.failed ?? 0} failed
          </Typography>
          {studentCsvImportResult && studentCsvImportResult.errors.length > 0 ? (
            <Box sx={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0.75 }}>
              {studentCsvImportResult.errors.map((err, i) => (
                <Alert key={i} severity="warning" sx={{ py: 0.25 }}>{err}</Alert>
              ))}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStudentCsvImportResult(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
    </DateTimeProvider>
  );
}

export default App;



