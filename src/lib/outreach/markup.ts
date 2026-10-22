/**
 * The tiny inline markup the template body understands.
 *
 * Both the panel preview and the actual sender render through this module, so
 * what a person approves on screen is exactly the HTML that leaves the app.
 *
 * Supported syntax:
 *   https://example.com        → clickable link (also www. and bare domains)
 *   [Steam page](https://...)  → clickable link with your own label
 *   ![alt text](https://...)   → image by public URL
 *   ![alt text](asset:<id>)    → image uploaded to this app (sent as a CID part)
 *
 * Everything that is not markup is escaped before it reaches the HTML, and
 * only http/https links are ever emitted — a `javascript:` URL in a template
 * must not become a live link in someone's inbox.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Gmail rejects messages over 25 MB; base64 makes attachments ~33% bigger. */
export const MAX_TOTAL_IMAGE_BYTES = 10 * 1024 * 1024;

export const IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

export function isImageMimeType(value: string): value is ImageMimeType {
  // Some browsers still report the non-standard `image/jpg`.
  const normalized = value.toLowerCase() === "image/jpg" ? "image/jpeg" : value.toLowerCase();
  return (IMAGE_MIME_TYPES as readonly string[]).includes(normalized);
}

/**
 * Bare domains are only linked when the last label is a plausible TLD. Without
 * this, `notes.txt` or `e.g` would turn into links.
 */
const TLDS = new Set([
  "com", "net", "org", "io", "gg", "co", "dev", "app", "ai", "tv", "me",
  "store", "games", "game", "studio", "site", "online", "tech", "xyz", "info",
  "biz", "link", "page", "shop", "live", "news", "media", "design", "blog",
  "us", "uk", "de", "fr", "es", "it", "nl", "se", "tr", "ca", "au", "jp", "kr",
  "br", "in", "ru", "pl", "pt", "ar", "mx", "cl", "be", "at", "ch", "dk", "no",
  "fi", "cz", "gr", "hu", "ro", "sk", "ua", "il", "ae", "za", "id", "my", "sg",
  "ph", "th", "vn", "hk", "tw", "nz", "ie", "eu",
]);

const AUTO_URL =
  String.raw`(?:https?:\/\/|www\.)[^\s<>"']+` +
  String.raw`|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}\b(?::\d{2,5})?(?:[/?#][^\s<>"']*)?`;

/**
 * Group 1/2: image alt + source. Group 3/4: link label + href. Group 5: an
 * automatically detected URL.
 */
const TOKEN_RE = new RegExp(
  String.raw`!\[([^\]]*)\]\(\s*([^)\s]+)\s*\)` +
    String.raw`|\[([^\]]+)\]\(\s*([^)\s]+)\s*\)` +
    `|(${AUTO_URL})`,
  "gi"
);

/**
 * RFC 2392 wants a Content-ID in the `local@domain` shape. Gmail in particular
 * refuses to match a bare UUID, which is why the image would fall back to its
 * alt text (and show up as an ordinary attachment).
 */
export function assetCid(id: string): string {
  return `${id}@creator-hub.local`;
}

