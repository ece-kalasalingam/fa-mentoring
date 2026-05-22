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
  },
  {
    id: "0011_drop_legacy_regulations_tables",
    description: "Drop legacy regulations and plan-of-study tables after redesign reset",
    statements: [
      "drop table if exists regulation_semester_category_plan",
      "drop table if exists regulation_plans",
      "drop table if exists regulation_category_requirements",
      "drop table if exists regulations"
    ]
  },
  {
    id: "0012_faculty_profiles_uuid_fk_rework",
    description: "Rework faculty_profiles to use user_accounts UUID/email foreign keys and drop legacy columns",
    statements: [
      "alter table faculty_profiles rename to faculty_profiles_old",
      `create table faculty_profiles (
        id text primary key,
        employee_id text not null unique,
        name text not null,
        email text not null unique,
        department text,
        updated_at text not null default current_timestamp,
        foreign key(id) references user_accounts(id),
        foreign key(email) references user_accounts(email)
      )`,
      "create index if not exists idx_faculty_profiles_email on faculty_profiles(email)",
      `insert into faculty_profiles(id, employee_id, name, email, department, updated_at)
       select ua.id, f.employee_id, f.name, lower(trim(f.email)), f.department, coalesce(f.updated_at, current_timestamp)
       from faculty_profiles_old f
       join user_accounts ua on lower(trim(ua.email)) = lower(trim(f.email))
       where trim(coalesce(f.employee_id, '')) <> ''
         and trim(coalesce(f.name, '')) <> ''
         and trim(coalesce(f.email, '')) <> ''`,
      "drop table faculty_profiles_old"
    ]
  },
  {
    id: "0013_faculty_profiles_drop_name_email_columns",
    description: "Drop name/email/email_user_account columns from faculty_profiles and keep UUID FK model",
    statements: [
      "alter table faculty_profiles rename to faculty_profiles_old_v2",
      `create table faculty_profiles (
        id text primary key,
        employee_id text not null unique,
        department text,
        updated_at text not null default current_timestamp,
        foreign key(id) references user_accounts(id)
      )`,
      `insert into faculty_profiles(id, employee_id, department, updated_at)
       select id, employee_id, department, coalesce(updated_at, current_timestamp)
       from faculty_profiles_old_v2`,
      "drop table faculty_profiles_old_v2"
    ]
  },
  {
    id: "0014_faculty_profiles_rename_id_to_user_account_id",
    description: "Rename faculty_profiles FK column from id to user_account_id",
    statements: [
      "alter table faculty_profiles rename to faculty_profiles_old_v3",
      `create table faculty_profiles (
        user_account_id text primary key,
        employee_id text not null unique,
        department text,
        updated_at text not null default current_timestamp,
        foreign key(user_account_id) references user_accounts(id)
      )`,
      `insert into faculty_profiles(user_account_id, employee_id, department, updated_at)
       select id, employee_id, department, coalesce(updated_at, current_timestamp)
       from faculty_profiles_old_v3`,
      "drop table faculty_profiles_old_v3"
    ]
  },
  {
    id: "0015_faculty_profiles_restore_id_pk_and_user_account_id",
    description: "Restore faculty_profiles id as primary key and keep user_account_id as renamed FK column",
    statements: [
      "alter table faculty_profiles rename to faculty_profiles_old_v4",
      `create table faculty_profiles (
        id text primary key,
        user_account_id text not null unique,
        employee_id text not null unique,
        department text,
        updated_at text not null default current_timestamp,
        foreign key(user_account_id) references user_accounts(id)
      )`,
      `insert into faculty_profiles(id, user_account_id, employee_id, department, updated_at)
       select user_account_id, user_account_id, employee_id, department, coalesce(updated_at, current_timestamp)
       from faculty_profiles_old_v4`,
      "drop table faculty_profiles_old_v4"
    ]
  },
  {
    id: "0016_faculty_profiles_drop_legacy_user_account_column",
    description: "Drop legacy user_account column from faculty_profiles",
    statements: [
      "alter table faculty_profiles rename to faculty_profiles_old_v5",
      `create table faculty_profiles (
        id text primary key,
        user_account_id text not null unique,
        employee_id text not null unique,
        department text,
        updated_at text not null default current_timestamp,
        foreign key(user_account_id) references user_accounts(id)
      )`,
      `insert into faculty_profiles(id, user_account_id, employee_id, department, updated_at)
       select id, user_account, employee_id, department, coalesce(updated_at, current_timestamp)
       from faculty_profiles_old_v5`,
      "drop table faculty_profiles_old_v5"
    ]
  },
  {
    id: "0017_faculty_profiles_enforce_single_fk_user_account_id",
    description: "Ensure faculty_profiles has only one FK: user_account_id -> user_accounts(id)",
    statements: [
      "alter table faculty_profiles rename to faculty_profiles_old_v6",
      `create table faculty_profiles (
        id text primary key,
        user_account_id text not null unique,
        employee_id text not null unique,
        department text,
        updated_at text not null default current_timestamp,
        foreign key(user_account_id) references user_accounts(id)
      )`,
      `insert into faculty_profiles(id, user_account_id, employee_id, department, updated_at)
       select id, user_account_id, employee_id, department, coalesce(updated_at, current_timestamp)
       from faculty_profiles_old_v6`,
      "drop table faculty_profiles_old_v6"
    ]
  },
  {
    id: "0018_faculty_profiles_strict_single_fk_shape",
    description: "Strictly enforce faculty_profiles final shape with only user_account_id FK and no extra columns",
    statements: [
      "alter table faculty_profiles rename to faculty_profiles_old_v7",
      `create table faculty_profiles (
        id text primary key,
        user_account_id text not null unique,
        employee_id text not null unique,
        department text,
        updated_at text not null default current_timestamp,
        foreign key(user_account_id) references user_accounts(id)
      )`,
      `insert into faculty_profiles(id, user_account_id, employee_id, department, updated_at)
       select id, user_account_id, employee_id, department, coalesce(updated_at, current_timestamp)
       from faculty_profiles_old_v7`,
      "drop table faculty_profiles_old_v7"
    ]
  },
  {
    id: "0019_drop_faculty_profiles_feature",
    description: "Drop deprecated faculty_profiles table after feature removal",
    statements: [
      "drop table if exists faculty_profiles"
    ]
  },
  {
    id: "0020_rebuild_students_table_user_linked",
    description: "Drop existing students table and recreate with user-linked schema",
    statements: [
      "drop table if exists students",
      `create table students (
        user_id text primary key,
        batch integer not null,
        programme_duration real not null,
        programme varchar(10),
        mentor_id text,
        constraint valid_batch check (batch between 2010 and 2050),
        foreign key (user_id) references user_accounts(id) on delete cascade,
        foreign key (mentor_id) references user_accounts(id) on delete set null
      )`
    ]
  },
  {
    id: "0021_students_add_registration_number_unique",
    description: "Add registration_number to students as varchar(15) unique not null",
    statements: [
      "alter table students rename to students_old_v2",
      `create table students (
        user_id text primary key,
        registration_number varchar(15) unique not null,
        batch integer not null,
        programme_duration real not null,
        programme varchar(10),
        mentor_id text,
        constraint valid_batch check (batch between 2010 and 2050),
        foreign key (user_id) references user_accounts(id) on delete cascade,
        foreign key (mentor_id) references user_accounts(id) on delete set null
      )`,
      `with numbered as (
         select user_id, batch, programme_duration, programme, mentor_id,
                row_number() over(order by user_id) as rn
         from students_old_v2
       )
       insert into students(user_id, registration_number, batch, programme_duration, programme, mentor_id)
       select user_id,
              substr('REG' || printf('%012d', rn), 1, 15),
              batch,
              programme_duration,
              programme,
              mentor_id
       from numbered`,
      "drop table students_old_v2"
    ]
  },
  {
    id: "0022_students_add_plan_of_study_code",
    description: "Add plan_of_study_code to students as varchar(30)",
    statements: [
      "alter table students add column plan_of_study_code varchar(30)",
      "update students set plan_of_study_code = null where trim(coalesce(plan_of_study_code, '')) = ''"
    ]
  },
  {
    id: "0023_students_plan_of_study_code_integer",
    description: "Rebuild students table with plan_of_study_code as integer",
    statements: [
      "alter table students rename to students_old_v3",
      `create table students (
        user_id text primary key,
        registration_number varchar(15) unique not null,
        plan_of_study_code integer,
        batch integer not null,
        programme_duration real not null,
        programme varchar(10),
        mentor_id text,
        constraint valid_batch check (batch between 2010 and 2050),
        foreign key (user_id) references user_accounts(id) on delete cascade,
        foreign key (mentor_id) references user_accounts(id) on delete set null
      )`,
      `insert into students(user_id, registration_number, plan_of_study_code, batch, programme_duration, programme, mentor_id)
       select
         user_id,
         registration_number,
         case
           when trim(coalesce(cast(plan_of_study_code as text), '')) = '' then null
           when trim(cast(plan_of_study_code as text)) glob '-?[0-9]*' then cast(trim(cast(plan_of_study_code as text)) as integer)
           else null
         end as plan_of_study_code,
         batch,
         programme_duration,
         programme,
         mentor_id
       from students_old_v3`,
      "drop table students_old_v3"
    ]
  },
  {
    id: "0024_students_programme_integer",
    description: "Rebuild students table with programme as integer",
    statements: [
      "alter table students rename to students_old_v4",
      `create table students (
        user_id text primary key,
        registration_number varchar(15) unique not null,
        plan_of_study_code integer,
        batch integer not null,
        programme_duration real not null,
        programme integer,
        mentor_id text,
        constraint valid_batch check (batch between 2010 and 2050),
        foreign key (user_id) references user_accounts(id) on delete cascade,
        foreign key (mentor_id) references user_accounts(id) on delete set null
      )`,
      `insert into students(user_id, registration_number, plan_of_study_code, batch, programme_duration, programme, mentor_id)
       select
         user_id,
         registration_number,
         plan_of_study_code,
         batch,
         programme_duration,
         case
           when trim(coalesce(cast(programme as text), '')) = '' then 0
           when trim(cast(programme as text)) glob '-?[0-9]*' then cast(trim(cast(programme as text)) as integer)
           else 0
         end as programme,
         mentor_id
       from students_old_v4`,
      "drop table students_old_v4"
    ]
  },
  {
    id: "0025_drop_credit_tracking_tables",
    description: "Drop removed credit tracking tables",
    statements: [
      "drop table if exists student_credit_snapshots",
      "drop table if exists credit_import_batches",
      "drop table if exists student_credit_claims"
    ]
  },
  {
    id: "0026_students_add_current_semester_and_audit_columns",
    description: "Add current_semester and audit columns to students",
    statements: [
      "alter table students add column current_semester integer not null default 1",
      "alter table students add column modified_by text references user_accounts(id)",
      "alter table students add column modified_at text",
      "update students set current_semester = 1 where current_semester is null",
      "update students set modified_at = current_timestamp where modified_at is null or trim(modified_at) = ''"
    ]
  },
  {
    id: "0027_student_credit_details_table_and_trigger",
    description: "Create student_credit_details table with indexes and modified_at update trigger",
    statements: [
      `create table if not exists student_credit_details (
        enrollment_id integer primary key autoincrement,
        student_id text not null,
        category_id text(10) not null,
        semester_taken integer not null check (semester_taken > 0),
        credits real not null check (credits >= 0),
        status integer not null default 1 check (status in (0,1,2,3,4,5)),
        modified_by text,
        modified_at datetime not null default current_timestamp,
        constraint fk_credit_student_id
          foreign key (student_id) references students(user_id) on delete cascade,
        constraint fk_credit_modified_by
          foreign key (modified_by) references user_accounts(id) on delete set null,
        constraint uq_student_semester_category
          unique (student_id, category_id, semester_taken)
      )`,
      "create index if not exists idx_credit_details_student on student_credit_details(student_id)",
      "create index if not exists idx_credit_details_student_sem on student_credit_details(student_id, semester_taken)",
      "drop trigger if exists trg_student_credit_details_modified_at",
      `create trigger if not exists trg_student_credit_details_modified_at
       after update on student_credit_details
       for each row
       when new.modified_at = old.modified_at
       begin
         update student_credit_details
         set modified_at = current_timestamp
         where enrollment_id = new.enrollment_id;
      end`
    ]
  },
  {
    id: "0028_students_replace_programme_duration_with_graduated",
    description: "Replace programme_duration with graduated binary flag on students table",
    statements: [
      "alter table students rename to students_old_v5",
      `create table students (
        user_id text primary key,
        registration_number varchar(15) unique not null,
        plan_of_study_code integer,
        current_semester integer not null default 1,
        batch integer not null,
        programme integer,
        graduated integer not null default 0 check(graduated in (0, 1)),
        mentor_id text,
        modified_by text references user_accounts(id),
        modified_at text,
        constraint valid_batch check (batch between 2010 and 2050),
        foreign key (user_id) references user_accounts(id) on delete cascade,
        foreign key (mentor_id) references user_accounts(id) on delete set null
      )`,
      `insert into students(
         user_id, registration_number, plan_of_study_code, current_semester, batch, programme, graduated, mentor_id, modified_by, modified_at
       )
       select
         user_id,
         registration_number,
         plan_of_study_code,
         coalesce(current_semester, 1),
         batch,
         programme,
         0 as graduated,
         mentor_id,
         modified_by,
         coalesce(modified_at, current_timestamp)
       from students_old_v5`,
      "drop table students_old_v5"
    ]
  },
  {
    id: "0029_student_credit_details_rebind_students_fk",
    description: "Rebuild student_credit_details so student FK points to current students table after students rebuild",
    statements: [
      "alter table student_credit_details rename to student_credit_details_old_v2",
      `create table student_credit_details (
        enrollment_id integer primary key autoincrement,
        student_id text not null,
        category_id text(10) not null,
        semester_taken integer not null check (semester_taken > 0),
        credits real not null check (credits >= 0),
        status integer not null default 1 check (status in (0,1,2,3,4,5)),
        modified_by text,
        modified_at datetime not null default current_timestamp,
        constraint fk_credit_student_id
          foreign key (student_id) references students(user_id) on delete cascade,
        constraint fk_credit_modified_by
          foreign key (modified_by) references user_accounts(id) on delete set null,
        constraint uq_student_semester_category
          unique (student_id, category_id, semester_taken)
      )`,
      `insert into student_credit_details(enrollment_id, student_id, category_id, semester_taken, credits, status, modified_by, modified_at)
       select enrollment_id, student_id, category_id, semester_taken, credits, status, modified_by, modified_at
       from student_credit_details_old_v2`,
      "drop table student_credit_details_old_v2",
      "create index if not exists idx_credit_details_student on student_credit_details(student_id)",
      "create index if not exists idx_credit_details_student_sem on student_credit_details(student_id, semester_taken)",
      "drop trigger if exists trg_student_credit_details_modified_at",
      `create trigger if not exists trg_student_credit_details_modified_at
       after update on student_credit_details
       for each row
       when new.modified_at = old.modified_at
       begin
         update student_credit_details
         set modified_at = current_timestamp
         where enrollment_id = new.enrollment_id;
       end`
    ]
  },
  {
    id: "0030_student_credit_details_summary_lookup_index",
    description: "Add composite index to optimize student credit summary grouping reads",
    statements: [
      "create index if not exists idx_credit_details_student_category_status on student_credit_details(student_id, category_id, status)"
    ]
  },
  {
    id: "0031_student_credit_status_summary_table",
    description: "Create per-student credit status summary table and backfill existing rows",
    statements: [
      `create table if not exists student_credit_status_summary (
        student_id text primary key
          references students(user_id) on delete cascade,
        batch integer not null,
        plan_of_study_code integer,
        current_semester integer not null default 1,
        earned_credits real not null default 0,
        earned_units real not null default 0,
        earned_total real not null default 0,
        required_credits real not null default 0,
        required_units real not null default 0,
        required_total real not null default 0,
        expected_credits real not null default 0,
        expected_units real not null default 0,
        expected_total real not null default 0,
        deficit_credits real not null default 0,
        deficit_units real not null default 0,
        deficit_total real not null default 0,
        status text not null check (status in ('Complete','On Track','Marginal','Alarming','Off Track')),
        category_totals_json text not null default '{}',
        category_required_json text not null default '{}',
        category_expected_json text not null default '{}',
        computed_at text not null default current_timestamp,
        updated_at text not null default current_timestamp
      )`,
      "create index if not exists idx_scss_batch_status on student_credit_status_summary(batch, status)",
      "create index if not exists idx_scss_status on student_credit_status_summary(status)",
      "create index if not exists idx_scss_plan_sem on student_credit_status_summary(plan_of_study_code, current_semester)",
      `insert into student_credit_status_summary(
         student_id, batch, plan_of_study_code, current_semester,
         earned_credits, earned_units, earned_total,
         required_credits, required_units, required_total,
         expected_credits, expected_units, expected_total,
         deficit_credits, deficit_units, deficit_total,
         status, category_totals_json, category_required_json, category_expected_json, computed_at, updated_at
       )
       with per_category as (
         select
           scd.student_id,
           scd.category_id,
           coalesce(sum(scd.credits), 0) as total_value,
           coalesce(sum(case when coalesce(scd.status, 0) = 5 then scd.credits else 0 end), 0) as unit_value,
           coalesce(sum(case when coalesce(scd.status, 0) = 5 then 0 else scd.credits end), 0) as credit_value
         from student_credit_details scd
         group by scd.student_id, scd.category_id
       ),
       per_student as (
         select
           student_id,
           coalesce(sum(credit_value), 0) as earned_credits,
           coalesce(sum(unit_value), 0) as earned_units,
           coalesce(sum(total_value), 0) as earned_total,
           coalesce(json_group_object(category_id, total_value), '{}') as category_totals_json
         from per_category
         group by student_id
       )
       select
         s.user_id as student_id,
         coalesce(s.batch, 2010) as batch,
         s.plan_of_study_code as plan_of_study_code,
         coalesce(s.current_semester, 1) as current_semester,
         coalesce(ps.earned_credits, 0) as earned_credits,
         coalesce(ps.earned_units, 0) as earned_units,
         coalesce(ps.earned_total, 0) as earned_total,
         0, 0, 0, 0, 0, 0, 0, 0, 0,
         'On Track' as status,
         coalesce(ps.category_totals_json, '{}') as category_totals_json,
         '{}' as category_required_json,
         '{}' as category_expected_json,
         current_timestamp,
         current_timestamp
       from students s
       left join per_student ps on ps.student_id = s.user_id
       on conflict(student_id) do update set
         batch = excluded.batch,
         plan_of_study_code = excluded.plan_of_study_code,
         current_semester = excluded.current_semester,
         earned_credits = excluded.earned_credits,
         earned_units = excluded.earned_units,
         earned_total = excluded.earned_total,
         category_totals_json = excluded.category_totals_json,
         updated_at = current_timestamp`
    ]
  },
  {
    id: "0032_batch_credit_status_summary_table",
    description: "Create per-batch scoped credit status summary table and backfill existing rows",
    statements: [
      `create table if not exists batch_credit_status_summary (
        batch integer not null,
        scope_type text not null check (scope_type in ('head','moderator','faculty')),
        scope_key text not null,
        total_active integer not null default 0,
        in_progress_count integer not null default 0,
        passed_out_count integer not null default 0,
        complete_count integer not null default 0,
        on_track_count integer not null default 0,
        marginal_count integer not null default 0,
        alarming_count integer not null default 0,
        off_track_count integer not null default 0,
        complete_pct real not null default 0,
        on_track_pct real not null default 0,
        marginal_pct real not null default 0,
        alarming_pct real not null default 0,
        off_track_pct real not null default 0,
        computed_at text not null default current_timestamp,
        updated_at text not null default current_timestamp,
        primary key (batch, scope_type, scope_key)
      )`,
      "create index if not exists idx_bcss_scope on batch_credit_status_summary(scope_type, scope_key, batch)",
      "create index if not exists idx_bcss_batch on batch_credit_status_summary(batch)",
      "delete from batch_credit_status_summary",
      `insert into batch_credit_status_summary(
         batch, scope_type, scope_key,
         total_active, in_progress_count, passed_out_count,
         complete_count, on_track_count, marginal_count, alarming_count, off_track_count,
         complete_pct, on_track_pct, marginal_pct, alarming_pct, off_track_pct,
         computed_at, updated_at
       )
       with scoped as (
         select s.batch, 'head' as scope_type, 'all' as scope_key, s.graduated, coalesce(ss.status, 'On Track') as status
         from students s
         inner join user_accounts ua on ua.id = s.user_id and ua.active = 1
         left join student_credit_status_summary ss on ss.student_id = s.user_id
         union all
         select s.batch, 'moderator' as scope_type, 'all' as scope_key, s.graduated, coalesce(ss.status, 'On Track') as status
         from students s
         inner join user_accounts ua on ua.id = s.user_id and ua.active = 1
         left join student_credit_status_summary ss on ss.student_id = s.user_id
         union all
         select s.batch, 'faculty' as scope_type, s.mentor_id as scope_key, s.graduated, coalesce(ss.status, 'On Track') as status
         from students s
         inner join user_accounts ua on ua.id = s.user_id and ua.active = 1
         left join student_credit_status_summary ss on ss.student_id = s.user_id
         where s.mentor_id is not null
       ),
       grouped as (
         select
           batch, scope_type, scope_key,
           count(*) as total_active,
           coalesce(sum(case when coalesce(graduated, 0) = 0 then 1 else 0 end), 0) as in_progress_count,
           coalesce(sum(case when coalesce(graduated, 0) = 1 then 1 else 0 end), 0) as passed_out_count,
           coalesce(sum(case when status = 'Complete' then 1 else 0 end), 0) as complete_count,
           coalesce(sum(case when status = 'On Track' then 1 else 0 end), 0) as on_track_count,
           coalesce(sum(case when status = 'Marginal' then 1 else 0 end), 0) as marginal_count,
           coalesce(sum(case when status = 'Alarming' then 1 else 0 end), 0) as alarming_count,
           coalesce(sum(case when status = 'Off Track' then 1 else 0 end), 0) as off_track_count
         from scoped
         group by batch, scope_type, scope_key
       )
       select
         batch, scope_type, scope_key,
         total_active, in_progress_count, passed_out_count,
         complete_count, on_track_count, marginal_count, alarming_count, off_track_count,
         case when total_active > 0 then round((complete_count * 100.0) / total_active, 2) else 0 end,
         case when total_active > 0 then round((on_track_count * 100.0) / total_active, 2) else 0 end,
         case when total_active > 0 then round((marginal_count * 100.0) / total_active, 2) else 0 end,
         case when total_active > 0 then round((alarming_count * 100.0) / total_active, 2) else 0 end,
         case when total_active > 0 then round((off_track_count * 100.0) / total_active, 2) else 0 end,
         current_timestamp, current_timestamp
       from grouped`
    ]
  }
];
