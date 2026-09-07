"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  Database,
  ExternalLink,
  History,
  Info,
  Radar,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { CreatorAvatar } from "@/components/shared/creator-avatar";
import {
  countryFlagFor,
  DEFAULT_MAX_SUBSCRIBERS,
  DEFAULT_MIN_SUBSCRIBERS,
  KEYWORD_SUGGESTIONS,
  RECENCY_OPTIONS,
  RESULTS_PER_SEARCH,
  SEARCH_LANGUAGES,
  SEARCH_REGIONS,
} from "@/lib/constants";
import { compactNumber, relativeTime } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/provider";
import type { DiscoveryCandidate, DiscoveryRun, QuotaUsage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SearchResponse {
  run?: DiscoveryRun;
  candidates?: DiscoveryCandidate[];
  nextPageToken?: string | null;
  fromCache?: boolean;
  cached?: boolean;
  message?: string;
  error?: string;
  code?: string;
}

/** One search costs 100 units; each 50 channels adds 1 more. */
const SEARCH_QUOTA_COST = 100;

export function DiscoverPanel({ initialQuota }: { initialQuota: QuotaUsage }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const [keyword, setKeyword] = React.useState("");
  const [maxResults, setMaxResults] = React.useState(25);
  const [region, setRegion] = React.useState("");
  const [language, setLanguage] = React.useState("");
  const [recency, setRecency] = React.useState<number | null>(null);
  const [minSubs, setMinSubs] = React.useState(String(DEFAULT_MIN_SUBSCRIBERS));
  const [maxSubs, setMaxSubs] = React.useState(String(DEFAULT_MAX_SUBSCRIBERS));

  const [state, setState] = React.useState<"idle" | "loading" | "done">("idle");
  const [run, setRun] = React.useState<DiscoveryRun | null>(null);
  const [candidates, setCandidates] = React.useState<DiscoveryCandidate[]>([]);
  const [nextPageToken, setNextPageToken] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [quota, setQuota] = React.useState(initialQuota);
  const [cacheNotice, setCacheNotice] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [analyzeAfterSave, setAnalyzeAfterSave] = React.useState(true);

  const refreshQuota = React.useCallback(async () => {
    try {
      const res = await fetch("/api/quota");
      if (res.ok) setQuota((await res.json()) as QuotaUsage);
    } catch {
      /* meter is advisory */
    }
  }, []);

  const selectable = candidates.filter((c) => c.passesFilter && !c.alreadySaved);

  async function runSearch(opts: { force?: boolean; pageToken?: string } = {}) {
    if (!keyword.trim()) {
      toast.error(t("discover.keywordRequired"));
      return;
    }
    setState("loading");
    setCacheNotice(null);

    try {
      const res = await fetch("/api/discover/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          maxResults,
          region: region || undefined,
          language: language || undefined,
          publishedWithinDays: recency ?? undefined,
          minSubscribers: Number(minSubs) || 0,
          maxSubscribers: Number(maxSubs) || DEFAULT_MAX_SUBSCRIBERS,
          pageToken: opts.pageToken,
          force: opts.force ?? false,
        }),
      });

      const data = (await res.json()) as SearchResponse;

      if (!res.ok) {
        setState(candidates.length ? "done" : "idle");
        toast.error(data.error ?? t("discover.searchFailed"), {
          description: data.code === "quota_guard" ? t("discover.quotaGuardHint") : undefined,
        });
        return;
      }

      const incoming = data.candidates ?? [];
      // "Load more" appends; a fresh search replaces.
      setCandidates(opts.pageToken ? [...candidates, ...incoming] : incoming);
      setRun(data.run ?? null);
      setNextPageToken(data.nextPageToken ?? null);
      setSelected(new Set());
      setState("done");

      if (data.cached) {
        setCacheNotice(data.message ?? t("discover.cacheNotice"));
      } else {
        toast.success(t("discover.resultsFound", { count: incoming.length }), {
          description: t("discover.quotaSpent", { units: data.run?.quotaUnitsUsed ?? 0 }),
        });
      }
      void refreshQuota();
    } catch {
      setState("idle");
      toast.error(t("discover.searchFailed"));
    }
  }

  async function saveSelected() {
    const chosen = candidates.filter((c) => selected.has(c.youtubeChannelId));
    if (chosen.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates: chosen, runId: run?.id }),
      });
      const data = (await res.json()) as { added?: number; ids?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? t("discover.saveFailed"));

      toast.success(t("discover.savedCount", { count: data.added ?? 0 }));

      // Mark them saved in place so the table reflects reality without a re-search.
      setCandidates((prev) =>
        prev.map((c) =>
          selected.has(c.youtubeChannelId) ? { ...c, alreadySaved: true } : c
        )
      );
      setSelected(new Set());

      if (analyzeAfterSave && data.ids?.length) {
        const toastId = toast.loading(
          t("creators.analyzingCount", { count: data.ids.length })
        );
        let ok = 0;
        for (const id of data.ids) {
          try {
            const r = await fetch(`/api/creators/${id}/analyze`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ videoCount: 10, runId: run?.id }),
            });
            if (r.ok) ok++;
          } catch {
            /* keep going; partial analysis is still useful */
          }
        }
        toast.success(t("creators.bulkAnalyzeDone", { ok, failed: data.ids.length - ok }), {
          id: toastId,
          description: t("creators.bulkAnalyzeCost", { units: data.ids.length * 2 }),
        });
        void refreshQuota();
      }

      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const quotaPct = Math.min(100, Math.round((quota.totalUnits / quota.dailyLimit) * 100));
  const quotaLow = quota.dailyLimit - quota.totalUnits < SEARCH_QUOTA_COST;

  return (
    <div className="space-y-4">
      {/* Quota meter — always visible, because searches are the scarce resource */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="min-w-[200px] flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{t("discover.quotaToday")}</span>
              <span className="tabular text-muted-foreground">
                {quota.totalUnits} / {quota.dailyLimit}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  quotaPct > 85 ? "bg-destructive" : quotaPct > 60 ? "bg-warning" : "bg-primary"
                )}
                style={{ width: `${quotaPct}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("discover.quotaExplain", {
                searches: quota.searchRequestsToday,
                remaining: Math.max(
                  0,
                  Math.floor((quota.dailyLimit - quota.totalUnits) / SEARCH_QUOTA_COST)
                ),
              })}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/discover/history">
              <History />
              {t("discover.history")}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Search form */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>{t("discover.searchParameters")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("discover.searchParametersDesc")}</p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Radar className="h-3 w-3" />
              {t("discover.youtubeOnly")}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dv-keyword">{t("discover.keyword")}</Label>
            <Input
              id="dv-keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void runSearch()}
              placeholder={t("discover.keywordPlaceholder")}
            />
            <div className="flex flex-wrap gap-1.5">
              {KEYWORD_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setKeyword(s)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                    keyword === s
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label>{t("discover.resultsPerSearch")}</Label>
              <Select value={String(maxResults)} onValueChange={(v) => setMaxResults(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESULTS_PER_SEARCH.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("discover.region")}</Label>
              <Select value={region || "any"} onValueChange={(v) => setRegion(v === "any" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {SEARCH_REGIONS.map((r) => (
                    <SelectItem key={r.code || "any"} value={r.code || "any"}>
                      {r.flag} {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("discover.language")}</Label>
              <Select
                value={language || "any"}
                onValueChange={(v) => setLanguage(v === "any" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {SEARCH_LANGUAGES.map((l) => (
                    <SelectItem key={l.code || "any"} value={l.code || "any"}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("discover.publishedInLast")}</Label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setRecency(null)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                    recency === null
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t("discover.any")}
                </button>
                {RECENCY_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setRecency(d)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                      recency === d
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t("discover.days", { count: d })}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-lg border border-border p-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dv-min">{t("discover.minSubscribers")}</Label>
              <Input
                id="dv-min"
                value={minSubs}
                onChange={(e) => setMinSubs(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dv-max">{t("discover.maxSubscribers")}</Label>
              <Input
                id="dv-max"
                value={maxSubs}
                onChange={(e) => setMaxSubs(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <p className="text-[11px] text-muted-foreground md:col-span-2">
              {t("discover.hiddenSubsNote")}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              {t("discover.costNote", { units: SEARCH_QUOTA_COST })}
            </p>
            <Button onClick={() => void runSearch()} disabled={state === "loading" || quotaLow}>
              <Search className={cn(state === "loading" && "animate-pulse")} />
              {state === "loading" ? t("discover.searching") : t("discover.findCreators")}
            </Button>
          </div>

          {quotaLow && (
            <p className="inline-flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t("discover.quotaExhausted")}
            </p>
          )}
        </CardContent>
      </Card>

      {cacheNotice && (
        <Card className="border-warning/40 bg-warning/[0.06]">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="inline-flex items-center gap-2 text-[13px]">
              <History className="h-4 w-4 text-warning" />
              {cacheNotice}
            </p>
            <Button size="sm" variant="outline" onClick={() => void runSearch({ force: true })}>
              {t("discover.runAgain")}
            </Button>
          </CardContent>
        </Card>
      )}

      {state === "loading" && <ResultsSkeleton />}

      {state === "idle" && (
        <EmptyState
          icon={Search}
          title={t("discover.idleTitle")}
          description={t("discover.idleBody")}
        />
      )}

      {state === "done" && candidates.length === 0 && (
        <EmptyState
          icon={Radar}
          title={t("discover.emptyTitle")}
          description={t("discover.emptyBody")}
        />
      )}

      {state === "done" && candidates.length > 0 && (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
            <div>
              <CardTitle>{t("discover.resultsTitle", { count: candidates.length })}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("discover.resultsSummary", {
                  unique: run?.uniqueChannelsFound ?? candidates.length,
                  existing: run?.existingCreatorsFound ?? 0,
                  passing: selectable.length,
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={analyzeAfterSave}
                  onCheckedChange={(v) => setAnalyzeAfterSave(Boolean(v))}
                />
                {t("discover.analyzeAfterSave")}
              </label>
              <Button
                size="sm"
                disabled={selected.size === 0 || saving}
                onClick={() => void saveSelected()}
              >
                <Database />
                {t("discover.addSelected", { count: selected.size })}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="px-0 pb-0">
            <Table wrapperClassName="border-t border-border">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-9 pl-5">
                    <Checkbox
                      checked={
                        selectable.length > 0 && selectable.every((c) => selected.has(c.youtubeChannelId))
                          ? true
                          : selected.size > 0
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={() =>
                        setSelected((prev) =>
                          prev.size === selectable.length
                            ? new Set()
                            : new Set(selectable.map((c) => c.youtubeChannelId))
                        )
                      }
                      aria-label={t("common.selectAll")}
                    />
                  </TableHead>
                  <TableHead>{t("creators.colCreator")}</TableHead>
                  <TableHead className="text-right">{t("creators.colSubscribers")}</TableHead>
                  <TableHead className="text-right">{t("discover.colTotalViews")}</TableHead>
                  <TableHead className="text-right">{t("discover.colVideos")}</TableHead>
                  <TableHead>{t("creators.colCountry")}</TableHead>
                  <TableHead className="min-w-[200px]">{t("discover.colMatchedVideo")}</TableHead>
                  <TableHead className="pr-5">{t("discover.colState")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => {
                  const disabled = !c.passesFilter || c.alreadySaved;
                  return (
                    <TableRow
                      key={c.youtubeChannelId}
                      className={cn(disabled && "opacity-60")}
                    >
                      <TableCell className="pl-5">
                        <Checkbox
                          disabled={disabled}
                          checked={selected.has(c.youtubeChannelId)}
                          onCheckedChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(c.youtubeChannelId)) next.delete(c.youtubeChannelId);
                              else next.add(c.youtubeChannelId);
                              return next;
                            })
                          }
                          aria-label={t("common.select", { name: c.name })}
                        />
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <CreatorAvatar
                            name={c.name}
                            seed={c.youtubeChannelId}
                            imageUrl={c.thumbnailUrl}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-medium">{c.name}</div>
                            {c.handle && (
                              <div className="truncate text-xs text-muted-foreground">
                                {c.handle}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-right text-[13px] tabular">
                        {c.subscriberCountHidden ? (
                          <SimpleTooltip label={t("creators.subsHiddenTip")}>
                            <span className="text-muted-foreground">{t("creators.hidden")}</span>
                          </SimpleTooltip>
                        ) : c.subscriberCount === null ? (
                          "—"
                        ) : (
                          compactNumber(c.subscriberCount)
                        )}
                      </TableCell>

                      <TableCell className="text-right text-[13px] tabular">
                        {c.channelTotalViews === null ? "—" : compactNumber(c.channelTotalViews)}
                      </TableCell>
                      <TableCell className="text-right text-[13px] tabular">
                        {c.channelVideoCount ?? "—"}
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                        {c.country ? `${countryFlagFor(c.country)} ${c.country}` : "—"}
                      </TableCell>

                      <TableCell className="max-w-[260px]">
                        {c.matchedVideoId ? (
                          <a
                            href={`https://youtube.com/watch?v=${c.matchedVideoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block min-w-0"
                          >
                            <span className="flex items-center gap-1 truncate text-[13px] group-hover:underline">
                              {c.matchedVideoTitle}
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                            </span>
                            {c.matchedVideoPublishedAt && (
                              <span className="text-[11px] text-muted-foreground">
                                {relativeTime(c.matchedVideoPublishedAt, locale)}
                              </span>
                            )}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>

                      <TableCell className="pr-5">
                        {c.alreadySaved ? (
                          <Badge variant="secondary" className="gap-1">
                            <Check className="h-3 w-3" />
                            {t("discover.alreadySaved")}
                          </Badge>
                        ) : c.passesFilter ? (
                          <Badge variant="success">{t("discover.passes")}</Badge>
                        ) : (
                          <SimpleTooltip label={c.filterReason ?? ""}>
                            <span>
                              <Badge variant="muted">{t("discover.filtered")}</Badge>
                            </span>
                          </SimpleTooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {nextPageToken && (
              <div className="flex flex-col items-center gap-1.5 border-t border-border p-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={quotaLow}
                  onClick={() => void runSearch({ force: true, pageToken: nextPageToken })}
                >
                  <ChevronDown />
                  {t("discover.loadMore")}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  {t("discover.loadMoreCost", { units: SEARCH_QUOTA_COST })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {state === "done" && candidates.length > 0 && (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" />
          {t("discover.saveThenAnalyze")}
        </p>
      )}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-56" />
      </CardHeader>
      <CardContent className="space-y-2 px-5 pb-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-2.5 w-28" />
            </div>
            <Skeleton className="hidden h-3 w-14 sm:block" />
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
