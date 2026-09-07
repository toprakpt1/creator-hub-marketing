import type { CreatorMetrics } from "@/lib/scoring/metrics";

/**
 * Rule-based creator score, 0–100. Deliberately transparent and replaceable:
 * every component is stored in `scoreBreakdown` so a low score can always be
 * explained, and the whole file can be swapped for a model later without
 * touching callers.
 *
 * Weights (per the phase-1 spec):
 *   35  view / subscriber performance
 *   25  recent activity
 *   20  average & median views
 *   20  keyword relevance
 */

export const SCORE_WEIGHTS = {
  performance: 35,
  activity: 25,
  reach: 20,
  relevance: 20,
} as const;

export interface ScoreInput {
  subscriberCount: number | null;
  subscriberCountHidden: boolean;
  metrics: CreatorMetrics;
  /** Keywords this creator was discovered by. */
  keywords: string[];
  /** Channel title + description, used for the relevance signal. */
  text?: string;
}

export interface ScoreComponent {
  key: keyof typeof SCORE_WEIGHTS;
  earned: number;
  max: number;
  /**
   * Dictionary key plus its numbers, rather than a finished sentence: the
   * breakdown is stored once but read in whichever language the user picked.
   */
  detailKey: string;
  detailVars?: Record<string, string | number>;
}

export interface ScoreResult {
  score: number;
  isRising: boolean;
  breakdown: ScoreComponent[];
}

/** Maps a value onto 0..1 across a range, clamped at both ends. */
const scale = (value: number, min: number, max: number) =>
  Math.max(0, Math.min(1, (value - min) / (max - min)));

function performanceComponent(input: ScoreInput): ScoreComponent {
  const { viewToSubscriberRatio } = input.metrics;
  const max = SCORE_WEIGHTS.performance;

  if (viewToSubscriberRatio === null) {
    // No ratio available (hidden subs, or no videos analysed yet). Award a
    // neutral half rather than punishing a creator for missing data.
    return {
      key: "performance",
      earned: Math.round(max * 0.5),
      max,
      detailKey: input.subscriberCountHidden
        ? "scoreComponents.performanceHidden"
        : "scoreComponents.performanceNoData",
    };
  }

  // 0.1× → nothing, 2.0× → full marks. Above 2× is already exceptional.
  const earned = Math.round(max * scale(viewToSubscriberRatio, 0.1, 2));
  return {
    key: "performance",
    earned,
    max,
    detailKey: "scoreComponents.performanceDetail",
    detailVars: { ratio: viewToSubscriberRatio.toFixed(2) },
  };
}

function activityComponent(input: ScoreInput): ScoreComponent {
  const { daysSinceLastUpload, uploadsLast30Days } = input.metrics;
  const max = SCORE_WEIGHTS.activity;

  if (daysSinceLastUpload === null) {
    return {
      key: "activity",
      earned: 0,
      max,
      detailKey: "scoreComponents.activityNoData",
    };
  }

  // Two thirds for recency, one third for cadence.
  const recency = scale(60 - daysSinceLastUpload, 0, 60);
  const cadence = scale(uploadsLast30Days, 0, 4);
  const earned = Math.round(max * (recency * 0.65 + cadence * 0.35));

  return {
    key: "activity",
    earned,
    max,
    detailKey: "scoreComponents.activityDetail",
    detailVars: { days: daysSinceLastUpload, uploads: uploadsLast30Days },
  };
}

function reachComponent(input: ScoreInput): ScoreComponent {
  const { averageViews, medianViews } = input.metrics;
  const max = SCORE_WEIGHTS.reach;

  if (averageViews === null) {
    return { key: "reach", earned: 0, max, detailKey: "scoreComponents.reachNoData" };
  }

  // Log-ish curve: 200 views → low, 20k → full. Median is weighted equally so
  // one viral outlier cannot carry an otherwise flat channel.
  const avgPart = scale(Math.log10(Math.max(averageViews, 1)), Math.log10(200), Math.log10(20000));
  const medPart = scale(
    Math.log10(Math.max(medianViews ?? averageViews, 1)),
    Math.log10(200),
    Math.log10(20000)
  );
  const earned = Math.round(max * (avgPart * 0.5 + medPart * 0.5));

  return {
    key: "reach",
    earned,
    max,
    detailKey: "scoreComponents.reachDetail",
    detailVars: { average: averageViews, median: medianViews ?? 0 },
  };
}

function relevanceComponent(input: ScoreInput): ScoreComponent {
  const max = SCORE_WEIGHTS.relevance;
  const haystack = (input.text ?? "").toLowerCase();

  // Match individual words, not the whole phrase: a channel called
  // "Indie Game Clinic" is clearly relevant to "roguelike indie game" even
  // though that exact string appears nowhere.
  const words = new Set(
    input.keywords
      .flatMap((k: string) => k.toLowerCase().split(/\s+/))
      .filter((w) => w.length > 2)
  );
  const wordHits = [...words].filter((w) => haystack.includes(w)).length;

  // Being found by several keywords is itself evidence of relevance.
  const breadth = scale(input.keywords.length, 1, 3);
  const textual = scale(wordHits, 0, 3);
  const earned = Math.round(max * (breadth * 0.4 + textual * 0.6));

  return {
    key: "relevance",
    earned,
    max,
    detailKey:
      input.keywords.length > 0
        ? "scoreComponents.relevanceDetail"
        : "scoreComponents.relevanceNoKeywords",
    detailVars: { keywords: input.keywords.join(", ") },
  };
}

/**
 * Rising = the channel out-performs what its subscriber count predicts, and is
 * still actively publishing. Small channels benefit most, which is the point.
 */
export function computeRising(input: ScoreInput): boolean {
  const { viewToSubscriberRatio, daysSinceLastUpload, medianViews, videosAnalyzed } = input.metrics;
  const subs = input.subscriberCount;
  if (viewToSubscriberRatio === null || subs === null || subs <= 0) return false;
  if (videosAnalyzed < 3) return false;

  const active = daysSinceLastUpload !== null && daysSinceLastUpload <= 45;
  const small = subs <= 50_000;

  // Judge on the MEDIAN, not the average. One viral video inflates the average
  // (avg 50k / median 200 on a 1k channel is not a rising creator), while a
  // genuinely strong small channel clears the bar on its typical video too.
  const medianRatio = (medianViews ?? 0) / subs;
  const overperforming = medianRatio >= 1.0 && viewToSubscriberRatio >= 1.5;

  return overperforming && active && small;
}

export function computeScore(input: ScoreInput): ScoreResult {
  const breakdown = [
    performanceComponent(input),
    activityComponent(input),
    reachComponent(input),
    relevanceComponent(input),
  ];

  const score = Math.max(
    0,
    Math.min(100, breakdown.reduce((sum, c) => sum + c.earned, 0))
  );

  return { score, isRising: computeRising(input), breakdown };
}
