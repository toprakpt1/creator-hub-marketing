"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { CreatorIdentity } from "@/components/shared/creator-avatar";
import {
  CreatorStatusBadge,
  KeywordBadges,
  RisingBadge,
  ScoreBadge,
} from "@/components/shared/badges";
import { CreatorRowActions } from "@/components/creators/creator-actions";
import { EmailCell } from "@/components/creators/email-cell";
import { countryFlagFor, countryName } from "@/lib/constants";
import { compactNumber, relativeTime } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/provider";
import type { Creator } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Renders a nullable metric as an em dash rather than inventing a zero. */
function Metric({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return <>{compactNumber(value)}</>;
}

export function CreatorsTable({
  rows,
  selected,
  onToggle,
  onToggleAll,
  onChanged,
}: {
  rows: Creator[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onChanged?: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = rows.some((r) => selected.has(r.id));

  return (
    <Table wrapperClassName="rounded-xl border border-border bg-card">
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-9 pl-4">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={onToggleAll}
              aria-label={t("common.selectAll")}
            />
          </TableHead>
          <TableHead className="w-[200px] min-w-[180px]">{t("creators.colCreator")}</TableHead>
          <TableHead className="text-right" title={t("creators.colSubscribers")}>
            {t("creators.colSubsShort")}
          </TableHead>
          <TableHead className="text-right" title={t("creators.colAvgViews")}>
            {t("creators.colAvgShort")}
          </TableHead>
          <TableHead className="text-right" title={t("creators.colMedianViews")}>
            {t("creators.colMedianShort")}
          </TableHead>
          <TableHead className="text-right" title={t("creators.colRatio")}>
            {t("creators.colRatioShort")}
          </TableHead>
          <TableHead className="whitespace-nowrap" title={t("creators.colActivity")}>
            {t("creators.colActivityShort")}
          </TableHead>
          <TableHead className="w-8" title={t("creators.colRising")}>
            <span className="sr-only">{t("creators.colRising")}</span>
          </TableHead>
          <TableHead className="w-10" title={t("creators.colScore")}>
            {t("creators.colScore")}
          </TableHead>
          <TableHead className="w-8" title={t("creators.colCountry")}>
            <span className="sr-only">{t("creators.colCountry")}</span>
          </TableHead>
          <TableHead title={t("creators.colDiscoveredBy")}>
            {t("creators.colKeywordShort")}
          </TableHead>
          <TableHead title={t("creators.colEmail")}>{t("creators.colEmail")}</TableHead>
          <TableHead title={t("creators.colStatus")}>{t("creators.colStatus")}</TableHead>
          <TableHead className="w-10 pr-4 text-right">
            <span className="sr-only">{t("common.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => {
          const isSelected = selected.has(c.id);
          return (
            <TableRow key={c.id} data-state={isSelected ? "selected" : undefined}>
              <TableCell className="pl-4">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggle(c.id)}
                  aria-label={t("common.select", { name: c.name })}
                />
              </TableCell>

              <TableCell className="max-w-[200px]">
                <CreatorIdentity creator={c} href={`/creators/${c.id}`} showPlatform={false} />
              </TableCell>

              <TableCell className="text-right text-[13px] tabular">
                {c.subscriberCountHidden ? (
                  <SimpleTooltip label={t("creators.subsHiddenTip")}>
                    <span className="text-muted-foreground">{t("creators.hidden")}</span>
                  </SimpleTooltip>
                ) : (
                  <Metric value={c.subscriberCount} />
                )}
              </TableCell>

              <TableCell className="text-right text-[13px] tabular">
                <Metric value={c.averageViews} />
              </TableCell>
              <TableCell className="text-right text-[13px] tabular">
                <Metric value={c.medianViews} />
              </TableCell>

              <TableCell className="text-right text-[13px] tabular">
                {c.viewToSubscriberRatio === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span
                    className={cn(c.viewToSubscriberRatio >= 1.5 && "font-medium text-warning")}
                  >
                    {c.viewToSubscriberRatio.toFixed(2)}×
                  </span>
                )}
              </TableCell>

              <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                {c.lastUploadAt ? relativeTime(c.lastUploadAt, locale) : "—"}
              </TableCell>

              <TableCell className="w-8">
                <RisingBadge isRising={c.isRising} ratio={c.viewToSubscriberRatio} compact />
              </TableCell>

              <TableCell>
                <ScoreBadge score={c.creatorScore} showLabel={false} />
              </TableCell>

              <TableCell className="w-8 whitespace-nowrap text-[13px] text-muted-foreground">
                {c.country ? (
                  <SimpleTooltip label={countryName(c.country, locale)}>
                    <span className="cursor-default text-base leading-none" aria-label={c.country}>
                      {countryFlagFor(c.country)}
                    </span>
                  </SimpleTooltip>
                ) : (
                  "—"
                )}
              </TableCell>

              <TableCell>
                <KeywordBadges keywords={c.discoveredKeywords} max={1} />
              </TableCell>

              <TableCell>
                <EmailCell creator={c} onChanged={onChanged} />
              </TableCell>

              <TableCell>
                <CreatorStatusBadge status={c.status} />
              </TableCell>

              <TableCell className="pr-4 text-right">
                <CreatorRowActions creator={c} onChanged={onChanged} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Narrow-viewport rendering of the same rows. */
export function CreatorCardList({
  rows,
  selected,
  onToggle,
  onChanged,
}: {
  rows: Creator[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onChanged?: () => void;
}) {
  const t = useT();
  return (
    <div className="space-y-2">
      {rows.map((c) => (
        <div
          key={c.id}
          className={cn(
            "rounded-xl border bg-card p-3 transition-colors",
            selected.has(c.id) ? "border-primary/50 bg-primary/[0.04]" : "border-border"
          )}
        >
          <div className="flex items-start gap-3">
            <Checkbox
              checked={selected.has(c.id)}
              onCheckedChange={() => onToggle(c.id)}
              aria-label={t("common.select", { name: c.name })}
              className="mt-1"
            />
            <Link href={`/creators/${c.id}`} className="min-w-0 flex-1">
              <CreatorIdentity creator={c} />
            </Link>
            <ScoreBadge score={c.creatorScore} showLabel={false} />
            <CreatorRowActions creator={c} onChanged={onChanged} />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-secondary/40 py-1.5">
              <div className="text-[13px] font-medium tabular">
                {c.subscriberCountHidden
                  ? t("creators.hidden")
                  : c.subscriberCount === null
                    ? "—"
                    : compactNumber(c.subscriberCount)}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("creators.colSubscribers")}
              </div>
            </div>
            <div className="rounded-md bg-secondary/40 py-1.5">
              <div className="text-[13px] font-medium tabular">
                {c.averageViews === null ? "—" : compactNumber(c.averageViews)}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("creators.colAvgViews")}
              </div>
            </div>
            <div className="rounded-md bg-secondary/40 py-1.5">
              <div className="text-[13px] font-medium tabular">
                {c.viewToSubscriberRatio === null ? "—" : `${c.viewToSubscriberRatio.toFixed(2)}×`}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("creators.colRatio")}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {c.country && (
              <span className="text-xs text-muted-foreground">
                {countryFlagFor(c.country)} {c.country}
              </span>
            )}
            <CreatorStatusBadge status={c.status} />
            <RisingBadge isRising={c.isRising} ratio={c.viewToSubscriberRatio} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CreatorsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5">
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="divide-y divide-border/70">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2.5 w-24" />
            </div>
            <Skeleton className="hidden h-3 w-16 sm:block" />
            <Skeleton className="hidden h-3 w-16 md:block" />
            <Skeleton className="h-6 w-10 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
