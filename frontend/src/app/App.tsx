import { Fragment, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactElement } from "react";
import { Alert, AppBar, Avatar, Box, Button, Card, CardContent, Checkbox, Chip, Collapse, Divider, Drawer, FormControl, IconButton, InputBase, InputLabel, LinearProgress, List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Select, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Toolbar, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
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
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { callApi, setCsrfToken } from "../shared/api/client";
import { APP_NAME_FULL, APP_NAME_SHORT, ORG_NAME } from "../shared/branding";

const TAB_SESSION_MARKER_KEY = "fa_tab_session_active";
const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
const GOOGLE_IDP_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const ManageUsersTable = lazy(() => import("./ManageUsersTable"));
const ActiveUsersTable = lazy(() => import("./ActiveUsersTable"));
const FailedLoginsTable = lazy(() => import("./FailedLoginsTable"));

type Principal = {
  subject: string;
  email?: string;
  fullName?: string;
  isSuperuser?: boolean;
  roles: string[];
  provider: string;
};

type MyAccount = {
  subject: string;
  email: string | null;
  fullName: string | null;
  roles: string[];
  provider: string;
  username: string | null;
};

type MySession = {
  id: string;
  createdAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string | null;
  isCurrent: boolean;
};

type AdminDashboard = {
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
};

type LogRow = {
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

type ActiveUserRow = {
  subject: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  roles: string[];
  sessionCount: number;
  lastSeenAt: string;
  latestExpiry: string;
};

type UserRow = {
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

type FailedLoginRow = {
  attemptRef: number;
  username: string;
  ipAddress: string;
  success: boolean;
  attemptedAt: string;
};
type LogTypeFilter = "status5xx" | "status4xx" | "slow";
type UserQuickFilter = "active" | "disabled" | "neverLoggedIn";
type LoginActivityQuickFilter = "all" | "success" | "failed";
type NavLeaf = { id: string; label: string; icon: ReactElement; active: boolean; disabled?: boolean; onClick: () => void };
type NavGroup = { id: string; label: string; icon: ReactElement; children: NavLeaf[] };
type NavItem = NavLeaf | NavGroup;
type NavSection = { label: string; items: NavItem[] };

type GoogleCredentialResponse = { credential?: string };

const ACTIVITY_LOGS_PAGE_SIZE = 25;
const ADMIN_DRAWER_WIDTH = 240;
const ADMIN_CACHE_TTL_MS = {
  dashboard: 60_000,
  logs: 20_000,
  activityLogs: 20_000,
  activeUsers: 20_000,
  failedLogins: 30_000,
  users: 30_000,
} as const;

type AdminCacheKey =
  | "dashboard"
  | "logs:error:first"
  | "logs:warn:first"
  | "activity:first"
  | "active-users:first"
  | "login-activity:first"
  | "users:first";

type AdminCacheEntry = { cachedAt: number; payload: unknown };

function formatIst(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const utcText = normalized.endsWith("Z") ? normalized : `${normalized}Z`;
  const date = new Date(utcText);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(date);
}

function formatIstHourMinute(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const utcText = normalized.endsWith("Z") ? normalized : `${normalized}Z`;
  const date = new Date(utcText);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function parseCsvRecords(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    const next = csvText[i + 1];
    if (ch === "\"") {
      if (inQuotes && next === "\"") {
        currentField += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") {
        i += 1;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentField = "";
      currentRow = [];
      continue;
    }
    currentField += ch;
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}

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

  const [bootstrapKey, setBootstrapKey] = useState("");
  const [adminUser, setAdminUser] = useState("admin");
  const [adminPass, setAdminPass] = useState("");
  const [myAccount, setMyAccount] = useState<MyAccount | null>(null);
  const [otherSessionsCount, setOtherSessionsCount] = useState(0);
  const [sessionTakenOver, setSessionTakenOver] = useState(false);
  const [fullNameInput, setFullNameInput] = useState("");
  const [editingMyName, setEditingMyName] = useState(false);
  const [editingMyNameWidth, setEditingMyNameWidth] = useState<number | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileAnchorEl, setProfileAnchorEl] = useState<HTMLElement | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [menuAnchors, setMenuAnchors] = useState<Record<string, HTMLElement | null>>({});
  const [accountView, setAccountView] = useState<"profile" | "password" | "sessions">("profile");
  const [mySessions, setMySessions] = useState<MySession[]>([]);
  const [superView, setSuperView] = useState<"dashboard" | "account" | "session-admin" | "logs" | "activity-logs" | "active-users" | "all-users" | "login-activity">("dashboard");
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
  const [userCursor, setUserCursor] = useState<string | null>(null);
  const [userHasMore, setUserHasMore] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRoles, setNewUserRoles] = useState<string[]>(["student"]);
  const [bulkCsvFileName, setBulkCsvFileName] = useState("");
  const [userQuickFilters, setUserQuickFilters] = useState<UserQuickFilter[]>([]);
  const [userRoleFilters, setUserRoleFilters] = useState<string[]>([]);
  const [userGlobalFilter, setUserGlobalFilter] = useState("");
  const [loginActivityQuickFilter, setLoginActivityQuickFilter] = useState<LoginActivityQuickFilter>("all");
  const sessionCheckRef = useRef<{ checkedAt: number; ok: boolean }>({ checkedAt: 0, ok: false });
  const strictRevalidateRef = useRef(0);
  const tabIdRef = useRef("");
  const authSyncInFlightRef = useRef(false);
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

  const userSummary = useMemo(() => {
    const total = userRows.length;
    const active = userRows.filter((row) => row.active).length;
    const disabled = total - active;
    const loaded = total;
    const neverLoggedIn = userRows.filter((row) => !row.lastLoginAt || row.lastLoginAt === row.createdAt).length;
    return { total, active, disabled, loaded, neverLoggedIn };
  }, [userRows]);
  const userRoleSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of userRows) {
      const normalizedRoles = (row.roles ?? []).map((role) => String(role ?? "").trim().toLowerCase()).filter(Boolean);
      if (normalizedRoles.length === 0) {
        counts.set("guest", (counts.get("guest") ?? 0) + 1);
        continue;
      }
      for (const role of normalizedRoles) {
        counts.set(role, (counts.get(role) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [userRows]);
  useEffect(() => {
    setUserQuickFilters((prev) =>
      prev.filter((filter) => {
        if (filter === "active") return userSummary.active > 0;
        if (filter === "disabled") return userSummary.disabled > 0;
        if (filter === "neverLoggedIn") return userSummary.neverLoggedIn > 0;
        return false;
      })
    );
  }, [userSummary.active, userSummary.disabled, userSummary.neverLoggedIn]);
  useEffect(() => {
    const availableRoles = new Set(userRoleSummary.map(([role]) => role));
    setUserRoleFilters((prev) => prev.filter((role) => availableRoles.has(role)));
  }, [userRoleSummary]);
  useEffect(() => {
    if (!hasSuperAdmin || principal || !GOOGLE_CLIENT_ID) {
      return;
    }
    const setupGoogleButton = () => {
      const googleApi = (window as unknown as { google?: any }).google;
      const container = document.getElementById("google-signin-button");
      if (!googleApi?.accounts?.id || !container) {
        return;
      }
      googleApi.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: GoogleCredentialResponse) => {
          void onGoogleCredential(response);
        },
      });
      container.innerHTML = "";
      googleApi.accounts.id.renderButton(container, {
        theme: "outline",
        size: "large",
        width: 320,
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
  const loginActivitySummary = useMemo(() => {
    const total = loginActivityRows.length;
    const success = loginActivityRows.filter((row) => row.success).length;
    const failed = total - success;
    return { total, success, failed };
  }, [loginActivityRows]);
  const visibleLoginActivityRows = useMemo(() => {
    if (loginActivityQuickFilter === "success") {
      return loginActivityRows.filter((row) => row.success);
    }
    if (loginActivityQuickFilter === "failed") {
      return loginActivityRows.filter((row) => !row.success);
    }
    return loginActivityRows;
  }, [loginActivityRows, loginActivityQuickFilter]);
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
  const dashboardTotalLogs = dashboardErrorLogs + dashboardWarnLogs;
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
          void openLoginActivity("success");
          return;
        }
        if (normalizedSeries === "failed") {
          void openLoginActivity("failed");
        }
      },
    }),
    []
  );
  const systemLogsChartOption = useMemo<EChartsOption>(() => {
    return {
      tooltip: {},
      legend: {},
      xAxis: {
        type: "category",
        data: ["Warning", "Error"],
      },
      yAxis: {
        type: "value",
        minInterval: 1,
      },
      series: [
        {
          name: "Logs",
          type: "bar",
          data: [
            { value: dashboardWarnLogs, itemStyle: { color: "#ed6c02" } },
            { value: dashboardErrorLogs, itemStyle: { color: "#d32f2f" } },
          ],
          label: { show: true },
        },
      ],
    };
  }, [dashboardWarnLogs, dashboardErrorLogs]);
  const systemLogsChartEvents = useMemo(
    () => ({
      click: (params: { name?: string; dataIndex?: number; value?: number }) => {
        const normalizedName = String(params?.name ?? "").toLowerCase();
        const dataIndex = Number(params?.dataIndex ?? -1);
        const value = Number(params?.value ?? 0);
        if (value <= 0) return;
        if (normalizedName === "warning" || dataIndex === 0) {
          void (async () => {
            if (await ensureActiveServerSession()) {
              setSuperView("logs");
              setLogLevel("warn");
              await loadLogs("warn");
            }
          })();
          return;
        }
        if (normalizedName === "error" || dataIndex === 1) {
          void (async () => {
            if (await ensureActiveServerSession()) {
              setSuperView("logs");
              setLogLevel("error");
              await loadLogs("error");
            }
          })();
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
    }
  }

  async function ensureActiveServerSession(): Promise<boolean> {
    if (sessionStorage.getItem(TAB_SESSION_MARKER_KEY) !== "1") {
      bindAdminCacheToSession(null);
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
        logging: res.logging
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

  async function openLoginActivity(filter: LoginActivityQuickFilter) {
    if (!(await ensureActiveServerSession())) {
      return;
    }
    setLoginActivityQuickFilter(filter);
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
    const hasActive = userQuickFilters.includes("active");
    const hasDisabled = userQuickFilters.includes("disabled");
    const activeParam = hasActive && !hasDisabled ? "true" : !hasActive && hasDisabled ? "false" : "";
    const neverLoggedInParam = userQuickFilters.includes("neverLoggedIn") ? "1" : "";
    const rolesParam = userRoleFilters
      .map((role) => String(role ?? "").trim().toLowerCase())
      .filter(Boolean)
      .join(",");
    const searchParam = userGlobalFilter.trim();
    const query = new URLSearchParams();
    query.set("limit", "100");
    if (cursor) query.set("cursor", cursor);
    if (activeParam) query.set("active", activeParam);
    if (neverLoggedInParam) query.set("neverLoggedIn", neverLoggedInParam);
    if (rolesParam) query.set("roles", rolesParam);
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

  useEffect(() => {
    if (!principal || !isAdmin || superView !== "all-users") return;
    const timeoutId = window.setTimeout(() => {
      void loadUsers(undefined, { force: true });
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [userQuickFilters, userRoleFilters, userGlobalFilter, principal, isAdmin, superView]);

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

  async function processUserGridRowUpdate(newRow: any, oldRow: any) {
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

    if (nextFullName !== currentFullName || nextRoles.join("|") !== currentRoles.join("|")) {
      const res = await callApi("/api/admin/users/update", "POST", undefined, {
        subject,
        fullName: nextFullName,
        roles: nextRoles
      });
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

  async function updateUserRow(row: UserRow, patch: Partial<{ fullName: string; roles: string[]; active: boolean }>) {
    const nextRow = {
      subject: row.subject,
      fullName: patch.fullName ?? (row.fullName || row.email || row.subject),
      roles: patch.roles ?? (row.roles.length > 0 ? row.roles : ["guest"]),
      active: patch.active ?? row.active,
    };
    const oldRow = {
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
      setPrincipal(null);
      setMyAccount(null);
      setOtherSessionsCount(0);
      setOpenGroups({});
      setMenuAnchors({});
      setStatus("Session moved to another tab. Please sign in again.");
      sessionStorage.removeItem(TAB_SESSION_MARKER_KEY);
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
      setEditingMyNameWidth(null);
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
    setEditingMyNameWidth(null);
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
              onClick: () => { void runStep("/api/setup/seed-data", "Seed data"); },
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
    pageStack: { spacing: 2 },
    headerPanel: {
      p: { xs: 1.25, sm: 1.5 },
      borderRadius: 2,
      border: "1px solid",
      borderColor: "divider",
      bgcolor: "action.hover",
    },
    sectionPanel: { p: 1.5, borderRadius: 2 },
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
              <TextField type="password" label="Bootstrap key" value={bootstrapKey} onChange={(e) => setBootstrapKey(e.target.value)} />
              <Box sx={{ height: 1 }} />
              <TextField type="text" label="Admin username" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} />
              <Box sx={{ height: 1 }} />
              <TextField type="password" label="Admin password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
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
                <Avatar sx={{ width: 22, height: 22, fontSize: "0.7rem", bgcolor: "primary.main" }}>
                  {displayName.charAt(0).toUpperCase()}
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
              <TextField type="password" label="Bootstrap key" value={bootstrapKey} onChange={(e) => setBootstrapKey(e.target.value)} />
              <Box sx={{ height: 1 }} />
              <TextField type="text" label="Admin username" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} />
              <Box sx={{ height: 1 }} />
              <TextField type="password" label="Admin password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
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
          <Box sx={{ maxWidth: 400, mx: "auto", mt: { xs: 6, md: 10 } }}>
            <Stack spacing={1} sx={{ mb: 3, alignItems: "center" }}>
              <Box component="img" src="/favicons/android-chrome-1024x1024.png" alt={APP_NAME_SHORT} sx={{ width: 48, height: 48 }} />
              <Typography variant="h5" sx={{ textAlign: "center" }}>{`${APP_NAME_FULL} (${APP_NAME_SHORT})`}</Typography>
              <Typography variant="body2" color="text.secondary">Sign in to your account</Typography>
            </Stack>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <form onSubmit={onLogin}>
                  <Stack spacing={2}>
                    <TextField fullWidth type="text" label="Username" autoComplete="username" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} />
                    <TextField fullWidth type="password" label="Password" autoComplete="current-password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
                    <Button fullWidth variant="contained" size="large" disabled={busy} type="submit">
                      Sign In
                    </Button>
                    {GOOGLE_CLIENT_ID ? (
                      <>
                        <Divider>or</Divider>
                        <Box sx={{ display: "flex", justifyContent: "center" }}>
                          <Box id="google-signin-button" />
                        </Box>
                      </>
                    ) : null}
                  </Stack>
                </form>
              </CardContent>
            </Card>
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
                  {/* Live platform metrics — not time-limited */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: dashboard.auth?.totalGuests !== 0 ? "repeat(4, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))" },
                      gap: 2,
                      mb: 3
                    }}
                  >
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
                                setUserQuickFilters([]);
                                setUserRoleFilters(["guest"]);
                                setUserGlobalFilter("");
                                setSuperView("all-users");
                              }
                            })();
                          }}
                        >
                          View guest accounts
                        </Button>
                      </Paper>
                    ) : null}
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
                  </Box>

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
                          onClick={() => { void openLoginActivity("all"); }}
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
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Faculty</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Faculty mentoring queue and pending evaluations will appear here.</Typography>
                      <Box sx={{ mt: 1.5 }}><Button type="button" size="small" onClick={() => { setSuperView("account"); setAccountView("profile"); }}>Open My Account</Button></Box>
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
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>User</TableCell>
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
                        <TableCell component="th" scope="col" sx={{ fontWeight: 700 }}>User</TableCell>
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
                  <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                    <Box>
                      <Typography variant="h6">Active Users</Typography>
                      <Typography variant="body2" color="text.secondary">Users with currently active sessions.</Typography>
                      <Chip
                        size="small"
                        color="info"
                        label={`${activeLiveUsersCount} live users`}
                        sx={{ mt: 1, fontSize: "0.7rem", fontWeight: 700, height: 22 }}
                      />
                    </Box>
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
                  </Stack>
                </Box>
                <Paper sx={{ p: 1, borderRadius: 2, border: "none", boxShadow: "none" }}>
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
                  <Box sx={{ mt: 1.25, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                    <Chip
                      size="small"
                      clickable
                      onClick={() => setLoginActivityQuickFilter("all")}
                      color={loginActivityQuickFilter === "all" ? "primary" : "default"}
                      variant={loginActivityQuickFilter === "all" ? "filled" : "outlined"}
                      label={`Total: ${loginActivitySummary.total}`}
                    />
                    <Chip
                      size="small"
                      clickable
                      onClick={() => setLoginActivityQuickFilter("success")}
                      color="success"
                      variant={loginActivityQuickFilter === "success" ? "filled" : "outlined"}
                      label={`Success: ${loginActivitySummary.success}`}
                    />
                    <Chip
                      size="small"
                      clickable
                      onClick={() => setLoginActivityQuickFilter("failed")}
                      color="error"
                      variant={loginActivityQuickFilter === "failed" ? "filled" : "outlined"}
                      label={`Failed: ${loginActivitySummary.failed}`}
                    />
                  </Box>
                </Box>
                <Paper sx={{ p: 1, borderRadius: 2, border: "none", boxShadow: "none" }}>
                  <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading failed-login table...</Typography>}>
                    <FailedLoginsTable rows={visibleLoginActivityRows} busy={busy} formatIst={formatIst} />
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
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                      <Chip
                        size="small"
                        clickable
                        onClick={() => {
                          setUserQuickFilters([]);
                          setUserRoleFilters([]);
                        }}
                        color={userQuickFilters.length === 0 && userRoleFilters.length === 0 ? "primary" : "default"}
                        variant={userQuickFilters.length === 0 && userRoleFilters.length === 0 ? "filled" : "outlined"}
                        label={`Total: ${userSummary.total}`}
                      />
                      {userSummary.active > 0 ? (
                        <Chip
                          size="small"
                          clickable
                          onClick={() =>
                            setUserQuickFilters((prev) => (prev.includes("active") ? prev.filter((f) => f !== "active") : [...prev, "active"]))
                          }
                          color="success"
                          variant={userQuickFilters.includes("active") ? "filled" : "outlined"}
                          label={`Active: ${userSummary.active}`}
                        />
                      ) : null}
                      {userSummary.disabled > 0 ? (
                        <Chip
                          size="small"
                          clickable
                          onClick={() =>
                            setUserQuickFilters((prev) => (prev.includes("disabled") ? prev.filter((f) => f !== "disabled") : [...prev, "disabled"]))
                          }
                          color="default"
                          variant={userQuickFilters.includes("disabled") ? "filled" : "outlined"}
                          label={`Disabled: ${userSummary.disabled}`}
                        />
                      ) : null}
                      {userSummary.neverLoggedIn > 0 ? (
                        <Chip
                          size="small"
                          clickable
                          onClick={() =>
                            setUserQuickFilters((prev) =>
                              prev.includes("neverLoggedIn") ? prev.filter((f) => f !== "neverLoggedIn") : [...prev, "neverLoggedIn"]
                            )
                          }
                          color="warning"
                          variant={userQuickFilters.includes("neverLoggedIn") ? "filled" : "outlined"}
                          label={`Never Logged In: ${userSummary.neverLoggedIn}`}
                        />
                      ) : null}
                      {userRoleSummary.map(([role, count]) => (
                        <Chip
                          key={role}
                          size="small"
                          clickable
                          onClick={() =>
                            setUserRoleFilters((prev) => (prev.includes(role) ? prev.filter((item) => item !== role) : [...prev, role]))
                          }
                          color={userRoleFilters.includes(role) ? "primary" : "default"}
                          variant={userRoleFilters.includes(role) ? "filled" : "outlined"}
                          label={`${role.toUpperCase()}: ${count}`}
                        />
                      ))}
                    </Box>
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
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <form onSubmit={createUser}>
                        <Stack spacing={1.5}>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                          <TextField fullWidth type="text" label="Full name" value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} />
                          <TextField fullWidth type="text" label="Email (optional)" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                          <TextField fullWidth type="text" label="Username" value={newUserUsername} onChange={(e) => setNewUserUsername(e.target.value)} />
                        </Stack>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                          <TextField fullWidth type="password" label="Password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
                          <FormControl fullWidth>
                            <InputLabel id="new-user-roles-label">Roles</InputLabel>
                            <Select
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
                              <MenuItem value="student"><Checkbox checked={newUserRoles.includes("student")} size="small" /><ListItemText primary="Student" /></MenuItem>
                              <MenuItem value="faculty"><Checkbox checked={newUserRoles.includes("faculty")} size="small" /><ListItemText primary="Faculty" /></MenuItem>
                              <MenuItem value="head"><Checkbox checked={newUserRoles.includes("head")} size="small" /><ListItemText primary="Head" /></MenuItem>
                              <MenuItem value="moderator"><Checkbox checked={newUserRoles.includes("moderator")} size="small" /><ListItemText primary="Moderator" /></MenuItem>
                              <MenuItem value="guest"><Checkbox checked={newUserRoles.includes("guest")} size="small" /><ListItemText primary="Guest" /></MenuItem>
                              <MenuItem value="admin"><Checkbox checked={newUserRoles.includes("admin")} size="small" /><ListItemText primary="Admin" /></MenuItem>
                            </Select>
                          </FormControl>
                        </Stack>
                        <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                          <Button type="submit" variant="contained" disabled={busy}>
                            Create User
                          </Button>
                        </Stack>
                        <Divider />
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" } }}>
                          <Typography variant="body2" color="text.secondary">
                            Bulk create via CSV. Required columns: `fullName`, `username`, `password`. Optional: `email`, `role`.
                          </Typography>
                          <Button component="label" variant="outlined" disabled={busy}>
                            Upload CSV
                            <input hidden accept=".csv,text/csv" type="file" onChange={createUsersFromCsvFile} />
                          </Button>
                        </Stack>
                        {bulkCsvFileName ? (
                          <Typography variant="caption" color="text.secondary">
                            Last selected file: {bulkCsvFileName}
                          </Typography>
                        ) : null}
                      </Stack>
                    </form>
                  </Paper>
                ) : null}

                <Paper sx={{ p: 1, borderRadius: 2, border: "none", boxShadow: "none" }}>
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

        {principal && myAccount && superView === "account" ? (
          <Card>
            <CardContent>
              <Stack spacing={adminPageSx.pageStack.spacing}>
                <Box sx={adminPageSx.headerPanel}>
                  <Typography variant="h6">My Account</Typography>
                  <Typography variant="body2" color="text.secondary">Account details.</Typography>
                </Box>
                <Paper variant="outlined" sx={{ p: 1 }}>
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
                    <TableContainer>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell component="th" scope="col">User</TableCell>
                            <TableCell
                              onDoubleClick={(e) => {
                                if (canEditOwnProfile) {
                                  const target = e.target as HTMLElement;
                                  setEditingMyNameWidth(Math.ceil(target.getBoundingClientRect().width));
                                  setEditingMyName(true);
                                }
                              }}
                            >
                              <Box component="span">
                                {editingMyName && canEditOwnProfile ? (
                                  <InputBase
                                    autoFocus
                                    sx={editingMyNameWidth ? { width: `${editingMyNameWidth}px` } : undefined}
                                    value={fullNameInput}
                                    onChange={(e) => setFullNameInput(e.target.value)}
                                    onBlur={() => {
                                      void saveMyAccountName();
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        void saveMyAccountName();
                                      }
                                      if (e.key === "Escape") {
                                        setEditingMyName(false);
                                        setEditingMyNameWidth(null);
                                        setFullNameInput(myAccount.fullName ?? "");
                                      }
                                    }}
                                    disabled={busy}
                                  />
                                ) : (
                                  <Typography component="span" variant="body2">{myAccount.fullName || "—"}</Typography>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell component="th" scope="col">Email</TableCell>
                            <TableCell>{myAccount.email || "—"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell component="th" scope="col">Username</TableCell>
                            <TableCell>{myAccount.username || "—"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell component="th" scope="col">Roles</TableCell>
                            <TableCell>{myAccount.roles.join(", ") || "—"}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : null}
                  {accountView === "password" && canChangeOwnPassword && myAccount.username ? (
                    <form onSubmit={changePassword}>
                      <Stack spacing={1.25} sx={{ maxWidth: 420, p: 1 }}>
                        <TextField label="Username" type="text" value={myAccount.username} disabled />
                        <TextField label="Current password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                        <TextField label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                        <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                          <Button type="submit" variant="contained" disabled={busy}>
                            Update Password
                          </Button>
                        </Stack>
                      </Stack>
                    </form>
                  ) : null}
                  {accountView === "password" && canChangeOwnPassword && !myAccount.username ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                      No local password is configured for this account.
                    </Typography>
                  ) : null}
                  {accountView === "sessions" ? (
                    <Stack spacing={1.25} sx={{ p: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Active sessions for your account across devices and browsers.
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Session</TableCell>
                              <TableCell>Created</TableCell>
                              <TableCell>Last Seen</TableCell>
                              <TableCell>Expires</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {mySessions.map((session) => (
                              <TableRow key={session.id}>
                                <TableCell>{session.isCurrent ? "Current" : "Other"}</TableCell>
                                <TableCell>{formatIst(session.createdAt)}</TableCell>
                                <TableCell>{formatIst(session.lastSeenAt)}</TableCell>
                                <TableCell>{formatIst(session.expiresAt)}</TableCell>
                              </TableRow>
                            ))}
                            {mySessions.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4}>No active sessions found.</TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="caption" color="text.secondary">
                          Other active sessions: {otherSessionsCount}
                        </Typography>
                        <Button
                          type="button"
                          size="small"
                          disabled={busy || otherSessionsCount < 1}
                          onClick={() => {
                            void logoutOtherSessions();
                          }}
                        >
                          Logout All Sessions
                        </Button>
                      </Stack>
                    </Stack>
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

                <Paper variant="outlined" sx={adminPageSx.sectionPanel}>
                  <form onSubmit={forceLogoutAllSessionsForUser}>
                    <TextField
                      label="Username / Email / Subject"
                      type="text"
                      placeholder="user@example.com or local-user@example.com or username"
                      value={sessionTarget}
                      onChange={(e) => setSessionTarget(e.target.value)}
                      sx={{ width: { xs: "100%", sm: 300 }, mb: 1.25 }}
                    />
                    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                      <Button type="submit" variant="contained" disabled={busy}>
                        Revoke All Sessions
                      </Button>
                    </Box>
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

