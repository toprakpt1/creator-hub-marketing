import type { Creator } from "@/lib/types";

/**
 * Template variables, shared by the preview and the sender.
 *
 * The preview a person approves and the message that actually goes out must
 * come from the same code — otherwise the panel would show one thing and send
 * another.
 */

export const GAME_NAME = "Chest Blade";
export const STEAM_LINK = "https://store.steampowered.com/app/chestblade";

export const TEMPLATE_VARIABLES = [
  { token: "{{creator_name}}", key: "varCreatorName" },
  { token: "{{channel_name}}", key: "varChannelName" },
  { token: "{{subscribers}}", key: "varSubscribers" },
  { token: "{{average_views}}", key: "varAverageViews" },
  { token: "{{country}}", key: "varCountry" },
  { token: "{{keyword}}", key: "varKeyword" },
  { token: "{{game_name}}", key: "varGameName" },
  { token: "{{steam_link}}", key: "varSteamLink" },
] as const;

/** Shown in the preview where a creator has no value for a variable. */
export const MISSING = "—";

function variableMap(creator: Creator | null): Record<string, string> {
  return {
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
    game_name: GAME_NAME,
    steam_link: STEAM_LINK,
  };
}

/** Replaces {{tokens}}; unknown ones are left visible rather than blanked. */
export function renderTemplate(text: string, creator: Creator | null): string {
  const map = variableMap(creator);
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (full, k: string) => map[k] ?? full);
}

/**
 * Tokens a send must not go out with: ones we have no variable for at all, and
 * ones this particular creator has no data behind. An unanalysed creator would
 * otherwise receive "average — views", which reads as a broken mail merge.
 */
export function unresolvedVariables(text: string, creator: Creator | null): string[] {
  const map = variableMap(creator);
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    const value = map[m[1]];
    if (value === undefined || value === MISSING) found.add(m[0]);
  }
  return [...found];
}

/**
 * Plain-text body turned into minimal HTML. Outreach mail reads better as
 * plain text and lands in the inbox more often, so both parts are sent and
 * the HTML stays deliberately unstyled.
 */
export function bodyToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}">${url}</a>`
  );

  return linked
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}
