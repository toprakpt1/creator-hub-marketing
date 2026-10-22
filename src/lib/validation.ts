/**
 * Small, dependency-free input helpers shared by API routes and the
 * add-creator form. Kept free of Node imports so the client can use them too.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE_RE = /^[A-Za-z0-9_.-]{2,30}$/;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

/** YouTube paths that point at content, not at a channel. */
const NON_CHANNEL_PATHS = new Set([
  "watch",
  "playlist",
  "results",
  "shorts",
  "live",
  "embed",
  "v",
  "redirect",
  "feed",
  "hashtag",
  "clip",
  "post",
  "account",
  "signin",
  "premium",
  "about",
  "t",
]);

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** YouTube stores custom URLs with the @ prefix, so we do the same. */
export function normalizeHandle(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim().replace(/^@+/, "");
  if (!HANDLE_RE.test(raw)) return null;
  return `@${raw}`;
}

export type YouTubeChannelRef =
  | { kind: "id"; channelId: string }
  | { kind: "handle"; handle: string }
  | { kind: "username"; username: string };

/**
 * Turns whatever someone pastes into a channel reference.
 *
 * Accepts channel ids, channel/@handle/user URLs, and a bare @handle. Anything
 * else (a video link, another site) returns null so the caller can explain.
 */
export function parseYouTubeInput(value: string): YouTubeChannelRef | null {
  const input = value.trim();
  if (!input) return null;

  if (CHANNEL_ID_RE.test(input)) return { kind: "id", channelId: input };

  if (input.startsWith("@")) {
    const handle = normalizeHandle(input);
    return handle ? { kind: "handle", handle } : null;
  }

  const looksLikeUrl =
    /^https?:\/\//i.test(input) ||
    /youtube\.com\//i.test(input) ||
    /youtu\.be\//i.test(input);

  if (looksLikeUrl) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    } catch {
      return null;
    }

    const host = url.hostname.replace(/^(www|m|music)\./i, "").toLowerCase();
    // youtu.be links are videos; there is no channel to read from them.
    if (host === "youtu.be") return null;
    if (host !== "youtube.com") return null;

    const parts = url.pathname.split("/").filter(Boolean);

    if (NON_CHANNEL_PATHS.has(parts[0] ?? "")) return null;

    if (parts[0] === "channel" && parts[1] && CHANNEL_ID_RE.test(parts[1])) {
      return { kind: "id", channelId: parts[1] };
    }

    if (parts[0]?.startsWith("@")) {
      const handle = normalizeHandle(parts[0]);
      return handle ? { kind: "handle", handle } : null;
    }

    if (parts[0] === "user" && parts[1] && HANDLE_RE.test(parts[1])) {
      return { kind: "username", username: parts[1] };
    }

    // Legacy /c/name URLs and youtube.com/name both point at a handle.
    const candidate =
      parts[0] === "c" ? parts[1] : parts.length === 1 ? parts[0] : null;
    if (candidate) {
      const handle = normalizeHandle(candidate);
      return handle ? { kind: "handle", handle } : null;
    }

    return null;
  }

  // A bare handle is convenient and accepted by the YouTube API too.
  const handle = normalizeHandle(input);
  return handle ? { kind: "handle", handle } : null;
}
