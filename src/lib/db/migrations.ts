import type Database from "better-sqlite3";
import { computeMetrics } from "@/lib/scoring/metrics";
import { computeScore } from "@/lib/scoring/score";

/**
 * Data migrations that the idempotent schema file cannot express.
 *
 * These run once per boot alongside `schema.sql`. Each one must be safe to run
 * against an already-migrated database — they check before they write.
 *
 * This module deliberately takes the connection as an argument instead of
 * calling `getDb()`, so it stays a leaf and cannot form an import cycle with
 * the query modules.
 */
export function runDataMigrations(db: Database.Database): void {
  ensureMailFromName(db);
  rescoreLegacyBreakdowns(db);
}

/**
 * `mail_account.from_name` arrived after the first Gmail connections existed.
 * CREATE TABLE IF NOT EXISTS cannot add a column, so old databases need this.
 */
function ensureMailFromName(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(mail_account)").all() as { name: string }[];
  if (columns.length === 0) return;
  if (columns.some((column) => column.name === "from_name")) return;
  db.exec("ALTER TABLE mail_account ADD COLUMN from_name TEXT");
  console.log("[db] added mail_account.from_name");
}

/**
 * Score breakdowns used to be stored as finished English sentences. They are
 * now stored as dictionary keys plus their numbers, so the card reads in the
 * user's language. Rows written by the old code are recomputed from the
 * videos we already hold — no YouTube calls, so no quota is spent.
 */
function rescoreLegacyBreakdowns(db: Database.Database): void {
  const stale = db
    .prepare(
      `SELECT id, subscriber_count, subscriber_count_hidden, name, description
         FROM creators
        WHERE score_breakdown IS NOT NULL
          AND score_breakdown LIKE '%"label"%'`
    )
    .all() as {
    id: string;
    subscriber_count: number | null;
    subscriber_count_hidden: number;
    name: string;
    description: string | null;
  }[];

  if (stale.length === 0) return;

  const videosFor = db.prepare(
    `SELECT published_at, view_count, like_count, comment_count
       FROM youtube_videos WHERE creator_id = ? ORDER BY published_at DESC`
  );
  const keywordsFor = db.prepare(
    `SELECT keyword FROM creator_keywords WHERE creator_id = ?`
  );
  const update = db.prepare(
    `UPDATE creators SET creator_score = ?, score_breakdown = ?, is_rising = ? WHERE id = ?`
  );

  const run = db.transaction(() => {
    for (const c of stale) {
      const videos = videosFor.all(c.id) as {
        published_at: string;
        view_count: number | null;
        like_count: number | null;
        comment_count: number | null;
      }[];

      const metrics = computeMetrics(
        videos.map((v) => ({
          publishedAt: v.published_at,
          viewCount: v.view_count,
          likeCount: v.like_count,
          commentCount: v.comment_count,
        })),
        c.subscriber_count
      );

      const keywords = (keywordsFor.all(c.id) as { keyword: string }[]).map(
        (k) => k.keyword
      );

      const { score, isRising, breakdown } = computeScore({
        subscriberCount: c.subscriber_count,
        subscriberCountHidden: c.subscriber_count_hidden === 1,
        metrics,
        keywords,
        text: `${c.name} ${c.description ?? ""}`,
      });

      update.run(score, JSON.stringify(breakdown), isRising ? 1 : 0, c.id);
    }
  });

  run();
  console.log(`[db] rescored ${stale.length} creator(s) onto translated breakdowns`);
}
