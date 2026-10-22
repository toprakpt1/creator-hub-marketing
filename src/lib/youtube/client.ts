import { getDb, nowIso, todayKey } from "@/lib/db/client";

/**
 * Low-level YouTube Data API v3 client.
 *
 * Every call goes through `callApi`, which records the request's documented
 * quota cost before returning. That is the only place quota is spent, so the
 * usage meter can never drift from reality.
 */

/** Documented quota cost per endpoint (units). search.list is 100× the rest. */
export const QUOTA_COST = {
  "search.list": 100,
  "channels.list": 1,
  "playlistItems.list": 1,
  "videos.list": 1,
} as const;

export type YouTubeEndpoint = keyof typeof QUOTA_COST;

const API_BASE = "https://www.googleapis.com/youtube/v3";

export class YouTubeApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    /** True when retrying later could succeed (quota resets at midnight PT). */
    readonly retryable = false
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

function requireApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new YouTubeApiError(
      "YOUTUBE_API_KEY is not set. Add it to .env.local and restart the server.",
      "missing_api_key",
      500
    );
  }
  return key;
}

/** Records one request against today's usage before the response is returned. */
function recordUsage(endpoint: YouTubeEndpoint, runId?: string) {
  getDb()
    .prepare(
      `INSERT INTO api_usage (endpoint, quota_units, run_id, day, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(endpoint, QUOTA_COST[endpoint], runId ?? null, todayKey(), nowIso());
}

/** Maps Google's error payload onto something safe to show a user. */
function translateError(status: number, body: unknown): YouTubeApiError {
  const err = (
    body as {
      error?: {
        message?: string;
        errors?: { reason?: string }[];
        details?: { reason?: string }[];
      };
    }
  )?.error;
  const reason = err?.errors?.[0]?.reason ?? "";
  const detailReason = err?.details?.find((d) => d.reason)?.reason ?? "";

  // The API exists but is switched off (or excluded by the key's API restriction).
  // Distinct from a bad key, and fixed in a different place, so say so.
  if (detailReason === "API_KEY_SERVICE_BLOCKED" || detailReason === "SERVICE_DISABLED") {
    return new YouTubeApiError(
      "YouTube Data API v3 is not enabled for this API key. Enable it in Google Cloud Console → APIs & Services → Library, and make sure the key's API restrictions include it.",
      "api_not_enabled",
      403
    );
  }

  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
    return new YouTubeApiError(
      "YouTube API daily quota exhausted. It resets at midnight Pacific Time.",
      "quota_exceeded",
      429,
      true
    );
  }
  if (reason === "keyInvalid" || status === 400) {
    return new YouTubeApiError(
      "The YouTube API key was rejected. Check the key and that YouTube Data API v3 is enabled.",
      "invalid_key",
      400
    );
  }
  if (status === 403) {
    return new YouTubeApiError(
      "YouTube refused the request. The key may be restricted to other APIs, referrers or IPs.",
      "forbidden",
      403
    );
  }
  // Deliberately generic: Google's raw message can echo the key back.
  return new YouTubeApiError(
    "YouTube API request failed. Please try again shortly.",
    "upstream_error",
    status,
    status >= 500
  );
}

export interface CallOptions {
  /** Attributes the quota spend to a discovery run. */
  runId?: string;
}

async function callApi<T>(
  endpoint: YouTubeEndpoint,
  params: Record<string, string | number | undefined>,
  options: CallOptions = {}
): Promise<T> {
  const key = requireApiKey();
  const search = new URLSearchParams({ key });

  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(name, String(value));
  }

  const resource = endpoint.split(".")[0];
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${resource}?${search.toString()}`, {
      // Results are cached in our own database; never at the fetch layer.
      cache: "no-store",
    });
  } catch {
    throw new YouTubeApiError(
      "Could not reach the YouTube API. Check your network connection.",
      "network_error",
      503,
      true
    );
  }

  // The request counted against quota whether or not it succeeded.
  recordUsage(endpoint, options.runId);

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      /* non-JSON error body */
    }
    throw translateError(response.status, body);
  }

  return (await response.json()) as T;
}

/* ------------------------------------------------------------------ */
/* Typed endpoint wrappers                                             */
/* ------------------------------------------------------------------ */

