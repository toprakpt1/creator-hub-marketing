import { PageIntro, T } from "@/components/shared/page-intro";
import { CampaignsGrid } from "@/components/campaigns/campaign-cards";
import { listCampaigns } from "@/lib/db/groups";

export const metadata = { title: "Campaigns · Chest Blade Creator Hub" };
export const dynamic = "force-dynamic";

export default function CampaignsPage() {
  const campaigns = listCampaigns();
  const totalMembers = campaigns.reduce((s, c) => s + c.memberCount, 0);
  const active = campaigns.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-5">
      <PageIntro titleKey="campaigns.title" descriptionKey="campaigns.subtitle">
        {campaigns.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span><T k="campaigns.statActive" vars={{ count: active }} /></span>
            <span><T k="campaigns.statCreators" vars={{ count: totalMembers }} /></span>
          </div>
        )}
      </PageIntro>

      <CampaignsGrid campaigns={campaigns} />
    </div>
  );
}
