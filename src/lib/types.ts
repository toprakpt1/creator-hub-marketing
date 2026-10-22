/**
 * Domain model for Chest Blade Creator Hub.
 *
 * Phase 1 is YouTube-only, but the shape stays platform-agnostic: `platform`
 * discriminates the record and the YouTube-specific identifiers live in their
 * own fields, so TikTok/Instagram can be added without reshaping the UI.
 */

export type Platform = "youtube" | "tiktok" | "instagram" | "twitch";

/** Only YouTube is wired to a real API in this phase. */
export const ACTIVE_PLATFORMS: Platform[] = ["youtube"];

export type CreatorStatus =
  | "new"
  | "reviewing"
  | "qualified"
  | "shortlisted"
  | "ready_to_contact"
  | "contacted"
  | "replied"
  | "interested"
  | "accepted"
  | "content_published"
  | "not_interested"
  | "rejected";

export type EmailStatus = "not_checked" | "not_found" | "manual" | "found" | "verified";

export type EmailSource =
  | "none"
  | "manual"
  | "youtube_public"
  | "website"
  | "instagram"
  | "tiktok"
  | "hunter"
  | "other";

export interface ScoreComponentRecord {
  key: string;
  earned: number;
  max: number;
  detailKey: string;
  detailVars?: Record<string, string | number>;
}

/** A YouTube video we analysed for a creator. */
export interface CreatorVideo {
  videoId: string;
  creatorId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  duration: string | null;
  fetchedAt: string;
}

export interface Creator {
  id: string;
  platform: Platform;
  youtubeChannelId: string | null;

  name: string;
  handle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  country: string | null;

  subscriberCount: number | null;
  subscriberCountHidden: boolean;
  channelTotalViews: number | null;
  channelVideoCount: number | null;
  uploadsPlaylistId: string | null;
  channelPublishedAt: string | null;

  /* Locally computed — null until videos have been analysed. */
  averageViews: number | null;
  medianViews: number | null;
  maxRecentViews: number | null;
  minRecentViews: number | null;
  averageLikes: number | null;
  averageComments: number | null;
  videosAnalyzed: number;
  viewToSubscriberRatio: number | null;
  uploadsLast30Days: number | null;
  uploadsLast90Days: number | null;
  daysSinceLastUpload: number | null;
  lastUploadAt: string | null;

  creatorScore: number | null;
  scoreBreakdown: ScoreComponentRecord[];
  isRising: boolean;

  status: CreatorStatus;

  email: string | null;
  emailSource: EmailSource;
  emailStatus: EmailStatus;

  discoveredKeywords: string[];
  discoveredAt: string;
  lastSyncedAt: string | null;
  videosSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Discovery                                                           */
/* ------------------------------------------------------------------ */

/** A search hit that has NOT been saved yet — candidates are not creators. */
export interface DiscoveryCandidate {
  youtubeChannelId: string;
  name: string;
  handle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  country: string | null;
  subscriberCount: number | null;
  subscriberCountHidden: boolean;
  channelTotalViews: number | null;
  channelVideoCount: number | null;
  uploadsPlaylistId: string | null;
  channelPublishedAt: string | null;
  /** The video that surfaced this channel, for context in the results table. */
  matchedVideoId: string | null;
  matchedVideoTitle: string | null;
  matchedVideoPublishedAt: string | null;
  keyword: string;
  /** True when this channel is already saved in our database. */
  alreadySaved: boolean;
  /** False when the subscriber filter excluded it — shown but not selectable. */
  passesFilter: boolean;
  filterReason: string | null;
}

export interface DiscoveryRun {
  id: string;
  keyword: string;
  region: string | null;
  language: string | null;
  publishedAfter: string | null;
  requestedResults: number;
  minSubscribers: number | null;
  maxSubscribers: number | null;
  pageToken: string | null;
  nextPageToken: string | null;
  rawResults: number;
  uniqueChannelsFound: number;
  existingCreatorsFound: number;
  creatorsPassingFilter: number;
  newCreatorsAdded: number;
  creatorsDeepAnalyzed: number;
  quotaUnitsUsed: number;
  apiRequests: number;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface DiscoveryQuery {
  keyword: string;
  maxResults: number;
  region?: string;
  language?: string;
  publishedWithinDays?: number;
  minSubscribers: number;
  maxSubscribers: number;
  pageToken?: string;
  /** Set to skip the cache check and spend quota deliberately. */
  force?: boolean;
}

/* ------------------------------------------------------------------ */
/* Quota                                                               */
/* ------------------------------------------------------------------ */

export interface QuotaUsage {
  day: string;
  totalUnits: number;
  dailyLimit: number;
  byEndpoint: { endpoint: string; requests: number; units: number }[];
  searchRequestsToday: number;
}

/* ------------------------------------------------------------------ */
/* Grouping surfaces                                                   */
/* ------------------------------------------------------------------ */

export interface CreatorList {
  id: string;
  name: string;
  description: string | null;
  color: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus = "draft" | "active" | "paused" | "completed";

/** Counts derived from member creators' real pipeline status. */
export interface CampaignFunnel {
  added: number;
  qualified: number;
  contacted: number;
  replied: number;
  interested: number;
  accepted: number;
  published: number;
}

export interface Campaign {
  id: string;
  name: string;
  goal: string | null;
  status: CampaignStatus;
  owner: string | null;
  startDate: string | null;
  endDate: string | null;
  memberCount: number;
  funnel: CampaignFunnel;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  language: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** An image uploaded for a template, stored under data/uploads. */
export interface EmailAsset {
  id: string;
  templateId: string;
  filename: string;
  mime: string;
  size: number;
  createdAt: string;
}

/** One outreach email we handed to the mail server. */
export type OutreachStatus = "queued" | "sent" | "failed";

export interface OutreachMessage {
  id: string;
  creatorId: string;
  creatorName: string | null;
  templateId: string | null;
  campaignId: string | null;
  toEmail: string;
  fromEmail: string;
  subject: string;
  body: string;
  status: OutreachStatus;
  providerId: string | null;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

/** The connected Gmail account, as the panel is allowed to see it. */
export interface MailAccountSummary {
  provider: "gmail";
  email: string;
  /** Display name recipients see. Null means "use the fallback". */
  fromName: string | null;
  connectedAt: string;
  lastVerifiedAt: string | null;
  needsReconnect: boolean;
  lastError: string | null;
}