export interface SearchVideoItem {
  id: { videoId?: string };
  snippet: {
    channelId: string;
    channelTitle: string;
    title: string;
    description: string;
    publishedAt: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
  };
}

export interface SearchResponse {
  items?: SearchVideoItem[];
  nextPageToken?: string;
  pageInfo?: { totalResults?: number };
}

export interface SearchParams {
  q: string;
  maxResults: number;
  regionCode?: string;
  relevanceLanguage?: string;
  publishedAfter?: string;
  pageToken?: string;
  order?: string;
}

/** search.list — the expensive one (100 units). Always video-typed. */
export function searchVideos(params: SearchParams, options?: CallOptions) {
  return callApi<SearchResponse>(
    "search.list",
    {
      part: "snippet",
      type: "video",
      q: params.q,
      maxResults: params.maxResults,
      regionCode: params.regionCode,
      relevanceLanguage: params.relevanceLanguage,
      publishedAfter: params.publishedAfter,
      pageToken: params.pageToken,
      order: params.order ?? "relevance",
    },
    options
  );
}

export interface ChannelItem {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    customUrl?: string;
    publishedAt?: string;
    country?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
  };
  statistics?: {
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
    videoCount?: string;
    viewCount?: string;
  };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}

/**
 * channels.list — 1 unit per request regardless of how many ids are passed,
 * so ids are always batched in 50s (the API maximum).
 */
export async function fetchChannels(
  channelIds: string[],
  options?: CallOptions
): Promise<ChannelItem[]> {
  const out: ChannelItem[] = [];
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const data = await callApi<{ items?: ChannelItem[] }>(
      "channels.list",
      { part: "snippet,statistics,contentDetails", id: batch.join(","), maxResults: 50 },
      options
    );
    out.push(...(data.items ?? []));
  }
  return out;
}

/**
 * channels.list by handle — 1 unit. Used when someone adds a creator manually
 * with an @handle instead of a channel id.
 */
export async function fetchChannelByHandle(
  handle: string,
  options?: CallOptions
): Promise<ChannelItem | null> {
  const data = await callApi<{ items?: ChannelItem[] }>(
    "channels.list",
    {
      part: "snippet,statistics,contentDetails",
      forHandle: handle,
      maxResults: 1,
    },
    options
  );
  return data.items?.[0] ?? null;
}

/** channels.list by legacy /user/ name — 1 unit. */
export async function fetchChannelByUsername(
  username: string,
  options?: CallOptions
): Promise<ChannelItem | null> {
  const data = await callApi<{ items?: ChannelItem[] }>(
    "channels.list",
    {
      part: "snippet,statistics,contentDetails",
      forUsername: username,
      maxResults: 1,
    },
    options
  );
  return data.items?.[0] ?? null;
}

export interface PlaylistItem {
  contentDetails?: { videoId?: string; videoPublishedAt?: string };
  snippet?: {
    title?: string;
    publishedAt?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
  };
}

/** playlistItems.list — 1 unit. Used to read a channel's uploads playlist. */
export async function fetchUploads(
  uploadsPlaylistId: string,
  maxResults: number,
  options?: CallOptions
): Promise<PlaylistItem[]> {
  const data = await callApi<{ items?: PlaylistItem[] }>(
    "playlistItems.list",
    {
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: Math.min(maxResults, 50),
    },
    options
  );
  return data.items ?? [];
}

export interface VideoItem {
  id: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
  };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
}

/**
 * videos.list — 1 unit per request, ids batched in 50s. This is the supported
 * way to read statistics in bulk; there is no cheaper documented endpoint.
 */
export async function fetchVideoStats(
  videoIds: string[],
  options?: CallOptions
): Promise<VideoItem[]> {
  const out: VideoItem[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await callApi<{ items?: VideoItem[] }>(
      "videos.list",
      { part: "snippet,statistics,contentDetails", id: batch.join(","), maxResults: 50 },
      options
    );
    out.push(...(data.items ?? []));
  }
  return out;
}

export const thumbnailOf = (t?: { medium?: { url?: string }; default?: { url?: string } }) =>
  t?.medium?.url ?? t?.default?.url ?? null;

export const toInt = (v?: string) => (v === undefined ? null : Number.parseInt(v, 10));
