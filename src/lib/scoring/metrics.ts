/**
 * Locally computed creator metrics.
 *
 * Nothing here costs API quota — every value is derived from video rows we
 * already stored. Keep it that way.
 */

export interface AnalyzedVideo {
  publishedAt: string;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
}

export interface CreatorMetrics {
  averageViews: number | null;
  medianViews: number | null;
  maxRecentViews: number | null;
  minRecentViews: number | null;
  averageLikes: number | null;
  averageComments: number | null;
  videosAnalyzed: number;
  uploadsLast30Days: number;
  uploadsLast90Days: number;
  daysSinceLastUpload: number | null;
  lastUploadAt: string | null;
  viewToSubscriberRatio: number | null;
}

const DAY = 86_400_000;

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export function computeMetrics(
  videos: AnalyzedVideo[],
  subscriberCount: number | null,
  now = Date.now()
): CreatorMetrics {
  const views = videos.map((v) => v.viewCount).filter((v): v is number => v !== null);
  const likes = videos.map((v) => v.likeCount).filter((v): v is number => v !== null);
  const comments = videos.map((v) => v.commentCount).filter((v): v is number => v !== null);

  const timestamps = videos
    .map((v) => Date.parse(v.publishedAt))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a);

  const lastUpload = timestamps[0] ?? null;
  const averageViews = mean(views);

  // Guard the ratio: a hidden or zero subscriber count would otherwise divide
  // by zero and make every such creator look infinitely promising.
  const ratio =
    averageViews !== null && subscriberCount !== null && subscriberCount > 0
      ? Math.round((averageViews / subscriberCount) * 100) / 100
      : null;

  return {
    averageViews,
    medianViews: median(views),
    maxRecentViews: views.length ? Math.max(...views) : null,
    minRecentViews: views.length ? Math.min(...views) : null,
    averageLikes: mean(likes),
    averageComments: mean(comments),
    videosAnalyzed: videos.length,
    uploadsLast30Days: timestamps.filter((t) => now - t <= 30 * DAY).length,
    uploadsLast90Days: timestamps.filter((t) => now - t <= 90 * DAY).length,
    daysSinceLastUpload: lastUpload === null ? null : Math.floor((now - lastUpload) / DAY),
    lastUploadAt: lastUpload === null ? null : new Date(lastUpload).toISOString(),
    viewToSubscriberRatio: ratio,
  };
}
