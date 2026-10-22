import type { Creator } from "@/lib/types";
import { GAME_NAME, STEAM_LINK } from "@/lib/constants";

/**
 * Template variables, shared by the preview and the sender.
 *
 * The preview a person approves and the message that actually goes out must
 * come from the same code — otherwise the panel would show one thing and send
 * another.
 */

export { GAME_NAME, STEAM_LINK } from "@/lib/constants";

/**
 * The game a template talks about. Stored in the database and edited from
 * Settings, so it is passed in rather than read from a constant — but callers
 * that have no value handy fall back to the constants above.
 */
export interface GameIdentity {
  name: string;
  link: string;
}

export const DEFAULT_GAME: GameIdentity = { name: GAME_NAME, link: STEAM_LINK };

export const TEMPLATE_VARIABLES = [
  { token: "{{creator_name}}", key: "varCreatorName" },
  { token: "{{channel_name}}", key: "varChannelName" },
  { token: "{{subscribers}}", key: "varSubscribers" },
  { token: "{{average_views}}", key: "varAverageViews" },
  { token: "{{country}}", key: "varCountry" },
  { token: "{{keyword}}", key: "varKeyword" },
  { token: "{{game_name}}", key: "varGameName" },
  { token: "{{game_link}}", key: "varGameLink" },
  { token: "{{steam_link}}", key: "varSteamLink" },
] as const;

/** Shown in the preview where a creator has no value for a variable. */
export const MISSING = "—";

function variableMap(
  creator: Creator | null,
  game: GameIdentity = DEFAULT_GAME
): Record<string, string> {
  const map: Record<string, string> = {
    creator_name: creator?.name?.trim() || "there",
    // The display name reads naturally inside a sentence; a raw @handle does
    // not ("I came across @gamingmeetsexperience4332").
    channel_name: creator?.name?.trim() || creator?.handle || "your channel",
    subscribers:
      creator?.subscriberCount != null ? creator.subscriberCount.toLocaleString("en-US") : MISSING,
    average_views:
      creator?.averageViews != null ? creator.averageViews.toLocaleString("en-US") : MISSING,
    country: creator?.country ?? "your region",
    keyword: creator?.discoveredKeywords[0] ?? "indie games",
    game_name: game.name || GAME_NAME,
  };

  // Both spellings are offered because older templates say {{steam_link}}. When
  // no link is configured neither key exists, so `unresolvedVariables` blocks
  // the send instead of letting the token collapse silently into an empty line
  // — or worse, into a link that goes nowhere.
  const link = game.link.trim();
  if (link) {
    map.game_link = link;
    map.steam_link = link;
  }

  return map;
}

/** Replaces {{tokens}}; unknown ones are left visible rather than blanked. */
export function renderTemplate(
  text: string,
  creator: Creator | null,
  game: GameIdentity = DEFAULT_GAME
): string {
  const map = variableMap(creator, game);
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (full, k: string) => map[k] ?? full);
}

/**
 * Tokens a send must not go out with: ones we have no variable for at all, and
 * ones this particular creator has no data behind. An unanalysed creator would
 * otherwise receive "average — views", which reads as a broken mail merge.
 */
export function unresolvedVariables(
  text: string,
  creator: Creator | null,
  game: GameIdentity = DEFAULT_GAME
): string[] {
  const map = variableMap(creator, game);
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    const value = map[m[1]];
    if (value === undefined || value === MISSING) found.add(m[0]);
  }
  return [...found];
}

/**
 * The body is turned into HTML by `markup.ts`, which also understands images
 * and labelled links. It is re-exported here so callers that already render
 * template variables have one import for the whole body pipeline.
 */
export { extractAssetIds, renderBodyHtml, renderBodyPlainText } from "@/lib/outreach/markup";
export type { BodyRenderOptions } from "@/lib/outreach/markup";
