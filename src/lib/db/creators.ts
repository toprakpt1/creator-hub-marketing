import { randomUUID } from "node:crypto";
import { getDb, nowIso } from "@/lib/db/client";
import { computeMetrics, type AnalyzedVideo } from "@/lib/scoring/metrics";
import { computeScore } from "@/lib/scoring/score";
import type {
  Creator,
  CreatorStatus,
  CreatorVideo,
  DiscoveryCandidate,
  EmailSource,
  EmailStatus,
  ScoreComponentRecord,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Row mapping                                                         */
/* ------------------------------------------------------------------ */

interface CreatorRow {
  id: string;
  platform: string;
  youtube_channel_id: string | null;
  name: string;
  handle: string | null;
  description: string | null;
  thumbnail_url: string | null;
  country: string | null;
  subscriber_count: number | null;
  subscriber_count_hidden: number;
  channel_total_views: number | null;
  channel_video_count: number | null;
  uploads_playlist_id: string | null;
  channel_published_at: string | null;
  average_views: number | null;
  median_views: number | null;
  max_recent_views: number | null;
  min_recent_views: number | null;
  average_likes: number | null;
  average_comments: number | null;
  videos_analyzed: number;
  view_to_subscriber_ratio: number | null;
  uploads_last_30_days: number | null;
  uploads_last_90_days: number | null;
  days_since_last_upload: number | null;
  last_upload_at: string | null;
  creator_score: number | null;
  score_breakdown: string | null;
  is_rising: number;
  status: string;
  email: string | null;
  email_source: string;
  email_status: string;
  discovered_at: string;
  last_synced_at: string | null;
  videos_synced_at: string | null;
  created_at: string;
  updated_at: string;
  keywords?: string | null;
}

/** GROUP_CONCAT separator — keywords may contain commas, so use a control char. */
const KEYWORD_SEP = String.fromCharCode(31);

function mapCreator(row: CreatorRow): Creator {
  let breakdown: ScoreComponentRecord[] = [];
  if (row.score_breakdown) {
    try {
      breakdown = JSON.parse(row.score_breakdown) as ScoreComponentRecord[];
    } catch {
      breakdown = [];
    }
  }
  return {
    id: row.id,
    platform: row.platform as Creator["platform"],
    youtubeChannelId: row.youtube_channel_id,
    name: row.name,
    handle: row.handle,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    country: row.country,
    subscriberCount: row.subscriber_count,
    subscriberCountHidden: row.subscriber_count_hidden === 1,
    channelTotalViews: row.channel_total_views,
    channelVideoCount: row.channel_video_count,
    uploadsPlaylistId: row.uploads_playlist_id,
    channelPublishedAt: row.channel_published_at,
    averageViews: row.average_views,
    medianViews: row.median_views,
    maxRecentViews: row.max_recent_views,
    minRecentViews: row.min_recent_views,
    averageLikes: row.average_likes,
    averageComments: row.average_comments,
    videosAnalyzed: row.videos_analyzed,
    viewToSubscriberRatio: row.view_to_subscriber_ratio,
    uploadsLast30Days: row.uploads_last_30_days,
    uploadsLast90Days: row.uploads_last_90_days,
    daysSinceLastUpload: row.days_since_last_upload,
    lastUploadAt: row.last_upload_at,
    creatorScore: row.creator_score,
    scoreBreakdown: breakdown,
    isRising: row.is_rising === 1,
    status: row.status as CreatorStatus,
    email: row.email,
    emailSource: row.email_source as EmailSource,
    emailStatus: row.email_status as EmailStatus,
    discoveredKeywords: row.keywords ? row.keywords.split(KEYWORD_SEP).filter(Boolean) : [],
    discoveredAt: row.discovered_at,
    lastSyncedAt: row.last_synced_at,
    videosSyncedAt: row.videos_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GROUP_CONCAT with a unit separator: keywords may legitimately contain commas.
const SELECT_CREATOR = `
  SELECT c.*, (
    SELECT GROUP_CONCAT(k.keyword, char(31))
    FROM creator_keywords k WHERE k.creator_id = c.id
  ) AS keywords
  FROM creators c
`;

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function listCreators(): Creator[] {
  const rows = getDb()
    .prepare(`${SELECT_CREATOR} ORDER BY c.creator_score DESC NULLS LAST, c.discovered_at DESC`)
    .all() as CreatorRow[];
  return rows.map(mapCreator);
}

export function getCreatorById(id: string): Creator | null {
  const row = getDb().prepare(`${SELECT_CREATOR} WHERE c.id = ?`).get(id) as CreatorRow | undefined;
  return row ? mapCreator(row) : null;
}

/** Channel ids we already store — the deduplication lookup. */
export function findExistingChannelIds(channelIds: string[]): Set<string> {
  if (channelIds.length === 0) return new Set();
  const found = new Set<string>();
  const db = getDb();
  // SQLite caps variables per statement; chunk to stay well under it.
  for (let i = 0; i < channelIds.length; i += 400) {
    const batch = channelIds.slice(i, i + 400);
    const placeholders = batch.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT youtube_channel_id FROM creators WHERE youtube_channel_id IN (${placeholders})`
      )
      .all(...batch) as { youtube_channel_id: string }[];
    rows.forEach((r) => found.add(r.youtube_channel_id));
  }
  return found;
}

export function getCreatorByChannelId(channelId: string): Creator | null {
  const row = getDb()
    .prepare(`${SELECT_CREATOR} WHERE c.youtube_channel_id = ?`)
    .get(channelId) as CreatorRow | undefined;
  return row ? mapCreator(row) : null;
}

export function listVideos(creatorId: string): CreatorVideo[] {
  interface VideoRow {
    video_id: string; creator_id: string; title: string; published_at: string;
    thumbnail_url: string | null; view_count: number | null; like_count: number | null;
    comment_count: number | null; duration: string | null; fetched_at: string;
  }
  const rows = getDb()
    .prepare(`SELECT * FROM youtube_videos WHERE creator_id = ? ORDER BY published_at DESC`)
    .all(creatorId) as VideoRow[];
  return rows.map((r) => ({
    videoId: r.video_id,
    creatorId: r.creator_id,
    title: r.title,
    publishedAt: r.published_at,
    thumbnailUrl: r.thumbnail_url,
    viewCount: r.view_count,
    likeCount: r.like_count,
    commentCount: r.comment_count,
    duration: r.duration,
    fetchedAt: r.fetched_at,
  }));
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

const INSERT_CREATOR = `
  INSERT INTO creators (
    id, platform, youtube_channel_id, name, handle, description, thumbnail_url, country,
    subscriber_count, subscriber_count_hidden, channel_total_views, channel_video_count,
    uploads_playlist_id, channel_published_at, status, email_source, email_status,
    discovered_at, last_synced_at, created_at, updated_at
  ) VALUES (
    @id, 'youtube', @channelId, @name, @handle, @description, @thumbnailUrl, @country,
    @subscriberCount, @subscriberHidden, @totalViews, @videoCount,
    @uploadsPlaylistId, @channelPublishedAt, 'new', 'none', 'not_checked',
    @now, @now, @now, @now
  )
  ON CONFLICT(youtube_channel_id) DO NOTHING
`;

/**
 * Saves candidates as creators. Deduplication is enforced by the UNIQUE index
 * on `youtube_channel_id`, so concurrent calls cannot create twins.
 * Returns the number actually inserted.
 */
export function saveCandidates(candidates: DiscoveryCandidate[]): {
  added: number;
  skipped: number;
  ids: string[];
} {
  const db = getDb();
  const insert = db.prepare(INSERT_CREATOR);
  const linkKeyword = db.prepare(
    `INSERT OR IGNORE INTO creator_keywords (creator_id, keyword, first_seen) VALUES (?, ?, ?)`
  );
  const findId = db.prepare(`SELECT id FROM creators WHERE youtube_channel_id = ?`);

  let added = 0;
  let skipped = 0;
  const ids: string[] = [];

  const run = db.transaction(() => {
    for (const c of candidates) {
      const now = nowIso();
      const result = insert.run({
        id: randomUUID(),
        channelId: c.youtubeChannelId,
        name: c.name,
        handle: c.handle,
        description: c.description,
        thumbnailUrl: c.thumbnailUrl,
        country: c.country,
        subscriberCount: c.subscriberCount,
        subscriberHidden: c.subscriberCountHidden ? 1 : 0,
        totalViews: c.channelTotalViews,
        videoCount: c.channelVideoCount,
        uploadsPlaylistId: c.uploadsPlaylistId,
        channelPublishedAt: c.channelPublishedAt,
        now,
      });

      if (result.changes > 0) added++;
      else skipped++;

      const row = findId.get(c.youtubeChannelId) as { id: string } | undefined;
      if (row) {
        ids.push(row.id);
        // Keywords accumulate across runs — a creator found three ways keeps all three.
        linkKeyword.run(row.id, c.keyword, now);
      }
    }
  });
  run();

  return { added, skipped, ids };
}

/** Replaces a creator's analysed videos and recomputes every derived metric. */
export function saveVideosAndRescore(
  creatorId: string,
  videos: Omit<CreatorVideo, "creatorId" | "fetchedAt">[]
): Creator | null {
  const db = getDb();
  const creator = getCreatorById(creatorId);
  if (!creator) return null;

  const now = nowIso();

  const run = db.transaction(() => {
    db.prepare(`DELETE FROM youtube_videos WHERE creator_id = ?`).run(creatorId);
    const insert = db.prepare(
      `INSERT INTO youtube_videos
         (video_id, creator_id, title, published_at, thumbnail_url,
          view_count, like_count, comment_count, duration, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const v of videos) {
      insert.run(
        v.videoId,
        creatorId,
        v.title,
        v.publishedAt,
        v.thumbnailUrl,
        v.viewCount,
        v.likeCount,
        v.commentCount,
        v.duration,
        now
      );
    }

    const analyzed: AnalyzedVideo[] = videos.map((v) => ({
      publishedAt: v.publishedAt,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      commentCount: v.commentCount,
    }));

    const metrics = computeMetrics(analyzed, creator.subscriberCount);
    const { score, isRising, breakdown } = computeScore({
      subscriberCount: creator.subscriberCount,
      subscriberCountHidden: creator.subscriberCountHidden,
      metrics,
      keywords: creator.discoveredKeywords,
      text: `${creator.name} ${creator.description ?? ""}`,
    });

    db.prepare(
      `UPDATE creators SET
         average_views = ?, median_views = ?, max_recent_views = ?, min_recent_views = ?,
         average_likes = ?, average_comments = ?, videos_analyzed = ?,
         view_to_subscriber_ratio = ?, uploads_last_30_days = ?, uploads_last_90_days = ?,
         days_since_last_upload = ?, last_upload_at = ?,
         creator_score = ?, score_breakdown = ?, is_rising = ?,
         videos_synced_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      metrics.averageViews,
      metrics.medianViews,
      metrics.maxRecentViews,
      metrics.minRecentViews,
      metrics.averageLikes,
      metrics.averageComments,
      metrics.videosAnalyzed,
      metrics.viewToSubscriberRatio,
      metrics.uploadsLast30Days,
      metrics.uploadsLast90Days,
      metrics.daysSinceLastUpload,
      metrics.lastUploadAt,
      score,
      JSON.stringify(breakdown),
      isRising ? 1 : 0,
      now,
      now,
      creatorId
    );
  });
  run();

  return getCreatorById(creatorId);
}

export function updateCreatorEmail(
  id: string,
  email: string | null,
  source: EmailSource,
  status: EmailStatus
): Creator | null {
  getDb()
    .prepare(
      `UPDATE creators SET email = ?, email_source = ?, email_status = ?, updated_at = ? WHERE id = ?`
    )
    .run(email, source, status, nowIso(), id);
  return getCreatorById(id);
}

export function updateCreatorStatus(id: string, status: CreatorStatus): Creator | null {
  getDb()
    .prepare(`UPDATE creators SET status = ?, updated_at = ? WHERE id = ?`)
    .run(status, nowIso(), id);
  return getCreatorById(id);
}

export function deleteCreator(id: string): boolean {
  return getDb().prepare(`DELETE FROM creators WHERE id = ?`).run(id).changes > 0;
}

/* ------------------------------------------------------------------ */
/* Aggregates for the dashboard                                        */
/* ------------------------------------------------------------------ */

export interface CreatorStats {
  total: number;
  qualified: number;
  rising: number;
  withEmail: number;
  analyzed: number;
  avgScore: number | null;
  byCountry: { country: string; count: number }[];
  bySubscriberBucket: { bucket: string; count: number }[];
  byStatus: { status: string; count: number }[];
  topKeywords: { keyword: string; count: number }[];
  discoveredByDay: { day: string; count: number }[];
}

export function getCreatorStats(): CreatorStats {
  const db = getDb();
  const one = <T>(sql: string): T => db.prepare(sql).get() as T;

  const totals = one<{
    total: number;
    qualified: number;
    rising: number;
    withEmail: number;
    analyzed: number;
    avgScore: number | null;
  }>(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status IN ('qualified','shortlisted','ready_to_contact') THEN 1 ELSE 0 END) AS qualified,
      SUM(CASE WHEN is_rising = 1 THEN 1 ELSE 0 END) AS rising,
      SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS withEmail,
      SUM(CASE WHEN videos_analyzed > 0 THEN 1 ELSE 0 END) AS analyzed,
      AVG(creator_score) AS avgScore
    FROM creators
  `);

  const byCountry = db
    .prepare(
      `SELECT COALESCE(country, 'Unknown') AS country, COUNT(*) AS count
       FROM creators GROUP BY country ORDER BY count DESC LIMIT 10`
    )
    .all() as { country: string; count: number }[];

  const bySubscriberBucket = db
    .prepare(
      `SELECT CASE
          WHEN subscriber_count IS NULL THEN 'Hidden'
          WHEN subscriber_count < 100 THEN '10–100'
          WHEN subscriber_count < 500 THEN '100–500'
          WHEN subscriber_count < 1000 THEN '500–1K'
          WHEN subscriber_count < 5000 THEN '1K–5K'
          WHEN subscriber_count < 10000 THEN '5K–10K'
          ELSE '10K–50K'
        END AS bucket, COUNT(*) AS count
       FROM creators GROUP BY bucket`
    )
    .all() as { bucket: string; count: number }[];

  const byStatus = db
    .prepare(`SELECT status, COUNT(*) AS count FROM creators GROUP BY status ORDER BY count DESC`)
    .all() as { status: string; count: number }[];

  const topKeywords = db
    .prepare(
      `SELECT keyword, COUNT(*) AS count FROM creator_keywords
       GROUP BY keyword ORDER BY count DESC LIMIT 10`
    )
    .all() as { keyword: string; count: number }[];

  const discoveredByDay = db
    .prepare(
      `SELECT substr(discovered_at, 1, 10) AS day, COUNT(*) AS count
       FROM creators GROUP BY day ORDER BY day DESC LIMIT 30`
    )
    .all() as { day: string; count: number }[];

  return {
    total: totals.total ?? 0,
    qualified: totals.qualified ?? 0,
    rising: totals.rising ?? 0,
    withEmail: totals.withEmail ?? 0,
    analyzed: totals.analyzed ?? 0,
    avgScore: totals.avgScore === null ? null : Math.round(totals.avgScore * 10) / 10,
    byCountry,
    bySubscriberBucket,
    byStatus,
    topKeywords,
    discoveredByDay: discoveredByDay.reverse(),
  };
}

/** Distinct keywords, for the Creators page filter. */
export function listKnownKeywords(): string[] {
  return (
    getDb().prepare(`SELECT DISTINCT keyword FROM creator_keywords ORDER BY keyword`).all() as {
      keyword: string;
    }[]
  ).map((r) => r.keyword);
}

/** Fetch several creators by id, preserving the given order. */
export function getCreators(ids: string[]): Creator[] {
  if (ids.length === 0) return [];
  const byId = new Map(listCreators().map((c) => [c.id, c]));
  return ids.map((id) => byId.get(id)).filter((c): c is Creator => Boolean(c));
}
