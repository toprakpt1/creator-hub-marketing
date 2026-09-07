import { findExistingChannelIds, getCreatorById, saveVideosAndRescore } from "@/lib/db/creators";
import {
  canAffordSearch,
  completeRun,
  failRun,
  findCachedRun,
  recordDeepAnalysis,
  startRun,
} from "@/lib/db/runs";
import {
  fetchChannels,
  fetchUploads,
  fetchVideoStats,
  searchVideos,
  thumbnailOf,
  toInt,
  YouTubeApiError,
} from "@/lib/youtube/client";
import type { DiscoveryCandidate, DiscoveryQuery, DiscoveryRun } from "@/lib/types";

/**
 * Discovery orchestration — the only place a search is executed.
 *
 * Cost shape per run: exactly ONE search.list (100 units) plus one
 * channels.list per 50 unique channels (1 unit each). Deep video analysis is a
 * separate, explicit step, so a wide search never triggers hundreds of calls.
 */

export interface DiscoveryOutcome {
  run: DiscoveryRun;
  candidates: DiscoveryCandidate[];
  nextPageToken: string | null;
  /** True when results came from a previous run and no quota was spent. */
  fromCache: boolean;
}

export class QuotaGuardError extends Error {
  constructor(readonly used: number, readonly limit: number) {
    super(
      `This search would exceed today's YouTube quota allowance (${used}/${limit} units used).`
    );
    this.name = "QuotaGuardError";
  }
}

export class CachedRunError extends Error {
  constructor(readonly outcome: DiscoveryOutcome) {
    super("An identical search was run recently.");
    this.name = "CachedRunError";
  }
}

