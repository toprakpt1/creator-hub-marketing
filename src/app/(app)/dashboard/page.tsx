import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Flame, Mail, Radar, Users } from "lucide-react";
import { PageIntro, T } from "@/components/shared/page-intro";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartCard } from "@/components/charts/chart-primitives";
import { RankedBars, SizeDistributionBars } from "@/components/charts/distribution-charts";
import { CreatorIdentity } from "@/components/shared/creator-avatar";
import { CreatorStatusBadge, RisingBadge, ScoreBadge } from "@/components/shared/badges";
import { EmptyDiscoverState } from "@/components/shared/empty-discover-state";
import { PlatformStatusRow } from "@/components/discover/platform-status";
import { getCreatorStats, listCreators } from "@/lib/db/creators";
import { getQuotaUsage, listRuns } from "@/lib/db/runs";
import { Compact, Num, TimeAgo } from "@/components/shared/time";
import { compactNumber, fullNumber } from "@/lib/format";

export const metadata = { title: "Dashboard · Chest Blade Creator Hub" };
export const dynamic = "force-dynamic";

/**
 * Every number here comes from the local database. With nothing discovered
 * yet the page says so rather than showing invented totals.
 */
export default function DashboardPage() {
  const stats = getCreatorStats();
  const creators = listCreators();
  const runs = listRuns(5);
  const quota = getQuotaUsage();

  const recent = [...creators]
    .sort((a, b) => +new Date(b.discoveredAt) - +new Date(a.discoveredAt))
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <PageIntro
        titleKey="dashboard.title"
        descriptionKey="dashboard.subtitle"
        actions={
          <Button size="sm" asChild>
            <Link href="/discover">
              <Radar />
              <T k="dashboard.runDiscovery" />
              <ArrowRight />
            </Link>
          </Button>
        }
      >
        <PlatformStatusRow />
      </PageIntro>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label={<T k="dashboard.kpiTotal" />} value={<Num value={stats.total} />} icon={Users} />
        <KpiCard
          label={<T k="dashboard.kpiQualified" />}
          value={<Num value={stats.qualified} />}
          icon={CheckCircle2}
        />
        <KpiCard label={<T k="dashboard.kpiRising" />} value={<Num value={stats.rising} />} icon={Flame} />
        <KpiCard
          label={<T k="dashboard.kpiAnalyzed" />}
          value={<Num value={stats.analyzed} />}
          icon={BarChart3}
        />
        <KpiCard label={<T k="dashboard.kpiEmail" />} value={<Num value={stats.withEmail} />} icon={Mail} />
        <KpiCard
          label={<T k="dashboard.kpiAvgScore" />}
          value={stats.avgScore === null ? "—" : String(stats.avgScore)}
        />
      </div>

      {stats.total === 0 ? (
        <EmptyDiscoverState titleKey="dashboard.emptyTitle" bodyKey="dashboard.emptyBody" />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard
              title={<T k="dashboard.chartSize" />}
              description={<T k="dashboard.chartSizeDesc" />}
            >
              <SizeDistributionBars
                data={stats.bySubscriberBucket.map((b) => ({ bucket: b.bucket, value: b.count }))}
              />
            </ChartCard>

            <ChartCard
              title={<T k="dashboard.chartCountry" />}
              description={<T k="dashboard.chartCountryDesc" />}
            >
              {stats.byCountry.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  <T k="dashboard.noCountryData" />
                </p>
              ) : (
                <RankedBars
                  data={stats.byCountry.map((c) => ({
                    key: c.country,
                    label: c.country === "Unknown" ? "—" : c.country,
                    value: c.count,
                    code: c.country !== "Unknown" ? c.country : undefined,
                  }))}
                  showFlags
                />
              )}
            </ChartCard>

            <ChartCard
              title={<T k="dashboard.chartKeywords" />}
              description={<T k="dashboard.chartKeywordsDesc" />}
            >
              {stats.topKeywords.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  <T k="dashboard.noKeywordData" />
                </p>
              ) : (
                <RankedBars
                  data={stats.topKeywords.map((k) => ({
                    key: k.keyword,
                    label: k.keyword,
                    value: k.count,
                  }))}
                  barColor="hsl(258 62% 56%)"
                />
              )}
            </ChartCard>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>
                  <T k="dashboard.recentTitle" />
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  <T k="dashboard.recentDesc" />
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/creators">
                  <T k="dashboard.viewAllCreators" />
                  <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table wrapperClassName="border-t border-border">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">
                      <T k="creators.colCreator" />
                    </TableHead>
                    <TableHead className="text-right">
                      <T k="creators.colSubscribers" />
                    </TableHead>
                    <TableHead className="text-right">
                      <T k="creators.colAvgViews" />
                    </TableHead>
                    <TableHead className="text-right">
                      <T k="creators.colRatio" />
                    </TableHead>
                    <TableHead>
                      <T k="creators.colRising" />
                    </TableHead>
                    <TableHead>
                      <T k="creators.colScore" />
                    </TableHead>
                    <TableHead className="pr-5">
                      <T k="creators.colStatus" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="pl-5">
                        <CreatorIdentity creator={c} href={`/creators/${c.id}`} showPlatform={false} />
                      </TableCell>
                      <TableCell className="text-right text-[13px] tabular">
                        <Compact value={c.subscriberCount} />
                      </TableCell>
                      <TableCell className="text-right text-[13px] tabular">
                        <Compact value={c.averageViews} />
                      </TableCell>
                      <TableCell className="text-right text-[13px] tabular">
                        {c.viewToSubscriberRatio === null
                          ? "—"
                          : `${c.viewToSubscriberRatio.toFixed(2)}×`}
                      </TableCell>
                      <TableCell>
                        <RisingBadge isRising={c.isRising} ratio={c.viewToSubscriberRatio} />
                      </TableCell>
                      <TableCell>
                        <ScoreBadge score={c.creatorScore} showLabel={false} />
                      </TableCell>
                      <TableCell className="pr-5">
                        <CreatorStatusBadge status={c.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Discovery activity — useful even at zero creators */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle>
              <T k="dashboard.recentRuns" />
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              <T k="dashboard.quotaLine" vars={{ used: quota.totalUnits, limit: quota.dailyLimit }} />
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/discover/history">
              <T k="discover.history" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              <T k="dashboard.noRuns" />
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-2 text-[13px]">
                  <span className="font-medium">{r.keyword}</span>
                  <span className="text-xs text-muted-foreground">
                    <T
                      k="dashboard.runSummary"
                      vars={{
                        unique: r.uniqueChannelsFound,
                        added: r.newCreatorsAdded,
                        units: r.quotaUnitsUsed,
                      }}
                    />
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    <TimeAgo iso={r.startedAt} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
