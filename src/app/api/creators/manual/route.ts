import { NextResponse } from "next/server";
import {
  createManualCreator,
  getCreatorByChannelId,
  getCreatorByHandle,
} from "@/lib/db/creators";
import {
  fetchChannelByHandle,
  fetchChannelByUsername,
  fetchChannels,
  thumbnailOf,
  toInt,
  YouTubeApiError,
  type ChannelItem,
} from "@/lib/youtube/client";
import { isEmail, normalizeHandle, parseYouTubeInput } from "@/lib/validation";

/**
 * POST /api/creators/manual — adds one creator the user entered by hand.
 *
 * When a channel link or @handle is given, its public details are read from
 * YouTube (channels.list, 1 quota unit) so the record is complete: scores and
 * video analysis need the uploads playlist, which only the API provides. If the
 * lookup fails and a name was typed, the creator is still saved with the
 * information the user supplied.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_KEYWORDS = 10;

function toCount(value: string | undefined): number | null {
  const parsed = toInt(value);
  return parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeKeywords(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const keyword = item.trim().toLowerCase().slice(0, 40);
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    out.push(keyword);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

function fail(error: string, code: string, status = 400) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.", "invalid_body");
  }

  const b = (body ?? {}) as Record<string, unknown>;

  const rawName = typeof b.name === "string" ? b.name.trim() : "";
  if (rawName.length > 120) {
    return fail("Creator name is too long.", "invalid_name");
  }

  const rawChannel = typeof b.channelInput === "string" ? b.channelInput.trim() : "";
  if (rawChannel.length > 500) {
    return fail("That channel link is too long.", "invalid_channel");
  }

  if (!rawName && !rawChannel) {
    return fail(
      "Enter a creator name or a YouTube channel link.",
      "name_or_channel_required"
    );
  }

  const rawEmail = typeof b.email === "string" ? b.email.trim() : "";
  if (rawEmail.length > 254 || (rawEmail && !isEmail(rawEmail))) {
    return fail("That does not look like an email address.", "invalid_email");
  }

  let subscriberInput: number | null = null;
  if (b.subscriberCount !== undefined && b.subscriberCount !== null && b.subscriberCount !== "") {
    const parsed = Number(b.subscriberCount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fail("Subscriber count must be a positive number.", "invalid_subscriber_count");
    }
    subscriberInput = Math.round(parsed);
  }

  const rawCountry = typeof b.country === "string" ? b.country.trim().toUpperCase() : "";
  if (rawCountry && !/^[A-Z]{2}$/.test(rawCountry)) {
    return fail("Country must be a two-letter code.", "invalid_country");
  }

  const description =
    typeof b.description === "string" ? b.description.trim().slice(0, 2000) : "";
  const keywords = normalizeKeywords(b.keywords);

  const ref = rawChannel ? parseYouTubeInput(rawChannel) : null;
  if (rawChannel && !ref) {
    return fail(
      "That does not look like a YouTube channel link or @handle.",
      "invalid_channel"
    );
  }

  /* ---- deduplicate before spending quota ---- */

  if (ref?.kind === "id") {
    const existing = getCreatorByChannelId(ref.channelId);
    if (existing) return NextResponse.json({ creator: existing, created: false });
  }
  if (ref?.kind === "handle") {
    const existing = getCreatorByHandle(ref.handle);
    if (existing) return NextResponse.json({ creator: existing, created: false });
  }

  /* ---- enrich from YouTube when a link was given ---- */

  let channel: ChannelItem | null = null;
  let warning: string | null = null;

  if (ref) {
    try {
      if (ref.kind === "id") {
        channel = (await fetchChannels([ref.channelId]))[0] ?? null;
      } else if (ref.kind === "handle") {
        channel = await fetchChannelByHandle(ref.handle);
      } else {
        channel = await fetchChannelByUsername(ref.username);
      }

      if (!channel && !rawName) {
        return fail("No YouTube channel was found for that link.", "channel_not_found", 404);
      }
      if (!channel) {
        warning = "that channel could not be found on YouTube";
      }
    } catch (error) {
      if (!(error instanceof YouTubeApiError)) throw error;
      if (!rawName) {
        return fail(error.message, error.code, error.status);
      }
      warning = error.message;
    }
  }

  const channelId = channel?.id ?? (ref?.kind === "id" ? ref.channelId : null);

  // A handle lookup resolves to an id that may already be stored.
  if (channelId) {
    const existing = getCreatorByChannelId(channelId);
    if (existing) return NextResponse.json({ creator: existing, created: false });
  }

  const name = rawName || channel?.snippet?.title?.trim();
  if (!name) {
    return fail("Enter a creator name or a working channel link.", "name_required");
  }

  const fetchedHandle = normalizeHandle(channel?.snippet?.customUrl);
  const handle =
    fetchedHandle ?? (ref?.kind === "handle" ? ref.handle : null);

  const stats = channel?.statistics;
  const hidden = stats?.hiddenSubscriberCount === true;
  const fetchedSubscribers = hidden ? null : toCount(stats?.subscriberCount);

  const result = createManualCreator({
    channelId,
    handle,
    name,
    description: description || channel?.snippet?.description || null,
    thumbnailUrl: thumbnailOf(channel?.snippet?.thumbnails),
    country: rawCountry || channel?.snippet?.country || null,
    subscriberCount: subscriberInput ?? fetchedSubscribers,
    subscriberCountHidden: hidden,
    channelTotalViews: toCount(stats?.viewCount),
    channelVideoCount: toCount(stats?.videoCount),
    uploadsPlaylistId: channel?.contentDetails?.relatedPlaylists?.uploads ?? null,
    channelPublishedAt: channel?.snippet?.publishedAt ?? null,
    email: rawEmail || null,
    keywords,
  });

  return NextResponse.json(
    { ...result, warning },
    { status: result.created ? 201 : 200 }
  );
}
