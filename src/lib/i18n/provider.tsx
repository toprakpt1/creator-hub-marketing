"use client";

import * as React from "react";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "@/lib/i18n/config";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { intl } from "@/lib/format";

type Vars = Record<string, string | number>;

export interface I18nValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  /** Translate a dot-path key. Falls back to English, then to the key itself. */
  t: (key: string, vars?: Vars) => string;
  /** True once the stored preference has been read — avoids a flash of English. */
  ready: boolean;
}

const I18nContext = React.createContext<I18nValue | null>(null);

function lookup(dict: unknown, path: string[]): unknown {
  return path.reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

/**
 * Numbers are grouped for the reader's locale (1.234,5 vs 1,234.5). Callers
 * that need a specific shape — a ratio, a percentage — pass a string instead.
 */
function interpolate(template: string, vars: Vars | undefined, locale: string): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (full, key: string) => {
    if (!(key in vars)) return full;
    const value = vars[key];
    return typeof value === "number" ? value.toLocaleString(intl(locale)) : String(value);
  });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      /* storage may be unavailable */
    }
    if (isLocale(stored)) {
      setLocaleState(stored);
    } else if (typeof navigator !== "undefined" && navigator.language?.startsWith("tr")) {
      // First visit from a Turkish browser opens in Turkish.
      setLocaleState("tr");
    }
    setReady(true);
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = React.useCallback(
    (key: string, vars?: Vars) => {
      const path = key.split(".");
      const hit = lookup(DICTIONARIES[locale], path) ?? lookup(DICTIONARIES.en, path);
      if (typeof hit === "string") return interpolate(hit, vars, locale);
      // Missing keys surface as the key itself rather than an empty string, so
      // gaps are obvious in the UI instead of silently blank.
      return key;
    },
    [locale]
  );

  const value = React.useMemo<I18nValue>(
    () => ({ locale, setLocale, t, ready }),
    [locale, setLocale, t, ready]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Shorthand for components that only need the translate function. */
export function useT() {
  return useI18n().t;
}

/** For date and number formatting, which needs the locale rather than a key. */
export function useLocale() {
  return useI18n().locale;
}
