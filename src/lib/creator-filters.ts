import { SUBSCRIBER_BUCKETS } from "@/lib/constants";
import type { Creator } from "@/lib/types";

export interface CreatorFilters {
  query: string;
  countries: string[];
  statuses: string[];
  keywords: string[];
  /** Subscriber bucket ids from SUBSCRIBER_BUCKETS; empty = all. */
  subscriberBuckets: string[];
  minAvgViews: number | null;
  minMedianViews: number | null;
  minScore: number | null;
  minRatio: number | null;
  risingOnly: boolean;
  /** "any" | "yes" | "no" */
  email: "any" | "yes" | "no";
  /** "any" | "yes" | "no" — whether recent videos have been analysed. */
  analyzed: "any" | "yes" | "no";
  /** Only creators that uploaded within this many days. */
  uploadedWithinDays: number | null;
}

export const EMPTY_FILTERS: CreatorFilters = {
  query: "",
  countries: [],
  statuses: [],
  keywords: [],
  subscriberBuckets: [],
  minAvgViews: null,
  minMedianViews: null,
  minScore: null,
  minRatio: null,
  risingOnly: false,
  email: "any",
  analyzed: "any",
  uploadedWithinDays: null,
};

export const SORT_OPTIONS = [
  { id: "score_desc", labelKey: "sortScoreDesc" },
  { id: "views_desc", labelKey: "sortViewsDesc" },
  { id: "ratio_desc", labelKey: "sortRatioDesc" },
  { id: "subs_desc", labelKey: "sortSubsDesc" },
  { id: "subs_asc", labelKey: "sortSubsAsc" },
  { id: "discovered_desc", labelKey: "sortDiscovered" },
  { id: "active_desc", labelKey: "sortRecentlyActive" },
] as const;

export type SortId = (typeof SORT_OPTIONS)[number]["id"];

export const hasEmail = (c: Creator) => Boolean(c.email && c.email.trim());

function matchesQuery(c: Creator, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    c.name.toLowerCase().includes(needle) ||
    (c.handle ?? "").toLowerCase().includes(needle) ||
    (c.country ?? "").toLowerCase().includes(needle) ||
    (c.email ?? "").toLowerCase().includes(needle) ||
    (c.description ?? "").toLowerCase().includes(needle) ||
    c.discoveredKeywords.some((k) => k.toLowerCase().includes(needle))
  );
}

function matchesBuckets(c: Creator, bucketIds: string[]) {
  if (bucketIds.length === 0) return true;
  // A hidden subscriber count cannot be bucketed; keep it visible rather than
  // silently dropping creators we deliberately chose not to reject.
  if (c.subscriberCount === null) return true;
  return bucketIds.some((id) => {
    const bucket = SUBSCRIBER_BUCKETS.find((b) => b.id === id);
    if (!bucket) return false;
    return c.subscriberCount! >= bucket.min && c.subscriberCount! <= bucket.max;
  });
}

export function applyFilters(creators: Creator[], f: CreatorFilters): Creator[] {
  return creators.filter((c) => {
    if (!matchesQuery(c, f.query)) return false;
    if (f.countries.length && !f.countries.includes(c.country ?? "")) return false;
    if (f.statuses.length && !f.statuses.includes(c.status)) return false;
    if (f.keywords.length && !f.keywords.some((k) => c.discoveredKeywords.includes(k))) return false;
    if (!matchesBuckets(c, f.subscriberBuckets)) return false;
    if (f.minAvgViews !== null && (c.averageViews ?? 0) < f.minAvgViews) return false;
    if (f.minMedianViews !== null && (c.medianViews ?? 0) < f.minMedianViews) return false;
    if (f.minScore !== null && (c.creatorScore ?? 0) < f.minScore) return false;
    if (f.minRatio !== null && (c.viewToSubscriberRatio ?? 0) < f.minRatio) return false;
    if (f.risingOnly && !c.isRising) return false;
    if (f.email === "yes" && !hasEmail(c)) return false;
    if (f.email === "no" && hasEmail(c)) return false;
    if (f.analyzed === "yes" && c.videosAnalyzed === 0) return false;
    if (f.analyzed === "no" && c.videosAnalyzed > 0) return false;
    if (f.uploadedWithinDays !== null) {
      if (c.daysSinceLastUpload === null || c.daysSinceLastUpload > f.uploadedWithinDays) {
        return false;
      }
    }
    return true;
  });
}

/** Sorts nulls last regardless of direction — unanalysed creators shouldn't win. */
function byNumber(get: (c: Creator) => number | null, direction: "asc" | "desc") {
  return (a: Creator, b: Creator) => {
    const av = get(a);
    const bv = get(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return direction === "desc" ? bv - av : av - bv;
  };
}

export function sortCreators(creators: Creator[], sort: SortId): Creator[] {
  const list = [...creators];
  switch (sort) {
    case "score_desc":
      return list.sort(byNumber((c) => c.creatorScore, "desc"));
    case "views_desc":
      return list.sort(byNumber((c) => c.averageViews, "desc"));
    case "ratio_desc":
      return list.sort(byNumber((c) => c.viewToSubscriberRatio, "desc"));
    case "subs_desc":
      return list.sort(byNumber((c) => c.subscriberCount, "desc"));
    case "subs_asc":
      return list.sort(byNumber((c) => c.subscriberCount, "asc"));
    case "discovered_desc":
      return list.sort((a, b) => +new Date(b.discoveredAt) - +new Date(a.discoveredAt));
    case "active_desc":
      return list.sort(byNumber((c) => c.daysSinceLastUpload, "asc"));
    default:
      return list;
  }
}

export function countActiveFilters(f: CreatorFilters): number {
  let n = 0;
  if (f.query.trim()) n++;
  n += f.countries.length ? 1 : 0;
  n += f.statuses.length ? 1 : 0;
  n += f.keywords.length ? 1 : 0;
  n += f.subscriberBuckets.length ? 1 : 0;
  if (f.minAvgViews !== null) n++;
  if (f.minMedianViews !== null) n++;
  if (f.minScore !== null) n++;
  if (f.minRatio !== null) n++;
  if (f.risingOnly) n++;
  if (f.email !== "any") n++;
  if (f.analyzed !== "any") n++;
  if (f.uploadedWithinDays !== null) n++;
  return n;
}
