import type { CreatorStatus, EmailSource, EmailStatus, Platform } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Platforms                                                           */
/* ------------------------------------------------------------------ */

type BadgeTone =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive"
  | "muted";

export interface PlatformMeta {
  label: string;
  short: string;
  color: string;
  audienceLabel: string;
  urlBase: string;
  /** Only an active platform can be searched or saved to. */
  active: boolean;
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  youtube: {
    label: "YouTube",
    short: "YT",
    color: "#ef4444",
    audienceLabel: "Subscribers",
    urlBase: "https://youtube.com/channel/",
    active: true,
  },
  tiktok: {
    label: "TikTok",
    short: "TT",
    color: "#0ea5b7",
    audienceLabel: "Followers",
    urlBase: "https://tiktok.com/@",
    active: false,
  },
  instagram: {
    label: "Instagram",
    short: "IG",
    color: "#c2410c",
    audienceLabel: "Followers",
    urlBase: "https://instagram.com/",
    active: false,
  },
  twitch: {
    label: "Twitch",
    short: "TW",
    color: "#7c3aed",
    audienceLabel: "Followers",
    urlBase: "https://twitch.tv/",
    active: false,
  },
};

export const ALL_PLATFORMS: Platform[] = ["youtube", "tiktok", "instagram", "twitch"];
export const ENABLED_PLATFORMS: Platform[] = ALL_PLATFORMS.filter((p) => PLATFORM_META[p].active);

/* ------------------------------------------------------------------ */
/* Discovery inputs                                                    */
/* ------------------------------------------------------------------ */

/** Seed keywords offered on Discover — the user can type anything else. */
export const KEYWORD_SUGGESTIONS = [
  "roguelike",
  "roguelite",
  "indie games",
  "indie gaming",
  "deckbuilder",
  "card game",
  "steam games",
  "steam demo",
  "indie game review",
  "upcoming indie games",
  "new indie games",
  "strategy games",
  "gaming shorts",
];

/** search.list caps at 50; these are the sizes the UI offers. */
export const RESULTS_PER_SEARCH = [10, 25, 50];

export const DEFAULT_MIN_SUBSCRIBERS = 10;
export const DEFAULT_MAX_SUBSCRIBERS = 50_000;

export const RECENCY_OPTIONS = [7, 30, 90, 365];

/** ISO 3166-1 alpha-2 codes accepted by search.list's regionCode. */
export const SEARCH_REGIONS = [
  { code: "", name: "Any region", flag: "🌍" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
];

/** BCP-47 codes accepted by search.list's relevanceLanguage. */
export const SEARCH_LANGUAGES = [
  { code: "", name: "Any language" },
  { code: "en", name: "English" },
  { code: "tr", name: "Turkish" },
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "pt", name: "Portuguese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "id", name: "Indonesian" },
  { code: "pl", name: "Polish" },
];

/* ------------------------------------------------------------------ */
/* Statuses                                                            */
/* ------------------------------------------------------------------ */

export const CREATOR_STATUS_META: Record<CreatorStatus, { tone: BadgeTone }> = {
  new: { tone: "muted" },
  reviewing: { tone: "outline" },
  qualified: { tone: "default" },
  shortlisted: { tone: "default" },
  ready_to_contact: { tone: "warning" },
  contacted: { tone: "secondary" },
  replied: { tone: "default" },
  interested: { tone: "success" },
  accepted: { tone: "success" },
  content_published: { tone: "success" },
  not_interested: { tone: "destructive" },
  rejected: { tone: "destructive" },
};

export const CREATOR_STATUSES = Object.keys(CREATOR_STATUS_META) as CreatorStatus[];

export const EMAIL_STATUS_META: Record<EmailStatus, { tone: BadgeTone }> = {
  verified: { tone: "success" },
  found: { tone: "default" },
  manual: { tone: "default" },
  not_found: { tone: "muted" },
  not_checked: { tone: "muted" },
};

export const EMAIL_SOURCES: EmailSource[] = [
  "manual",
  "youtube_public",
  "website",
  "instagram",
  "tiktok",
  "hunter",
  "other",
];

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export const SUBSCRIBER_BUCKETS = [
  { id: "u100", label: "Under 100", labelKey: "creators.bucketUnder100", min: 0, max: 99 },
  { id: "100-500", label: "100–500", min: 100, max: 500 },
  { id: "500-1k", label: "500–1K", min: 501, max: 1000 },
  { id: "1k-5k", label: "1K–5K", min: 1001, max: 5000 },
  { id: "5k-10k", label: "5K–10K", min: 5001, max: 10000 },
  { id: "10k-50k", label: "10K–50K", min: 10001, max: 50000 },
];

/** `key` maps to the `scoreBands.*` dictionary entry. */
export function scoreBand(score: number): {
  key: "excellent" | "good" | "potential" | "low";
  tone: BadgeTone;
  color: string;
} {
  if (score >= 85) return { key: "excellent", tone: "success", color: "hsl(152 60% 30%)" };
  if (score >= 70) return { key: "good", tone: "default", color: "hsl(205 84% 40%)" };
  if (score >= 50) return { key: "potential", tone: "warning", color: "hsl(30 92% 34%)" };
  return { key: "low", tone: "muted", color: "hsl(215 16% 45%)" };
}

export const GAME_NAME = "Chest Blade";
export const STEAM_LINK = "https://store.steampowered.com/app/chestblade";

/** Country codes we can render a flag for; anything else falls back. */
/**
 * Country name in the reader's language. Intl carries the full ISO list, so
 * there is nothing to keep in the dictionaries.
 */
export function countryName(code: string | null, locale = "en"): string {
  if (!code) return "—";
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    return dn.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function countryFlagFor(code: string | null): string {
  if (!code || code.length !== 2) return "🏳️";
  const A = 0x1f1e6;
  const base = "A".charCodeAt(0);
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((c) => A + (c.charCodeAt(0) - base))
  );
}
