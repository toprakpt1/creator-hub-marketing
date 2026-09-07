"use client";

import { compactNumber, formatDate, formatDateTime, fullNumber, relativeTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

/**
 * The reader's language lives in localStorage, so a server component cannot
 * know it. These render the timestamp on the client instead, which keeps dates
 * in the same language as the rest of the page.
 */
export function TimeAgo({ iso }: { iso: string | null | undefined }) {
  const { locale } = useI18n();
  return <>{relativeTime(iso, locale)}</>;
}

export function DateText({ iso }: { iso: string | null | undefined }) {
  const { locale } = useI18n();
  return <>{formatDate(iso, locale)}</>;
}

export function DateTimeText({ iso }: { iso: string | null | undefined }) {
  const { locale } = useI18n();
  return <>{formatDateTime(iso, locale)}</>;
}

/** "Updated 2d ago" / "2 gn. önce güncellendi" — one string, so word order holds. */
export function UpdatedAgo({ iso }: { iso: string | null | undefined }) {
  const { t, locale } = useI18n();
  return <>{t("common.updated", { time: relativeTime(iso, locale) })}</>;
}

/** Grouped number rendered client-side, so it follows the reader's locale. */
export function Num({ value }: { value: number }) {
  const { locale } = useI18n();
  return <>{fullNumber(value, locale)}</>;
}

/** "12.4K" — the suffix is locale-independent, the fallback grouping is not. */
export function Compact({ value }: { value: number | null }) {
  const { locale } = useI18n();
  if (value === null) return <>—</>;
  return <>{Math.abs(value) < 1000 ? fullNumber(value, locale) : compactNumber(value)}</>;
}
