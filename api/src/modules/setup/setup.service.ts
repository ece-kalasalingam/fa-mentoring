import { getDb } from "../../core/db";
import type { Env } from "../../core/types";
import { MIGRATIONS } from "./migrations";

async function safeRollback(db: ReturnType<typeof getDb>): Promise<void> {
  try {
    await db.execute("ROLLBACK");
  } catch {
    // Ignore rollback errors when no active transaction exists.
  }
}

async function safeCommit(db: ReturnType<typeof getDb>): Promise<void> {
  try {
    await db.execute("COMMIT");
  } catch {
    // Ignore commit errors when no active transaction exists.
    // Some SQLite/libSQL DDL paths can auto-complete transaction boundaries.
  }
}

async function ensureMigrationsTable(env: Env) {
  const db = getDb(env);
  await db.execute(`create table if not exists schema_migrations (
    id text primary key,
    description text not null,
    applied_at text not null default current_timestamp
  )`);
}

async function getAppliedMigrationIds(env: Env): Promise<Set<string>> {
  const db = getDb(env);
  const res = await db.execute("select id from schema_migrations order by id");
  return new Set(res.rows.map((row) => String(row.id)));
}

async function getColumnType(env: Env, table: string, column: string): Promise<string | null> {
  const db = getDb(env);
  const res = await db.execute(`pragma table_info(${table})`);
  for (const row of res.rows) {
    if (String(row.name) === column) {
      return String(row.type ?? "").toLowerCase();
    }
  }
  return null;
}

async function shouldRunMigration(env: Env, migrationId: string): Promise<boolean> {
  // 0005 is only needed for older installs that used integer ids.
  // Fresh installs already use text/UUID ids from migrations 0003/0004.
  if (migrationId !== "0005_user_account_uuid_rekey") {
    return true;
  }

  const userAccountIdType = await getColumnType(env, "user_accounts", "id");
  const credentialFkType = await getColumnType(env, "auth_credentials", "user_account_id");
  const sessionFkType = await getColumnType(env, "auth_sessions", "user_account_id");

  const isAlreadyUuidStyle =
    userAccountIdType?.includes("text") &&
    credentialFkType?.includes("text") &&
    sessionFkType?.includes("text");
  return !isAlreadyUuidStyle;
}

export async function setupSchema(env: Env) {
  await ensureMigrationsTable(env);
  const db = getDb(env);
  const appliedIds = await getAppliedMigrationIds(env);
  const pending = MIGRATIONS.filter((migration) => !appliedIds.has(migration.id));

  for (const migration of pending) {
    const runThisMigration = await shouldRunMigration(env, migration.id);
    if (!runThisMigration) {
      await db.execute({
        sql: "insert into schema_migrations(id, description) values(?, ?)",
        args: [migration.id, `${migration.description} (auto-skipped)`]
      });
      continue;
    }

    await db.execute("BEGIN");
    try {
      for (const statement of migration.statements) {
        await db.execute(statement);
      }
      await db.execute({
        sql: "insert into schema_migrations(id, description) values(?, ?)",
        args: [migration.id, migration.description]
      });
      await safeCommit(db);
    } catch (error) {
      await safeRollback(db);
      throw error;
    }
  }

  return {
    appliedNow: pending.length,
    totalMigrations: MIGRATIONS.length
  };
}

export async function getSetupStatus(env: Env) {
  await ensureMigrationsTable(env);
  const db = getDb(env);
  const tablesRes = await db.execute(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name != 'schema_migrations' order by name"
  );
  const appliedIds = await getAppliedMigrationIds(env);
  const pendingMigrations = MIGRATIONS.filter((migration) => !appliedIds.has(migration.id)).map((migration) => migration.id);
  const tableNames = tablesRes.rows.map((row) => String(row.name));
  return {
    hasTables: tableNames.length > 0,
    tableCount: tableNames.length,
    tableNames,
    currentSchemaVersion: [...appliedIds].sort().at(-1) ?? null,
    totalMigrations: MIGRATIONS.length,
    appliedMigrations: appliedIds.size,
    pendingMigrations
  };
}
