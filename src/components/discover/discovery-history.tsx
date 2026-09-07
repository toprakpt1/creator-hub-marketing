"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { SimpleTooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/provider";
import type { DiscoveryRun, QuotaUsage } from "@/lib/types";

/**
 * Discovery history: which searches were run, what they cost and what they
 * produced — the feedback loop for spending quota well.
 */
export function DiscoveryHistory({
  runs,
  quota,
}: {
  runs: DiscoveryRun[];
  quota: QuotaUsage;
}) {
  const t = useT();
  const locale = useLocale();

  const totals = React.useMemo(() => {
    const spent = runs.reduce((s, r) => s + r.quotaUnitsUsed, 0);
    const added = runs.reduce((s, r) => s + r.newCreatorsAdded, 0);
    return {
      runs: runs.length,
      spent,
      added,
      costPerCreator: added > 0 ? Math.round(spent / added) : null,
    };
  }, [runs]);

  return (
    <div className="space-y-4">
      <Link
        href="/discover"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("history.backToDiscover")}
      </Link>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={t("history.kpiRuns")} value={totals.runs} />
        <KpiCard label={t("history.kpiSpent")} value={totals.spent} />
        <KpiCard label={t("history.kpiAdded")} value={totals.added} />
        <KpiCard
          label={t("history.kpiCostPer")}
          value={totals.costPerCreator ?? "—"}
          sub={t("history.kpiCostPerHint")}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("history.quotaTitle")}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("history.quotaToday", { day: quota.day, used: quota.totalUnits, limit: quota.dailyLimit })}
          </p>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {runs.length === 0 ? (
        <EmptyState
          icon={History}
          title={t("history.emptyTitle")}
          description={t("history.emptyBody")}
          action={
            <Button size="sm" asChild>
              <Link href="/discover">{t("history.backToDiscover")}</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("history.runsTitle")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("history.runsDesc")}</p>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table wrapperClassName="border-t border-border">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">{t("history.colKeyword")}</TableHead>
                  <TableHead>{t("history.colScope")}</TableHead>
                  <TableHead className="text-right">{t("history.colRaw")}</TableHead>
                  <TableHead className="text-right">{t("history.colUnique")}</TableHead>
                  <TableHead className="text-right">{t("history.colExisting")}</TableHead>
                  <TableHead className="text-right">{t("history.colPassing")}</TableHead>
                  <TableHead className="text-right">{t("history.colAdded")}</TableHead>
                  <TableHead className="text-right">{t("history.colAnalyzed")}</TableHead>
                  <TableHead className="text-right">{t("history.colQuota")}</TableHead>
                  <TableHead className="pr-5">{t("history.colWhen")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{r.keyword}</span>
                        {r.error && (
                          <SimpleTooltip label={r.error}>
                            <span>
                              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                            </span>
                          </SimpleTooltip>
                        )}
                        {r.pageToken && (
                          <Badge variant="outline">{t("history.nextPage")}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {[r.region, r.language, r.publishedAfter ? t("history.recent") : null]
                        .filter(Boolean)
                        .join(" · ") || t("discover.any")}
                    </TableCell>
                    <TableCell className="text-right text-[13px] tabular">{r.rawResults}</TableCell>
                    <TableCell className="text-right text-[13px] tabular">
                      {r.uniqueChannelsFound}
                    </TableCell>
                    <TableCell className="text-right text-[13px] tabular text-muted-foreground">
                      {r.existingCreatorsFound}
                    </TableCell>
                    <TableCell className="text-right text-[13px] tabular">
                      {r.creatorsPassingFilter}
                    </TableCell>
                    <TableCell className="text-right text-[13px] tabular font-medium">
                      {r.newCreatorsAdded}
                    </TableCell>
                    <TableCell className="text-right text-[13px] tabular text-muted-foreground">
                      {r.creatorsDeepAnalyzed}
                    </TableCell>
                    <TableCell className="text-right text-[13px] tabular">
                      <span className={r.quotaUnitsUsed >= 100 ? "text-warning" : undefined}>
                        {r.quotaUnitsUsed}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap pr-5 text-[13px] text-muted-foreground">
                      <SimpleTooltip label={formatDateTime(r.startedAt, locale)}>
                        <span>{relativeTime(r.startedAt, locale)}</span>
                      </SimpleTooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