export interface BodyRenderOptions {
  /**
   * Turns an uploaded asset id into an `<img src>`. The preview points at the
   * app's asset route; a send points at `cid:<id>` so the image travels with
   * the message instead of requiring a public host.
   */
  assetSrc?: (id: string) => string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function occurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

const TRAILING_PUNCTUATION = ".,;:!?'\"*_~";

/** `https://x.com/a.` should link the address, not the sentence's full stop. */
function splitTrailingPunctuation(value: string): { url: string; trailing: string } {
  let end = value.length;
  while (end > 0) {
    const char = value[end - 1];
    const before = value.slice(0, end);
    if (TRAILING_PUNCTUATION.includes(char)) {
      end -= 1;
      continue;
    }
    if (char === ")" && occurrences(before, "(") < occurrences(before, ")")) {
      end -= 1;
      continue;
    }
    if (char === "]" && occurrences(before, "[") < occurrences(before, "]")) {
      end -= 1;
      continue;
    }
    if (char === "}" && occurrences(before, "{") < occurrences(before, "}")) {
      end -= 1;
      continue;
    }
    break;
  }
  return { url: value.slice(0, end), trailing: value.slice(end) };
}

/** Adds a scheme when the person wrote `www.x.com`, then keeps only http(s). */
export function normalizeHttpUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isBareDomain(value: string): boolean {
  return !/^https?:\/\//i.test(value) && !/^www\./i.test(value);
}

function tldOf(value: string): string {
  const host = value.split(/[/?#]/)[0].replace(/:\d+$/, "").toLowerCase();
  return host.split(".").pop() ?? "";
}

function imageSource(reference: string, options: BodyRenderOptions): string | null {
  const ref = reference.trim();
  if (ref.toLowerCase().startsWith("asset:")) {
    const id = ref.slice(6).trim();
    if (!/^[A-Za-z0-9-]+$/.test(id)) return null;
    return options.assetSrc?.(id) ?? null;
  }
  return normalizeHttpUrl(ref);
}

/** Inline rendering (no paragraph wrapper), shared by the body renderer. */
function renderInlineHtml(text: string, options: BodyRenderOptions): string {
  let out = "";
  let last = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    out += escapeHtml(text.slice(last, index));
    last = index + match[0].length;

    const [, alt, imageRef, label, linkRef, autoUrl] = match;

    if (imageRef !== undefined) {
      const src = imageSource(imageRef, options);
      if (!src) {
        // An asset that no longer exists should not leave raw syntax in the mail.
        out += escapeHtml(alt.trim());
        continue;
      }
      out += `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto;display:block;margin:12px 0;border:0;" />`;
      continue;
    }

    if (linkRef !== undefined) {
      const href = normalizeHttpUrl(linkRef);
      if (!href) {
        out += escapeHtml(match[0]);
        continue;
      }
      out += `<a href="${escapeHtml(href)}" style="color:#1283d3;">${escapeHtml(label)}</a>`;
      continue;
    }

    // Automatically detected URL.
    const { url, trailing } = splitTrailingPunctuation(autoUrl);

    if (isBareDomain(url)) {
      const previous = index > 0 ? text[index - 1] : "";
      if (/[@.\/-]/.test(previous) || !TLDS.has(tldOf(url))) {
        out += escapeHtml(autoUrl);
        continue;
      }
    }

    const href = normalizeHttpUrl(url);
    if (!href) {
      out += escapeHtml(autoUrl);
      continue;
    }
    out += `<a href="${escapeHtml(href)}" style="color:#1283d3;">${escapeHtml(url)}</a>`;
    out += escapeHtml(trailing);
  }

  out += escapeHtml(text.slice(last));
  return out;
}

/** The `html` part of an outreach message (and the preview). */
export function renderBodyHtml(text: string, options: BodyRenderOptions = {}): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111111;">${renderInlineHtml(
          paragraph,
          options
        ).replace(/\n/g, "<br />\n")}</p>`
    )
    .join("\n");
}

/**
 * Alt text worth putting in the text/plain part.
 *
 * Uploaded images are commonly given `![30E8ma.png](asset:...)`, and the alt is
 * then the filename. That name used to land in the plain-text body as a stray
 * line, which reads to a recipient — and to a spam filter — as broken markup.
 */
function isMeaningfulImageAlt(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (/\.(png|jpe?g|webp|gif|avif|svg|bmp|tiff?)$/i.test(text)) return false;
  // A bare asset id: no spaces, no sentence. Nothing a reader can use.
  if (!/\s/.test(text) && /^[A-Za-z0-9_-]{6,}$/.test(text)) return false;
  return true;
}

/**
 * The `text` part. Images become their alt text, labelled links keep their
 * label and append the address so a plain-text reader can still follow them.
 */
export function renderBodyPlainText(text: string): string {
  let out = "";
  let last = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    out += text.slice(last, index);
    last = index + match[0].length;

    const [, alt, imageRef, label, linkRef, autoUrl] = match;

    if (imageRef !== undefined) {
      if (isMeaningfulImageAlt(alt)) out += alt.trim();
      continue;
    }

    if (linkRef !== undefined) {
      const href = normalizeHttpUrl(linkRef);
      if (!href) {
        out += match[0];
        continue;
      }
      out += label === linkRef ? href : `${label} (${href})`;
      continue;
    }

    out += autoUrl;
  }

  out += text.slice(last);

  // Removed image lines leave holes behind. A block of blank lines in the middle
  // of a mail looks machine-generated, so squeeze them down to one empty line.
  return out
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n+$/, "");
}

/** Uploaded images referenced by a template, in insertion order. */
export function extractAssetIds(text: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(TOKEN_RE)) {
    const imageRef = match[2];
    if (!imageRef?.toLowerCase().startsWith("asset:")) continue;
    const id = imageRef.slice(6).trim();
    if (/^[A-Za-z0-9-]+$/.test(id)) ids.add(id);
  }
  return [...ids];
}
