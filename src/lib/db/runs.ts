import { randomUUID } from "node:crypto";
import { getDb, nowIso, todayKey } from "@/lib/db/client";
import { QUOTA_COST } from "@/lib/youtube/client";
import type { DiscoveryCandidate, DiscoveryQuery, DiscoveryRun, QuotaUsage } from "@/lib/types";

/**
 * Discovery-run bookkeeping and quota accounting.
 *
 * A run's candidate payload is cached on the row itself, so re-opening a
 * previous search costs zero quota.
 */

/** Cached searches are considered fresh for this long. */
export const SEARCH_CACHE_TTL_HOURS = 24;
/** Channel statistics are refreshed after this long. */
export const CHANNEL_CACHE_TTL_DAYS = 7;
/** Recent-video statistics are refreshed after this long. */
export const VIDEO_CACHE_TTL_DAYS = 3;

/** Normalised key so "Roguelike " and "roguelike" hit the same cache entry. */
export function cacheKeyFor(query: DiscoveryQuery): string {
  return [
    query.keyword.trim().toLowerCase(),
    query.maxResults,
    query.region ?? "",
    query.language ?? "",
    query.publishedWithinDays ?? "",
    query.minSubscribers,
    query.maxSubscribers,
    query.pageToken ?? "",
  ].join("|");
}

