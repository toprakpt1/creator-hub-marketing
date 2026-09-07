import { PageIntro, T } from "@/components/shared/page-intro";
import { Num } from "@/components/shared/time";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartCard } from "@/components/charts/chart-primitives";
import { RankedBars, SizeDistributionBars } from "@/components/charts/distribution-charts";
import { EmptyDiscoverState } from "@/components/shared/empty-discover-state";
import { getCreatorStats } from "@/lib/db/creators";
import { getQuotaUsage, listRuns } from "@/lib/db/runs";
import { fullNumber } from "@/lib/format";

export const metadata = { title: "Analytics · Chest Blade Creator Hub" };
export const dynamic = "force-dynamic";

/** Reporting over real discovered data only — no invented totals. */
export default function AnalyticsPage() {
  const stats = getCreatorStats();
  const runs = listRuns(100);
  const quota = getQuotaUsage();

  const totalQuotaSpent = runs.reduce((s, r) => s + r.quotaUnitsUsed, 0);
  const totalAdded = runs.reduce((s, r) => s + r.newCreatorsAdded, 0);
  const costPerCreator = totalAdded > 0 ? Math.round(totalQuotaSpent / totalAdded) : null;

  // Which keywords actually produced saved creators — the useful ranking.
  const keywordYield = stats.topKeywords.map((k) => ({
    key: k.keyword,
    label: k.keyword,
    value: k.count,
  }));

  return (
    <div className="space-y-5">
      <PageIntro titleKey="analytics.title" descriptionKey="analytics.subtitle" />

      {stats.total === 0 ? (
        <EmptyDiscoverState titleKey="analytics.emptyTitle" bodyKey="analytics.emptyBody" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard label={<T k="analytics.kpiDiscovered" />} value={<Num value={stats.total} />} />
            <KpiCard label={<T k="analytics.kpiQualified" />} value={<Num value={stats.qualified} />} />
            <KpiCard label={<T k="analytics.kpiRising" />} value={<Num value={stats.rising} />} />
            <KpiCard label={<T k="analytics.kpiAnalyzed" />} value={<Num value={stats.analyzed} />} />
            <KpiCard
              label={<T k="analytics.kpiAvgScore" />}
              value={stats.avgScore === null ? "—" : String(stats.avgScore)}
            />
            <KpiCard
              label={<T k="analytics.kpiCostPerCreator" />}
              value={costPerCreator === null ? "—" : String(costPerCreator)}
              sub={<T k="analytics.kpiCostHint" /> as unknown as string}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard
              title={<T k="analytics.chartSize" />}
              description={<T k="analytics.chartSizeDesc" />}
            >
              <SizeDistributionBars
                data={stats.bySubscriberBucket.map((b) => ({ bucket: b.bucket, value: b.count }))}
              />
            </ChartCard>

            <ChartCard
              title={<T k="analytics.chartCountry" />}
              description={<T k="analytics.chartCountryDesc" />}
            >
              <RankedBars
                data={stats.byCountry.map((c) => ({
                  key: c.country,
                  label: c.country === "Unknown" ? "—" : c.country,
                  value: c.count,
                  code: c.country !== "Unknown" ? c.country : undefined,
                }))}
                showFlags
              />
            </ChartCard>

            <ChartCard
              title={<T k="analytics.chartKeywords" />}
              description={<T k="analytics.chartKeywordsDesc" />}
            >
              <RankedBars data={keywordYield} barColor="hsl(258 62% 56%)" />
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title={<T k="analytics.chartStatus" />}
              description={<T k="analytics.chartStatusDesc" />}
            >
              <RankedBars
                data={stats.byStatus.map((s) => ({
                  key: s.status,
                  label: s.status,
                  labelKey: `status.creator.${s.status}`,
                  value: s.count,
                }))}
              />
            </ChartCard>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>
                  <T k="analytics.quotaTitle" />
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  <T
                    k="analytics.quotaDesc"
                    vars={{ used: quota.totalUnits, limit: quota.dailyLimit }}
                  />
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    <T k="analytics.totalRuns" />
                  </span>
                  <span className="tabular">{runs.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    <T k="analytics.totalSpent" />
                  </span>
                  <span className="tabular">{totalQuotaSpent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    <T k="analytics.totalAdded" />
                  </span>
                  <span className="tabular">{totalAdded}</span>
                </div>
                {quota.byEndpoint.map((e) => (
                  <div key={e.endpoint} className="flex justify-between">
                    <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
                      {e.endpoint}
                    </code>
                    <span className="tabular text-muted-foreground">
                      {e.requests} · {e.units}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
