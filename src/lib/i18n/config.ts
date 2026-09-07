export const LOCALES = ["en", "tr"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_META: Record<Locale, { label: string; nativeLabel: string; flag: string }> = {
  en: { label: "English", nativeLabel: "English", flag: "🇬🇧" },
  tr: { label: "Turkish", nativeLabel: "Türkçe", flag: "🇹🇷" },
};

export const LOCALE_STORAGE_KEY = "cb_hub_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
