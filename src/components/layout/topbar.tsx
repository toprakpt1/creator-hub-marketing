"use client";

import Link from "next/link";
import { Bell, Menu, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "@/components/layout/global-search";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { toast } from "@/components/ui/sonner";
import { useT } from "@/lib/i18n/provider";

const NOTIFICATIONS = [1, 2, 3] as const;

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const t = useT();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-5">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label={t("nav.openNavigation")}
      >
        <Menu />
      </Button>

      <GlobalSearch className="max-w-md flex-1" />

      <div className="ml-auto flex items-center gap-1.5">
        <LanguageSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("topbar.notifications")}
              className="relative"
            >
              <Bell />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>{t("topbar.notifications")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {NOTIFICATIONS.map((n) => (
              <DropdownMenuItem
                key={n}
                className="flex-col items-start gap-0.5 py-2"
                onSelect={() =>
                  toast(t(`topbar.notif${n}Title`), { description: t(`topbar.notif${n}Body`) })
                }
              >
                <span className="text-[13px] font-medium text-foreground">
                  {t(`topbar.notif${n}Title`)}
                </span>
                <span className="text-xs text-muted-foreground">{t(`topbar.notif${n}Body`)}</span>
                <span className="text-[11px] text-muted-foreground/70">
                  {t(`topbar.notif${n}Time`)}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => toast(t("topbar.markedAllRead"))}>
              {t("topbar.markAllRead")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" asChild>
          <Link href="/discover">
            <Radar />
            <span className="hidden sm:inline">{t("dashboard.runDiscovery")}</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
