export const TAB_SESSION_MARKER_KEY = "fa_tab_session_active";
export const SESSION_REGULATIONS_CACHE_KEY = "fa_session_regulations";
export const SESSION_PLAN_OF_STUDY_CACHE_KEY = "fa_session_plan_of_study";
export const SESSION_PLAN_VALIDATION_CACHE_KEY = "fa_session_plan_validation";
export const SESSION_PROGRAMMES_CACHE_KEY = "fa_session_programmes";
export const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
export const GOOGLE_IDP_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

export const ACTIVITY_LOGS_PAGE_SIZE = 25;
export const ADMIN_DRAWER_WIDTH = 240;
export const STATUS_AUTO_HIDE_MS = 8_000;
export const ADMIN_CACHE_TTL_MS = {
  dashboard: 60_000,
  logs: 20_000,
  activityLogs: 20_000,
  activeUsers: 20_000,
  failedLogins: 30_000,
  users: 30_000,
} as const;
