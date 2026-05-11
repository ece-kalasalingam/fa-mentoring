export type Migration = {
  id: string;
  description: string;
  statements: string[];
};

export const MIGRATIONS: Migration[] = [
  {
    id: "0001_initial_schema",
    description: "Create initial schema for mentoring platform",
    statements: [
      `create table if not exists regulations (
        id integer primary key autoincrement,
        code text not null unique,
        name text not null,
        duration_years integer not null check(duration_years > 0),
        total_credits_required integer not null check(total_credits_required > 0),
        active integer not null default 1,
        created_at text not null default current_timestamp,
        updated_at text not null default current_timestamp
      )`,
      `create table if not exists regulation_category_requirements (
        id integer primary key autoincrement,
        regulation_code text not null,
        category_code text not null,
        category_name text not null,
        min_credits real not null check(min_credits >= 0),
        unique(regulation_code, category_code)
      )`,
      `create table if not exists regulation_plans (
        id integer primary key autoincrement,
        regulation_code text not null,
        program text not null,
        batch_start_year integer not null check(batch_start_year between 1970 and 2070),
        version integer not null default 1,
        active integer not null default 1,
        unique(regulation_code, program, batch_start_year, version)
      )`,
      `create table if not exists regulation_semester_category_plan (
        id integer primary key autoincrement,
        plan_id integer not null,
        semester_no integer not null check(semester_no > 0),
        category_code text not null,
        planned_credits real not null check(planned_credits >= 0),
        unique(plan_id, semester_no, category_code)
      )`,
      `create table if not exists faculty_profiles (
        id integer primary key autoincrement,
        employee_id text not null unique,
        name text not null,
        email text not null unique,
        department text,
        active integer not null default 1,
        created_at text not null default current_timestamp,
        updated_at text not null default current_timestamp
      )`,
      `create table if not exists students (
        id integer primary key autoincrement,
        roll_no text not null unique,
        full_name text not null,
        email text not null unique,
        program text not null,
        batch_start_year integer not null check(batch_start_year between 1970 and 2070),
        mentor_email text not null,
        completion_status text not null default 'On Track',
        risk_score integer not null default 0,
        created_at text not null default current_timestamp,
        updated_at text not null default current_timestamp
      )`
    ]
  },
  {
    id: "0002_app_logs",
    description: "Create compact structured application logs table",
    statements: [
      `create table if not exists app_logs (
        id integer primary key autoincrement,
        ts text not null default current_timestamp,
        level text not null check(level in ('debug','info','warn','error')),
        request_id text not null,
        method text not null,
        path text not null,
        status_code integer not null,
        duration_ms integer not null,
        principal_subject text,
        auth_provider text,
        event text not null,
        meta_json text
      )`,
      "create index if not exists idx_app_logs_ts on app_logs(ts)",
      "create index if not exists idx_app_logs_level on app_logs(level)"
    ]
  },
  {
    id: "0003_user_accounts",
    description: "Create authenticated user accounts table for authorization and superuser bootstrap",
    statements: [
      `create table if not exists user_accounts (
        id text primary key,
        provider text not null,
        subject text not null,
        email text,
        full_name text,
        roles_json text not null,
        permissions_json text not null,
        is_admin integer not null default 0 check(is_admin in (0, 1)),
        is_superuser integer not null default 0 check(is_superuser in (0, 1)),
        active integer not null default 1 check(active in (0, 1)),
        created_at text not null default current_timestamp,
        updated_at text not null default current_timestamp,
        last_login_at text not null default current_timestamp,
        unique(provider, subject)
      )`,
      "create index if not exists idx_user_accounts_admin on user_accounts(is_admin, is_superuser)",
      "create index if not exists idx_user_accounts_email on user_accounts(email)"
    ]
  },
  {
    id: "0004_local_auth",
    description: "Create local credential, session, and login-attempt tables",
    statements: [
      `create table if not exists auth_credentials (
        user_account_id text primary key,
        username text not null unique,
        password_hash text not null,
        password_salt text not null,
        password_algo text not null default 'pbkdf2_sha256',
        password_iterations integer not null,
        failed_attempts integer not null default 0,
        locked_until text,
        active integer not null default 1 check(active in (0, 1)),
        created_at text not null default current_timestamp,
        updated_at text not null default current_timestamp,
        password_changed_at text not null default current_timestamp
      )`,
      `create table if not exists auth_sessions (
        id integer primary key autoincrement,
        user_account_id text not null,
        token_hash text not null unique,
        expires_at text not null,
        revoked_at text,
        created_at text not null default current_timestamp,
        last_seen_at text not null default current_timestamp
      )`,
      `create table if not exists auth_login_attempts (
        id integer primary key autoincrement,
        username text not null,
        ip_hash text not null,
        success integer not null check(success in (0, 1)),
        attempted_at text not null default current_timestamp
      )`,
      "create index if not exists idx_auth_credentials_username on auth_credentials(username)",
      "create index if not exists idx_auth_sessions_token_hash on auth_sessions(token_hash)",
      "create index if not exists idx_auth_sessions_user on auth_sessions(user_account_id, expires_at)",
      "create index if not exists idx_auth_attempts_lookup on auth_login_attempts(username, ip_hash, attempted_at)"
    ]
  },
  {
    id: "0005_user_account_uuid_rekey",
    description: "Rekey user account and auth references to UUID ids",
    statements: [
      "alter table user_accounts rename to user_accounts_old",
      "alter table auth_credentials rename to auth_credentials_old",
      "alter table auth_sessions rename to auth_sessions_old",
      `create table user_accounts (
        id text primary key,
        provider text not null,
        subject text not null,
        email text,
        full_name text,
        roles_json text not null,
        permissions_json text not null,
        is_admin integer not null default 0 check(is_admin in (0, 1)),
        is_superuser integer not null default 0 check(is_superuser in (0, 1)),
        active integer not null default 1 check(active in (0, 1)),
        created_at text not null default current_timestamp,
        updated_at text not null default current_timestamp,
        last_login_at text not null default current_timestamp,
        unique(provider, subject)
      )`,
      "create index idx_user_accounts_admin on user_accounts(is_admin, is_superuser)",
      "create index idx_user_accounts_email on user_accounts(email)",
      `create table auth_credentials (
        user_account_id text primary key,
        username text not null unique,
        password_hash text not null,
        password_salt text not null,
        password_algo text not null default 'pbkdf2_sha256',
        password_iterations integer not null,
        failed_attempts integer not null default 0,
        locked_until text,
        active integer not null default 1 check(active in (0, 1)),
        created_at text not null default current_timestamp,
        updated_at text not null default current_timestamp,
        password_changed_at text not null default current_timestamp
      )`,
      "create index idx_auth_credentials_username on auth_credentials(username)",
      `create table auth_sessions (
        id integer primary key autoincrement,
        user_account_id text not null,
        token_hash text not null unique,
        expires_at text not null,
        revoked_at text,
        created_at text not null default current_timestamp,
        last_seen_at text not null default current_timestamp
      )`,
      "create index idx_auth_sessions_token_hash on auth_sessions(token_hash)",
      "create index idx_auth_sessions_user on auth_sessions(user_account_id, expires_at)",
      "create table user_id_map(old_id text primary key, new_id text not null)",
      `insert into user_id_map(old_id, new_id)
       select
         cast(id as text),
         lower(hex(randomblob(4))) || '-' ||
         lower(hex(randomblob(2))) || '-4' ||
         substr(lower(hex(randomblob(2))), 2) || '-' ||
         substr('89ab', abs(random()) % 4 + 1, 1) ||
         substr(lower(hex(randomblob(2))), 2) || '-' ||
         lower(hex(randomblob(6)))
       from user_accounts_old`,
      `insert into user_accounts(id, provider, subject, email, full_name, roles_json, permissions_json, is_admin, is_superuser, active, created_at, updated_at, last_login_at)
       select m.new_id, u.provider, u.subject, u.email, null, u.roles_json, u.permissions_json, u.is_admin, u.is_superuser, u.active, u.created_at, u.updated_at, u.last_login_at
       from user_accounts_old u
       join user_id_map m on m.old_id = cast(u.id as text)`,
      `insert into auth_credentials(user_account_id, username, password_hash, password_salt, password_algo, password_iterations, failed_attempts, locked_until, active, created_at, updated_at, password_changed_at)
       select m.new_id, c.username, c.password_hash, c.password_salt, c.password_algo, c.password_iterations, c.failed_attempts, c.locked_until, c.active, c.created_at, c.updated_at, c.password_changed_at
       from auth_credentials_old c
       join user_id_map m on m.old_id = cast(c.user_account_id as text)`,
      `insert into auth_sessions(id, user_account_id, token_hash, expires_at, revoked_at, created_at, last_seen_at)
       select s.id, m.new_id, s.token_hash, s.expires_at, s.revoked_at, s.created_at, s.last_seen_at
       from auth_sessions_old s
       join user_id_map m on m.old_id = cast(s.user_account_id as text)`,
      "drop table user_accounts_old",
      "drop table auth_credentials_old",
      "drop table auth_sessions_old",
      "drop table user_id_map"
    ]
  },
  {
    id: "0006_user_full_name",
    description: "Add full_name to user accounts for profile management",
    statements: ["alter table user_accounts add column full_name text"]
  },
  {
    id: "0007_unified_user_identity_model",
    description: "Reset auth schema to unified single-user UUID model with provider identity mapping",
    statements: [
      "drop table if exists auth_sessions",
      "drop table if exists auth_credentials",
      "drop table if exists auth_login_attempts",
      "drop table if exists auth_identities",
      "drop table if exists user_accounts",
      `create table user_accounts (
        id text primary key,
        provider text not null,
        provider_subject text,
        subject text not null unique,
        email text unique,
        full_name text,
        roles_json text not null,
        permissions_json text not null,
        is_admin integer not null default 0 check(is_admin in (0, 1)),
        is_superuser integer not null default 0 check(is_superuser in (0, 1)),
        active integer not null default 1 check(active in (0, 1)),
        created_at text not null default current_timestamp,
        updated_at text not null default current_timestamp,
        last_login_at text not null default current_timestamp,
        unique(provider, provider_subject)
      )`,
      "create index if not exists idx_user_accounts_admin on user_accounts(is_admin, is_superuser)",
      "create index if not exists idx_user_accounts_email on user_accounts(email)",
      `create table auth_credentials (
        user_account_id text primary key,
        username text not null unique,
        password_hash text not null,
        password_salt text not null,
        password_algo text not null default 'pbkdf2_sha256',
        password_iterations integer not null,
        failed_attempts integer not null default 0,
        locked_until text,
        active integer not null default 1 check(active in (0, 1)),
        created_at text not null default current_timestamp,
        updated_at text not null default current_timestamp,
        password_changed_at text not null default current_timestamp
      )`,
      `create table auth_sessions (
        id integer primary key autoincrement,
        user_account_id text not null,
        token_hash text not null unique,
        expires_at text not null,
        revoked_at text,
        created_at text not null default current_timestamp,
        last_seen_at text not null default current_timestamp
      )`,
      `create table auth_login_attempts (
        id integer primary key autoincrement,
        username text not null,
        ip_hash text not null,
        success integer not null check(success in (0, 1)),
        attempted_at text not null default current_timestamp
      )`,
      "create index if not exists idx_auth_credentials_username on auth_credentials(username)",
      "create index if not exists idx_auth_sessions_token_hash on auth_sessions(token_hash)",
      "create index if not exists idx_auth_sessions_user on auth_sessions(user_account_id, expires_at)",
      "create index if not exists idx_auth_attempts_lookup on auth_login_attempts(username, ip_hash, attempted_at)"
    ]
  },
  {
    id: "0008_drop_auth_identities",
    description: "Drop legacy auth_identities table after single-table identity refactor",
    statements: [
      "drop table if exists auth_identities"
    ]
  },
  {
    id: "0009_app_logs_retention_trigger",
    description: "Enforce app_logs retention at DB level: keep max 7 days and max 500 rows",
    statements: [
      "drop trigger if exists trg_app_logs_prune_after_insert",
      `create trigger if not exists trg_app_logs_prune_after_insert
       after insert on app_logs
       begin
         delete from app_logs
         where ts < datetime('now', '-7 days');
         delete from app_logs
         where id not in (
           select id from app_logs
           order by ts desc, id desc
           limit 500
         );
       end`,
      "delete from app_logs where ts < datetime('now', '-7 days')",
      "delete from app_logs where id not in (select id from app_logs order by ts desc, id desc limit 500)"
    ]
  },
  {
    id: "0010_auth_login_attempts_ip_address",
    description: "Store source IP address in login attempts for admin observability",
    statements: [
      "alter table auth_login_attempts add column ip_address text"
    ]
  }
];
