import "server-only";
import { GAME_NAME } from "@/lib/constants";
import { getDb, nowIso } from "@/lib/db/client";

/**
 * Settings that belong to the workspace rather than to a mail account.
 *
 * The game name and its store link used to be source constants, which meant a
 * rebuild — and a code edit — to change the thing an outreach mail talks about.
 * They live in a single row now so Settings can edit them and every template
 * resolves the same values.
 *
 * Reading never writes: a fresh database simply falls back to the defaults, so
 * the settings screen works before anything is saved.
 */

export interface GameSettings {
  name: string;
  link: string;
}

interface Row {
  game_name: string;
  game_link: string;
}

const FALLBACK: GameSettings = { name: GAME_NAME, link: "" };

function defaults(): GameSettings {
  return { ...FALLBACK };
}

/**
 * The schema file creates this table too. This copy exists for the one case the
 * schema file cannot cover: a dev server that was already running when the
 * table was introduced keeps its cached connection, so the new query would hit
 * "no such table" until a restart. Creating it on first use is idempotent and
 * costs one statement per process.
 */
let tableReady = false;

function ensureTable(): void {
  if (tableReady) return;
  getDb().exec(
    `CREATE TABLE IF NOT EXISTS app_settings (
       id          INTEGER PRIMARY KEY CHECK (id = 1),
       game_name   TEXT NOT NULL DEFAULT '',
       game_link   TEXT NOT NULL DEFAULT '',
       updated_at  TEXT NOT NULL
     )`
  );
  tableReady = true;
}

export function getGameSettings(): GameSettings {
  ensureTable();
  const row = getDb()
    .prepare("SELECT game_name, game_link FROM app_settings WHERE id = 1")
    .get() as Row | undefined;

  if (!row) return defaults();

  return {
    // An empty name would render "I work on , an indie game", so fall back.
    name: row.game_name.trim() || FALLBACK.name,
    link: row.game_link.trim(),
  };
}

export function saveGameSettings(input: GameSettings): GameSettings {
  ensureTable();
  const value: GameSettings = { name: input.name.trim(), link: input.link.trim() };

  getDb()
    .prepare(
      `INSERT INTO app_settings (id, game_name, game_link, updated_at)
            VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
            game_name = excluded.game_name,
            game_link = excluded.game_link,
            updated_at = excluded.updated_at`
    )
    .run(value.name, value.link, nowIso());

  return getGameSettings();
}
