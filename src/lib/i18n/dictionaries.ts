import type { Locale } from "@/lib/i18n/config";
import { en, type Dictionary } from "@/lib/i18n/en";
import { tr } from "@/lib/i18n/tr";

export const DICTIONARIES: Record<Locale, Dictionary> = { en, tr };

export type { Dictionary };
