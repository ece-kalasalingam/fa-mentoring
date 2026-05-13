export type Env = {
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  AUTH_PROVIDER?: string;
  AUTH_STATIC_TOKENS_JSON?: string;
  LOG_RETENTION_DAYS?: string;
  LOG_MAX_ROWS?: string;
  FRONTEND_ORIGIN?: string;
  SETUP_BOOTSTRAP_KEY?: string;
  ALLOW_INSECURE_AUTH_NONE?: string;
  AUTH_COOKIE_NAME?: string;
  AUTH_COOKIE_SECURE?: string;
  AUTH_COOKIE_SAMESITE?: string;
  AUTH_SESSION_HOURS?: string;
  GOOGLE_CLIENT_ID?: string;
  TURSO_API_TOKEN?: string;
  TURSO_ORG_NAME?: string;
  LOG_DISABLE_SUCCESS_REQUESTS?: string;
  LOG_INFO_SAMPLE_RATE?: string;
  LOG_PRUNE_EVERY_N_WRITES?: string;
};

export type CsvImportRow = Record<string, string | number | null | undefined>;
