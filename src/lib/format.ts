/** 12400 -> "12.4K", 980 -> "980", 1_200_000 -> "1.2M" */
export function compactNumber(n: number): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (Math.abs(n) < 1000) return String(Math.round(n));
  if (Math.abs(n) < 1_000_000) {
    const v = n / 1000;
    return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + "K";
  }
  if (Math.abs(n) < 1_000_000_000) {
    const v = n / 1_000_000;
    return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + "M";
  }
  const v = n / 1_000_000_000;
  return Math.round(v * 10) / 10 + "B";
}

/** Full grouped number: 12400 -> "12,400" (en) / "12.400" (tr) */
export function fullNumber(n: number, locale = "en"): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(intl(locale));
}

export function percent(n: number, digits = 1): string {
  return n.toFixed(digits) + "%";
}

export function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic avatar tint derived from the creator id/name. */
export function avatarTint(seed: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return { bg: `hsl(${h} 62% 92%)`, fg: `hsl(${h} 48% 34%)` };
}

const DAY = 86_400_000;

/** Maps our short locale codes onto the BCP 47 tags Intl expects. */
const INTL_LOCALE: Record<string, string> = { en: "en-US", tr: "tr-TR" };

export const intl = (locale: string) => INTL_LOCALE[locale] ?? "en-US";

/**
 * "2d ago" / "3 hf. önce". Timestamps come from YouTube and from our own
 * writes, so this reads the real clock; `now` stays injectable for tests.
 * Wording comes from Intl so it follows the reader's language.
 */
export function relativeTime(
  iso: string | null | undefined,
  locale = "en",
  now = Date.now()
): string {
  if (!iso) return "—";
  const parsed = new Date(iso).getTime();
  if (!Number.isFinite(parsed)) return "—";

  const rtf = new Intl.RelativeTimeFormat(intl(locale), {
    numeric: "auto",
    style: "narrow",
  });

  const diff = now - parsed;
  // Clock skew between us and YouTube can put a timestamp slightly ahead.
  if (diff < 60_000) return rtf.format(0, "second");
  if (diff < 3600_000) return rtf.format(-Math.round(diff / 60_000), "minute");
  if (diff < DAY) return rtf.format(-Math.round(diff / 3600_000), "hour");
  if (diff < 7 * DAY) return rtf.format(-Math.round(diff / DAY), "day");
  if (diff < 30 * DAY) return rtf.format(-Math.round(diff / (7 * DAY)), "week");
  if (diff < 365 * DAY) return rtf.format(-Math.round(diff / (30 * DAY)), "month");
  return rtf.format(-Math.round(diff / (365 * DAY)), "year");
}

export function formatDate(iso: string | null | undefined, locale = "en"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(intl(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined, locale = "en"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(intl(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
