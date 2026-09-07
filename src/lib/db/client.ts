import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { runDataMigrations } from "@/lib/db/migrations";

/**
 * SQLite connection, created once per process.
 *
 * Next dev reloads modules on every edit, so the handle is cached on
 * `globalThis` — otherwise each reload would open another file handle and
 * eventually lock the database.
 */

const globalForDb = globalThis as unknown as { __creatorHubDb?: Database.Database };

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH ?? "./data/creator-hub.db";
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

function createConnection(): Database.Database {
  const file = resolveDbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // The schema is idempotent (CREATE TABLE IF NOT EXISTS), so applying it on
  // every boot doubles as the migration step — no separate CLI to remember.
  const schemaPath = path.join(process.cwd(), "src", "lib", "db", "schema.sql");
  db.exec(fs.readFileSync(schemaPath, "utf8"));

  // Anything the schema file cannot express (data reshapes) runs here.
  runDataMigrations(db);

  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.__creatorHubDb) {
    globalForDb.__creatorHubDb = createConnection();
  }
  return globalForDb.__creatorHubDb;
}

/** Milliseconds → ISO string, used everywhere timestamps are written. */
export const nowIso = () => new Date().toISOString();

/** UTC day key, matching how Google resets YouTube quota (midnight PT ≈ UTC day). */
export const todayKey = () => new Date().toISOString().slice(0, 10);
