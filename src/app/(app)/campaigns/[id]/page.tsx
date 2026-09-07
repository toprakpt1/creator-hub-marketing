import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { T } from "@/components/shared/page-intro";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-cards";
import { CampaignFunnelChart } from "@/components/campaigns/campaign-funnel";
import { CreatorsExplorer } from "@/components/creators/creators-explorer";
import { getCreators } from "@/lib/db/creators";
import { campaignMemberIds, getCampaign } from "@/lib/db/groups";
import { Compact, DateText, UpdatedAgo } from "@/components/shared/time";
import { compactNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = getCampaign(id);
  return { title: campaign ? `${campaign.name} · Campaigns` : "Campaign · Creator Hub" };
}

function Stat({
  label,
  value,
  hint,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = getCampaign(id);
  if (!campaign) notFound();

  const members = getCreators(campaignMemberIds(id));
  const { funnel } = campaign;

  const analysed = members.filter((c) => c.videosAnalyzed > 0);
  const avgScore = analysed.length
    ? Math.round(analysed.reduce((s, c) => s + (c.creatorScore ?? 0), 0) / analysed.length)
    : null;
  const estimatedReach = members.reduce((s, c) => s + (c.averageViews ?? 0), 0);

  return (
    <div className="space-y-5">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <T k="campaigns.backToCampaigns" />
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            {campaign.name}
            <CampaignStatusBadge status={campaign.status} />
          </span>
        }
        description={campaign.goal ?? undefined}
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          {campaign.startDate && (
            <span>
              <DateText iso={campaign.startDate} />
            </span>
          )}
          <span>
            <UpdatedAgo iso={campaign.updatedAt} />
          </span>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label={<T k="campaigns.detailCreators" />} value={String(funnel.added)} />
        <Stat label={<T k="campaigns.detailQualified" />} value={String(funnel.qualified)} />
        <Stat label={<T k="campaigns.detailContacted" />} value={String(funnel.contacted)} />
        <Stat
          label={<T k="campaigns.detailAvgScore" />}
          value={avgScore === null ? "—" : String(avgScore)}
        />
        <Stat
          label={<T k="campaigns.detailReach" />}
          value={estimatedReach ? <Compact value={estimatedReach} /> : "—"}
          hint={<T k="campaigns.detailReachHint" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>
              <T k="campaigns.funnelTitle" />
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              <T k="campaigns.funnelDesc" />
            </p>
          </CardHeader>
          <CardContent>
            <CampaignFunnelChart funnel={funnel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>
              <T k="campaigns.audienceTitle" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                <T k="campaigns.audienceAnalyzed" />
              </span>
              <span className="tabular">
                {analysed.length} / {members.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                <T k="campaigns.audienceRising" />
              </span>
              <span className="tabular">{members.filter((c) => c.isRising).length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                <T k="campaigns.audienceWithEmail" />
              </span>
              <span className="tabular">{members.filter((c) => c.email).length}</span>
            </div>
            <p className="pt-2 text-[11px] text-muted-foreground">
              <T k="campaigns.outreachPending" />
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">
          <T k="campaigns.campaignCreators" />
        </h2>
        <CreatorsExplorer creators={members} />
      </div>
    </div>
  );
}
