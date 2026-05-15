import { Fragment, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Alert, AppBar, Avatar, Box, Button, Card, CardContent, Chip, Collapse, Divider, Drawer, FormControl, IconButton, InputAdornment, InputLabel, LinearProgress, List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Select, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Toolbar, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery } from "@mui/material";
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
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
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
  GOOGLE_CLIENT_ID,
  GOOGLE_IDP_SCRIPT_SRC,
  TAB_SESSION_MARKER_KEY,
  SESSION_REGULATIONS_CACHE_KEY,
  SESSION_PLAN_OF_STUDY_CACHE_KEY,
  SESSION_PLAN_VALIDATION_CACHE_KEY,
  SESSION_PROGRAMMES_CACHE_KEY
} from "./constants";
import { formatIst, formatIstHourMinute } from "./dateTime";
import { parseCsvRecords } from "./csv";
import { getInitials } from "./utils";
import type {
  ActiveUserRow,
  AdminCacheEntry,
  AdminCacheKey,
  AdminDashboard,
  FailedLoginRow,
  FacultyStudentRow,
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
  const [superView, setSuperView] = useState<"dashboard" | "regulations" | "students-directory" | "account" | "session-admin" | "logs" | "activity-logs" | "active-users" | "all-users" | "login-activity">("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [sessionTarget, setSessionTarget] = useState("");
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
  const [facultyStudentRows, setFacultyStudentRows] = useState<FacultyStudentRow[]>([]);
  const [facultyStudentsFilter, setFacultyStudentsFilter] = useState<"mentoring" | "completed">("mentoring");
  const [mentorNameOptions, setMentorNameOptions] = useState<string[]>([]);
  const [programmeOptions, setProgrammeOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [regulationTab, setRegulationTab] = useState(0);
  const [plansOfStudy, setPlansOfStudy] = useState<PlanOfStudy[]>([]);
  const [plansValidationReport, setPlansValidationReport] = useState<PlansValidationReport | null>(null);
  const [planOfStudyTab, setPlanOfStudyTab] = useState(0);
  const [userCursor, setUserCursor] = useState<string | null>(null);
  const [userHasMore, setUserHasMore] = useState(false);
  const [studentsDirectoryCursor, setStudentsDirectoryCursor] = useState<string | null>(null);
  const [studentsDirectoryHasMore, setStudentsDirectoryHasMore] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoles, setNewUserRoles] = useState<string[]>(["student"]);
  const [bulkCsvFileName, setBulkCsvFileName] = useState("");
  const [studentsCsvFileName, setStudentsCsvFileName] = useState("");
  const [userGlobalFilter, setUserGlobalFilter] = useState("");
  const sessionCheckRef = useRef<{ checkedAt: number; ok: boolean }>({ checkedAt: 0, ok: false });
  const strictRevalidateRef = useRef(0);
  const tabIdRef = useRef("");
  const authSyncInFlightRef = useRef(false);
  const googleIdpInitializedRef = useRef(false);
  const adminReadCacheRef = useRef<Partial<Record<AdminCacheKey, AdminCacheEntry>>>({});
  const adminCacheSessionKeyRef = useRef<string | null>(null);

  const isSuperAdmin = useMemo(() => Boolean(principal?.isSuperuser), [principal]);
  const isAdmin = useMemo(() => Boolean(principal?.roles.includes("admin")), [principal]);
  const hasStudentRole = useMemo(() => Boolean(principal?.roles.includes("student")), [principal]);
  const hasFacultyRole = useMemo(() => Boolean(principal?.roles.includes("faculty")), [principal]);
  const hasHeadRole = useMemo(() => Boolean(principal?.roles.includes("head")), [principal]);
  const hasModeratorRole = useMemo(() => Boolean(principal?.roles.includes("moderator")), [principal]);
  const hasGuestRole = useMemo(() => Boolean(principal?.roles.includes("guest")), [principal]);
  const theme = useTheme();
  const echartsTheme = theme.palette.mode === "dark" ? "dark" : undefined;
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
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
  const canChangeOwnPassword = canEditOwnProfile;

  useEffect(() => {
    if (!status || status === "Loading...") return;
    const timeoutId = window.setTimeout(() => {
      setStatus((current) => (current === status ? "" : current));
    }, STATUS_AUTO_HIDE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [status]);

  function getCachedAdminPayload<T>(key: AdminCacheKey, ttlMs: number): T | null {
    const entry = adminReadCacheRef.current[key];
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > ttlMs) return null;
    return entry.payload as T;
  }

  function setCachedAdminPayload<T>(key: AdminCacheKey, payload: T) {
    adminReadCacheRef.current[key] = { cachedAt: Date.now(), payload };
  }

  function invalidateAdminCache(keys?: AdminCacheKey[]) {
    if (!keys) {
      adminReadCacheRef.current = {};
      return;
    }
    for (const key of keys) {
      delete adminReadCacheRef.current[key];
    }
  }

  function getPrincipalCacheSessionKey(nextPrincipal: Principal | null | undefined): string | null {
    if (!nextPrincipal) return null;
    return `${nextPrincipal.provider}|${nextPrincipal.subject}`;
  }

  function bindAdminCacheToSession(nextPrincipal: Principal | null | undefined) {
    const nextKey = getPrincipalCacheSessionKey(nextPrincipal);
    if (adminCacheSessionKeyRef.current !== nextKey) {
      invalidateAdminCache();
      adminCacheSessionKeyRef.current = nextKey;
    }
  }

  function readSessionJson<T>(key: string): T | null {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  function writeSessionJson<T>(key: string, payload: T) {
    try {
      sessionStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // Best-effort cache write; ignore storage quota or availability errors.
    }
  }

  function clearSessionDataCaches() {
    sessionStorage.removeItem(SESSION_REGULATIONS_CACHE_KEY);
    sessionStorage.removeItem(SESSION_PLAN_OF_STUDY_CACHE_KEY);
    sessionStorage.removeItem(SESSION_PLAN_VALIDATION_CACHE_KEY);
    sessionStorage.removeItem(SESSION_PROGRAMMES_CACHE_KEY);
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
        width: 360,
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
  const selectedRegulationCode = useMemo(() => {
    if (regulations.length === 0) return null;
    const activeIndex = Math.min(regulationTab, regulations.length - 1);
    const active = regulations[activeIndex];
    return active?.code ?? null;
  }, [regulations, regulationTab]);
  const filteredPlansOfStudy = useMemo(() => {
    if (!selectedRegulationCode) return [];
    return plansOfStudy.filter((plan) => plan.regulationCode === selectedRegulationCode);
  }, [plansOfStudy, selectedRegulationCode]);
  const planOfStudyOptions = useMemo(
    () =>
      plansOfStudy
        .map((plan) => ({ code: Number(plan.planCode), name: String(plan.planName ?? "").trim() || `Plan ${plan.planCode}` }))
        .filter((item) => Number.isInteger(item.code))
        .sort((a, b) => a.code - b.code),
    [plansOfStudy]
  );
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
    const res = await callApi("/api/admin/dashboard", "GET");
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
      setStatus(`Unable to load logs: ${res.error ?? "Unknown error"}`);
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
      setStatus(`Unable to load activity logs: ${res.error ?? "Unknown error"}`);
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
      setStatus(`Unable to load active users: ${res.error ?? "Unknown error"}`);
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
      setStatus(`Unable to load login activity: ${res.error ?? "Unknown error"}`);
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
    setSuperView("login-activity");
    await loadLoginActivity();
  }

  async function loadUsers(cursor?: string | null, options?: { force?: boolean }) {
    const force = Boolean(options?.force);
    const cacheKey: AdminCacheKey = "users:first";
    if (!cursor && !force) {
      const cached = getCachedAdminPayload<{ rows: UserRow[]; nextCursor: string | null; hasMore: boolean }>(cacheKey, ADMIN_CACHE_TTL_MS.users);
      if (cached) {
        setUserRows(cached.rows);
        setUserCursor(cached.nextCursor);
        setUserHasMore(cached.hasMore);
        return;
      }
    }
    const searchParam = userGlobalFilter.trim();
    const query = new URLSearchParams();
    query.set("limit", "100");
    if (cursor) query.set("cursor", cursor);
    if (searchParam) query.set("q", searchParam);
    const res = await callApi(`/api/admin/users?${query.toString()}`, "GET");
    if (!res.ok) {
      setStatus(`Unable to load users: ${res.error ?? "Unknown error"}`);
      return;
    }
    const rows = (res.rows ?? []) as unknown as UserRow[];
    setUserRows((prev) => (cursor ? [...prev, ...rows] : rows));
    setUserCursor(res.page?.nextCursor ?? null);
    setUserHasMore(Boolean(res.page?.hasMore));
    if (!cursor) {
      setCachedAdminPayload(cacheKey, {
        rows,
        nextCursor: res.page?.nextCursor ?? null,
        hasMore: Boolean(res.page?.hasMore),
      });
    }
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
      setStatus(`Unable to load regulations: ${res.error ?? "Unknown error"}`);
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
      setStatus(`Unable to load plans of study: ${res.error ?? "Unknown error"}`);
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
      sessionStorage.removeItem(SESSION_PLAN_VALIDATION_CACHE_KEY);
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
      setStatus(`Unable to load students directory: ${res.error ?? "Unknown error"}`);
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

  async function loadFacultyStudents(options?: { force?: boolean }) {
    const force = Boolean(options?.force);
    const cacheKey: AdminCacheKey = "faculty-students:first";
    if (!force) {
      const cached = getCachedAdminPayload<FacultyStudentRow[]>(cacheKey, ADMIN_CACHE_TTL_MS.facultyStudents);
      if (cached) {
        setFacultyStudentRows(cached);
        return;
      }
    }
    const res = await callApi("/api/students?limit=100", "GET");
    if (!res.ok) {
      setStatus(`Unable to load mentored students: ${res.error ?? "Unknown error"}`);
      return;
    }
    const rows = Array.isArray(res.rows) ? res.rows : [];
    const normalizedRows: FacultyStudentRow[] = rows.map((row) => {
      const data = row as Record<string, unknown>;
      return {
        userId: String(data.user_id ?? ""),
        registrationNumber: data.registration_number == null ? null : String(data.registration_number),
        planOfStudyCode: data.plan_of_study_code == null ? null : Number(data.plan_of_study_code),
        batch: data.batch == null ? null : Number(data.batch),
        programme: data.programme == null ? null : Number(data.programme),
        duration: data.programme_duration == null ? null : Number(data.programme_duration),
        fullName: data.full_name == null ? null : String(data.full_name),
        email: data.email == null ? null : String(data.email),
        studentActive: Number(data.student_active ?? 0) === 1,
        mentorEmail: data.mentor_email == null ? null : String(data.mentor_email),
      };
    });
    setFacultyStudentRows(normalizedRows);
    setCachedAdminPayload(cacheKey, normalizedRows);
  }

  async function openFacultyStudentsDirectory(filter: "mentoring" | "completed") {
    setFacultyStudentsFilter(filter);
    setSuperView("students-directory");
    await loadProgrammes();
    await loadPlansOfStudy();
    await loadFacultyStudents();
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

  async function updateStudentsDirectoryRow(
    row: StudentDirectoryRow,
    patch: Pick<StudentDirectoryRow, "registrationNumber" | "planOfStudyCode" | "gender" | "section" | "mobileNumber" | "batch" | "programme" | "duration" | "mentorName">
  ) {
    if (!(await ensureActiveServerSession())) return;
    const registrationNumber = String(patch.registrationNumber ?? "").trim() || "Not Allotted";
    const planOfStudyCode =
      typeof patch.planOfStudyCode === "number" && Number.isInteger(patch.planOfStudyCode)
        ? patch.planOfStudyCode
        : null;
    const batch = typeof patch.batch === "number" && Number.isFinite(patch.batch) ? patch.batch : 2010;
    const programme =
      typeof patch.programme === "number" && Number.isInteger(patch.programme)
        ? patch.programme
        : 0;
    const duration = typeof patch.duration === "number" && Number.isFinite(patch.duration) ? patch.duration : 0;
    const gender = String(patch.gender ?? "").trim();
    const section = String(patch.section ?? "").trim();
    const mobileNumber = String(patch.mobileNumber ?? "").trim();
    const mentorName = String(patch.mentorName ?? "").trim();
    try {
      setBusy(true);
      const res = await callApi("/api/students-directory/update", "POST", undefined, {
        userId: row.userId,
        registrationNumber,
        planOfStudyCode,
        gender,
        section,
        mobileNumber,
        batch,
        programme,
        duration,
        mentorName,
      });
      if (!res.ok) {
        throw new Error(res.error ?? "Student update failed");
      }
      setStatus("Student updated.");
      invalidateAdminCache(["students-directory:first", "dashboard"]);
      await loadStudentsDirectory(undefined, { force: true });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Inline student update failed");
    } finally {
      setBusy(false);
    }
  }

  async function importStudentsFromCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!(await ensureActiveServerSession())) return;
    setStudentsCsvFileName(file.name);
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
      ["gender"],
      ["section"],
      ["mobile_number"],
      ["programme"],
      ["batch"],
      ["programme_duration"],
      ["mentor_email", "mentorEmail"],
    ];
    const hasAtLeastOneOptionalHeader = optionalHeaderGroups.some((group) => group.some((key) => headerIndex.has(key)));
    if (!hasAtLeastOneOptionalHeader) {
      setStatus(
        "CSV must include at least one optional student column header: registration_number, plan_of_study_code, gender, section, mobile_number, programme, batch, programme_duration, or mentor_email."
      );
      return;
    }

    const hasHeader = (key: string) => headerIndex.has(key);
    const rows = parsedRows.slice(1).map((cells) => {
      const get = (key: string) => String(cells[headerIndex.get(key) ?? -1] ?? "").trim();
      const row: Record<string, string | number> = { email: get("email") };
      if (hasHeader("registration_number")) {
        row.registration_number = get("registration_number");
      }
      if (hasHeader("plan_of_study_code")) {
        const raw = get("plan_of_study_code");
        row.plan_of_study_code = raw ? Number(raw) : "";
      }
      if (hasHeader("gender")) {
        row.gender = get("gender");
      }
      if (hasHeader("section")) {
        row.section = get("section");
      }
      if (hasHeader("mobile_number")) {
        row.mobile_number = get("mobile_number");
      }
      if (hasHeader("programme")) {
        const raw = get("programme");
        row.programme = raw ? Number(raw) : 0;
      }
      if (hasHeader("batch")) {
        row.batch = get("batch");
      }
      if (hasHeader("programme_duration")) {
        row.programme_duration = get("programme_duration");
      }
      if (hasHeader("mentor_email") || hasHeader("mentorEmail")) {
        row.mentorEmail = get("mentor_email") || get("mentorEmail");
      }
      return row;
    }).filter((row) => row.email);

    if (rows.length === 0) {
      setStatus("No valid student rows found in CSV.");
      return;
    }

    setBusy(true);
    setStatus("Importing students from CSV...");
    try {
      const res = await callApi("/api/import/students", "POST", undefined, { rows });
      if (!res.ok) {
        setStatus(`Student CSV import failed: ${res.error ?? "Unknown error"}`);
        return;
      }
      setStatus(`Student CSV import complete. Updated: ${rows.length}.`);
      invalidateAdminCache(["students-directory:first", "dashboard"]);
      await loadStudentsDirectory(undefined, { force: true });
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
    if (!payload.fullName || !payload.username || !payload.password || payload.roles.length === 0) {
      setStatus("Fill full name, username, password, and at least one role.");
      return;
    }
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
      const errorSuffix = errors.length > 0 ? ` First error: ${errors[0]}` : "";
      setStatus(`CSV import complete. Created: ${createdCount}, Failed: ${failedCount}.${errorSuffix}`);
    } finally {
      setBusy(false);
    }
  }

  async function resetUserPassword(row: UserRow) {
    if (row.provider !== "local") {
      setStatus("Password reset is available only for local users.");
      return;
    }
    if (!(await ensureActiveServerSession())) {
      return;
    }
    const newPassword = window.prompt(`Enter new password for ${row.username || row.subject}`);
    if (!newPassword) {
      return;
    }
    setBusy(true);
    setStatus("Resetting password...");
    try {
      const res = await callApi("/api/admin/users/reset-password", "POST", undefined, {
        subject: row.subject,
        newPassword
      });
      if (!res.ok) {
        setStatus(`Password reset failed: ${res.error ?? "Unknown error"}`);
        return;
      }
      setStatus("Password reset completed.");
    } finally {
      setBusy(false);
    }
  }

  type EditableUserRow = Partial<Pick<UserRow, "subject" | "fullName" | "email" | "username" | "roles" | "active">>;

  async function processUserGridRowUpdate(newRow: EditableUserRow, oldRow: EditableUserRow) {
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

    setStatus("User updated.");
    invalidateAdminCache(["users:first", "dashboard", "active-users:first"]);
    await loadUsers(undefined, { force: true });
    return newRow;
  }

  async function updateUserRow(row: UserRow, patch: Partial<{ fullName: string; email: string; username: string; roles: string[]; active: boolean }>) {
    const nextRow: EditableUserRow = {
      subject: row.subject,
      fullName: patch.fullName ?? (row.fullName || row.email || row.subject),
      roles: patch.roles ?? (row.roles.length > 0 ? row.roles : ["guest"]),
      active: patch.active ?? row.active,
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(patch.username !== undefined ? { username: patch.username } : {}),
    };
    const oldRow: EditableUserRow = {
      subject: row.subject,
      fullName: row.fullName || row.email || row.subject,
      roles: row.roles.length > 0 ? row.roles : ["guest"],
      active: row.active,
    };
    try {
      setBusy(true);
      await processUserGridRowUpdate(nextRow, oldRow);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Inline update failed");
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
    if (!principal || superView !== "dashboard" || !isAdmin) {
      return;
    }
    void loadDashboard();
  }, [principal, superView, isAdmin]);

  useEffect(() => {
    if (!principal || superView !== "dashboard" || !hasFacultyRole) {
      return;
    }
    void loadFacultyStudents();
  }, [principal, superView, hasFacultyRole]);

  useEffect(() => {
    if (!principal || superView !== "regulations") {
      return;
    }
    void loadRegulations();
    void loadPlansOfStudy();
  }, [principal, superView]);

  useEffect(() => {
    if (!principal || superView !== "students-directory") {
      return;
    }
    if (programmeOptions.length > 0) {
      if (plansOfStudy.length > 0) {
        return;
      }
      void loadPlansOfStudy();
      return;
    }
    void (async () => {
      await loadProgrammes();
      await loadPlansOfStudy();
    })();
  }, [principal, superView, programmeOptions.length, plansOfStudy.length]);

  useEffect(() => {
    if (!principal || superView !== "students-directory" || !hasFacultyRole) {
      return;
    }
    void loadFacultyStudents();
  }, [principal, superView, hasFacultyRole]);

  const facultyMentoringCount = useMemo(
    () => facultyStudentRows.filter((student) => student.studentActive).length,
    [facultyStudentRows]
  );
  const facultyCompletedCount = useMemo(
    () => facultyStudentRows.filter((student) => !student.studentActive).length,
    [facultyStudentRows]
  );
  const facultyStudentsDirectoryRows = useMemo<StudentDirectoryRow[]>(
    () =>
      facultyStudentRows
        .filter((student) => (facultyStudentsFilter === "mentoring" ? student.studentActive : !student.studentActive))
        .map((student) => ({
          userId: student.userId,
          fullName: student.fullName?.trim() || "Unnamed Student",
          email: student.email?.trim() || "",
          registrationNumber: student.registrationNumber?.trim() || "Not Allotted",
          planOfStudyCode: student.planOfStudyCode,
          gender: "",
          section: "",
          mobileNumber: "",
          batch: student.batch,
          programme: student.programme,
          duration: student.duration,
          mentorName: principal?.fullName?.trim() || "Assigned Faculty",
        })),
    [facultyStudentRows, facultyStudentsFilter, principal?.fullName]
  );

  useEffect(() => {
    if (filteredPlansOfStudy.length === 0) {
      if (planOfStudyTab !== 0) setPlanOfStudyTab(0);
      return;
    }
    if (planOfStudyTab > filteredPlansOfStudy.length - 1) {
      setPlanOfStudyTab(0);
    }
  }, [filteredPlansOfStudy.length, planOfStudyTab]);

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

  async function logout() {
    await callApi("/api/auth/logout", "POST");
    sessionCheckRef.current = { checkedAt: Date.now(), ok: false };
    setSessionTakenOver(false);
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
    setStatus("Logged out");
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

  async function forceLogoutAllSessionsForUser(e: FormEvent) {
    e.preventDefault();
    if (!(await ensureActiveServerSession())) {
      return;
    }
    const identifier = sessionTarget.trim();
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
      setSessionTarget("");
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
              setSuperView("dashboard");
              if (isAdmin) {
                await loadDashboard();
              }
            }
          })();
        },
      }],
    }] : []),
    ...((principal && (hasStudentRole || hasFacultyRole || hasHeadRole || hasModeratorRole || isAdmin)) ? [{
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
                    setSuperView("regulations");
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
                    setSuperView("students-directory");
                    await loadProgrammes({ force: true });
                    await loadPlansOfStudy();
                    if (hasFacultyRole && !(isAdmin || hasHeadRole || hasModeratorRole)) {
                      setFacultyStudentsFilter("mentoring");
                      await loadFacultyStudents();
                    } else {
                      await loadStudentsDirectory();
                    }
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
                    setSuperView("logs");
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
                    setSuperView("activity-logs");
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
                  setSuperView("all-users");
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
                  setSuperView("login-activity");
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
                  setSuperView("active-users");
                  await loadActiveUsers();
                }
              })();
            },
          },
          {
            id: "session-admin",
            label: "Force Logout User",
            icon: <LogoutIcon fontSize="small" />,
            active: superView === "session-admin",
            onClick: () => {
              void (async () => {
                if (await ensureActiveServerSession()) {
                  setSuperView("session-admin");
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
              onClick={() => void runStep("/api/setup/run-migrations", "Database setup")}
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
            <Typography variant="caption" color="text.disabled">{status}</Typography>
            <Typography variant="caption" color="text.disabled" sx={{ ml: "auto", textAlign: "right" }}>
              {`© ${new Date().getFullYear()} ${ORG_NAME}`}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
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
                <MenuItem
                  sx={{ fontSize: "0.8rem" }}
                  onClick={() => {
                    setSuperView("account");
                    setAccountView("profile");
                    setProfileAnchorEl(null);
                    void ensureActiveServerSession();
                  }}
                >
                  <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                  My Account
                </MenuItem>
                <MenuItem
                  sx={{ fontSize: "0.8rem" }}
                  onClick={() => {
                    setProfileAnchorEl(null);
                    void logout();
                  }}
                >
                  <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                  Sign Out
                </MenuItem>
              </Menu>
            </Stack>
          ) : (
            <Chip label="Not signed in" />
          )}
        </Toolbar>
      </AppBar>
      {principal ? (
        <Box component="nav">
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
            <Toolbar sx={{ minHeight: 62, gap: 1 }}>
              <Box component="img" src="/favicons/android-chrome-1024x1024.png" alt={APP_NAME_SHORT} sx={{ width: 20, height: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{APP_NAME_SHORT}</Typography>
            </Toolbar>
            <Box sx={{ py: 0.5 }}>
              {renderSidebarNav()}
            </Box>
          </Drawer>
        </Box>
      ) : null}
      <Box
        component="main"
        sx={{
          ml: principal && isDesktop ? `${ADMIN_DRAWER_WIDTH}px` : 0,
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
          <Box
            sx={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              bgcolor: "#f0f4f8",
            }}
          >
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
              <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: -0.5, position: "relative", textAlign: "center" }}>
                {APP_NAME_SHORT}
              </Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.82, maxWidth: 340, position: "relative", textAlign: "center" }}>
                {APP_NAME_FULL}
              </Typography>
              <Box sx={{ width: 48, height: 3, borderRadius: 2, bgcolor: "rgba(255,255,255,0.38)", my: 0.5, position: "relative" }} />
              <Typography variant="body2" sx={{ opacity: 0.65, letterSpacing: 1.2, textTransform: "uppercase", fontSize: "0.7rem", position: "relative" }}>
                {ORG_NAME}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.48, mt: 0.25, position: "relative" }}>
                Academic Management Portal
              </Typography>
            </Box>

            {/* Right login panel */}
            <Box
              sx={{
                width: { xs: "100%", md: 480 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                bgcolor: "#fff",
                p: { xs: 3, sm: 5 },
              }}
            >
              {/* Mobile-only branding */}
              <Box sx={{ display: { xs: "block", md: "none" }, textAlign: "center", mb: 3 }}>
                <Box component="img" src="/favicons/android-chrome-1024x1024.png" alt={APP_NAME_SHORT} sx={{ width: 60, height: 60, mb: 1.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{APP_NAME_SHORT}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{ORG_NAME}</Typography>
              </Box>

              <Box sx={{ width: "100%", maxWidth: 360 }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, textAlign: "center" }}>
                  Welcome back
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, textAlign: "center" }}>
                  Sign in to your academic portal
                </Typography>

                <Stack spacing={1.25}>
                  {/* Primary: SSO / OAuth buttons */}
                  {GOOGLE_CLIENT_ID ? (
                    <Box sx={{ display: "flex", justifyContent: "center" }}>
                      <Box id="google-signin-button" sx={{ width: "100%" }} />
                    </Box>
                  ) : null}

                  {/* Divider between SSO and local login */}
                  {GOOGLE_CLIENT_ID ? (
                    <Divider sx={{ my: 0.25 }}>
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.7rem" }}>or</Typography>
                    </Divider>
                  ) : null}

                  {/* Secondary: local credentials — toggle link when SSO is available */}
                  {GOOGLE_CLIENT_ID && !showLocalLogin ? (
                    <Box sx={{ textAlign: "center" }}>
                      <Typography
                        component="button"
                        variant="caption"
                        onClick={() => setShowLocalLogin(true)}
                        sx={{ color: "text.disabled", fontSize: "0.72rem", cursor: "pointer", background: "none", border: "none", p: 0, "&:hover": { color: "text.secondary", textDecoration: "underline" } }}
                      >
                        Sign in with username &amp; password
                      </Typography>
                    </Box>
                  ) : (
                    <Collapse in={showLocalLogin} unmountOnExit>
                      <form onSubmit={onLogin}>
                        <Stack spacing={2}>
                          <TextField
                            variant="outlined"
                            fullWidth
                            type="text"
                            label="Username"
                            autoComplete="username"
                            value={loginUser}
                            onChange={(e) => setLoginUser(e.target.value)}
                            slotProps={{
                              input: {
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <PersonIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                                  </InputAdornment>
                                ),
                              },
                            }}
                          />
                          <TextField
                            variant="outlined"
                            fullWidth
                            type="password"
                            label="Password"
                            autoComplete="current-password"
                            value={loginPass}
                            onChange={(e) => setLoginPass(e.target.value)}
                            slotProps={{
                              input: {
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <LockPersonIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                                  </InputAdornment>
                                ),
                              },
                            }}
                          />
                          <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={busy}
                            type="submit"
                            sx={{
                              py: 1.5,
                              fontWeight: 600,
                              fontSize: "1rem",
                              borderRadius: 2,
                              background: "linear-gradient(90deg, #0d1b5e 0%, #1a3a8a 100%)",
                              boxShadow: "0 4px 14px rgba(13,27,94,0.30)",
                              "&:hover": {
                                background: "linear-gradient(90deg, #1a3a8a 0%, #2d52a0 100%)",
                                boxShadow: "0 6px 18px rgba(13,27,94,0.40)",
                              },
                            }}
                          >
                            Sign In
                          </Button>
                          {GOOGLE_CLIENT_ID ? (
                            <Box sx={{ textAlign: "center" }}>
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => setShowLocalLogin(false)}
                                sx={{ color: "text.disabled", fontSize: "0.75rem", textTransform: "none", "&:hover": { color: "text.secondary", bgcolor: "transparent" } }}
                              >
                                ← Back to sign-in options
                              </Button>
                            </Box>
                          ) : null}
                        </Stack>
                      </form>
                    </Collapse>
                  )}
                </Stack>

                <Box sx={{ mt: 5, pt: 3, borderTop: "1px solid", borderColor: "divider", textAlign: "center" }}>
                  <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 0.75 }}>
                    {APP_NAME_FULL}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ display: "block" }}>
                    {ORG_NAME} · Academic Management Portal
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

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
                  <Chip key={role} size="small" label={role} />
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
                          sx={{ p: 0, mt: 0.5 }}
                          onClick={() => { void (async () => { if (await ensureActiveServerSession()) { setSuperView("all-users"); await loadUsers(); } })(); }}
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
                          sx={{ p: 0, mt: 0.5 }}
                          onClick={() => {
                            void (async () => {
                              if (await ensureActiveServerSession()) {
                                setUserGlobalFilter("guest");
                                setSuperView("all-users");
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
                          sx={{ p: 0, mt: 0.5 }}
                          onClick={() => { void (async () => { if (await ensureActiveServerSession()) { setSuperView("active-users"); await loadActiveUsers(); } })(); }}
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
                                setSuperView("logs");
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
                                setSuperView("logs");
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
                      <Box sx={{ height: 220, mt: 1 }}>
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
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2, mt: isAdmin ? 2.5 : 0 }}>
                {hasStudentRole ? (
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Student</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Learning dashboard and assigned mentoring actions will appear here.</Typography>
                      <Box sx={{ mt: 1.5 }}><Button type="button" size="small" onClick={() => { setSuperView("account"); setAccountView("profile"); }}>Open My Account</Button></Box>
                    </CardContent>
                  </Card>
                ) : null}
                {hasFacultyRole ? (
                  <Card sx={!(hasStudentRole || hasHeadRole || hasModeratorRole) ? { gridColumn: { md: "1 / -1" } } : {}}>
                    <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 2.5 }}>
                        <Box>
                          <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                            <SchoolIcon fontSize="small" color="primary" />
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>My Students</Typography>
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            Students currently under your mentorship
                          </Typography>
                        </Box>
                        <Tooltip title="Refresh counts">
                          <IconButton size="small" onClick={() => { void loadFacultyStudents({ force: true }); }} disabled={busy}>
                            <RefreshIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                          gap: 2,
                        }}
                      >
                        <Paper
                          variant="outlined"
                          sx={{ borderRadius: 2, px: 3, py: 2.5, cursor: "pointer", transition: "box-shadow 0.15s", "&:hover": { boxShadow: 3 } }}
                          onClick={() => { void openFacultyStudentsDirectory("mentoring"); }}
                        >
                          <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 0.25 }}>
                            <SchoolIcon sx={{ fontSize: "0.85rem", color: "primary.main" }} />
                            <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1 }}>
                              Mentoring
                            </Typography>
                          </Stack>
                          <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.5 }}>
                            {facultyMentoringCount.toLocaleString()}
                          </Typography>
                          <Button
                            type="button"
                            size="small"
                            endIcon={<ArrowForwardIcon />}
                            sx={{ p: 0, mt: 1 }}
                            onClick={(e) => { e.stopPropagation(); void openFacultyStudentsDirectory("mentoring"); }}
                          >
                            View students
                          </Button>
                        </Paper>
                        <Paper
                          variant="outlined"
                          sx={{ borderRadius: 2, px: 3, py: 2.5, cursor: "pointer", transition: "box-shadow 0.15s", "&:hover": { boxShadow: 3 } }}
                          onClick={() => { void openFacultyStudentsDirectory("completed"); }}
                        >
                          <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 0.25 }}>
                            <CheckCircleOutlineIcon sx={{ fontSize: "0.85rem", color: "success.main" }} />
                            <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.6rem", letterSpacing: 1 }}>
                              Completed
                            </Typography>
                          </Stack>
                          <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15, mt: 0.5 }}>
                            {facultyCompletedCount.toLocaleString()}
                          </Typography>
                          <Button
                            type="button"
                            size="small"
                            endIcon={<ArrowForwardIcon />}
                            sx={{ p: 0, mt: 1 }}
                            onClick={(e) => { e.stopPropagation(); void openFacultyStudentsDirectory("completed"); }}
                          >
                            View students
                          </Button>
                        </Paper>
                      </Box>
                    </CardContent>
                  </Card>
                ) : null}
                {hasHeadRole ? (
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Head</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Department-level rollups and escalation insights will appear here.</Typography>
                      <Box sx={{ mt: 1.5 }}><Button type="button" size="small" onClick={() => { setSuperView("account"); setAccountView("profile"); }}>Open My Account</Button></Box>
                    </CardContent>
                  </Card>
                ) : null}
                {hasModeratorRole ? (
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Moderator</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Moderation review items and flagged activity summary will appear here.</Typography>
                      <Box sx={{ mt: 1.5 }}><Button type="button" size="small" onClick={() => { setSuperView("account"); setAccountView("profile"); }}>Open My Account</Button></Box>
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

                <Box sx={{ mt: 1.25, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                  <Chip
                    size="small"
                    clickable
                    onClick={() => setLogTypeFilters([])}
                    color={hasAnyLogTypeFilter ? "default" : "primary"}
                    variant={hasAnyLogTypeFilter ? "outlined" : "filled"}
                    label={`All: ${visibleLogRows.length}`}
                  />
                  <Chip
                    size="small"
                    clickable
                    onClick={() => toggleLogTypeFilter("status5xx")}
                    variant={isLogTypeSelected("status5xx") ? "filled" : "outlined"}
                    color="error"
                    label={`5xx: ${visibleLogRowsByType.status5xx.length}`}
                  />
                  <Chip
                    size="small"
                    clickable
                    onClick={() => toggleLogTypeFilter("status4xx")}
                    variant={isLogTypeSelected("status4xx") ? "filled" : "outlined"}
                    color="warning"
                    label={`4xx: ${visibleLogRowsByType.status4xx.length}`}
                  />
                  <Chip
                    size="small"
                    clickable
                    onClick={() => toggleLogTypeFilter("slow")}
                    variant={isLogTypeSelected("slow") ? "filled" : "outlined"}
                    color="info"
                    label={`Slow >1s: ${visibleLogRowsByType.slow.length}`}
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
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>Full name</TableCell>
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
                                <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200, cursor: "help" }}>
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
                <Box sx={{ mt: 1.25, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                  <Chip
                    size="small"
                    clickable
                    color={!hasAnyActivityLevelFilter && !hasAnyActivityStatusFilter && !hasAnyActivityEventFilter ? "primary" : "default"}
                    variant={!hasAnyActivityLevelFilter && !hasAnyActivityStatusFilter && !hasAnyActivityEventFilter ? "filled" : "outlined"}
                    label={`Total: ${activityLogRows.length}`}
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
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>Full name</TableCell>
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
                              />
                            </Box>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 200 }}>
                            {row.meta ? (
                              <Tooltip title={<Box component="pre" sx={{ m: 0, fontSize: "0.7rem" }}>{JSON.stringify(row.meta, null, 2)}</Box>} placement="left" arrow>
                                <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200, cursor: "help" }}>
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
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading active-users table...</Typography>}>
                    <ActiveUsersTable rows={activeUserRows} busy={busy} formatIst={formatIst} />
                  </Suspense>
                </Paper>
                {activeUserHasMore ? (
                  <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                    <Button
                      type="button"
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
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading failed-login table...</Typography>}>
                    <FailedLoginsTable rows={loginActivityRows} busy={busy} formatIst={formatIst} />
                  </Suspense>
                </Paper>
                {loginActivityHasMore ? (
                  <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                    <Button
                      type="button"
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
                    <Button
                      type="button"
                      variant={showAddUserForm ? "outlined" : "contained"}
                      startIcon={<PersonAddIcon />}
                      onClick={() => setShowAddUserForm((v) => !v)}
                      sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}
                    >
                      {showAddUserForm ? "Close Form" : "Add New User"}
                    </Button>
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

                    <form onSubmit={createUser}>
                      <Stack spacing={2.5} sx={{ p: 2.5 }}>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                          <TextField variant="standard" size="small" fullWidth type="text" label="Full name" value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} />
                          <TextField variant="standard" size="small" fullWidth type="text" label="Email (optional)" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                          <TextField variant="standard" size="small" fullWidth type="text" label="Username" value={newUserUsername} onChange={(e) => setNewUserUsername(e.target.value)} />
                        </Stack>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                          <TextField variant="standard" size="small" fullWidth type="password" label="Password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
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
                            Create User
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
                        {bulkCsvFileName ? (
                          <Typography variant="caption" color="primary.main">
                            Selected: {bulkCsvFileName}
                          </Typography>
                        ) : null}
                      </Box>
                      <Button component="label" variant="outlined" size="small" disabled={busy}>
                        Upload CSV
                        <input hidden accept=".csv,text/csv" type="file" onChange={createUsersFromCsvFile} />
                      </Button>
                    </Box>
                  </Paper>
                ) : null}

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading users table...</Typography>}>
                    <ManageUsersTable
                      rows={userRows}
                      busy={busy}
                      globalFilter={userGlobalFilter}
                      onGlobalFilterChange={(value) => setUserGlobalFilter(value)}
                      onResetPassword={(row) => {
                        void resetUserPassword(row);
                      }}
                      onUpdateRow={async (row, patch) => {
                        await updateUserRow(row, patch);
                      }}
                      formatIst={formatIst}
                    />
                  </Suspense>
                </Paper>
                {userHasMore ? (
                  <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                    <Button
                      type="button"
                      onClick={() => {
                        void loadUsers(userCursor);
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

        {principal && (isAdmin || hasHeadRole || hasModeratorRole || hasFacultyRole) && superView === "students-directory" ? (
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
                      <Typography variant="body2" color="text.secondary">
                        {hasFacultyRole && !(isAdmin || hasHeadRole || hasModeratorRole)
                          ? `${facultyStudentsDirectoryRows.length} ${facultyStudentsFilter === "mentoring" ? "mentoring" : "completed"} student account${facultyStudentsDirectoryRows.length === 1 ? "" : "s"} loaded`
                          : `${studentDirectoryRows.length} student account${studentDirectoryRows.length === 1 ? "" : "s"} loaded`}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "flex-end", alignSelf: { xs: "flex-start", sm: "flex-start" } }}>
                      <Tooltip title="Refresh" arrow>
                        <span>
                          <IconButton
                            size="small"
                            disabled={busy}
                            onClick={() => {
                              void (async () => {
                                await loadProgrammes({ force: true });
                                if (hasFacultyRole && !(isAdmin || hasHeadRole || hasModeratorRole)) {
                                  await loadFacultyStudents({ force: true });
                                } else {
                                  await loadStudentsDirectory(undefined, { force: true });
                                }
                              })();
                            }}
                          >
                            <RefreshIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.25, display: "block" }}>
                    Use table column filters and search to refine student results.
                  </Typography>
                  {hasFacultyRole && !(isAdmin || hasHeadRole || hasModeratorRole) ? (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      Showing only your {facultyStudentsFilter === "mentoring" ? "mentoring" : "completed"} students.
                    </Typography>
                  ) : null}
                  {!(hasFacultyRole && !(isAdmin || hasHeadRole || hasModeratorRole)) ? (
                    <>
                      <Box
                        sx={{
                          mt: 1.25,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1.5,
                          flexWrap: "wrap",
                        }}
                      >
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            <b>Bulk import via CSV.</b> Compulsory: <code>email</code>. Optional (at least one required): <code>registration_number</code>, <code>plan_of_study_code</code>, <code>gender</code>, <code>section</code>, <code>mobile_number</code>, <code>programme</code>, <code>batch</code>, <code>programme_duration</code>, <code>mentor_email</code>.
                          </Typography>
                          {studentsCsvFileName ? (
                            <Typography variant="caption" color="primary.main">
                              Selected: {studentsCsvFileName}
                            </Typography>
                          ) : null}
                        </Box>
                        {(isAdmin || hasModeratorRole) ? (
                          <Button component="label" variant="contained" color="primary" size="small" disabled={busy}>
                            Upload CSV
                            <input hidden accept=".csv,text/csv" type="file" onChange={importStudentsFromCsvFile} />
                          </Button>
                        ) : null}
                      </Box>
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          <b>Programme values:</b>{" "}
                          {programmeOptions.length > 0
                            ? programmeOptions.map((item) => `${item.id} - ${item.name}`).join(", ")
                            : "No programme values loaded."}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                          <b>Plan of Study values:</b>{" "}
                          {planOfStudyOptions.length > 0
                            ? planOfStudyOptions.map((item) => `${item.code} - ${item.name}`).join(", ")
                            : "No plan of study values loaded."}
                        </Typography>
                      </Box>
                    </>
                  ) : null}
                </Box>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading students directory table...</Typography>}>
                    <StudentsDirectoryTable
                      rows={hasFacultyRole && !(isAdmin || hasHeadRole || hasModeratorRole) ? facultyStudentsDirectoryRows : studentDirectoryRows}
                      busy={busy}
                      planOfStudyOptions={planOfStudyOptions}
                      mentorNameOptions={mentorNameOptions}
                      programmeOptions={programmeOptions}
                      canEdit={!(hasFacultyRole && !(isAdmin || hasHeadRole || hasModeratorRole))}
                      onUpdateRow={async (row, patch) => {
                        await updateStudentsDirectoryRow(row, patch);
                      }}
                    />
                  </Suspense>
                </Paper>
                {studentsDirectoryHasMore && !(hasFacultyRole && !(isAdmin || hasHeadRole || hasModeratorRole)) ? (
                  <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                    <Button type="button" onClick={() => { void loadStudentsDirectory(studentsDirectoryCursor); }}>
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
                            disabled={busy}
                            onClick={() => {
                              void loadRegulations({ force: true });
                              void loadPlansOfStudy({ force: true });
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
                  {plansValidationReport?.hasErrors ? (
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

              {regulations.length > 0 ? (
                <Paper variant="outlined">
                    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                      <Tabs
                        value={Math.min(regulationTab, regulations.length - 1)}
                        onChange={(_, v: number) => { setRegulationTab(v); }}
                        variant="scrollable"
                        scrollButtons="auto"
                      >
                        {regulations.map((reg, i) => (
                          <Tab
                            key={reg.code}
                            value={i}
                            label={
                              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                                <span>{reg.code}</span>
                                <Chip
                                  label={`${reg.curriculumStructure.totalCreditsRequired} cr`}
                                  size="small"
                                  sx={{ height: 18, fontSize: "0.68rem", pointerEvents: "none", mx: 0.25, my: 0.25 }}
                                />
                              </Stack>
                            }
                          />
                        ))}
                      </Tabs>
                    </Box>

                    {regulations.map((regulation, i) => {
                      if (i !== Math.min(regulationTab, regulations.length - 1)) return null;
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
                              <Chip label={`${total} credits required`} size="small" color="primary" sx={{ m: 0.25 }} />
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
                                    : String((category.rule as { type: string; value: number }).value);
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
                      No regulations found. Click Refresh to reload.
                    </Typography>
                  </Box>
                </Paper>
              )}

              {filteredPlansOfStudy.length > 0 ? (
                <Paper variant="outlined">
                    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                      <Tabs
                        value={Math.min(planOfStudyTab, filteredPlansOfStudy.length - 1)}
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
                                  label={`${computedPlanTotalCredits} cr`}
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
                      if (i !== Math.min(planOfStudyTab, filteredPlansOfStudy.length - 1)) return null;
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
                              <Chip label={`${computedPlanTotalCredits} credits planned`} size="small" color="primary" sx={{ m: 0.25 }} />
                            </Stack>
                          </Stack>

                          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ "& .MuiTableCell-head": { bgcolor: "action.hover", fontWeight: 700 } }}>
                                  <TableCell>Semester</TableCell>
                                  {categoryCodes.map((code) => (
                                    <TableCell key={`${plan.planCode}-${code}`} align="right">{code}</TableCell>
                                  ))}
                                  <TableCell align="right">Total</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {plan.semesters.map((semester) => (
                                  <TableRow key={`${plan.planCode}-sem-${semester.semester}`} hover>
                                    <TableCell>{semester.semester}</TableCell>
                                    {categoryCodes.map((code) => (
                                      <TableCell key={`${plan.planCode}-sem-${semester.semester}-${code}`} align="right">
                                        {Number(semester.categories?.[code] ?? 0)}
                                      </TableCell>
                                    ))}
                                    <TableCell align="right">
                                      <Chip label={semester.totalCredits} size="small" sx={{ m: 0.25 }} />
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow sx={{ "& .MuiTableCell-root": { fontWeight: 700 } }}>
                                  <TableCell>Total</TableCell>
                                  {categoryCodes.map((code) => (
                                    <TableCell key={`${plan.planCode}-tot-${code}`} align="right">
                                      {Number(computedCategoryTotals[code] ?? 0)}
                                    </TableCell>
                                  ))}
                                  <TableCell align="right">
                                    <Chip label={computedPlanTotalCredits} size="small" color="primary" sx={{ m: 0.25 }} />
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
                    {canChangeOwnPassword ? <Tab value="password" label="Password" /> : null}
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
                              <Chip key={role} label={role} size="small" color="primary" />
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

                      <form onSubmit={changePassword}>
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

        {principal && isAdmin && superView === "session-admin" ? (
          <Card>
            <CardContent>
              <Stack spacing={adminPageSx.pageStack.spacing}>
                <Box sx={adminPageSx.headerPanel}>
                  <Typography variant="h6" gutterBottom={false}>Force Logout User</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Revoke all active sessions for a user across all devices and browsers.
                  </Typography>
                </Box>

                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                  {/* Section header */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      px: 2,
                      py: 1.5,
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
                        bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <LogoutIcon sx={{ color: "error.main", fontSize: "1.1rem" }} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Revoke User Sessions</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Immediately terminates all active sessions for the target account.
                      </Typography>
                    </Box>
                  </Box>

                  <form onSubmit={forceLogoutAllSessionsForUser}>
                    <Stack spacing={2} sx={{ p: 2 }}>
                      {/* Warning callout */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 1,
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
                          border: "1px solid",
                          borderColor: (theme) => alpha(theme.palette.warning.main, 0.3),
                        }}
                      >
                        <WarningAmberIcon sx={{ color: "warning.main", fontSize: "1rem", mt: 0.15, flexShrink: 0 }} />
                        <Typography variant="caption" color="text.secondary">
                          This action is immediate and cannot be undone. The user will be signed out of all devices and browsers at once.
                        </Typography>
                      </Box>

                      <TextField
                        variant="outlined"
                        size="small"
                        fullWidth
                        label="Username / Email / Subject"
                        type="text"
                        placeholder="user@example.com · local-username · subject-id"
                        value={sessionTarget}
                        onChange={(e) => setSessionTarget(e.target.value)}
                      />

                      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                        <Button
                          type="submit"
                          variant="contained"
                          color="error"
                          startIcon={<LogoutIcon />}
                          disabled={busy || !sessionTarget.trim()}
                        >
                          Revoke All Sessions
                        </Button>
                      </Box>
                    </Stack>
                  </form>
                </Paper>
              </Stack>
            </CardContent>
          </Card>
        ) : null}
        </Box>
        <Box sx={{ mt: "auto", pt: 1.5, pb: 0.5, borderTop: "1px solid", borderColor: "divider" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="caption" color="text.disabled">{status}</Typography>
            <Typography variant="caption" color="text.disabled" sx={{ ml: "auto", textAlign: "right" }}>
              {`© ${new Date().getFullYear()} ${ORG_NAME}`}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default App;

