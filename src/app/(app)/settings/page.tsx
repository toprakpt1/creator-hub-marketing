import { PageIntro } from "@/components/shared/page-intro";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { getDb } from "@/lib/db/client";
import { getMailAccountSummary } from "@/lib/db/mail";
import { getQuotaUsage } from "@/lib/db/runs";
import { getGameSettings } from "@/lib/db/settings";
import { oauthConfigured } from "@/lib/outreach/gmail";

export const metadata = { title: "Settings · Chest Blade Creator Hub" };
export const dynamic = "force-dynamic";

function countRows(table: string): number {
  const row = getDb().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
  return row.n;
}

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageIntro titleKey="settings.title" descriptionKey="settings.subtitle" />
      <SettingsWorkspace
        quota={getQuotaUsage()}
        creatorCount={countRows("creators")}
        videoCount={countRows("youtube_videos")}
        runCount={countRows("discovery_runs")}
        mailAccount={getMailAccountSummary()}
        oauthConfigured={oauthConfigured()}
        game={getGameSettings()}
      />
    </div>
  );
}