interface RunRow {
  id: string;
  keyword: string;
  region: string | null;
  language: string | null;
  published_after: string | null;
  requested_results: number;
  min_subscribers: number | null;
  max_subscribers: number | null;
  page_token: string | null;
  next_page_token: string | null;
  raw_results: number;
  unique_channels_found: number;
  existing_creators_found: number;
  creators_passing_filter: number;
  new_creators_added: number;
  creators_deep_analyzed: number;
  quota_units_used: number;
  api_requests: number;
  candidates_json: string | null;
  cache_key: string;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

function mapRun(row: RunRow): DiscoveryRun {
  return {
    id: row.id,
    keyword: row.keyword,
    region: row.region,
    language: row.language,
    publishedAfter: row.published_after,
    requestedResults: row.requested_results,
    minSubscribers: row.min_subscribers,
    maxSubscribers: row.max_subscribers,
    pageToken: row.page_token,
    nextPageToken: row.next_page_token,
    rawResults: row.raw_results,
    uniqueChannelsFound: row.unique_channels_found,
    existingCreatorsFound: row.existing_creators_found,
    creatorsPassingFilter: row.creators_passing_filter,
    newCreatorsAdded: row.new_creators_added,
    creatorsDeepAnalyzed: row.creators_deep_analyzed,
    quotaUnitsUsed: row.quota_units_used,
    apiRequests: row.api_requests,
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export function startRun(query: DiscoveryQuery, publishedAfter: string | null): string {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO discovery_runs
         (id, keyword, region, language, published_after, requested_results,
          min_subscribers, max_subscribers, page_token, cache_key, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      query.keyword.trim(),
      query.region ?? null,
      query.language ?? null,
      publishedAfter,
      query.maxResults,
      query.minSubscribers,
      query.maxSubscribers,
      query.pageToken ?? null,
      cacheKeyFor(query),
      nowIso()
    );
  return id;
}

export function completeRun(
  id: string,
  data: {
    rawResults: number;
    uniqueChannelsFound: number;
    existingCreatorsFound: number;
    creatorsPassingFilter: number;
    nextPageToken: string | null;
    candidates: DiscoveryCandidate[];
  }
) {
  const usage = getDb()
    .prepare(
      `SELECT COALESCE(SUM(quota_units), 0) AS units, COUNT(*) AS requests
       FROM api_usage WHERE run_id = ?`
    )
    .get(id) as { units: number; requests: number };

  getDb()
    .prepare(
      `UPDATE discovery_runs SET
         raw_results = ?, unique_channels_found = ?, existing_creators_found = ?,
         creators_passing_filter = ?, next_page_token = ?, candidates_json = ?,
         quota_units_used = ?, api_requests = ?, completed_at = ?
       WHERE id = ?`
    )
    .run(
      data.rawResults,
      data.uniqueChannelsFound,
      data.existingCreatorsFound,
      data.creatorsPassingFilter,
      data.nextPageToken,
      JSON.stringify(data.candidates),
      usage.units,
      usage.requests,
      nowIso(),
      id
    );
}

export function failRun(id: string, message: string) {
  const usage = getDb()
    .prepare(
      `SELECT COALESCE(SUM(quota_units), 0) AS units, COUNT(*) AS requests
       FROM api_usage WHERE run_id = ?`
    )
    .get(id) as { units: number; requests: number };

  getDb()
    .prepare(
      `UPDATE discovery_runs SET error = ?, quota_units_used = ?, api_requests = ?, completed_at = ?
       WHERE id = ?`
    )
    .run(message, usage.units, usage.requests, nowIso(), id);
}

export function recordAddedCreators(runId: string, added: number) {
  getDb()
    .prepare(`UPDATE discovery_runs SET new_creators_added = new_creators_added + ? WHERE id = ?`)
    .run(added, runId);
}

export function recordDeepAnalysis(runId: string, count: number) {
  getDb()
    .prepare(
      `UPDATE discovery_runs SET creators_deep_analyzed = creators_deep_analyzed + ? WHERE id = ?`
    )
    .run(count, runId);
}

/** A completed, error-free run for the same parameters inside the TTL. */
export function findCachedRun(query: DiscoveryQuery): {
  run: DiscoveryRun;
  candidates: DiscoveryCandidate[];
} | null {
  const cutoff = new Date(Date.now() - SEARCH_CACHE_TTL_HOURS * 3600_000).toISOString();
  const row = getDb()
    .prepare(
      `SELECT * FROM discovery_runs
       WHERE cache_key = ? AND error IS NULL AND completed_at IS NOT NULL AND started_at >= ?
       ORDER BY started_at DESC LIMIT 1`
    )
    .get(cacheKeyFor(query), cutoff) as RunRow | undefined;

  if (!row?.candidates_json) return null;
  try {
    return { run: mapRun(row), candidates: JSON.parse(row.candidates_json) as DiscoveryCandidate[] };
  } catch {
    return null;
  }
}

export function getRun(id: string): { run: DiscoveryRun; candidates: DiscoveryCandidate[] } | null {
  const row = getDb().prepare(`SELECT * FROM discovery_runs WHERE id = ?`).get(id) as
    | RunRow
    | undefined;
  if (!row) return null;
  let candidates: DiscoveryCandidate[] = [];
  if (row.candidates_json) {
    try {
      candidates = JSON.parse(row.candidates_json) as DiscoveryCandidate[];
    } catch {
      candidates = [];
    }
  }
  return { run: mapRun(row), candidates };
}

export function listRuns(limit = 50): DiscoveryRun[] {
  const rows = getDb()
    .prepare(`SELECT * FROM discovery_runs ORDER BY started_at DESC LIMIT ?`)
    .all(limit) as RunRow[];
  return rows.map(mapRun);
}

/* ------------------------------------------------------------------ */
/* Quota                                                               */
/* ------------------------------------------------------------------ */

export function getQuotaUsage(): QuotaUsage {
  const db = getDb();
  const day = todayKey();

  const byEndpoint = db
    .prepare(
      `SELECT endpoint, COUNT(*) AS requests, SUM(quota_units) AS units
       FROM api_usage WHERE day = ? GROUP BY endpoint ORDER BY units DESC`
    )
    .all(day) as { endpoint: string; requests: number; units: number }[];

  const totalUnits = byEndpoint.reduce((sum, e) => sum + e.units, 0);
  const searchRequestsToday =
    byEndpoint.find((e) => e.endpoint === "search.list")?.requests ?? 0;

  return {
    day,
    totalUnits,
    dailyLimit: Number(process.env.YOUTUBE_DAILY_QUOTA ?? 10000),
    byEndpoint,
    searchRequestsToday,
  };
}

/** Refuses a search that would exceed the configured daily allowance. */
export function canAffordSearch(): { ok: boolean; usage: QuotaUsage } {
  const usage = getQuotaUsage();
  return {
    ok: usage.totalUnits + QUOTA_COST["search.list"] <= usage.dailyLimit,
    usage,
  };
}
