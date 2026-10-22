"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpDown,
  BarChart3,
  Flame,
  Radar,
  Search,
  SlidersHorizontal,
  ListPlus,
  Megaphone,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import {
  MultiSelectFilter,
  NumberFilter,
  SegmentedFilter,
} from "@/components/creators/filter-controls";
import {
  CreatorCardList,
  CreatorsTable,
  CreatorsTableSkeleton,
} from "@/components/creators/creators-table";
import {
  analyzeCreatorRequest,
  ConfirmDialog,
  patchCreator,
} from "@/components/creators/creator-actions";
import { AddToCampaignDialog, AddToListDialog } from "@/components/creators/add-to-group";
import { CREATOR_STATUSES, SUBSCRIBER_BUCKETS, countryFlagFor } from "@/lib/constants";
import {
  applyFilters,
  countActiveFilters,
  EMPTY_FILTERS,
  SORT_OPTIONS,
  sortCreators,
  type CreatorFilters,
  type SortId,
} from "@/lib/creator-filters";
import { fullNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { Creator } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CreatorsExplorer({
  creators,
  addedNonce = 0,
  onAddManual,
}: {
  creators: Creator[];
  addedNonce?: number;
  onAddManual?: () => void;
}) {
  const t = useT();
  const router = useRouter();

  const [filters, setFilters] = React.useState<CreatorFilters>(EMPTY_FILTERS);
  const [sort, setSort] = React.useState<SortId>("score_desc");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [listOpen, setListOpen] = React.useState(false);
  const [campaignOpen, setCampaignOpen] = React.useState(false);

  // A newly added creator has no score yet, so show the newest records first.
  React.useEffect(() => {
    if (addedNonce > 0) {
      setSort("discovered_desc");
      setPage(1);
    }
  }, [addedNonce]);

  const set = <K extends keyof CreatorFilters>(key: K, value: CreatorFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const filtered = React.useMemo(
    () => sortCreators(applyFilters(creators, filters), sort),
    [creators, filters, sort]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const activeCount = countActiveFilters(filters);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOnPage = rows.every((r) => next.has(r.id));
      rows.forEach((r) => (allOnPage ? next.delete(r.id) : next.add(r.id)));
      return next;
    });

  const refresh = () => router.refresh();

  /* ---- facet options are derived from what we actually have ---- */

  const countryOptions = React.useMemo(() => {
    const counts = new Map<string, number>();
    creators.forEach((c) => {
      if (c.country) counts.set(c.country, (counts.get(c.country) ?? 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({
        value: code,
        label: code,
        prefix: <span aria-hidden>{countryFlagFor(code)}</span>,
        count,
      }));
  }, [creators]);

  const keywordOptions = React.useMemo(() => {
    const counts = new Map<string, number>();
    creators.forEach((c) =>
      c.discoveredKeywords.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1))
    );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([keyword, count]) => ({ value: keyword, label: keyword, count }));
  }, [creators]);

  const statusOptions = React.useMemo(
    () =>
      CREATOR_STATUSES.map((s) => ({
        value: s,
        label: t(`status.creator.${s}`),
        count: creators.filter((c) => c.status === s).length,
      })).filter((o) => o.count > 0),
    [creators, t]
  );

  /* ---- bulk actions ---- */

  const bulkStatus = async (status: Creator["status"], messageKey: string) => {
    setBusy(true);
    const ids = [...selected];
    try {
      await Promise.all(ids.map((id) => patchCreator(id, { status })));
      toast.success(t(messageKey, { count: ids.length }));
      setSelected(new Set());
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Analyses each selected creator; 2 quota units apiece, so it is explicit. */
  const bulkAnalyze = async () => {
    const ids = creators
      .filter((c) => selected.has(c.id) && c.uploadsPlaylistId)
      .map((c) => c.id);
    const skipped = selected.size - ids.length;

    if (ids.length === 0) {
      toast.error(t("creators.analyzeUnavailable"), {
        description: t("creators.analyzeUnavailableBody"),
      });
      return;
    }

    setBusy(true);
    const toastId = toast.loading(t("creators.analyzingCount", { count: ids.length }));
    let ok = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await analyzeCreatorRequest(id);
        ok++;
      } catch {
        failed++;
      }
    }
    toast.success(t("creators.bulkAnalyzeDone", { ok, failed }), {
      id: toastId,
      description: t("creators.bulkAnalyzeCost", { units: ids.length * 2 }),
    });
    if (skipped > 0) {
      toast.info(t("creators.bulkAnalyzeSkipped", { count: skipped }));
    }
    setSelected(new Set());
    setBusy(false);
    refresh();
  };

  if (creators.length === 0) {
    return (
      <EmptyState
        icon={Radar}
        title={t("creators.emptyDbTitle")}
        description={t("creators.emptyDbBody")}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" asChild>
              <Link href="/discover">
                <Radar />
                {t("creators.goDiscover")}
              </Link>
            </Button>
            {onAddManual && (
              <Button size="sm" variant="outline" onClick={onAddManual}>
                <UserPlus />
                {t("creators.addManual")}
              </Button>
            )}
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder={t("creators.searchPlaceholder")}
            className="h-9 pl-9"
          />
          {filters.query && (
            <button
              onClick={() => set("query", "")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t("creators.clearSearch")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Button
          variant={showFilters ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal />
          {t("common.filters")}
          {activeCount > 0 && (
            <Badge variant="default" className="ml-0.5">
              {activeCount}
            </Badge>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ArrowUpDown />
              <span className="hidden sm:inline">
                {t(`creators.${SORT_OPTIONS.find((s) => s.id === sort)?.labelKey}`)}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t("common.sortBy")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortId)}>
              {SORT_OPTIONS.map((o) => (
                <DropdownMenuRadioItem key={o.id} value={o.id}>
                  {t(`creators.${o.labelKey}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter rail */}
      {showFilters && (
        <div className="space-y-2.5 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelectFilter
              label={t("creators.filterCountry")}
              options={countryOptions}
              selected={filters.countries}
              onChange={(v) => set("countries", v)}
              searchable
            />
            <MultiSelectFilter
              label={t("creators.filterKeyword")}
              options={keywordOptions}
              selected={filters.keywords}
              onChange={(v) => set("keywords", v)}
              searchable
            />
            <MultiSelectFilter
              label={t("creators.filterStatus")}
              options={statusOptions}
              selected={filters.statuses}
              onChange={(v) => set("statuses", v)}
            />
            <NumberFilter
              label={t("creators.filterAvgViews")}
              value={filters.minAvgViews}
              onChange={(v) => set("minAvgViews", v)}
              placeholder="1000"
              presets={[500, 1000, 5000, 10000]}
            />
            <NumberFilter
              label={t("creators.filterMedianViews")}
              value={filters.minMedianViews}
              onChange={(v) => set("minMedianViews", v)}
              placeholder="500"
              presets={[250, 500, 2000]}
            />
            <NumberFilter
              label={t("creators.filterScore")}
              value={filters.minScore}
              onChange={(v) => set("minScore", v)}
              placeholder="60"
              presets={[50, 70, 85]}
            />
            <NumberFilter
              label={t("creators.filterRatio")}
              value={filters.minRatio}
              onChange={(v) => set("minRatio", v)}
              suffix="×"
              placeholder="1.5"
              presets={[1, 1.5, 3]}
            />
            <NumberFilter
              label={t("creators.filterUploadedWithin")}
              value={filters.uploadedWithinDays}
              onChange={(v) => set("uploadedWithinDays", v)}
              suffix="d"
              placeholder="30"
              presets={[7, 30, 90]}
            />

            <Button
              variant={filters.risingOnly ? "secondary" : "outline"}
              size="sm"
              className={cn("h-8 gap-1.5 text-[13px]", !filters.risingOnly && "border-dashed")}
              onClick={() => set("risingOnly", !filters.risingOnly)}
            >
              <Flame className="h-3.5 w-3.5" />
              {t("creators.rising")}
            </Button>

            <SegmentedFilter
              label={t("creators.filterEmail")}
              value={filters.email}
              onChange={(v) => set("email", v)}
              options={[
                { value: "any", label: t("creators.contactAny") },
                { value: "yes", label: t("creators.contactAvailable") },
                { value: "no", label: t("creators.contactMissing") },
              ]}
            />
            <SegmentedFilter
              label={t("creators.filterAnalyzed")}
              value={filters.analyzed}
              onChange={(v) => set("analyzed", v)}
              options={[
                { value: "any", label: t("creators.contactAny") },
                { value: "yes", label: t("creators.analyzedYes") },
                { value: "no", label: t("creators.analyzedNo") },
              ]}
            />

            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setPage(1);
                }}
              >
                <X className="h-3.5 w-3.5" />
                {t("common.reset")}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
            <span className="mr-1 text-xs text-muted-foreground">
              {t("creators.subscriberRange")}
            </span>
            {SUBSCRIBER_BUCKETS.map((b) => {
              const active = filters.subscriberBuckets.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() =>
                    set(
                      "subscriberBuckets",
                      active
                        ? filters.subscriberBuckets.filter((x) => x !== b.id)
                        : [...filters.subscriberBuckets, b.id]
                    )
                  }
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {"labelKey" in b ? t(b.labelKey as string) : b.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {t("creators.matchCount", {
            shown: filtered.length,
            total: creators.length,
          })}
        </span>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("common.clearSelection", { count: selected.size })}
          </button>
        )}
      </div>

      {busy ? (
        <CreatorsTableSkeleton rows={Math.min(pageSize, 8)} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("creators.emptyTitle")}
          description={t("creators.emptyBody")}
          action={
            <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
              {t("common.resetFilters")}
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <CreatorsTable
              rows={rows}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onChanged={refresh}
            />
          </div>
          <div className="md:hidden">
            <CreatorCardList
              rows={rows}
              selected={selected}
              onToggle={toggle}
              onChanged={refresh}
            />
          </div>

          <Pagination
            page={safePage}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-popover/95 p-2 shadow-2xl backdrop-blur">
            <span className="px-2 text-[13px] font-medium tabular">
              {t("common.selected", { count: selected.size })}
            </span>
            <span className="h-5 w-px bg-border" />
            <Button variant="ghost" size="sm" onClick={() => setListOpen(true)}>
              <ListPlus />
              {t("creators.bulkAddToList")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCampaignOpen(true)}>
              <Megaphone />
              {t("creators.bulkAddToCampaign")}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void bulkAnalyze()}>
              <BarChart3 />
              {t("creators.analyzeVideos")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void bulkStatus("qualified", "toast.bulkQualified")}
            >
              <ThumbsUp />
              {t("creators.bulkQualify")}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setRejectOpen(true)}>
              <ThumbsDown />
              {t("creators.bulkReject")}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSelected(new Set())}
              aria-label={t("common.clearSelection", { count: selected.size })}
            >
              <X />
            </Button>
          </div>
        </div>
      )}

      <AddToListDialog
        open={listOpen}
        onOpenChange={setListOpen}
        creatorIds={[...selected]}
        onDone={() => { setSelected(new Set()); refresh(); }}
      />
      <AddToCampaignDialog
        open={campaignOpen}
        onOpenChange={setCampaignOpen}
        creatorIds={[...selected]}
        onDone={() => { setSelected(new Set()); refresh(); }}
      />
      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={t("dialogs.rejectBulkTitle", { count: selected.size })}
        description={t("dialogs.rejectBulkBody")}
        confirmLabel={t("creators.markRejected")}
        destructive
        onConfirm={() => void bulkStatus("rejected", "toast.bulkRejected")}
      />
    </div>
  );
}