function publishedAfterIso(days?: number): string | null {
  if (!days || days <= 0) return null;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/**
 * Runs one discovery search.
 *
 * Throws `CachedRunError` (carrying the cached results) when an identical
 * search ran recently and `force` was not set — the caller decides whether to
 * show the cached run or spend quota again.
 */
export async function runDiscovery(query: DiscoveryQuery): Promise<DiscoveryOutcome> {
  if (!query.force) {
    const cached = findCachedRun(query);
    if (cached) {
      throw new CachedRunError({
        run: cached.run,
        candidates: cached.candidates,
        nextPageToken: cached.run.nextPageToken,
        fromCache: true,
      });
    }
  }

  const affordability = canAffordSearch();
  if (!affordability.ok) {
    throw new QuotaGuardError(affordability.usage.totalUnits, affordability.usage.dailyLimit);
  }

  const publishedAfter = publishedAfterIso(query.publishedWithinDays);
  const runId = startRun(query, publishedAfter);

  try {
    /* 1 — one search.list. This is the only 100-unit call in the run. */
    const search = await searchVideos(
      {
        q: query.keyword.trim(),
        maxResults: query.maxResults,
        regionCode: query.region || undefined,
        relevanceLanguage: query.language || undefined,
        publishedAfter: publishedAfter ?? undefined,
        pageToken: query.pageToken,
      },
      { runId }
    );

    const items = search.items ?? [];

    /* 2 — collapse videos to unique channels, keeping the video that matched. */
    const byChannel = new Map<
      string,
      { title: string; videoId: string | null; videoTitle: string; publishedAt: string }
    >();
    for (const item of items) {
      const channelId = item.snippet?.channelId;
      if (!channelId || byChannel.has(channelId)) continue;
      byChannel.set(channelId, {
        title: item.snippet.channelTitle,
        videoId: item.id?.videoId ?? null,
        videoTitle: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
      });
    }
    const channelIds = [...byChannel.keys()];

    /* 3 — which of these do we already store? */
    const existing = findExistingChannelIds(channelIds);

    /* 4 — batched channel statistics (1 unit per 50 ids). */
    const channels = channelIds.length ? await fetchChannels(channelIds, { runId }) : [];
    const statsById = new Map(channels.map((c) => [c.id, c]));

    /* 5 — cheap subscriber filter. Hidden counts are never auto-rejected. */
    const candidates: DiscoveryCandidate[] = channelIds.map((channelId) => {
      const match = byChannel.get(channelId)!;
      const channel = statsById.get(channelId);
      const stats = channel?.statistics;
      const hidden = stats?.hiddenSubscriberCount === true;
      const subs = hidden ? null : toInt(stats?.subscriberCount);

      let passesFilter = true;
      let filterReason: string | null = null;

      if (!channel) {
        passesFilter = false;
        filterReason = "Channel details unavailable";
      } else if (!hidden && subs !== null) {
        if (subs < query.minSubscribers) {
          passesFilter = false;
          filterReason = `Below ${query.minSubscribers.toLocaleString("en-US")} subscribers`;
        } else if (subs > query.maxSubscribers) {
          passesFilter = false;
          filterReason = `Above ${query.maxSubscribers.toLocaleString("en-US")} subscribers`;
        }
      }

      return {
        youtubeChannelId: channelId,
        name: channel?.snippet?.title ?? match.title,
        handle: channel?.snippet?.customUrl ?? null,
        description: channel?.snippet?.description ?? null,
        thumbnailUrl: thumbnailOf(channel?.snippet?.thumbnails),
        country: channel?.snippet?.country ?? null,
        subscriberCount: subs,
        subscriberCountHidden: hidden,
        channelTotalViews: toInt(stats?.viewCount),
        channelVideoCount: toInt(stats?.videoCount),
        uploadsPlaylistId: channel?.contentDetails?.relatedPlaylists?.uploads ?? null,
        channelPublishedAt: channel?.snippet?.publishedAt ?? null,
        matchedVideoId: match.videoId,
        matchedVideoTitle: match.videoTitle,
        matchedVideoPublishedAt: match.publishedAt,
        keyword: query.keyword.trim().toLowerCase(),
        alreadySaved: existing.has(channelId),
        passesFilter,
        filterReason,
      };
    });

    // Most promising first: highest subscriber count inside the window reads
    // as the strongest candidate before any video analysis exists.
    candidates.sort((a, b) => {
      if (a.passesFilter !== b.passesFilter) return a.passesFilter ? -1 : 1;
      return (b.subscriberCount ?? 0) - (a.subscriberCount ?? 0);
    });

    completeRun(runId, {
      rawResults: items.length,
      uniqueChannelsFound: channelIds.length,
      existingCreatorsFound: existing.size,
      creatorsPassingFilter: candidates.filter((c) => c.passesFilter && !c.alreadySaved).length,
      nextPageToken: search.nextPageToken ?? null,
      candidates,
    });

    const stored = findCachedRun({ ...query, force: false });
    return {
      run: stored!.run,
      candidates,
      nextPageToken: search.nextPageToken ?? null,
      fromCache: false,
    };
  } catch (error) {
    const message =
      error instanceof YouTubeApiError ? error.message : "Discovery failed unexpectedly.";
    failRun(runId, message);
    throw error;
  }
}

/**
 * Deep analysis for one saved creator: reads the uploads playlist, then pulls
 * statistics for those videos in a single batched request.
 *
 * Cost: 1 (playlistItems.list) + 1 (videos.list) = 2 units per creator.
 */
export async function analyzeCreator(creatorId: string, videoCount = 10, runId?: string) {
  const creator = getCreatorById(creatorId);
  if (!creator) return { ok: false as const, reason: "Creator not found" };
  if (!creator.uploadsPlaylistId) {
    return { ok: false as const, reason: "This channel has no uploads playlist" };
  }

  const uploads = await fetchUploads(creator.uploadsPlaylistId, videoCount, { runId });
  const videoIds = uploads
    .map((u) => u.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id));

  if (videoIds.length === 0) {
    return { ok: false as const, reason: "No recent uploads found" };
  }

  const stats = await fetchVideoStats(videoIds, { runId });

  const videos = stats.map((v) => ({
    videoId: v.id,
    title: v.snippet?.title ?? "Untitled",
    publishedAt: v.snippet?.publishedAt ?? new Date().toISOString(),
    thumbnailUrl: thumbnailOf(v.snippet?.thumbnails),
    viewCount: toInt(v.statistics?.viewCount),
    likeCount: toInt(v.statistics?.likeCount),
    commentCount: toInt(v.statistics?.commentCount),
    duration: v.contentDetails?.duration ?? null,
  }));

  const updated = saveVideosAndRescore(creatorId, videos);
  if (runId) recordDeepAnalysis(runId, 1);

  return { ok: true as const, creator: updated, videosAnalyzed: videos.length };
}
