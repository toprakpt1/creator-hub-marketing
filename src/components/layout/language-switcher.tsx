"use client";

import { Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  variant = "icon",
  className,
}: {
  /** "icon" for the top bar, "full" for the settings page. */
  variant?: "icon" | "full";
  className?: string;
}) {
  const { locale, setLocale, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("common.changeLanguage")}
            className={className}
          >
            <Languages />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className={cn("gap-2", className)}>
            <Languages />
            <span aria-hidden>{LOCALE_META[locale].flag}</span>
            {LOCALE_META[locale].nativeLabel}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALES.map((code: Locale) => (
          <DropdownMenuItem key={code} onSelect={() => setLocale(code)}>
            <span aria-hidden>{LOCALE_META[code].flag}</span>
            {LOCALE_META[code].nativeLabel}
            {locale === code && <Check className="ml-auto text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
