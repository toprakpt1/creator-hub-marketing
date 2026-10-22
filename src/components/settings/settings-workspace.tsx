"use client";

import * as React from "react";
import { Bot, Building2, Database, Gauge, Mail, Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/sonner";
import { MailAccountCard } from "@/components/settings/mail-account-card";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ALL_PLATFORMS, PLATFORM_META } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import type { MailAccountSummary, QuotaUsage } from "@/lib/types";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "general", labelKey: "settings.sectionGeneral", icon: Building2 },
  { id: "mail", labelKey: "settings.sectionMail", icon: Mail },
  { id: "platforms", labelKey: "settings.sectionPlatforms", icon: Plug },
  { id: "quota", labelKey: "settings.sectionQuota", icon: Gauge },
  { id: "automation", labelKey: "settings.sectionAutomation", icon: Bot },
  { id: "data", labelKey: "settings.sectionData", icon: Database },
];

/** Roadmap items — visible, explained, deliberately not switchable. */
const ROADMAP = [
  { id: "yt-auto", labelKey: "settings.autoYoutube", descKey: "settings.autoYoutubeDesc" },
  { id: "tt", labelKey: "settings.autoTiktok", descKey: "settings.autoTiktokDesc" },
  { id: "ig", labelKey: "settings.autoInstagram", descKey: "settings.autoInstagramDesc" },
  { id: "tw", labelKey: "settings.autoTwitch", descKey: "settings.autoTwitchDesc" },
  { id: "contact", labelKey: "settings.autoContact", descKey: "settings.autoContactDesc" },
  { id: "score", labelKey: "settings.autoScoring", descKey: "settings.autoScoringDesc" },
  { id: "outreach", labelKey: "settings.autoOutreach", descKey: "settings.autoOutreachDesc" },
  { id: "followup", labelKey: "settings.autoFollowup", descKey: "settings.autoFollowupDesc" },
];

export function SettingsWorkspace({
  quota,
  creatorCount,
  videoCount,
  runCount,
  mailAccount,
  oauthConfigured,
}: {
  quota: QuotaUsage;
  creatorCount: number;
  videoCount: number;
  runCount: number;
  mailAccount: MailAccountSummary | null;
  oauthConfigured: boolean;
}) {
  const t = useT();
  const [section, setSection] = React.useState("general");

  // Allow deep links like /settings?section=mail from the outreach panel.
  React.useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("section");
    if (requested && SECTIONS.some((s) => s.id === requested)) {
      setSection(requested);
    }
  }, []);

  // The OAuth callback lands back here with a result in the query string.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("gmail");
    if (!result) return;

    if (result === "connected") {
      toast.success(t("settings.mailCallbackConnected"));
    } else {
      toast.error(t("settings.mailCallbackError", { reason: params.get("reason") ?? "unknown" }));
    }

    params.delete("gmail");
    params.delete("reason");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [t]);

  return (
    <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav className="scrollbar-none flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
              section === s.id
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
          >
            <s.icon className="h-4 w-4" />
            {t(s.labelKey)}
          </button>
        ))}
      </nav>

      <div className="min-w-0 space-y-4">
        {section === "general" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t("settings.workspaceTitle")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("settings.workspaceDesc")}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <div className="text-[13px] font-medium">{t("settings.languageTitle")}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("settings.languageDesc")}
                  </p>
                </div>
                <LanguageSwitcher variant="full" />
              </div>

              <Separator />

              <dl className="divide-y divide-border/70 text-[13px]">
                {[
                  [t("settings.gameName"), "Chest Blade"],
                  [t("settings.dbLocation"), process.env.NEXT_PUBLIC_DB_HINT ?? "./data/creator-hub.db"],
                  [t("settings.apiKeyStatus"), t("settings.apiKeyServerOnly")],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3 py-2">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="max-w-[62%] truncate text-right font-mono text-xs">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}

        {section === "mail" && (
          <MailAccountCard account={mailAccount} oauthConfigured={oauthConfigured} />
        )}

        {section === "platforms" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t("settings.platformsTitle")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("settings.platformsDesc")}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {ALL_PLATFORMS.map((p) => {
                const meta = PLATFORM_META[p];
                return (
                  <div
                    key={p}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-lg border p-3",
                      meta.active ? "border-success/40 bg-success/[0.05]" : "border-border"
                    )}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-md"
                      style={{ backgroundColor: meta.color + "1f" }}
                    >
                      <PlatformIcon platform={p} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{meta.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {meta.active
                          ? t("settings.platformActiveDesc")
                          : t("platforms.comingSoonTip", { platform: meta.label })}
                      </div>
                    </div>
                    <Badge variant={meta.active ? "success" : "muted"}>
                      {meta.active ? t("platforms.active") : t("platforms.comingSoon")}
                    </Badge>
                    <Switch checked={meta.active} disabled aria-label={meta.label} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {section === "quota" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t("settings.quotaTitle")}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("settings.quotaDesc", { day: quota.day })}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{t("discover.quotaToday")}</span>
                  <span className="tabular text-muted-foreground">
                    {quota.totalUnits} / {quota.dailyLimit}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, (quota.totalUnits / quota.dailyLimit) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {quota.byEndpoint.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("history.noUsageToday")}</p>
              ) : (
                <ul className="space-y-2">
                  {quota.byEndpoint.map((e) => (
                    <li key={e.endpoint} className="flex items-center gap-3 text-[13px]">
                      <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
                        {e.endpoint}
                      </code>
                      <span className="text-muted-foreground">
                        {t("history.requests", { count: e.requests })}
                      </span>
                      <span className="ml-auto tabular font-medium">
                        {t("history.units", { count: e.units })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <Separator />
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p>{t("settings.quotaCostSearch")}</p>
                <p>{t("settings.quotaCostOthers")}</p>
                <p>{t("settings.quotaCacheNote")}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {section === "automation" && (
          <>
            <Card className="border-primary/25 bg-primary/[0.04]">
              <CardContent className="flex items-start gap-3 p-4">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-[13px] font-medium">
                    {t("settings.automationBannerTitle")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("settings.automationBannerBody")}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>{t("settings.automationTitle")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("settings.automationDesc")}</p>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/70">
                  {ROADMAP.map((f) => (
                    <div key={f.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium text-muted-foreground">
                            {t(f.labelKey)}
                          </span>
                          <Badge variant="muted">{t("settings.comingSoon")}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t(f.descKey)}</p>
                      </div>
                      <Switch checked={false} disabled aria-label={t(f.labelKey)} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {section === "data" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t("settings.dataTitle")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("settings.dataDesc")}</p>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border/70 text-[13px]">
                {[
                  [t("settings.rowCreators"), creatorCount],
                  [t("settings.rowVideos"), videoCount],
                  [t("settings.rowRuns"), runCount],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between py-2">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="tabular font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">{t("settings.dataLocalNote")}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
